# SQLAlchemy/Pydantic models

# src/backend/database/models.py
from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel

class AnalysisBase(BaseModel):
    analysis_id: str
    filename: str
    original_filename: str
    status: str
    progress: int
    pipeline_type: str

class AnalysisCreate(AnalysisBase):
    pass

class Analysis(AnalysisBase):
    file_path: str
    results: Optional[Dict[str, Any]] = None
    output_files: Optional[Dict[str, str]] = None
    error: Optional[str] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    created_at: datetime = datetime.now()

    class Config:
        from_attributes = True