from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uuid
import shutil
from pathlib import Path
import os
import json
from typing import Dict, Any
import asyncio

from src.backend.analysis.pipeline_video_frames import FrameAnalysisPipeline
from src.backend.utils.logger import get_logger

logger = get_logger(__name__)

app = FastAPI(title="Video Analysis API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories
UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs/api_results")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

# Store analysis status
analysis_status: Dict[str, Dict[str, Any]] = {}

@app.post("/api/upload-video")
async def upload_video(file: UploadFile = File(...)):
    """Upload video file and return analysis ID"""
    
    if not file.content_type.startswith('video/'):
        raise HTTPException(status_code=400, detail="File must be a video")
    
    analysis_id = str(uuid.uuid4())
    file_extension = Path(file.filename).suffix
    filename = f"{analysis_id}{file_extension}"
    file_path = UPLOAD_DIR / filename
    
    try:
        # Save uploaded file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Initialize analysis status
        analysis_status[analysis_id] = {
            "status": "uploaded",
            "filename": filename,
            "original_filename": file.filename,
            "file_path": str(file_path),
            "progress": 0,
            "results": None,
            "error": None
        }
        
        logger.info(f"Video uploaded: {filename} (ID: {analysis_id})")
        
        return {
            "analysis_id": analysis_id,
            "filename": file.filename,
            "message": "Video uploaded successfully"
        }
    
    except Exception as e:
        logger.error(f"Upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.post("/api/analyze/{analysis_id}")
async def analyze_video(analysis_id: str, background_tasks: BackgroundTasks):
    """Start video analysis in background"""
    
    if analysis_id not in analysis_status:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    
    status = analysis_status[analysis_id]
    if status["status"] == "processing":
        raise HTTPException(status_code=400, detail="Analysis already in progress")
    
    # Update status
    status["status"] = "processing"
    status["progress"] = 0
    
    # Add analysis to background tasks
    background_tasks.add_task(run_analysis_pipeline, analysis_id)
    
    return {
        "analysis_id": analysis_id,
        "status": "processing",
        "message": "Analysis started"
    }

def run_analysis_pipeline(analysis_id: str):
    """Run your existing pipeline with the uploaded video"""
    try:
        status = analysis_status[analysis_id]
        video_path = status["file_path"]
        
        logger.info(f"Starting analysis pipeline for {analysis_id}")
        
        # Create output directory for this analysis
        analysis_output_dir = OUTPUT_DIR / analysis_id
        analysis_output_dir.mkdir(exist_ok=True)
        
        # Initialize YOUR pipeline
        pipeline = FrameAnalysisPipeline(
            video_path=video_path,
            output_dir=str(analysis_output_dir),
            yolo_model_path="yolov8n.pt",
            languages=["en"]
        )
        
        # Run analysis
        result = pipeline.analyze(save_video=True, display=False)
        
        # Store results
        status.update({
            "status": "completed",
            "progress": 100,
            "results": result
        })
        
        logger.info(f"Analysis completed for {analysis_id}")
        
    except Exception as e:
        logger.error(f"Analysis failed for {analysis_id}: {str(e)}")
        analysis_status[analysis_id].update({
            "status": "error",
            "error": str(e)
        })

@app.get("/api/analysis-status/{analysis_id}")
async def get_analysis_status(analysis_id: str):
    """Get current analysis status"""
    
    if analysis_id not in analysis_status:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    
    status = analysis_status[analysis_id]
    
    return {
        "analysis_id": analysis_id,
        "status": status["status"],
        "progress": status["progress"],
        "filename": status["original_filename"],
        "error": status.get("error")
    }

@app.get("/")
async def root():
    return {"message": "Video Analysis API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
