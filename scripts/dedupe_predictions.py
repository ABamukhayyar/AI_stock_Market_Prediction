"""
One-shot cleanup: collapse duplicate ai_predictions rows for the same
(model_id, symbol, target_date) down to a single row — the most recent one
by execution_date / prediction_id. Cascades the cleanup to model_accuracy_log
so the Past Predictions panel stops showing N copies of the same date.

Background: insert_prediction() was a plain insert until the upsert fix
landed, so any rerun of predict.py for the same target_date appended a
duplicate row. The deterministic CNN model produced identical predicted
values on reruns with the same input window, which is why the Past
Predictions panel saw 9 rows of 11019.20 for 2026-05-17 on TASI.

Safe to re-run — it only acts on groups with > 1 row.

Usage:
    python scripts/dedupe_predictions.py           # actually delete
    python scripts/dedupe_predictions.py --dry-run # report only, no writes
"""

import argparse
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db.supabase_client import get_client


def main(dry_run: bool) -> None:
    sb = get_client()

    print("[INFO] Fetching all ai_predictions rows...")
    preds = sb.table("ai_predictions").select(
        "prediction_id,model_id,symbol,target_date,execution_date"
    ).execute().data
    print(f"[INFO] {len(preds)} total predictions")

    # Group by (model_id, symbol, target_date)
    groups = defaultdict(list)
    for p in preds:
        key = (p["model_id"], p["symbol"], p["target_date"])
        groups[key].append(p)

    dup_groups = {k: v for k, v in groups.items() if len(v) > 1}
    print(f"[INFO] {len(dup_groups)} (model_id, symbol, target_date) "
          f"groups have duplicates")

    if not dup_groups:
        print("[INFO] Nothing to clean. Done.")
        return

    # For each duplicate group, pick the survivor (latest execution_date,
    # ties broken by highest prediction_id) and mark the rest for deletion.
    to_delete_pred_ids = []
    for key, rows in dup_groups.items():
        rows.sort(
            key=lambda r: (r["execution_date"] or "", r["prediction_id"]),
            reverse=True,
        )
        survivor = rows[0]
        losers = rows[1:]
        to_delete_pred_ids.extend(r["prediction_id"] for r in losers)
        print(f"  {key} -> keep prediction_id={survivor['prediction_id']}, "
              f"remove {len(losers)} dupe(s)")

    print(f"[INFO] {len(to_delete_pred_ids)} ai_predictions rows "
          f"will be removed")

    # Find the corresponding model_accuracy_log rows so we can report and
    # delete them too (the FK from log → prediction would otherwise orphan).
    logs = sb.table("model_accuracy_log").select("log_id,prediction_id").in_(
        "prediction_id", to_delete_pred_ids
    ).execute().data if to_delete_pred_ids else []
    log_ids = [l["log_id"] for l in logs]
    print(f"[INFO] {len(log_ids)} model_accuracy_log rows will be removed")

    if dry_run:
        print("[DRY-RUN] No writes performed.")
        return

    if log_ids:
        sb.table("model_accuracy_log").delete().in_("log_id", log_ids).execute()
        print(f"[INFO] Deleted {len(log_ids)} model_accuracy_log rows")

    # Chunk the prediction deletes — PostgREST has a URL length cap on .in_()
    chunk = 100
    deleted = 0
    for i in range(0, len(to_delete_pred_ids), chunk):
        batch = to_delete_pred_ids[i:i + chunk]
        sb.table("ai_predictions").delete().in_("prediction_id", batch).execute()
        deleted += len(batch)
    print(f"[INFO] Deleted {deleted} ai_predictions rows")
    print("[INFO] Cleanup complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="Report what would be deleted without writing.")
    args = parser.parse_args()
    main(dry_run=args.dry_run)
