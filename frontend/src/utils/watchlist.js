const WATCHLIST_STORAGE_KEY = 'watchlist';
const WATCHLIST_EVENT = 'watchlist-changed';

function normalize(ids) {
  return Array.from(new Set(ids.filter(Boolean).map(String)));
}

export function getWatchlistIds() {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return [];
    return normalize(JSON.parse(raw));
  } catch {
    return [];
  }
}

function save(ids) {
  if (typeof window === 'undefined') return;

  const next = normalize(ids);
  window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(WATCHLIST_EVENT, { detail: next }));
}

export function isInWatchlist(id) {
  return getWatchlistIds().includes(String(id));
}

export function addToWatchlist(id) {
  save([...getWatchlistIds(), id]);
}

export function removeFromWatchlist(id) {
  save(getWatchlistIds().filter((value) => value !== String(id)));
}

export function toggleWatchlist(id) {
  if (isInWatchlist(id)) {
    removeFromWatchlist(id);
    return false;
  }

  addToWatchlist(id);
  return true;
}

export function subscribeToWatchlist(callback) {
  if (typeof window === 'undefined') return () => {};

  const handleCustom = (event) => {
    callback(event.detail || getWatchlistIds());
  };

  const handleStorage = (event) => {
    if (event.key === WATCHLIST_STORAGE_KEY) {
      callback(getWatchlistIds());
    }
  };

  window.addEventListener(WATCHLIST_EVENT, handleCustom);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(WATCHLIST_EVENT, handleCustom);
    window.removeEventListener('storage', handleStorage);
  };
}
