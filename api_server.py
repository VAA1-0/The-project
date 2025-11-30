"""
FastAPI Server for Video Analysis
Connects to your existing pipeline and provides endpoints for frontend
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uuid
import shutil
from pathlib import Path
import json
from typing import Dict, Any, Optional
import asyncio

from src.backend.analysis.pipeline_video_frames import FrameAnalysisPipeline
from src.backend.utils.logger import get_logger

logger = get_logger(__name__)

app = FastAPI(
    title="Video Analysis API",
    description="Backend for video analysis with YOLOv8 and EasyOCR",
    version="1.0.0"
)

# CORS middleware - configure for your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000", 
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories for API operations
UPLOAD_DIR = Path("uploads")
RESULTS_DIR = Path("outputs/api_results")
STATIC_DIR = Path("static")

UPLOAD_DIR.mkdir(exist_ok=True)
RESULTS_DIR.mkdir(exist_ok=True)
STATIC_DIR.mkdir(exist_ok=True)

# Serve static files (for downloaded files)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Store analysis status and results
analysis_status: Dict[str, Dict[str, Any]] = {}

@app.post("/api/upload", response_model=dict)
async def upload_video(file: UploadFile = File(...)) -> dict:
    """
    Upload a video file for analysis
    Returns analysis ID for tracking
    """
    if not file.content_type.startswith('video/'):
        raise HTTPException(
            status_code=400, 
            detail="File must be a video (mp4, avi, mov, etc.)"
        )
    
    # Generate unique analysis ID
    analysis_id = str(uuid.uuid4())
    file_extension = Path(file.filename).suffix
    safe_filename = f"{analysis_id}{file_extension}"
    file_path = UPLOAD_DIR / safe_filename
    
    try:
        # Save uploaded file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Initialize analysis status
        analysis_status[analysis_id] = {
            "status": "uploaded",
            "filename": safe_filename,
            "original_filename": file.filename,
            "file_path": str(file_path),
            "progress": 0,
            "results": None,
            "error": None,
            "start_time": None,
            "end_time": None,
            "output_files": {}
        }
        
        logger.info(f"Video uploaded: {file.filename} -> {safe_filename} (ID: {analysis_id})")
        
        return {
            "analysis_id": analysis_id,
            "filename": file.filename,
            "message": "Video uploaded successfully",
            "status": "uploaded"
        }
    
    except Exception as e:
        logger.error(f"Upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.post("/api/analyze/{analysis_id}", response_model=dict)
async def start_analysis(analysis_id: str, background_tasks: BackgroundTasks) -> dict:
    """
    Start video analysis for uploaded video
    Runs in background
    """
    if analysis_id not in analysis_status:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    
    status = analysis_status[analysis_id]
    if status["status"] == "processing":
        raise HTTPException(status_code=400, detail="Analysis already in progress")
    if status["status"] == "completed":
        raise HTTPException(status_code=400, detail="Analysis already completed")
    
    # Update status
    status["status"] = "processing"
    status["progress"] = 10  # Initial progress
    status["start_time"] = asyncio.get_event_loop().time()
    
    # Add analysis to background tasks
    background_tasks.add_task(run_video_analysis, analysis_id)
    
    logger.info(f"Analysis started for {analysis_id}")
    
    return {
        "analysis_id": analysis_id,
        "status": "processing",
        "message": "Analysis started",
        "progress": 10
    }

def run_video_analysis(analysis_id: str):
    """Run the video analysis pipeline in background"""
    try:
        status = analysis_status[analysis_id]
        video_path = status["file_path"]
        
        logger.info(f"Starting analysis pipeline for {analysis_id}")
        
        # Create output directory for this analysis
        analysis_output_dir = RESULTS_DIR / analysis_id
        analysis_output_dir.mkdir(exist_ok=True)
        
        # Update progress
        status["progress"] = 20
        
        # Initialize and run your pipeline
        pipeline = FrameAnalysisPipeline(
            video_path=video_path,
            output_dir=str(analysis_output_dir),
            yolo_model_path="yolov8n.pt",
            languages=["en"]
        )
        
        # Update progress
        status["progress"] = 40
        
        # Run analysis
        result = pipeline.analyze(save_video=True, display=False)
        
        # Update progress
        status["progress"] = 90
        
        # Prepare output files for download
        output_files = {}
        if result.get("annotated_video"):
            output_files["video"] = result["annotated_video"]
        if result.get("yolo_csv"):
            output_files["yolo_csv"] = result["yolo_csv"]
        if result.get("ocr_csv"):
            output_files["ocr_csv"] = result["ocr_csv"]
        if result.get("summary_json"):
            output_files["summary_json"] = result["summary_json"]
        
        # Update status with results
        status.update({
            "status": "completed",
            "progress": 100,
            "results": result,
            "output_files": output_files,
            "end_time": asyncio.get_event_loop().time()
        })
        
        # Calculate processing time
        processing_time = status["end_time"] - status["start_time"]
        logger.info(f"Analysis completed for {analysis_id} in {processing_time:.2f}s")
        
    except Exception as e:
        logger.error(f"Analysis failed for {analysis_id}: {str(e)}")
        analysis_status[analysis_id].update({
            "status": "error",
            "error": str(e),
            "progress": 0,
            "end_time": asyncio.get_event_loop().time()
        })

@app.get("/api/status/{analysis_id}", response_model=dict)
async def get_analysis_status(analysis_id: str) -> dict:
    """
    Get current status of analysis
    """
    if analysis_id not in analysis_status:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    
    status = analysis_status[analysis_id]
    response_data = {
        "analysis_id": analysis_id,
        "status": status["status"],
        "progress": status["progress"],
        "filename": status["original_filename"],
        "error": status.get("error")
    }
    
    # Add results if completed
    if status["status"] == "completed" and status.get("results"):
        results = status["results"]
        output_files = status.get("output_files", {})
        
        # Add processing time
        if status.get("start_time") and status.get("end_time"):
            processing_time = status["end_time"] - status["start_time"]
            response_data["processing_time"] = round(processing_time, 2)
        
        # Add analysis summary
        response_data["summary"] = {
            "yolo_detections": len(results.get("yolo_results", [])),
            "ocr_detections": len(results.get("ocr_results", [])),
        }
        
        # Add download links
        response_data["download_links"] = {}
        if output_files.get("video"):
            response_data["download_links"]["video"] = f"/api/download/{analysis_id}/video"
        if output_files.get("yolo_csv"):
            response_data["download_links"]["yolo_csv"] = f"/api/download/{analysis_id}/yolo_csv"
        if output_files.get("ocr_csv"):
            response_data["download_links"]["ocr_csv"] = f"/api/download/{analysis_id}/ocr_csv"
        if output_files.get("summary_json"):
            response_data["download_links"]["summary_json"] = f"/api/download/{analysis_id}/summary_json"
    
    return response_data

@app.get("/api/download/{analysis_id}/{file_type}")
async def download_file(analysis_id: str, file_type: str):
    """
    Download analysis results
    Supported file_types: video, yolo_csv, ocr_csv, summary_json
    """
    if analysis_id not in analysis_status:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    
    status = analysis_status[analysis_id]
    
    if status["status"] != "completed":
        raise HTTPException(status_code=400, detail="Analysis not completed")
    
    output_files = status.get("output_files", {})
    
    # Map file types to actual file paths and download names
    file_mapping = {
        "video": ("annotated_video.mp4", "video/mp4"),
        "yolo_csv": ("yolo_detections.csv", "text/csv"),
        "ocr_csv": ("ocr_text.csv", "text/csv"),
        "summary_json": ("analysis_summary.json", "application/json")
    }
    
    if file_type not in file_mapping:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    if file_type not in output_files:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = Path(output_files[file_type])
    filename, media_type = file_mapping[file_type]
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on server")
    
    # Create a nice download filename
    original_name = status["original_filename"]
    base_name = Path(original_name).stem
    download_filename = f"{base_name}_{filename}"
    
    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=download_filename
    )

@app.get("/api/analyses", response_model=dict)
async def list_analyses(limit: int = 10) -> dict:
    """
    List recent analyses (for admin/debugging)
    """
    recent_analyses = dict(sorted(
        analysis_status.items(),
        key=lambda x: x[1].get('start_time', 0),
        reverse=True
    )[:limit])
    
    return {
        "analyses": {
            aid: {
                "status": info["status"],
                "filename": info["original_filename"],
                "progress": info["progress"],
                "start_time": info.get("start_time")
            }
            for aid, info in recent_analyses.items()
        }
    }

@app.delete("/api/analysis/{analysis_id}")
async def delete_analysis(analysis_id: str) -> dict:
    """
    Delete analysis and associated files
    """
    if analysis_id not in analysis_status:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    
    try:
        # Remove uploaded file
        status = analysis_status[analysis_id]
        uploaded_file = Path(status["file_path"])
        if uploaded_file.exists():
            uploaded_file.unlink()
        
        # Remove result files
        output_files = status.get("output_files", {})
        for file_path in output_files.values():
            result_file = Path(file_path)
            if result_file.exists():
                result_file.unlink()
        
        # Remove from status tracking
        del analysis_status[analysis_id]
        
        logger.info(f"Analysis {analysis_id} deleted successfully")
        
        return {"message": "Analysis deleted successfully"}
    
    except Exception as e:
        logger.error(f"Failed to delete analysis {analysis_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete analysis")

@app.get("/", response_model=dict)
async def root() -> dict:
    """API root endpoint"""
    return {
        "message": "Video Analysis API",
        "version": "1.0.0",
        "endpoints": {
            "upload": "/api/upload",
            "analyze": "/api/analyze/{id}",
            "status": "/api/status/{id}",
            "download": "/api/download/{id}/{type}",
            "analyses": "/api/analyses"
        }
    }

@app.get("/api/health", response_model=dict)
async def health_check() -> dict:
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Video Analysis API",
        "timestamp": asyncio.get_event_loop().time()
    }


frontend_build_dir = Path("src/frontend/out")
if frontend_build_dir.exists():
    app.mount("/static", StaticFiles(directory=frontend_build_dir / "static"), name="static")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve frontend for all routes not handled by API"""
        frontend_paths = [
            frontend_build_dir / full_path,
            frontend_build_dir / f"{full_path}.html", 
            frontend_build_dir / "index.html"
        ]
        
        for path in frontend_paths:
            if path.exists() and path.is_file():
                return FileResponse(path)
        
        return FileResponse(frontend_build_dir / "index.html")

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Video Analysis API on http://localhost:8000")
    logger.info("API Documentation: http://localhost:8000/docs")
    uvicorn.run(
        "api_server:app",
        host="0.0.0.0", 
        port=8000, 
        reload=False  # Disable reload in Docker
    )