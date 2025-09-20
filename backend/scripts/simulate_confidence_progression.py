"""Simulate progressive confidence changes by inserting reports and running the ML pipeline.

Sequence:
 - Create one citizen report
 - Create another citizen report nearby
 - Insert a social media report (social)
 - Insert a few more citizen reports
 - Insert an INCOIS bulletin (official)
 - After each insertion, process the new report (or bulletin) and print the current hazard event confidence for the group

Run: python backend/scripts/simulate_confidence_progression.py

Requires environment configured for database (DATABASE_URL or SUPABASE env vars)
"""

import os
import time
from datetime import datetime, timezone, timedelta
from uuid import uuid4

# Use existing project imports
from database import get_supabase
from services.nlp import nlp_processor
from services.credibility import credibility_scorer
from services.dedupe import dedupe_engine
from services.fusion import fusion_engine


supabase = get_supabase()


def insert_raw_report_supabase(source, text, lat, lon, media_path=None, social_id=None, user_name=None, timestamp=None):
    ts = (timestamp or datetime.now(timezone.utc)).isoformat()
    resp = supabase.table('raw_reports').insert({
        'source': source,
        'text': text,
        'lat': lat,
        'lon': lon,
        'media_path': media_path,
        'has_media': bool(media_path),
        'social_id': social_id,
        'user_name': user_name or 'sim_user',
        'processed': False,
        'timestamp': ts
    }).execute()
    if resp.data:
        return resp.data[0]['id']
    raise RuntimeError('Failed to insert report via Supabase')


def insert_bulletin_supabase(hazard_type, severity, description, lat, lon, issued_at=None):
    ts = (issued_at or datetime.now(timezone.utc)).isoformat()
    resp = supabase.table('raw_bulletins').insert({
        'source': 'INCOIS',
        'hazard_type': hazard_type,
        'severity': severity,
        'description': description,
        'lat': lat,
        'lon': lon,
        'issued_at': ts
    }).execute()
    if resp.data:
        return resp.data[0]['id']
    raise RuntimeError('Failed to insert bulletin via Supabase')



def find_existing_event_for_report(report_id):
    """Find a hazard_event where evidence_json.report_ids contains the given report UUID."""
    resp = supabase.table('hazard_events').select('*').limit(500).execute()
    for h in resp.data or []:
        ev = h.get('evidence_json') or {}
        report_ids = ev.get('report_ids') if isinstance(ev, dict) else None
        if isinstance(report_ids, list) and report_id in report_ids:
            return h
    return None


def print_confidence_for_report(report_id):
    event = find_existing_event_for_report(report_id)
    if not event:
        print('No hazard event yet for report', report_id)
        return
    print(f"Hazard event {event.get('id')} confidence: {event.get('confidence', 0):.3f} (status: {event.get('status')})")


def find_existing_event_for_reports(report_ids):
    """Find a hazard_event where evidence_json.report_ids overlaps with given report_ids list."""
    if not report_ids:
        return None
    resp = supabase.table('hazard_events').select('*').limit(500).execute()
    for h in resp.data or []:
        ev = h.get('evidence_json') or {}
        existing_ids = ev.get('report_ids') if isinstance(ev, dict) else None
        if isinstance(existing_ids, list):
            # check for intersection
            for rid in report_ids:
                if rid in existing_ids:
                    return h
    return None


