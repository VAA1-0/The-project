"""
Logging Utility for VAA1
------------------------
Provides a reusable get_logger() function for consistent, formatted logging
across backend modules and pipelines.

Supports:
 - Console + file logging
 - Rotating log files
 - Configurable log level via environment variable
"""

import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path
from datetime import datetime


def get_logger(name: str = "vaa1", log_dir: str = "logs", level: str = "INFO") -> logging.Logger:
    """
    Returns a configured logger instance.

    Args:
        name (str): Module name or custom logger name.
        log_dir (str): Directory to store log files.
        level (str): Minimum log level ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL").

    Returns:
        logging.Logger: Configured logger.
    """
    # Ensure log directory exists
    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)

    # Create a timestamped log file (rotated daily)
    today = datetime.now().strftime("%Y-%m-%d")
    log_file = log_path / f"vaa1_{today}.log"

    # Define logging format
    log_format = (
        "[%(asctime)s] [%(levelname)s] "
        "[%(name)s:%(lineno)d] — %(message)s"
    )
    formatter = logging.Formatter(log_format, datefmt="%Y-%m-%d %H:%M:%S")

    # Get or create logger
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Avoid duplicate handlers in case of multiple imports
    if not logger.handlers:
        # Console Handler
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

        # File Handler with rotation (5MB max per file, keep last 5)
        file_handler = RotatingFileHandler(
            log_file, maxBytes=5 * 1024 * 1024, backupCount=5, encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    # Optional: Silence overly verbose third-party loggers
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("ffmpeg").setLevel(logging.WARNING)
    logging.getLogger("PIL").setLevel(logging.WARNING)

    return logger
