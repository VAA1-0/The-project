FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    ffmpeg \
    wget \
    git \
    build-essential \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip first
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# ============================================
# INSTALL ALL PACKAGES DIRECTLY
# ============================================

# 1. Install PyTorch with CPU support
RUN pip install --no-cache-dir \
    torch==2.9.0 torchaudio==2.9.0 torchvision==0.24.0 \
    --index-url https://download.pytorch.org/whl/cpu

# 2. Install core scientific packages
RUN pip install --no-cache-dir \
    numpy==2.2.6 \
    pandas==2.3.3 \
    scipy==1.15.3 \
    matplotlib==3.10.7 \
    pillow==12.0.0

# 3. Install computer vision packages
RUN pip install --no-cache-dir \
    opencv-python==4.12.0.88 \
    opencv-python-headless==4.12.0.88 \
    scikit-image==0.25.2 \
    easyocr==1.7.2 \
    ultralytics==8.3.225 \
    ultralytics-thop==2.0.18

# 4. Install NLP/ML packages
RUN pip install --no-cache-dir \
    transformers==4.57.1 \
    spacy==3.8.9 \
    openai-whisper==20250625 \
    whisper==1.1.10 \
    tiktoken==0.12.0 \
    tokenizers==0.22.1 \
    safetensors==0.6.2

# 5. Install web/API packages
RUN pip install --no-cache-dir \
    fastapi==0.121.3 \
    uvicorn==0.38.0 \
    pydantic==2.12.4 \
    pydantic-core==2.41.5 \
    starlette==0.50.0 \
    python-multipart==0.0.20

# 6. Install SpaCy dependencies
RUN pip install --no-cache-dir \
    spacy-legacy==3.0.12 \
    spacy-loggers==1.0.5 \
    blis==1.3.2 \
    catalogue==2.0.10 \
    confection==0.1.5 \
    cymem==2.0.13 \
    murmurhash==1.0.15 \
    preshed==3.0.11 \
    srsly==2.5.1 \
    thinc==8.3.9 \
    wasabi==1.1.3 \
    weasel==0.4.3

# 7. Install data processing packages
RUN pip install --no-cache-dir \
    polars==1.35.1 \
    polars-runtime-32==1.35.1 \
    shapely==2.1.2 \
    pyclipper==1.3.0.post6 \
    tifffile==2025.5.10 \
    imageio==2.37.2

# 8. Install async/network packages
RUN pip install --no-cache-dir \
    aiofiles==25.1.0 \
    anyio==4.11.0 \
    requests==2.32.5 \
    urllib3==2.5.0 \
    httpx \
    cloudpathlib==0.23.0 \
    fsspec==2025.10.0 \
    smart-open==7.5.0

# 9. Install utility packages
RUN pip install --no-cache-dir \
    tqdm==4.67.1 \
    psutil==7.1.3 \
    pyyaml==6.0.3 \
    python-dateutil==2.9.0.post0 \
    pytz==2025.2 \
    tzdata==2025.2 \
    six==1.17.0 \
    filelock==3.20.0 \
    packaging==25.0

# 10. Install development/build packages
RUN pip install --no-cache-dir \
    ninja==1.13.0 \
    numba==0.62.1 \
    llvmlite==0.45.1 \
    lazy-loader==0.4 \
    networkx==3.4.2 \
    more-itertools==10.8.0

# 11. Install CLI/UI packages
RUN pip install --no-cache-dir \
    click==8.3.1 \
    colorama==0.4.6 \
    typer-slim==0.20.0 \
    python-bidi==0.6.7 \
    ffmpeg-python==0.2.0

# 12. Install typing/annotation packages
RUN pip install --no-cache-dir \
    typing-extensions==4.15.0 \
    typing-inspection==0.4.2 \
    annotated-types==0.7.0 \
    annotated-doc==0.0.4

# 13. Install math/symbolic packages
RUN pip install --no-cache-dir \
    sympy==1.14.0 \
    mpmath==1.3.0

# 14. Install remaining packages
RUN pip install --no-cache-dir \
    contourpy==1.3.2 \
    cycler==0.12.1 \
    fonttools==4.60.1 \
    kiwisolver==1.4.9 \
    pyparsing==3.2.5 \
    jinja2==3.1.6 \
    markupsafe==3.0.3 \
    charset-normalizer==3.4.4 \
    idna==3.11 \
    certifi==2025.10.5 \
    h11==0.16.0 \
    sniffio==1.3.1 \
    exceptiongroup==1.3.1 \
    future==1.0.0 \
    huggingface-hub==0.36.0 \
    regex==2025.11.3 \
    wrapt==2.0.1

# Create necessary directories
RUN mkdir -p /app/outputs /app/uploads /app/models

# Copy application code
COPY . .

# Download Spacy model
RUN python -m spacy download en_core_web_sm

# Expose port
EXPOSE 8000

# Run the application
CMD ["python", "api_server.py"]