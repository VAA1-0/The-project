# check_analysis.py
import requests
import time
import json

def check_all_analyses():
    print("🔍 Checking All Analyses Status")
    print("=" * 50)
    
    # 1. Check API health
    try:
        health = requests.get("http://localhost:8000/api/health", timeout=5)
        print(f"✅ API Health: {health.json().get('status', 'unknown')}")
    except:
        print("❌ API not responding")
        return
    
    # 2. Get all analyses
    try:
        analyses = requests.get("http://localhost:8000/api/analyses?limit=20", timeout=5)
        analyses_data = analyses.json()
        
        print(f"\n📋 Total Analyses: {len(analyses_data.get('analyses', {}))}")
        print("-" * 50)
        
        # Count by status
        status_count = {}
        for aid, info in analyses_data.get('analyses', {}).items():
            status = info.get('status', 'unknown')
            status_count[status] = status_count.get(status, 0) + 1
            
            # Show details for processing analyses
            if status == 'processing':
                print(f"\n⚡ PROCESSING: {aid[:12]}...")
                print(f"   Progress: {info.get('progress', 0)}%")
                print(f"   File: {info.get('filename', 'N/A')}")
                print(f"   Type: {info.get('pipeline_type', 'full')}")
        
        print(f"\n📊 Status Summary:")
        for status, count in status_count.items():
            print(f"   {status}: {count}")
            
    except Exception as e:
        print(f"❌ Error getting analyses: {e}")

if __name__ == "__main__":
    check_all_analyses()