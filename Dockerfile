FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for OpenCV and FFmpeg
# libgl1-mesa-glx is replaced with libgl1 in newer Debian
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/outputs /app/uploads /app/models

# Expose port
EXPOSE 8000

# Run the application
CMD ["python", "api_server.py"]