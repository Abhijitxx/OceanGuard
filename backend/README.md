# OceanGuard3 Backend

## Setup

1. Create and activate a virtual environment:
   ```powershell
   python -m venv venv
   .\venv\Scripts\activate
   ```
2. Install dependencies:
   ```powershell
   pip install -r requirements.txt
   ```
3. Seed the database with dummy data:
   ```powershell
   python generate_data.py --incois 10 --citizen 50
   ```

## Files
- `models.py`: SQLAlchemy models for all tables
- `generate_data.py`: Seeds the database with dummy INCOIS bulletins and citizen reports
- `requirements.txt`: Python dependencies

## Next Steps
- Implement FastAPI endpoints in `app.py`
- Add core services (NLP, credibility, dedupe, fusion)
- Build frontend
