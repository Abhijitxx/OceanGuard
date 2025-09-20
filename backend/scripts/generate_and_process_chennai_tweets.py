"""
Generate ~100 synthetic tweets focused on Chennai, save to JSON, insert into `raw_reports`,
and process them through the project's ML pipeline.

Usage:
  - Ensure DATABASE_URL is set and reachable (or the project's DB manager is configured).
  - From repo root run: python backend/scripts/generate_and_process_chennai_tweets.py

The script will create `backend/data/chennai_tweets.json` containing all generated tweets.
If the DB isn't configured it will still write the JSON and exit with instructions.
"""
import os
import json
import random
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import SQLAlchemyError

# Import project DB helpers and models
from database import db_manager
from models import RawReport
from services.ingest import ProcessingPipeline

# Note: this script will no longer write JSON to disk. It will only insert generated
# tweets into the database and process them through the ML pipeline.

# Chennai bounding box / important places (approx)
LAT_MIN, LAT_MAX = 12.800000, 13.200000
LON_MIN, LON_MAX = 80.100000, 80.400000

PLACES = [
    'Marina Beach', 'Besant Nagar', 'Adyar', 'Anna Nagar', 'T. Nagar', 'Velachery',
    'Mylapore', 'Royapettah', 'Egmore', 'Guindy', 'Kodambakkam', 'Pallavaram',
    'Chromepet', 'Triplicane', 'Chengalpattu Road', 'Porur', 'Pulicat Lake', 'Kotturpuram'
]

TEMPLATES = [
    "Water entering houses near {place}. Immediate help needed.",
    "Huge waves observed at {place}, sea looks dangerous.",
    "Roads submerged at {place} after heavy rain, cars stuck.",
    "Unusual high tide at {place}, water level rising.",
    "Landslide reported near {place} after continuous rains.",
    "Strong winds and flooding near {place}, people evacuating.",
    "Small boat capsized off {place}, rescue teams required.",
    "Coastal erosion visible at {place}, structures damaged.",
    "Overflow observed in canal near {place}, do not cross.",
    "Storm surge reported close to {place}, take precautions."
]

NUM = 100

def generate_tweets(num=NUM):
    now = datetime.now(timezone.utc)
    tweets = []

    for i in range(num):
        lat = round(random.uniform(LAT_MIN, LAT_MAX), 6)
        lon = round(random.uniform(LON_MIN, LON_MAX), 6)
        place = random.choice(PLACES)
        text = random.choice(TEMPLATES).format(place=place)
        hashtags = random.choice([" #flood", " #tide", " #storm", " #help", ""])
        text = text + hashtags

        tweet = {
            'social_id': f"tweet_{uuid.uuid4()}",
            'social_platform': 'twitter',
            'social_username': random.choice(['chennai_watch', 'citizen_rpt', 'rescue_chennai', 'local_reporter']),
            'text': text,
            'lat': lat,
            'lon': lon,
            'timestamp': (now - timedelta(minutes=random.randint(0, 1440))).isoformat(),
            'media_path': None,
            'has_media': False
        }

        tweets.append(tweet)

    return tweets


def save_json(tweets, path=None):
    # Intentionally no-op to keep compatibility for callers that expect this function.
    # We print a short message to indicate the tweets were generated in-memory.
    print(f"Generated {len(tweets)} tweets in memory (not saving to disk as requested)")


def process_tweets_into_db(tweets):
    # Verify DB availability
    if not getattr(db_manager, 'engine', None) or not getattr(db_manager, 'SessionLocal', None):
        print("DB not configured for SQLAlchemy in this environment. Skipping DB insert/processing.")
        print("To run processing, ensure DATABASE_URL is set and restart. See backend/README or set env var and run again.")
        return

    Session = db_manager.SessionLocal
    pipeline = ProcessingPipeline()
    results = []

    with Session() as db:
        try:
            inserted_ids = []
            for t in tweets:
                # Convert ISO timestamp back to datetime
                try:
                    ts = datetime.fromisoformat(t['timestamp'])
                except Exception:
                    ts = datetime.now(timezone.utc)

                report = RawReport(
                    source='social',
                    text=t['text'],
                    lat=t['lat'],
                    lon=t['lon'],
                    media_path=t.get('media_path'),
                    has_media=bool(t.get('has_media')),
                    media_verified=False,
                    media_confidence=None,
                    processed=False,
                    nlp_type=None,
                    nlp_conf=None,
                    credibility=None,
                    group_id=None,
                    user_id=None,
                    user_name=t.get('social_username'),
                    user_session_id=None,
                    timestamp=ts,
                    social_id=t.get('social_id')
                )

                db.add(report)
                db.flush()
                inserted_ids.append(report.id)

            db.commit()
            print(f"Inserted {len(inserted_ids)} tweets into raw_reports. Processing through ML pipeline...")

            for rid in inserted_ids:
                ok = pipeline.process_single_report(rid, db)
                report = db.query(RawReport).filter(RawReport.id == rid).one()
                fusion = pipeline._process_group_fusion(report.group_id, db) if report.group_id else None

                results.append({
                    'id': str(rid),
                    'nlp_type': getattr(report, 'nlp_type', None),
                    'nlp_conf': float(getattr(report, 'nlp_conf', 0)) if getattr(report, 'nlp_conf', None) is not None else None,
                    'credibility': float(getattr(report, 'credibility', 0)) if getattr(report, 'credibility', None) is not None else None,
                    'group_id': report.group_id,
                    'group_confidence': float(getattr(fusion, 'confidence', 0)) if fusion else None,
                    'processed_ok': bool(ok)
                })

            # Print summary
            print('\n=== Processing Summary ===')
            for r in results:
                print(f"Report {r['id']} → NLP: {r['nlp_type']} (nlp_conf={r['nlp_conf']}) | credibility={r['credibility']} | group={r['group_id']} | group_conf={r['group_confidence']} | processed={r['processed_ok']}")

            processed = sum(1 for r in results if r['processed_ok'])
            avg_nlp = sum(r['nlp_conf'] for r in results if r['nlp_conf']) / max(1, sum(1 for r in results if r['nlp_conf']))
            avg_cred = sum(r['credibility'] for r in results if r['credibility']) / max(1, sum(1 for r in results if r['credibility']))
            avg_group_conf = sum(r['group_confidence'] for r in results if r['group_confidence']) / max(1, sum(1 for r in results if r['group_confidence']))

            print('\n=== Aggregate ===')
            print(f"Processed reports: {processed}/{len(results)}")
            print(f"Average NLP confidence (where available): {avg_nlp:.3f}")
            print(f"Average credibility (where available): {avg_cred:.3f}")
            print(f"Average group confidence (where available): {avg_group_conf:.3f}")

        except SQLAlchemyError as e:
            print(f"Database error: {e}")
            db.rollback()
        except Exception as e:
            print(f"Error during processing: {e}")
            db.rollback()
            raise


def main():
    tweets = generate_tweets()
    # Do not write JSON to disk; directly insert/process in DB
    save_json(tweets)  # no-op message
    process_tweets_into_db(tweets)


if __name__ == '__main__':
    main()
