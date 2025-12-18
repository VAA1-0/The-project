"""
FastAPI Server for Video Analysis with Audio Pipeline
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
from src.backend.analysis.pipeline_manager import run_full_pipeline
from src.backend.analysis.pipeline_ingestion import run_ingestion_pipeline
from src.backend.analysis.pipeline_audio_text import AudioTranscriptionPipeline
from src.backend.utils.logger import get_logger
from src.backend.analysis.pos_analysis import POSAnalysis
from fastapi import Form


logger = get_logger(__name__)

app = FastAPI(
    title="Video Analysis API",
    description="Backend for video analysis with YOLOv8, EasyOCR, and Whisper Audio Transcription",
    version="1.1.0"
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
AUDIO_DIR = Path("outputs/audio")
TRANSCRIPTS_DIR = Path("outputs/transcripts")
STATIC_DIR = Path("static")

UPLOAD_DIR.mkdir(exist_ok=True)
RESULTS_DIR.mkdir(exist_ok=True)
AUDIO_DIR.mkdir(exist_ok=True)
TRANSCRIPTS_DIR.mkdir(exist_ok=True)
STATIC_DIR.mkdir(exist_ok=True)

# Serve static files (for downloaded files)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Store analysis status and results
analysis_status: Dict[str, Dict[str, Any]] = {}

@app.post("/api/upload", response_model=dict)
async def upload_video(file: UploadFile = File(...), cvatID: int = Form(...)) -> dict:
    """
    Upload a video file for analysis
    Returns analysis ID for tracking
    """
    # More flexible file type checking
    allowed_extensions = {'.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm'}
    file_extension = Path(file.filename).suffix.lower()
    
    # Check both content type and file extension
    is_video_content = file.content_type and file.content_type.startswith('video/')
    is_video_extension = file_extension in allowed_extensions
    
    if not (is_video_content or is_video_extension):
        raise HTTPException(
            status_code=400, 
            detail=f"File must be a video. Supported formats: {', '.join(allowed_extensions)}"
        )
    
    # Generate unique analysis ID
    analysis_id = str(uuid.uuid4())
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
            "output_files": {},
            "pipeline_type": "full",
            "cvatID": cvatID
        }
        
        logger.info(f"Video uploaded: {file.filename} -> {safe_filename} (ID: {analysis_id})")
        logger.info(f"Video uploaded: {cvatID})")
        logger.info(f"Video uploaded: {file.filename} -> {safe_filename} (ID: {analysis_id})")
        return {
            "analysis_id": analysis_id,
            "filename": file.filename,
            "cvatID": cvatID,
            "message": "Video uploaded successfully",
            "status": "uploaded"
        }
    
    except Exception as e:
        logger.error(f"Upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.post("/api/analyze/{analysis_id}", response_model=dict)
async def start_analysis(analysis_id: str, background_tasks: BackgroundTasks, pipeline_type: str = "full") -> dict:
    """
    Start video analysis for uploaded video
    Runs in background
    
    pipeline_type options:
    - "full": Video + Audio analysis (default)
    - "visual_only": Only video frame analysis  
    - "audio_only": Only audio transcription
    """
    if analysis_id not in analysis_status:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    
    status = analysis_status[analysis_id]
    if status["status"] == "processing":
        raise HTTPException(status_code=400, detail="Analysis already in progress")
    if status["status"] == "completed":
        raise HTTPException(status_code=400, detail="Analysis already completed")
    
    # Validate pipeline type
    if pipeline_type not in ["full", "visual_only", "audio_only"]:
        raise HTTPException(status_code=400, detail="Invalid pipeline type")
    
    # Update status
    status["status"] = "processing"
    status["progress"] = 10  # Initial progress
    status["start_time"] = asyncio.get_event_loop().time()
    status["pipeline_type"] = pipeline_type
    
    # Add analysis to background tasks
    background_tasks.add_task(run_complete_analysis, analysis_id, pipeline_type)
    
    logger.info(f"Analysis started for {analysis_id} with pipeline: {pipeline_type}")
    
    return {
        "analysis_id": analysis_id,
        "status": "processing",
        "message": f"Analysis started with {pipeline_type} pipeline",
        "progress": 10,
        "pipeline_type": pipeline_type
    }

def run_complete_analysis(analysis_id: str, pipeline_type: str):
    """Run the complete analysis pipeline in background"""
    try:
        status = analysis_status[analysis_id]
        video_path = status["file_path"]
        
        logger.info(f"🚀 Starting {pipeline_type} analysis pipeline for {analysis_id}")
        logger.info(f"📁 Video path: {video_path}")
        
        # Verify the video file exists
        if not Path(video_path).exists():
            error_msg = f"Video file not found: {video_path}"
            logger.error(error_msg)
            raise FileNotFoundError(error_msg)
        
        logger.info("✅ Video file exists")
        
        # Create output directory for this analysis
        analysis_output_dir = RESULTS_DIR / analysis_id
        analysis_output_dir.mkdir(exist_ok=True)
        
        results = {}
        output_files = {}
        
        # VISUAL PROCESSING (YOLO + OCR)
        if pipeline_type in ["full", "visual_only"]:
            try:
                logger.info("🎥 Starting visual analysis pipeline...")
                
                # Initialize frame analysis pipeline
                frame_pipeline = FrameAnalysisPipeline(video_path)
                
                # Run the analysis
                visual_results = frame_pipeline.analyze(
                    save_video=True, 
                    display=False
                )
                
                # Store visual results
                results["visual_analysis"] = {
                    "yolo_results": visual_results.get("yolo_results", []),
                    "ocr_results": visual_results.get("ocr_results", []),
                    "annotated_video": visual_results.get("annotated_video"),
                    "yolo_csv": visual_results.get("yolo_csv"),
                    "ocr_csv": visual_results.get("ocr_csv"),
                    "summary_json": visual_results.get("summary_json")
                }
                
                # Add output files for download
                output_files["video"] = visual_results.get("annotated_video")
                output_files["yolo_csv"] = visual_results.get("yolo_csv")
                output_files["ocr_csv"] = visual_results.get("ocr_csv")
                output_files["summary_json"] = visual_results.get("summary_json")
                
                logger.info(f"✅ Visual analysis completed: {len(visual_results.get('yolo_results', []))} detections")
                
            except Exception as visual_error:
                logger.error(f"❌ Visual pipeline failed: {str(visual_error)}")
                import traceback
                logger.error(f"📝 Traceback: {traceback.format_exc()}")
                results["visual_error"] = str(visual_error)
        
        # AUDIO PROCESSING 
        if pipeline_type in ["full", "audio_only"]:
            try:
                logger.info("🎵 Starting audio pipeline...")

                # Step 1: Extract audio
                ingestion_result = run_ingestion_pipeline(video_path)
                audio_path = ingestion_result["audio_path"]

                if not Path(audio_path).exists():
                    raise FileNotFoundError(f"Audio file not found: {audio_path}")

                # Step 2: Transcribe
                audio_pipeline = AudioTranscriptionPipeline(str(audio_path))
                transcript = audio_pipeline.run()

                # Step 3: Prepare organized paths
                audio_filename = f"{analysis_id}_audio.wav"
                transcript_filename = f"{analysis_id}_transcript.json"

                organized_audio_path = AUDIO_DIR / audio_filename
                organized_transcript_path = TRANSCRIPTS_DIR / transcript_filename

                # Ensure dirs exist
                AUDIO_DIR.mkdir(parents=True, exist_ok=True)
                TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)

                # Step 4: Move audio
                shutil.move(audio_path, organized_audio_path)

                # Step 5: Locate transcript file
                original_transcript_dir = Path(audio_path).parent / "transcripts"
                original_transcript_path = original_transcript_dir / f"{Path(audio_path).stem}_transcript.json"

                if not original_transcript_path.exists():
                    alternative_path = audio_pipeline.output_dir / f"{Path(audio_path).stem}_transcript.json"
                    original_transcript_path = alternative_path

                if not original_transcript_path.exists():
                    raise FileNotFoundError("Transcript file not found")

                # Step 6: Move transcript
                shutil.move(str(original_transcript_path), organized_transcript_path)

                # Step 7: POS analysis (AFTER transcript exists in final place)
                logger.info("📝 Starting POS analysis on transcript...")
                with open(organized_transcript_path, "r", encoding="utf-8") as f:
                    data = json.load(f)

                text = " ".join(
                    seg["text"] for seg in data.get("segments", [])
                )

                pos_analyzer = POSAnalysis(text)
                pos_result = pos_analyzer.run()

                pos_path_init = f"{analysis_id}_pos.json" 
                pos_path = TRANSCRIPTS_DIR / pos_path_init
                pos_path.parent.mkdir(exist_ok=True, parents=True)

                with open(pos_path, "w", encoding="utf-8") as f:
                    json.dump(pos_result, f, indent=2, ensure_ascii=False)

                logger.info(f"POS Results saved: {pos_path}")

                # Step 8: Store results
                results["audio_analysis"] = {
                    "audio_path": str(organized_audio_path),
                    "transcript_path": str(organized_transcript_path),
                    "pos_analysis": str(pos_path),
                    "metadata": ingestion_result.get("metadata", {}),
                }

                output_files["audio"] = str(organized_audio_path)
                output_files["transcript"] = str(organized_transcript_path)

                logger.info("✅ Audio pipeline completed successfully")

            except Exception as audio_error:
                logger.error(f"❌ Audio pipeline failed: {str(audio_error)}")
                import traceback
                logger.error(traceback.format_exc())
                results["audio_error"] = str(audio_error)

        
        # MARK AS COMPLETED
        import time
        status.update({
            "status": "completed",
            "progress": 100,
            "results": results,
            "output_files": output_files,
            "end_time": time.time()
        })
        
        logger.info(f"🎉 Analysis marked as COMPLETED for {analysis_id}")
        logger.info(f"📊 Results keys: {list(results.keys())}")
        logger.info(f"📁 Output files: {output_files}")
        
    except Exception as e:
        logger.error(f"💥 Analysis failed for {analysis_id}: {str(e)}")
        import traceback
        logger.error(f"📝 Traceback: {traceback.format_exc()}")
        
        import time
        analysis_status[analysis_id].update({
            "status": "error", 
            "error": str(e),
            "progress": 0,
            "end_time": time.time()
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
        "error": status.get("error"),
        "pipeline_type": status.get("pipeline_type", "full"),
        "cvatID" : status["cvatID"],
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
        response_data["summary"] = {}

        if "visual_analysis" in results:
            va = results["visual_analysis"]
            response_data["summary"]["yolo_detections"] = len(va.get("yolo_results", []))
            response_data["summary"]["ocr_detections"] = len(va.get("ocr_results", []))

        if "audio_analysis" in results:
            aa = results["audio_analysis"]
            response_data["summary"]["audio_segments"] = len(
                aa.get("transcript", {}).get("segments", [])
            )
            response_data["summary"]["audio_language"] = aa.get("transcript", {}).get("language", "unknown")
        
        # Add download links
        response_data["download_links"] = {}
        for file_type, file_path in output_files.items():
            response_data["download_links"][file_type] = f"/api/download/{analysis_id}/{file_type}"
    return response_data

@app.get("/api/download/{analysis_id}/{file_type}")
async def download_file(analysis_id: str, file_type: str):
    """
    Download analysis results
    Supported file_types: video, yolo_csv, ocr_csv, summary_json, audio, transcript
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
        "summary_json": ("analysis_summary.json", "application/json"),
        "audio": ("extracted_audio.wav", "audio/wav"),
        "transcript": ("transcript.json", "application/json")
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

