# Dockerfile - Updated with Audio Processing
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies (added libsndfile1 for audio processing)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsm6 \
    libxext6 \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for better caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir torch==2.1.1 torchvision==0.16.1 --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

# Install spaCy model correctly
RUN python -m spacy download en_core_web_sm --direct

# Copy project
COPY . .

# Create directories (added audio and transcripts directories)
RUN mkdir -p uploads outputs/api_results static outputs/audio outputs/transcripts

EXPOSE 8000

CMD ["python", "api_server.py"]