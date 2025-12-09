import sys
import time
import requests
from pathlib import Path

API_URL = "http://127.0.0.1:8000"

def main():
    if len(sys.argv) != 2:
        print("Usage: python test_video_upload.py <VIDEO_PATH>")
        sys.exit(1)

    video_path = Path(sys.argv[1]).resolve()

    if not video_path.exists():
        print(f"❌ Video file not found: {video_path}")
        sys.exit(1)

    print("🎬 Video:", video_path)

    # ----------------------------
    # 1. Upload video
    # ----------------------------
    print("\n⬆️ Uploading video...")

    with open(video_path, "rb") as f:
        files = {"file": f}
        data = {"cvatID": 123}
        r = requests.post(f"{API_URL}/api/upload", files=files, data=data)

    if r.status_code != 200:
        print("❌ Upload failed:")
        print(r.text)
        return

    upload_data = r.json()
    analysis_id = upload_data["analysis_id"]
    print("✅ Upload successful!")
    print("🆔 Analysis ID:", analysis_id)

    # ----------------------------
    # 2. Start analysis
    # ----------------------------
    print("\n🚀 Starting analysis...")

    r = requests.post(
        f"{API_URL}/api/analyze/{analysis_id}",
        params={"pipeline_type": "full"}
    )

    if r.status_code != 200:
        print("❌ Failed to start analysis:")
        print(r.text)
        return

    # ----------------------------
    # 3. Track progress
    # ----------------------------
    print("\n⏳ Tracking progress...\n")

    while True:
        r = requests.get(f"{API_URL}/api/status/{analysis_id}")

        if r.status_code != 200:
            print("❌ Failed to fetch status:")
            print(r.text)
            return

        status_info = r.json()
        status = status_info["status"]
        progress = status_info.get("progress", 0)

        print(f"Status: {status} | Progress: {progress}%")

        if status == "completed":
            break
        elif status == "error":
            print("❌ Analysis failed!")
            print("Error:", status_info.get("error"))
            return

        time.sleep(3)

    # ----------------------------
    # 4. Print output locations
    # ----------------------------
    print("\n✅ Analysis complete!\n")

    links = status_info.get("download_links", {})

    if not links:
        print("⚠️ No output files reported by API.")
        return

    print("📦 Output file URLs:\n")
    for name, path in links.items():
        print(f"- {name}: {API_URL}{path}")

if __name__ == "__main__":
    main()
