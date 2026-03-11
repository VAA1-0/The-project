from setuptools import setup, find_packages

setup(
    name="video-analysis",
    version="1.0.0",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "opencv-python>=4.8.0",
        "ultralytics>=8.0.0",
        "easyocr>=1.7.0",
        "pandas>=1.5.0",
        "numpy>=1.24.0",
        "Pillow>=9.0.0",
    ],
    python_requires=">=3.8",
)
