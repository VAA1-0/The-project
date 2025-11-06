# test_no_unicode.py
import sys
print(f"Python version: {sys.version}")

# Test basic imports
try:
    import cv2
    print(f"OpenCV version: {cv2.__version__}")
    print("SUCCESS: OpenCV works!")
except ImportError as e:
    print(f"FAILED: OpenCV failed - {e}")

try:
    from ultralytics import YOLO
    print("SUCCESS: Ultralytics works!")
except ImportError as e:
    print(f"FAILED: Ultralytics failed - {e}")

try:
    import easyocr
    print("SUCCESS: EasyOCR works!")
except ImportError as e:
    print(f"FAILED: EasyOCR failed - {e}")

try:
    import whisper
    print("SUCCESS: Whisper works!")
except ImportError as e:
    print(f"FAILED: Whisper failed - {e}")