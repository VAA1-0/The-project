# debug_analysis.py
import requests
import json

analysis_id = "fec0779f-1d41-43db-ba21-0090accfcea3"
base_url = "http://localhost:8000"

def debug_analysis():
    print("🔍 Debugging Analysis Stuck at 90%...")
    
    # 1. Check status
    status_url = f"{base_url}/api/status/{analysis_id}"
    status_response = requests.get(status_url)
    status_data = status_response.json()
    
    print(f"📊 Current Status: {status_data['status']}")
    print(f"📈 Progress: {status_data['progress']}%")
    
    if 'error' in status_data:
        print(f"❌ Error: {status_data['error']}")
    
    # 2. Check if we can force completion by checking files
    print("\n📁 Checking for output files...")
    
    # Try to download files that should exist
    file_types = ['audio', 'transcript', 'yolo_csv', 'ocr_csv']
    
    for file_type in file_types:
        try:
            download_url = f"{base_url}/api/download/{analysis_id}/{file_type}"
            response = requests.get(download_url)
            if response.status_code == 200:
                print(f"✅ {file_type.upper()} file exists and is downloadable")
            else:
                print(f"❌ {file_type.upper()} file not available (HTTP {response.status_code})")
        except Exception as e:
            print(f"❌ {file_type.upper()} file check failed: {e}")
    
    # 3. Check analyses list
    print("\n📋 Checking analyses list...")
    analyses_response = requests.get(f"{base_url}/api/analyses")
    analyses_data = analyses_response.json()
    
    our_analysis = analyses_data.get('analyses', {}).get(analysis_id, {})
    print(f"Our analysis in list: {our_analysis}")

if __name__ == "__main__":
    debug_analysis()