# Keep your existing endpoints (they work well)
@app.get("/api/analyses", response_model=dict)
async def list_analyses(limit: int = 10) -> dict:
    """
    List recent analyses (for admin/debugging)
    """
    # Fix: Handle None values in sorting
    recent_analyses = dict(sorted(
        analysis_status.items(),
        key=lambda x: x[1].get('start_time', 0) or 0,  # Handle None values
        reverse=True
    )[:limit])
    
    return {
        "analyses": {
            aid: {
                "status": info["status"],
                "filename": info["original_filename"],
                "progress": info["progress"],
                "pipeline_type": info.get("pipeline_type", "full"),
                "start_time": info.get("start_time")
            }
            for aid, info in recent_analyses.items()
        }
    }

@app.delete("/api/analysis/{analysis_id}")
async def delete_analysis(analysis_id: str) -> dict:
    """Delete analysis and associated files"""
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
        "message": "Video Analysis API with Audio Pipeline",
        "version": "1.1.0",
        "endpoints": {
            "upload": "/api/upload",
            "analyze": "/api/analyze/{id}?pipeline_type=full|visual_only|audio_only",
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
        "service": "Video Analysis API with Audio",
        "timestamp": asyncio.get_event_loop().time()
    }

# Frontend serving (keep your existing code)
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
    logger.info("Starting Video Analysis API with Audio on http://localhost:8000")
    logger.info("API Documentation: http://localhost:8000/docs")
    uvicorn.run(
        "api_server:app",
        host="0.0.0.0", 
        port=8000, 
        reload=False
    )