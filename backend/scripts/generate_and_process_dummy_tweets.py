"""
Generate dummy social posts (tweets) around Tamil Nadu, insert them into `raw_reports`,
process them through the ML pipeline, and print a clear summary with confidence scores.

Usage:
  - Ensure your environment has DATABASE_URL set and the database is reachable.
  - From repository root run: python backend/scripts/generate_and_process_dummy_tweets.py

This script requires the project's SQLAlchemy models and the ProcessingPipeline to be
able to use the same database (DATABASE_URL). If DATABASE_URL is not set or the
SQLAlchemy engine is not initialized, the script will abort with instructions.
"""
import os
import random
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import SQLAlchemyError

# Import project DB helpers and models
from database import db_manager
from models import RawReport, HazardEvent
from services.ingest import ProcessingPipeline

# Make sure DB engine/session is available
if not getattr(db_manager, 'engine', None) or not getattr(db_manager, 'SessionLocal', None):
    print("ERROR: SQLAlchemy engine/session not initialized. Make sure DATABASE_URL is set in your environment and restart.")
    print("Set DATABASE_URL to your Postgres connection string (e.g. postgresql://user:pass@host:port/dbname)")
    raise SystemExit(1)

Session = db_manager.SessionLocal
pipeline = ProcessingPipeline()

# Tamil Nadu bounding box roughly: lat 8.0 to 13.5, lon 76.0 to 80.5
LAT_MIN, LAT_MAX = 8.0, 13.5
LON_MIN, LON_MAX = 76.0, 80.5

# Example templates focusing on coastal hazards
TEMPLATES = [
    "Heavy flooding near {place}, water entering houses, immediate assistance needed.",
    "Huge waves near {place}, sea looks violent. People are scared.",
    "Roads submerged at {place} after heavy rain. Vehicles stuck.",
    "Unusual tide level observed at {place}, water higher than normal.",
    "Landslide reported near {place} after continuous rains, debris on road.",
    "Strong tremors felt in {place}, buildings shaking and people evacuated.",
    "Coastal erosion increasing near {place}, fence washed away by waves.",
    "Water has entered the beach promenade at {place}, please avoid the area.",
    "Small boat capsized near {place}, rescue requested.",
    "Overflow in river near {place} with fast currents, dangerous to cross."
]

PLACES = [
    "Chennai", "Mahabalipuram", "Pondicherry", "Kanyakumari", "Tuticorin", "Rameswaram",
    "Nagapattinam", "Cuddalore", "Thanjavur", "Thoothukudi", "ECR Coast", "Marina",
    "Pazhayar", "Vattakottai", "Karaikal", "Mayiladuthurai", "Nagore", "Pulicat"
]

NUM = 100

results = []

with Session() as db:
    try:
        print(f"Inserting {NUM} dummy tweets into raw_reports...")
        inserted_ids = []
        now = datetime.now(timezone.utc)

        for i in range(NUM):
            lat = round(random.uniform(LAT_MIN, LAT_MAX), 6)
            lon = round(random.uniform(LON_MIN, LON_MAX), 6)
            place = random.choice(PLACES)
            text = random.choice(TEMPLATES).format(place=place)

            # Add some variants and hashtags
            hashtags = random.choice([" #flood", " #tide", " #tsunami", " #storm", "", " #help"])
            text = text + hashtags

            social_id = f"tweet_{uuid.uuid4()}"
            social_platform = 'twitter'
            social_username = random.choice(['userA', 'coastwatcher', 'reporterX', 'citizen123', 'rescue_team'])

            # Create RawReport object - use fields that exist on the ORM
            report = RawReport(
                source='social',
                text=text,
                lat=lat,
                lon=lon,
                media_path=None,
                has_media=False,
                media_verified=False,
                media_confidence=None,
                processed=False,
                nlp_type=None,
                nlp_conf=None,
                credibility=None,
                group_id=None,
                user_id=None,
                user_name=social_username,
                user_session_id=None,
                timestamp=now - timedelta(minutes=random.randint(0, 720)),  # within last 12 hours
                social_id=social_id
            )

            db.add(report)
            db.flush()  # assigns id
            inserted_ids.append(report.id)

        db.commit()
        print(f"Inserted {len(inserted_ids)} reports. Now processing each through the ML pipeline...")

        # Process & collect outputs
        for rid in inserted_ids:
            ok = pipeline.process_single_report(rid, db)

            # Refresh report and capture fields
            report = db.query(RawReport).filter(RawReport.id == rid).one()
            group_id = report.group_id
            nlp_type = getattr(report, 'nlp_type', None)
            nlp_conf = getattr(report, 'nlp_conf', None)
            credibility = getattr(report, 'credibility', None)

            # Run group fusion to get group-level confidence
            fusion_result = pipeline._process_group_fusion(report.group_id, db) if report.group_id is not None else None
            group_conf = getattr(fusion_result, 'confidence', None) if fusion_result else None

            results.append({
                'id': str(rid),
                'nlp_type': nlp_type,
                'nlp_conf': float(nlp_conf) if nlp_conf is not None else None,
                'credibility': float(credibility) if credibility is not None else None,
                'group_id': group_id,
                'group_confidence': float(group_conf) if group_conf is not None else None,
                'processed_ok': bool(ok)
            })

        # Print a clear summary
        print("\n=== Processing Summary ===")
        for r in results:
            print(f"Report {r['id']} → NLP: {r['nlp_type']} (nlp_conf={r['nlp_conf']}) | credibility={r['credibility']} | group={r['group_id']} | group_conf={r['group_confidence']} | processed={r['processed_ok']}")

        # Aggregate stats
        processed = sum(1 for r in results if r['processed_ok'])
        avg_nlp = sum(r['nlp_conf'] for r in results if r['nlp_conf']) / max(1, sum(1 for r in results if r['nlp_conf']))
        avg_cred = sum(r['credibility'] for r in results if r['credibility']) / max(1, sum(1 for r in results if r['credibility']))
        avg_group_conf = sum(r['group_confidence'] for r in results if r['group_confidence']) / max(1, sum(1 for r in results if r['group_confidence']))

        print("\n=== Aggregate ===")
        print(f"Processed reports: {processed}/{len(results)}")
        print(f"Average NLP confidence (where available): {avg_nlp:.3f}")
        print(f"Average credibility (where available): {avg_cred:.3f}")
        print(f"Average group confidence (where available): {avg_group_conf:.3f}")

    except SQLAlchemyError as e:
        print(f"Database error: {e}")
        db.rollback()
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
        raise

print("Done.")
