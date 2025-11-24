import sys
import os
print("Current directory:", os.getcwd())
print("Python path:", sys.path)

try:
    from src.backend.analysis.pipeline_video_frames import FrameAnalysisPipeline
    from src.backend.utils.logger import get_logger
    print(" SUCCESS: All imports working!")
    
    # Test the imports work
    logger = get_logger("test")
    logger.info("Logger is working!")
    
except ImportError as e:
    print(f" FAILED: {e}")
    print("Available modules:")
    if os.path.exists("src"):
        print("src exists:", os.listdir("src"))
    if os.path.exists("src/backend"):
        print("backend exists:", os.listdir("src/backend"))
