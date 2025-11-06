# test_critical_deps.py
dependencies = {
    'cv2': 'opencv-python',
    'ultralytics': 'ultralytics', 
    'easyocr': 'easyocr',
    'whisper': 'openai-whisper',
    'ffmpeg': 'ffmpeg-python'
}

for module, package in dependencies.items():
    try:
        __import__(module)
        print(f"✅ {module} ({package}) installed")
    except ImportError as e:
        print(f"❌ {module} ({package}) missing: {e}")

print("\nTesting basic imports...")
try:
    import cv2
    from ultralytics import YOLO
    import easyocr
    import whisper
    import ffmpeg
    print("✅ All critical dependencies imported successfully!")
except Exception as e:
    print(f"❌ Import failed: {e}")