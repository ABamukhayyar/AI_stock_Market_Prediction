"""
SentimentAnalyzer — fetches TASI-related news from Google News RSS,
translates Arabic headlines, and scores sentiment using a hybrid
Arabic financial lexicon + FinBERT approach.

Extracted from TASI_Sentiment.ipynb and adapted for local use.
Models are cached in models/ directory on first run.
"""

import os
import warnings
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

warnings.filterwarnings("ignore")

MODEL_DIR = Path(__file__).resolve().parent.parent / "models"

# ======================================================================
# RSS Feed Configuration
# ======================================================================

RSS_FEEDS = [
    # Arabic
    {"url": "https://news.google.com/rss/search?q=تاسي+سوق+الأسهم+السعودية&hl=ar&gl=SA&ceid=SA:ar", "lang": "ar", "priority": 10},
    {"url": "https://news.google.com/rss/search?q=مؤشر+تداول+اليوم&hl=ar&gl=SA&ceid=SA:ar", "lang": "ar", "priority": 10},
    {"url": "https://news.google.com/rss/search?q=سوق+الأسهم+السعودي+اليوم&hl=ar&gl=SA&ceid=SA:ar", "lang": "ar", "priority": 10},
    {"url": "https://news.google.com/rss/search?q=اقتصاد+السعودية+أسهم&hl=ar&gl=SA&ceid=SA:ar", "lang": "ar", "priority": 9},
    {"url": "https://news.google.com/rss/search?q=أرامكو+سابك+بنوك+سعودية&hl=ar&gl=SA&ceid=SA:ar", "lang": "ar", "priority": 9},
    {"url": "https://news.google.com/rss/search?q=البنوك+السعودية+أرباح&hl=ar&gl=SA&ceid=SA:ar", "lang": "ar", "priority": 8},
    {"url": "https://news.google.com/rss/search?q=النفط+أسعار+أوبك+السعودية&hl=ar&gl=SA&ceid=SA:ar", "lang": "ar", "priority": 8},
    {"url": "https://news.google.com/rss/search?q=تداول+ارتفاع+انخفاض+مؤشر&hl=ar&gl=SA&ceid=SA:ar", "lang": "ar", "priority": 7},
    # English
    {"url": "https://news.google.com/rss/search?q=TASI+Tadawul+Saudi+stock&hl=en-US&gl=US&ceid=US:en", "lang": "en", "priority": 10},
    {"url": "https://news.google.com/rss/search?q=Saudi+stock+market+today&hl=en-US&gl=US&ceid=US:en", "lang": "en", "priority": 10},
    {"url": "https://news.google.com/rss/search?q=Tadawul+index+Saudi+Arabia&hl=en-US&gl=US&ceid=US:en", "lang": "en", "priority": 10},
    {"url": "https://news.google.com/rss/search?q=Saudi+Arabia+economy+investment&hl=en-US&gl=US&ceid=US:en", "lang": "en", "priority": 9},
    {"url": "https://news.google.com/rss/search?q=Aramco+stock+Saudi+earnings&hl=en-US&gl=US&ceid=US:en", "lang": "en", "priority": 9},
    {"url": "https://news.google.com/rss/search?q=OPEC+oil+price+Saudi+Arabia&hl=en-US&gl=US&ceid=US:en", "lang": "en", "priority": 8},
    {"url": "https://news.google.com/rss/search?q=Saudi+Vision+2030+economy+growth&hl=en-US&gl=US&ceid=US:en", "lang": "en", "priority": 8},
    {"url": "https://news.google.com/rss/search?q=Saudi+banks+finance+market&hl=en-US&gl=US&ceid=US:en", "lang": "en", "priority": 7},
    {"url": "https://news.google.com/rss/search?q=Middle+East+Gulf+stock+market&hl=en-US&gl=US&ceid=US:en", "lang": "en", "priority": 6},
]

KEYWORDS_AR = [
    "تاسي", "تداول", "سوق الأسهم", "الأسهم السعودية", "أرامكو", "سابك",
    "اقتصاد", "رؤية 2030", "النفط", "مؤشر", "بنوك", "ربح", "ارتفاع", "انخفاض",
]
KEYWORDS_EN = [
    "TASI", "Tadawul", "Saudi stock", "Saudi market", "Aramco", "SABIC",
    "Saudi Arabia", "Vision 2030", "OPEC", "oil price", "Saudi banks",
    "Riyadh", "Saudi economy", "Gulf market",
]

MUST_SAUDI_AR = [
    "تاسي", "تداول", "الأسهم السعودية", "السوق السعودية",
    "سوق الأسهم السعودية", "أرامكو", "سابك", "السعودية",
]
MUST_SAUDI_EN = ["TASI", "Tadawul", "Saudi", "Aramco", "SABIC", "Riyadh", "Gulf"]

