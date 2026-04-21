from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uuid
import shutil
import time
from pathlib import Path
import os
import json
from typing import Dict, Any
import asyncio
from datetime import datetime, timezone

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


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

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
            "error": None,
            "start_time": None,
            "end_time": None,
            "uploaded_at": utc_now_iso(),
            "analysis_started_at": None,
            "analysis_completed_at": None,
            "output_files": {},
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
async def analyze_video(
    analysis_id: str,
    background_tasks: BackgroundTasks,
    apply_face_anonymization: bool = False,
    face_message_style: str = "plain",
    face_requires_person_detection: bool = False,
):
    """Start video analysis in background"""
    
    if analysis_id not in analysis_status:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    
    status = analysis_status[analysis_id]
    if status["status"] == "processing":
        raise HTTPException(status_code=400, detail="Analysis already in progress")
    
    # Update status
    status["status"] = "processing"
    status["progress"] = 0
    status["start_time"] = time.time()
    status["apply_face_anonymization"] = apply_face_anonymization
    status["face_message_style"] = face_message_style
    status["face_requires_person_detection"] = face_requires_person_detection
    status["analysis_started_at"] = utc_now_iso()
    status["analysis_completed_at"] = None
    
    # Add analysis to background tasks
    background_tasks.add_task(
        run_analysis_pipeline,
        analysis_id,
        apply_face_anonymization,
        face_message_style,
        face_requires_person_detection,
    )
    
    return {
        "analysis_id": analysis_id,
        "status": "processing",
        "message": "Analysis started",
        "apply_face_anonymization": apply_face_anonymization,
        "face_message_style": face_message_style,
        "face_requires_person_detection": face_requires_person_detection,
    }

def run_analysis_pipeline(
    analysis_id: str,
    apply_face_anonymization: bool = False,
    face_message_style: str = "plain",
    face_requires_person_detection: bool = False,
):
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
            languages=["en"],
            apply_face_anonymization=apply_face_anonymization,
            face_message_style=face_message_style,
            face_requires_person_detection=face_requires_person_detection,
        )
        
        # Run analysis
        result = pipeline.analyze(save_video=True, display=False)

        output_files = {
            "video": result.get("annotated_video"),
            "yolo_csv": result.get("yolo_csv"),
            "ocr_csv": result.get("ocr_csv"),
            "summary_json": result.get("summary_json"),
        }

        face_anonymization = result.get("face_anonymization")
        if face_anonymization and face_anonymization.get("manifest_path"):
            output_files["face_anonymization_manifest"] = face_anonymization[
                "manifest_path"
            ]
        
        # Store results
        status.update({
            "status": "completed",
            "progress": 100,
            "results": result,
            "output_files": {
                key: value for key, value in output_files.items() if value
            },
            "end_time": time.time(),
            "analysis_completed_at": utc_now_iso(),
        })
        
        logger.info(f"Analysis completed for {analysis_id}")
        
    except Exception as e:
        logger.error(f"Analysis failed for {analysis_id}: {str(e)}")
        analysis_status[analysis_id].update({
            "status": "error",
            "error": str(e),
            "end_time": time.time(),
            "analysis_completed_at": utc_now_iso(),
        })

@app.get("/api/analysis-status/{analysis_id}")
@app.get("/api/status/{analysis_id}")
async def get_analysis_status(analysis_id: str):
    """Get current analysis status"""
    
    if analysis_id not in analysis_status:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    
    status = analysis_status[analysis_id]
    
    response_data = {
        "analysis_id": analysis_id,
        "status": status["status"],
        "progress": status["progress"],
        "filename": status["original_filename"],
        "error": status.get("error"),
        "apply_face_anonymization": status.get("apply_face_anonymization", False),
        "face_message_style": status.get("face_message_style", "plain"),
        "face_requires_person_detection": status.get(
            "face_requires_person_detection", False
        ),
        "uploaded_at": status.get("uploaded_at"),
        "analysis_started_at": status.get("analysis_started_at"),
        "analysis_completed_at": status.get("analysis_completed_at"),
    }

    if status.get("start_time") and status.get("end_time"):
        response_data["processing_time"] = round(
            status["end_time"] - status["start_time"], 2
        )

    if status["status"] == "completed" and status.get("results"):
        results = status["results"]
        output_files = status.get("output_files", {})
        response_data["download_links"] = {
            file_type: f"/api/download/{analysis_id}/{file_type}"
            for file_type in output_files
        }

        face_sampling = results.get("face_sampling", {})
        response_data["summary"] = {
            "yolo_detections": len(results.get("yolo_results", [])),
            "ocr_detections": len(results.get("ocr_results", [])),
            "face_frames_considered": face_sampling.get("frames_considered", 0),
            "face_frames_selected": face_sampling.get("frames_selected", 0),
            "face_frames_skipped_no_person": face_sampling.get(
                "frames_skipped_no_person", 0
            ),
        }

    return response_data


@app.get("/api/download/{analysis_id}/{file_type}")
async def download_file(analysis_id: str, file_type: str):
    """Download analysis results for the lightweight app backend."""

    if analysis_id not in analysis_status:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    status = analysis_status[analysis_id]
    if status["status"] != "completed":
        raise HTTPException(status_code=400, detail="Analysis not completed")

    output_files = status.get("output_files", {})
    file_mapping = {
        "video": ("annotated_video.mp4", "video/mp4"),
        "yolo_csv": ("yolo_detections.csv", "text/csv"),
        "ocr_csv": ("ocr_text.csv", "text/csv"),
        "summary_json": ("analysis_summary.json", "application/json"),
        "face_anonymization_manifest": (
            "face_anonymization_manifest.json",
            "application/json",
        ),
    }

    if file_type not in file_mapping:
        raise HTTPException(status_code=400, detail="Invalid file type")

    if file_type not in output_files:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(output_files[file_type])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on server")

    filename, media_type = file_mapping[file_type]
    base_name = Path(status["original_filename"]).stem

    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=f"{base_name}_{filename}",
    )


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Video Analysis API",
        "timestamp": utc_now_iso(),
    }

@app.get("/")
async def root():
    return {"message": "Video Analysis API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