def process_report_supabase(report_id):
    """Process a single report using Supabase as the datastore and services for NLP/dedupe/fusion."""
    # Fetch report
    rres = supabase.table('raw_reports').select('*').eq('id', report_id).execute()
    if not rres.data:
        print('Report not found', report_id)
        return None
    report = rres.data[0]

    # NLP
    nlp = nlp_processor.classify_text(report.get('text', ''), report.get('source', ''), has_media=bool(report.get('has_media')), media_verified=bool(report.get('media_verified')))

    # Credibility
    # Note: credibility_scorer expects timestamp as datetime; parse if string
    ts = report.get('timestamp')
    try:
        if isinstance(ts, str):
            ts_dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
        else:
            ts_dt = ts
    except Exception:
        ts_dt = datetime.now(timezone.utc)

    cred = credibility_scorer.calculate_credibility(
        source=report.get('source'),
        text=report.get('text'),
        lat=report.get('lat'),
        lon=report.get('lon'),
        timestamp=ts_dt,
        media_path=report.get('media_path')
    )

    # Update report with NLP and credibility
    supabase.table('raw_reports').update({
        'nlp_type': nlp.hazard_type,
        'nlp_conf': nlp.confidence,
        'credibility': cred.score
    }).eq('id', report_id).execute()

    # Prepare processed reports list for dedup
    proc = supabase.table('raw_reports').select('*').eq('processed', True).execute()
    existing = proc.data or []

    # Compute current max group_id
    max_gid = 0
    for e in existing:
        gid = e.get('group_id')
        try:
            if gid is not None:
                max_gid = max(max_gid, int(gid))
        except Exception:
            continue

    # Find best match using dedupe_engine.combined_similarity
    new_report_for_compare = {
        'id': report_id,
        'text': report.get('text', ''),
        'lat': report.get('lat', 0),
        'lon': report.get('lon', 0),
        'timestamp': datetime.fromisoformat(report.get('timestamp').replace('Z', '+00:00')) if isinstance(report.get('timestamp'), str) else report.get('timestamp'),
        'source': report.get('source', ''),
    }

    best_score = 0.0
    best_group = None
    best_match_ids = []

    for e in existing:
        compare = {
            'id': e.get('id'),
            'text': e.get('text', ''),
            'lat': e.get('lat', 0),
            'lon': e.get('lon', 0),
            'timestamp': datetime.fromisoformat(e.get('timestamp').replace('Z', '+00:00')) if isinstance(e.get('timestamp'), str) else e.get('timestamp'),
            'source': e.get('source', '')
        }
        score = dedupe_engine.combined_similarity(new_report_for_compare, compare)
        if score > best_score:
            best_score = score
            best_group = e.get('group_id') or None
            best_match_ids = [e.get('id')]

    is_duplicate = best_score >= dedupe_engine.combined_threshold
    if is_duplicate and best_group:
        group_id = int(best_group)
    elif is_duplicate and not best_group:
        # assign the existing match an integer group id
        max_gid += 1
        group_id = max_gid
    else:
        max_gid += 1
        group_id = max_gid

    # Update report with group_id and processed
    supabase.table('raw_reports').update({'group_id': group_id, 'processed': True}).eq('id', report_id).execute()

    # Gather all processed reports in this group
    group_reports_resp = supabase.table('raw_reports').select('*').eq('group_id', group_id).execute()
    group_reports = group_reports_resp.data or []

    # Build reports_data expected by fusion_engine
    reports_data = []
    for r in group_reports:
        reports_data.append({
            'id': r.get('id'),
            'text': r.get('text'),
            'lat': r.get('lat'),
            'lon': r.get('lon'),
            'timestamp': datetime.fromisoformat(r.get('timestamp').replace('Z', '+00:00')) if isinstance(r.get('timestamp'), str) else r.get('timestamp'),
            'source': r.get('source'),
            'nlp_type': r.get('nlp_type'),
            'nlp_conf': r.get('nlp_conf') or 0.5,
            'credibility': r.get('credibility') or 0.5,
            'has_media': r.get('has_media', False),
            'media_verified': r.get('media_verified', False),
            'keywords_found': [],
            'severity_boost': 0
        })

    # Compute group_stats
    group_stats = dedupe_engine.get_group_statistics(reports_data)

    # Fuse
    fusion_result = fusion_engine.fuse_reports(reports_data, group_stats)

    # Upsert hazard event: try to find an existing event by report UUIDs
    report_ids = [r.get('id') for r in reports_data]
    existing_event = find_existing_event_for_reports(report_ids)
    evidence_json = fusion_result.evidence['dict'] if hasattr(fusion_result.evidence, 'get') or isinstance(fusion_result.evidence, dict) else fusion_result.evidence['dict']
    # evidence_json from fuse_reports returns {'json':..., 'dict':...}
    # create payload
    # Map numeric severity (1-5) to text values expected by the DB
    severity_map = {1: 'low', 2: 'low', 3: 'medium', 4: 'high', 5: 'critical'}
    severity_text = severity_map.get(fusion_result.severity, 'low')

    # Normalize status to allowed values in DB
    status_map = {
        'emergency': 'emergency',
        'confirmed': 'active',
        'pending': 'pending',
        'review': 'pending'
    }
    status_text = status_map.get(fusion_result.status, 'pending')

    payload = {
        'hazard_type': fusion_result.hazard_type,
        'confidence': fusion_result.confidence,
        'severity': severity_text,
        'status': status_text,
        'centroid_lat': fusion_result.centroid_lat,
        'centroid_lon': fusion_result.centroid_lon,
        'evidence_json': fusion_result.evidence['dict'],
        'updated_at': datetime.now(timezone.utc).isoformat()
    }

    if existing_event:
        supabase.table('hazard_events').update(payload).eq('id', existing_event.get('id')).execute()
        event_id = existing_event.get('id')
        action = 'updated'
    else:
        payload['created_at'] = datetime.now(timezone.utc).isoformat()
        ins = supabase.table('hazard_events').insert(payload).execute()
        event_id = ins.data[0].get('id') if ins.data else None
        action = 'created'

    print(f"Hazard event {event_id} {action} for group {group_id}: confidence={fusion_result.confidence:.3f}, status={fusion_result.status}")
    return group_id


