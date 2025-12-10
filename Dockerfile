FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir \
    pycocotools \
    seaborn \
    scikit-learn \
    scikit-image \
    matplotlib \
    pandas \
    tqdm

# Create directories
RUN mkdir -p /app/outputs /app/uploads /app/models

# Step 1: Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# Step 2: Install NumPy 1.x FIRST (critical!)
RUN pip install --no-cache-dir numpy==1.24.3

# Step 3: Download and install spaCy model BEFORE other packages
# Use the .tar.gz format, not .whl
RUN wget -q https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0.tar.gz -O /tmp/model.tar.gz && \
    pip install --no-cache-dir /tmp/model.tar.gz && \
    rm /tmp/model.tar.gz

# Step 4: Now install other requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Step 5: Force numpy back to 1.x (in case anything upgraded it)
RUN pip install --no-cache-dir --force-reinstall numpy==1.24.3

# Step 6: Verify installations
RUN python -c "import numpy; print(f'NumPy version: {numpy.__version__}')"
RUN python -c "import spacy; nlp = spacy.load('en_core_web_sm'); print(f'SpaCy model loaded: {nlp.meta[\"name\"]} v{nlp.meta[\"version\"]}')"

# Copy application
COPY . .

EXPOSE 8000

CMD ["python", "api_server.py"]