# ======================================================================
# Arabic Financial Lexicon
# ======================================================================

ARABIC_LEXICON = {
    # Bullish +2
    "ارتفع": 2, "ارتفاع": 2, "ارتفاعا": 2, "ارتفاعاً": 2,
    "يرتفع": 2, "ترتفع": 2, "مرتفع": 2, "مرتفعا": 2, "مرتفعاً": 2, "مرتفعة": 2,
    "صعود": 2, "يصعد": 2, "تصعد": 2, "صعد": 2,
    "مكاسب": 2, "ربح": 2, "يربح": 2, "تربح": 2, "أرباح": 2,
    "نمو": 2, "ينمو": 2, "تنمو": 2,
    "قفز": 2, "يقفز": 2, "تقفز": 2,
    "تحسن": 2, "إيجابي": 2, "إيجابية": 2, "إيجابياً": 2,
    "تعافى": 2, "تعافي": 2, "انتعاش": 2, "ينتعش": 2, "تنتعش": 2,
    "يحقق": 2, "تحقق": 2, "يسجل": 2, "تسجل": 2, "سجل": 2,
    "يكسب": 2, "تكسب": 2, "مكسب": 2, "يعوض": 1,
    # Bullish +1
    "دعم": 1, "مستقر": 1, "قوي": 1, "متماسك": 1,
    # Neutral
    "يغلق": 0, "تغلق": 0, "أغلق": 0, "ينهي": 0, "تنهي": 0,
    # Bearish -2
    "انخفض": -2, "انخفاض": -2, "انخفاضا": -2, "انخفاضاً": -2,
    "ينخفض": -2, "تنخفض": -2,
    "هبوط": -2, "يهبط": -2, "تهبط": -2, "هبط": -2,
    "خسارة": -2, "خسائر": -2, "يخسر": -2, "تخسر": -2,
    "تراجع": -2, "يتراجع": -2, "تتراجع": -2,
    "سقط": -2, "سقوط": -2, "يسقط": -2,
    "تدهور": -2, "انهيار": -2,
    # Bearish -1
    "ضغوط": -1, "مخاوف": -1, "توترات": -1, "تذبذب": -1,
    "تقلب": -1, "ضعيف": -1, "قلق": -1, "مخاطر": -1, "ضغط": -1,
}


# ======================================================================
# SentimentAnalyzer
# ======================================================================

