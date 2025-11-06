# quick_test.py
import sys
print(f"Python version: {sys.version}")

libs = ['cv2', 'ultralytics', 'easyocr', 'whisper', 'ffmpeg']
for lib in libs:
    try:
        __import__(lib)
        print(f"SUCCESS: {lib} imported")
    except ImportError as e:
        print(f"FAILED: {lib} - {e}")

print("\nTesting specific imports...")
try:
    from ultralytics import YOLO
    import cv2
    import easyocr
    import whisper
    import ffmpeg
    print("ALL CRITICAL IMPORTS SUCCESSFUL!")
except ImportError as e:
    print(f"Import failed: {e}")