def run_simulation():
    print('\n=== Simulation (Supabase only): progressive confidence ===\n')

    lat = 9.9265
    lon = 78.1190

    # 1) First citizen report
    id1 = insert_raw_report_supabase('citizen', 'Water entering ground floor of homes near the beach. Strong waves and flooding observed.', lat, lon, user_name='alice')
    print('Inserted citizen report 1 id=', id1)
    gid = process_report_supabase(id1)
    # Lookup a representative report id for this group (earliest processed)
    rep_resp = supabase.table('raw_reports').select('*').eq('group_id', gid).order('created_at', desc=False).limit(1).execute()
    rep_id = rep_resp.data[0].get('id') if rep_resp.data else id1
    print_confidence_for_report(rep_id)
    time.sleep(1)

    # 2) Second nearby citizen report
    id2 = insert_raw_report_supabase('citizen', 'Flooding on coastal road next to fishing market. Water rising to knee level.', lat + 0.002, lon + 0.001, user_name='bob')
    print('Inserted citizen report 2 id=', id2)
    process_report_supabase(id2)
    rep_resp = supabase.table('raw_reports').select('*').eq('group_id', gid).order('created_at', desc=False).limit(1).execute()
    rep_id = rep_resp.data[0].get('id') if rep_resp.data else id1
    print_confidence_for_report(rep_id)
    time.sleep(1)

    # 3) Social media corroboration
    id3 = insert_raw_report_supabase('social', 'Just saw flooding at the shoreline. Cars stranded. #chennaiflood', lat + 0.0015, lon + 0.0008, social_id=f'tweet_{uuid4()}', user_name='twitter_user')
    print('Inserted social report id=', id3)
    process_report_supabase(id3)
    rep_resp = supabase.table('raw_reports').select('*').eq('group_id', gid).order('created_at', desc=False).limit(1).execute()
    rep_id = rep_resp.data[0].get('id') if rep_resp.data else id1
    print_confidence_for_report(rep_id)
    time.sleep(1)

    # 4) Few more citizen reports
    for i in range(3):
        rid = insert_raw_report_supabase('citizen', f'Nearby area showing increased water level #{i+1} - residents moving to higher ground.', lat + 0.002 * (i+1), lon + 0.001 * (i+1), user_name=f'citizen_{i+1}')
        print('Inserted and processing citizen report id=', rid)
        process_report_supabase(rid)
        rep_resp = supabase.table('raw_reports').select('*').eq('group_id', gid).order('created_at', desc=False).limit(1).execute()
        rep_id = rep_resp.data[0].get('id') if rep_resp.data else id1
        print_confidence_for_report(rep_id)
        time.sleep(0.5)

    # 5) Insert INCOIS bulletin and an incois report
    bid = insert_bulletin_supabase('flood', 4, 'INCOIS advisory: Elevated sea levels and local flooding expected near Chennai coast.', lat + 0.001, lon + 0.001)
    print('Inserted INCOIS bulletin id=', bid)
    inc_id = insert_raw_report_supabase('incois', 'Official advisory: local flooding confirmed by INCOIS observations.', lat + 0.001, lon + 0.001, user_name='incois')
    print('Inserted incois report id=', inc_id)
    process_report_supabase(inc_id)
    rep_resp = supabase.table('raw_reports').select('*').eq('group_id', gid).order('created_at', desc=False).limit(1).execute()
    rep_id = rep_resp.data[0].get('id') if rep_resp.data else id1
    print_confidence_for_report(rep_id)

    print('\n=== Simulation complete ===\n')


if __name__ == '__main__':
    run_simulation()