class SentimentAnalyzer:
    """Fetches TASI news and scores sentiment using lexicon + FinBERT."""

    def __init__(self, model_dir: str = None):
        self.model_dir = Path(model_dir) if model_dir else MODEL_DIR
        self.model_dir.mkdir(parents=True, exist_ok=True)
        self._translator = None
        self._tokenizer = None
        self._finbert = None
        self._device = None

    # ------------------------------------------------------------------
    # Lazy model loading
    # ------------------------------------------------------------------

    def _load_models(self):
        """Load translation and FinBERT models (downloads on first run)."""
        if self._finbert is not None:
            return

        from transformers import pipeline, MarianMTModel, MarianTokenizer
        import torch

        self._device = 0 if torch.cuda.is_available() else -1
        device_label = "GPU" if self._device == 0 else "CPU"
        print(f"[Sentiment] Using: {device_label}")

        translate_dir = self.model_dir / "opus-mt-ar-en"
        finbert_dir = self.model_dir / "finbert"

        # Arabic -> English translation model
        if (translate_dir / "config.json").exists():
            print("[Sentiment] Loading translation model from cache...")
            self._tokenizer = MarianTokenizer.from_pretrained(str(translate_dir))
            self._translator = MarianMTModel.from_pretrained(str(translate_dir))
        else:
            print("[Sentiment] Downloading translation model (~300 MB, first time only)...")
            self._tokenizer = MarianTokenizer.from_pretrained("Helsinki-NLP/opus-mt-ar-en")
            self._translator = MarianMTModel.from_pretrained("Helsinki-NLP/opus-mt-ar-en")
            self._tokenizer.save_pretrained(str(translate_dir))
            self._translator.save_pretrained(str(translate_dir))
            print("[Sentiment] Translation model saved to cache")

        if self._device == 0:
            self._translator = self._translator.cuda()

        # FinBERT financial sentiment model
        if (finbert_dir / "config.json").exists():
            print("[Sentiment] Loading FinBERT from cache...")
            self._finbert = pipeline(
                "text-classification", model=str(finbert_dir),
                device=self._device, truncation=True, max_length=512,
            )
        else:
            print("[Sentiment] Downloading FinBERT (~440 MB, first time only)...")
            self._finbert = pipeline(
                "text-classification", model="ProsusAI/finbert",
                device=self._device, truncation=True, max_length=512,
            )
            self._finbert.model.save_pretrained(str(finbert_dir))
            self._finbert.tokenizer.save_pretrained(str(finbert_dir))
            print("[Sentiment] FinBERT saved to cache")

        print("[Sentiment] Models ready")

    # ------------------------------------------------------------------
    # Translation
    # ------------------------------------------------------------------

    def _translate_ar_to_en(self, text: str) -> str:
        """Translate Arabic text to English."""
        try:
            tokens = self._tokenizer(
                [text[:400]], return_tensors="pt",
                padding=True, truncation=True, max_length=128,
            )
            if self._device == 0:
                tokens = {k: v.cuda() for k, v in tokens.items()}
            translated = self._translator.generate(**tokens, max_new_tokens=128)
            return self._tokenizer.decode(translated[0], skip_special_tokens=True)
        except Exception:
            return text

    # ------------------------------------------------------------------
    # Scoring
    # ------------------------------------------------------------------

    @staticmethod
    def _normalize_arabic(word: str) -> str:
        """Strip punctuation, diacritics, and definite article for lexicon lookup."""
        w = word.strip("\u00ab\u00bb\u060c,.'\"()[]{};\u061b")
        diacritics = "\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652\u0653\u0654\u0655"
        for d in diacritics:
            w = w.replace(d, "")
        if w.startswith("\u0627\u0644") and len(w) > 3:
            w = w[2:]
        return w

    @staticmethod
    def _score_arabic_lexicon(text: str) -> float | None:
        """Score text using Arabic financial lexicon. Returns -1 to 1 or None."""
        words = text.split()
        total, hits = 0, 0
        for word in words:
            w = SentimentAnalyzer._normalize_arabic(word)
            if w in ARABIC_LEXICON:
                val = ARABIC_LEXICON[w]
                if val != 0:
                    total += val
                    hits += 1
        if hits == 0:
            return None
        return max(-1.0, min(1.0, total / (hits * 2)))

    def _score_finbert(self, text: str) -> float:
        """Score text using FinBERT. Returns -1 to 1."""
        try:
            result = self._finbert(text[:512])[0]
            label = result["label"].lower()
            conf = result["score"]
            if label == "positive":
                return conf
            elif label == "negative":
                return -conf
            else:
                return 0.0
        except Exception:
            return 0.0

    # ------------------------------------------------------------------
    # News fetching
    # ------------------------------------------------------------------

    @staticmethod
    def _fetch_articles(days: int = 3) -> list[dict]:
        """Fetch TASI-related news articles from Google News RSS."""
        import feedparser
        import httpx
        from bs4 import BeautifulSoup

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept-Language": "ar,en;q=0.9",
        }

        def clean_html(text):
            if text and "<" in text:
                return BeautifulSoup(text, "lxml").get_text(separator=" ").strip()
            return text or ""

        def is_recent(entry):
            cutoff = datetime.now(timezone.utc) - timedelta(days=days)
            for attr in ("published_parsed", "updated_parsed"):
                t = getattr(entry, attr, None)
                if t:
                    try:
                        return datetime(*t[:6], tzinfo=timezone.utc) >= cutoff
                    except Exception:
                        pass
            return True

        all_articles = []
        for cfg in RSS_FEEDS:
            try:
                with httpx.Client(timeout=20, follow_redirects=True, headers=headers) as client:
                    resp = client.get(cfg["url"])
                feed = feedparser.parse(resp.text)
                count = 0
                for e in feed.entries:
                    if not is_recent(e):
                        continue
                    title = getattr(e, "title", "").strip()
                    summary = clean_html(getattr(e, "summary", ""))
                    text = (title + " " + summary).lower()

                    kws = KEYWORDS_AR if cfg["lang"] == "ar" else KEYWORDS_EN
                    must_list = MUST_SAUDI_AR if cfg["lang"] == "ar" else MUST_SAUDI_EN

                    if (len(title) >= 10
                            and any(k.lower() in text for k in kws)
                            and any(m.lower() in text for m in must_list)):
                        all_articles.append({
                            "title": title,
                            "summary": summary[:400],
                            "lang": cfg["lang"],
                            "priority": cfg["priority"],
                        })
                        count += 1
                print(f"  [{cfg['lang'].upper()}] {count} articles")
            except Exception as ex:
                print(f"  Failed: {ex}")

        # Deduplicate and keep top 40 by priority
        seen, unique = set(), []
        for a in sorted(all_articles, key=lambda x: -x["priority"]):
            key = a["title"][:60].lower()
            if key not in seen:
                seen.add(key)
                unique.append(a)
        return unique[:40]

    # ------------------------------------------------------------------
    # Main analysis
    # ------------------------------------------------------------------

    def analyze(self, days: int = 3, verbose: bool = True) -> dict:
        """Fetch news and compute sentiment score.

        Returns dict with: score, confidence, sentiment_label, sentiment_encoded,
        positive_articles, negative_articles, neutral_articles, total_articles,
        data_quality, date, articles (list of scored articles).
        """
        if verbose:
            print("[Sentiment] Fetching news articles...")
        articles = self._fetch_articles(days=days)

        ar_count = sum(1 for a in articles if a["lang"] == "ar")
        en_count = sum(1 for a in articles if a["lang"] == "en")

        if verbose:
            print(f"[Sentiment] Found {len(articles)} articles "
                  f"(AR: {ar_count}, EN: {en_count})")

        if len(articles) < 1:
            print("[Sentiment] No articles found — returning neutral")
            return self._neutral_result()

        # Load models (lazy, first call downloads them)
        self._load_models()

        if verbose:
            print(f"[Sentiment] Scoring {len(articles)} articles...")

        scores = []
        scored_articles = []

        for i, article in enumerate(articles):
            title = article["title"]
            summary = article["summary"]

            if article["lang"] == "ar":
                title_en = self._translate_ar_to_en(title)
                summary_en = self._translate_ar_to_en(summary) if summary.strip() else ""
                lex_score = self._score_arabic_lexicon(title + " " + summary)
                fin_score = self._score_finbert(title_en + " " + summary_en)
                if lex_score is not None:
                    raw_score = (lex_score * 0.6) + (fin_score * 0.4)
                    method = f"Hybrid lex={lex_score:.2f} fin={fin_score:.2f}"
                else:
                    raw_score = fin_score
                    method = "FinBERT only"
            else:
                title_en = title
                raw_score = self._score_finbert(title + " " + summary)
                method = "FinBERT"

            scores.append(raw_score)
            label = "Positive" if raw_score > 0.1 else "Negative" if raw_score < -0.1 else "Neutral"
            scored_articles.append({
                "title": title[:80],
                "translated": title_en[:80] if article["lang"] == "ar" else "",
                "lang": article["lang"],
                "method": method,
                "score": round(raw_score, 3),
                "signal": label,
            })

            if verbose:
                print(f"  [{i+1:02d}] {article['lang'].upper()} | "
                      f"{label:<8} ({raw_score:+.2f}) | {method}")

        # Aggregate
        mean_score = np.mean(scores) if scores else 0
        final_score = int(mean_score * 100)
        final_score = max(-100, min(100, final_score))
        confidence = int(np.mean([abs(s) for s in scores]) * 100) if scores else 0
        positive_count = sum(1 for s in scores if s > 0.1)
        negative_count = sum(1 for s in scores if s < -0.1)
        neutral_count = len(scores) - positive_count - negative_count

        if final_score > 15:
            sentiment_label = "Bullish"
        elif final_score < -15:
            sentiment_label = "Bearish"
        else:
            sentiment_label = "Neutral"

        if confidence > 55:
            data_quality = "High"
        elif confidence > 30:
            data_quality = "Medium"
        else:
            data_quality = "Low"

        result = {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "score": final_score,
            "confidence": confidence,
            "sentiment_label": sentiment_label,
            "sentiment_encoded": 1 if sentiment_label == "Bullish" else -1 if sentiment_label == "Bearish" else 0,
            "magnitude": abs(final_score),
            "positive_articles": positive_count,
            "negative_articles": negative_count,
            "neutral_articles": neutral_count,
            "total_articles": len(articles),
            "data_quality": data_quality,
            "source": "google_news_rss",
            "articles": scored_articles,
        }

        if verbose:
            print(f"\n{'='*50}")
            print(f"  Overall   : {sentiment_label}")
            print(f"  Score     : {final_score} / 100")
            print(f"  Confidence: {confidence}%")
            print(f"  Articles  : +{positive_count} / -{negative_count} / ~{neutral_count}")
            print(f"  Quality   : {data_quality}")
            print(f"{'='*50}")

        return result

    def analyze_and_store(self, symbol: str = "TASI", days: int = 3) -> dict:
        """Run analysis and store results in Supabase."""
        from db.supabase_client import upsert_sentiment

        result = self.analyze(days=days)
        upsert_sentiment(result, symbol=symbol)
        print(f"[Sentiment] Stored in Supabase for {result['date']}")
        return result

    @staticmethod
    def _neutral_result() -> dict:
        """Return a neutral sentiment result (no articles found)."""
        return {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "score": 0,
            "confidence": 0,
            "sentiment_label": "Neutral",
            "sentiment_encoded": 0,
            "magnitude": 0,
            "positive_articles": 0,
            "negative_articles": 0,
            "neutral_articles": 0,
            "total_articles": 0,
            "data_quality": "Low",
            "source": "google_news_rss",
            "articles": [],
        }
