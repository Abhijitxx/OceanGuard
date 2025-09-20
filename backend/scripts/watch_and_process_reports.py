"""Watch Supabase `raw_reports` for new unprocessed reports and process them in near-real-time.

Usage:
  $env:PYTHONPATH = ".../backend"; python backend/scripts/watch_and_process_reports.py

This script polls Supabase for rows where processed=false and calls process_report_supabase
from the simulation module so the pipeline (NLP, credibility, dedupe, fusion) runs and hazard
events are created/updated. It includes a run_id tag option and simple backoff.
"""

import time
import uuid
from datetime import datetime, timezone

from database import get_supabase

# Reuse the processing function in the simulation script
from simulate_confidence_progression import process_report_supabase


supabase = get_supabase()


def watch(interval_seconds: float = 3.0):
    print('Starting watch loop; polling every', interval_seconds, 'seconds')
    backoff = interval_seconds
    try:
        while True:
            try:
                resp = supabase.table('raw_reports').select('*').eq('processed', False).limit(20).execute()
                new_reports = resp.data or []
                if new_reports:
                    for r in new_reports:
                        rid = r.get('id')
                        print(f"Found unprocessed report {rid} (source={r.get('source')}). Processing...")
                        try:
                            group_id = process_report_supabase(rid)
                            print(f"Processed report {rid}; assigned group {group_id}")
                        except Exception as e:
                            print('Error processing report', rid, e)
                    # reset backoff when we processed items
                    backoff = interval_seconds
                else:
                    # no new reports
                    pass

            except Exception as e:
                print('Watch loop error:', e)
                # exponential backoff up to 60s
                backoff = min(60, backoff * 2)

            time.sleep(backoff)
    except KeyboardInterrupt:
        print('Watcher stopped by user')


if __name__ == '__main__':
    watch()
