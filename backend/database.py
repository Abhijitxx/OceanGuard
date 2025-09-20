"""
Database configuration for OceanGuard
Uses Supabase as the primary database
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from supabase import create_client, Client
import asyncpg
from typing import Optional

# Load environment variables
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

# SQLAlchemy Base
Base = declarative_base()

class DatabaseManager:
    """Manages Supabase database connections"""
    
    def __init__(self):
        self.supabase_client: Optional[Client] = None
        self.engine = None
        self.SessionLocal = None
        
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in environment variables")
        
        self._init_supabase()
    
    def _init_supabase(self):
        """Initialize Supabase client and SQLAlchemy engine"""
        try:
            # Initialize Supabase client with service role key for backend operations
            # This bypasses RLS policies and allows backend to perform admin operations
            service_key = SUPABASE_SERVICE_KEY or SUPABASE_KEY
            self.supabase_client = create_client(SUPABASE_URL, service_key)
            print("✅ Connected to Supabase client")
            
            # Initialize SQLAlchemy engine for PostgreSQL
            if DATABASE_URL:
                self.engine = create_engine(
                    DATABASE_URL,
                    pool_size=10,
                    max_overflow=20,
                    pool_pre_ping=True,
                    echo=os.getenv("SQL_DEBUG", "false").lower() == "true"
                )
                self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
                print("✅ Connected to Supabase PostgreSQL database")
            else:
                print("⚠️ DATABASE_URL not provided, using Supabase client only")
                
        except Exception as e:
            print(f"❌ Failed to connect to Supabase: {e}")
            raise RuntimeError(f"Database connection failed: {e}")
    
    def get_supabase_client(self) -> Client:
        """Get Supabase client"""
        if not self.supabase_client:
            raise RuntimeError("Supabase client not initialized")
        return self.supabase_client
    
    def get_db_session(self):
        """Get database session (SQLAlchemy)"""
        if not self.SessionLocal:
            raise RuntimeError("Database session not initialized")
        
        db = self.SessionLocal()
        try:
            yield db
        finally:
            db.close()
    
    async def get_async_connection(self):
        """Get async PostgreSQL connection"""
        if not DATABASE_URL:
            raise RuntimeError("DATABASE_URL required for async connections")
        
        return await asyncpg.connect(DATABASE_URL)
    
    def create_tables(self):
        """Create all tables"""
        if self.engine:
            Base.metadata.create_all(bind=self.engine)
            print("📊 Database tables created/verified")

# Global database manager instance
db_manager = DatabaseManager()

# Convenience functions
def get_supabase() -> Client:
    """Get Supabase client instance"""
    return db_manager.get_supabase_client()

def get_db():
    """Get database session"""
    return db_manager.get_db_session()

def get_engine():
    """Get SQLAlchemy engine"""
    return db_manager.engine