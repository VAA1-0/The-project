# test_download.py
import requests
import json

analysis_id = "cf3c6581-ab6e-4d56-91c9-d022c9d78190"

# Get status to see download links
status_url = f"http://localhost:8000/api/status/{analysis_id}"
status = requests.get(status_url).json()

print("Analysis Status:")
print(json.dumps(status, indent=2))

# List all available files
if "download_links" in status:
    print("\n📁 Available files to download:")
    for file_type, url in status["download_links"].items():
        print(f"  {file_type}: {url}")

# Try to download one file
if "download_links" in status and "video" in status["download_links"]:
    print("\n📥 Testing download...")
    download_url = f"http://localhost:8000/api/download/{analysis_id}/video"
    response = requests.get(download_url)
    
    if response.status_code == 200:
        with open(f"{analysis_id}_annotated_video.mp4", "wb") as f:
            f.write(response.content)
        print(f"✅ Downloaded annotated video: {analysis_id}_annotated_video.mp4")
    else:
        print(f"❌ Download failed: {response.status_code}")