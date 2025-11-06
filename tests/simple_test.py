# simple_test.py
import sys
print(f"Python version: {sys.version}")

# Test basic imports
try:
    import cv2
    print(f"OpenCV version: {cv2.__version__}")
    print("✅ OpenCV works!")
except ImportError as e:
    print(f"❌ OpenCV failed: {e}")

try:
    import ultralytics
    print("✅ Ultralytics works!")
except ImportError as e:
    print(f"❌ Ultralytics failed: {e}")