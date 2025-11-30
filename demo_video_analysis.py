"""
Demo Video Analysis Runner
--------------------------
Runs the full visual analysis pipeline (YOLOv8 + EasyOCR)
on a sample video and saves annotated outputs + CSV/JSON results.
"""

import sys
import os
import logging

# Set up logging immediately for debugging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def setup_imports():
    """Setup Python paths and imports"""
    # Add current directory to Python path
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)
    
    # Try multiple import methods
    import_methods = [
        # Method 1: Direct import after pip install
        lambda: (__import__('src.backend.analysis.pipeline_video_frames', fromlist=['FrameAnalysisPipeline']),
                 __import__('src.backend.utils.logger', fromlist=['get_logger'])),
        
        # Method 2: Alternative import
        lambda: (__import__('backend.analysis.pipeline_video_frames', fromlist=['FrameAnalysisPipeline']),
                 __import__('backend.utils.logger', fromlist=['get_logger'])),
    ]
    
    for i, method in enumerate(import_methods):
        try:
            pipeline_module, logger_module = method()
            FrameAnalysisPipeline = getattr(pipeline_module, 'FrameAnalysisPipeline')
            get_logger = getattr(logger_module, 'get_logger')
            logger.info(f"✅ Imports successful using method {i+1}")
            return FrameAnalysisPipeline, get_logger
        except ImportError as e:
            logger.warning(f"Import method {i+1} failed: {e}")
            continue
    
    # Final fallback: manual import
    try:
        sys.path.insert(0, os.path.join(current_dir, 'src'))
        from src.backend.analysis.pipeline_video_frames import FrameAnalysisPipeline
        from src.backend.utils.logger import get_logger
        logger.info("✅ Imports successful using manual method")
        return FrameAnalysisPipeline, get_logger
    except ImportError as e:
        logger.error(f"❌ All import methods failed: {e}")
        logger.error("Python path: %s", sys.path)
        raise

try:
    FrameAnalysisPipeline, get_logger = setup_imports()
    logger = get_logger(__name__)
except ImportError as e:
    logger.error("Failed to setup imports. Please run: pip install -e .")
    sys.exit(1)

from pathlib import Path

def main():
    """Main analysis function"""
    # Find video file
    video_path = Path("./samples/Helsinki_short.mp4")
    
    if not video_path.exists():
        logger.error(f"Video file not found: {video_path}")
        logger.info("Available video files:")
        for video_file in Path("./samples").glob("*.mp4"):
            logger.info(f"  - {video_file}")
        return
    
    logger.info(f"Starting analysis for: {video_path.name}")
    
    try:
        # Initialize pipeline - use the yolov8n.pt in root directory
        yolo_model_path = "yolov8n.pt"
        if not Path(yolo_model_path).exists():
            yolo_model_path = "./models/yolov8n.pt"
            logger.info(f"Using model from: {yolo_model_path}")
        
        pipeline = FrameAnalysisPipeline(
            video_path=str(video_path),
            output_dir="outputs/frames",
            yolo_model_path=yolo_model_path,
            languages=["en"]
        )

        # Run analysis
        logger.info("Running analysis pipeline...")
        result = pipeline.analyze(save_video=True, display=False)

        logger.info("✅ Analysis complete!")
        logger.info(f"Annotated video: {result['annotated_video']}")
        logger.info(f"YOLO detections: {len(result.get('yolo_results', []))}")
        logger.info(f"OCR detections: {len(result.get('ocr_results', []))}")
        
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise

if __name__ == "__main__":
    main()