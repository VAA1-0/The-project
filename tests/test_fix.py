import sys
import os

print("=== Testing Project Setup ===")
print(f"Python executable: {sys.executable}")
print(f"Current directory: {os.getcwd()}")
print(f"Python path: {sys.path}")

# Test basic imports
try:
    import cv2
    print("✅ OpenCV imported")
except ImportError as e:
    print(f"❌ OpenCV failed: {e}")

try:
    import ultralytics
    print("✅ Ultralytics imported")
except ImportError as e:
    print(f"❌ Ultralytics failed: {e}")

# Test project imports
try:
    from src.backend.analysis.pipeline_video_frames import FrameAnalysisPipeline
    print("✅ FrameAnalysisPipeline imported")
except ImportError as e:
    print(f"❌ FrameAnalysisPipeline failed: {e}")

try:
    from src.backend.utils.logger import get_logger
    print("✅ get_logger imported")
    
    # Test logger
    logger = get_logger("test")
    logger.info("✅ Logger is working!")
except ImportError as e:
    print(f"❌ get_logger failed: {e}")

print("=== Test Complete ===")