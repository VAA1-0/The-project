# Test script to verify installations
import cv2
print(f"OpenCV version: {cv2.__version__}")

import easyocr
print(f"EasyOCR imported successfully")

from ultralytics import YOLO
print(f"YOLOv8 (Ultralytics) imported successfully")

import torch
print(f"PyTorch version: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")

import ffmpeg
print(f"FFmpeg Python wrapper imported successfully")