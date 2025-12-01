import requests
import json

def test_docker_api():
    print("Testing Docker API connection...")
    
    # Test 1: Health check
    try:
        resp = requests.get("http://localhost:8000/api/health", timeout=5)
        print(f"✅ Health check: {resp.json()}")
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return
    
    # Test 2: Upload a test video
    print("\nTesting upload endpoint...")
    try:
        with open("samples/Helsinki_short.mp4", "rb") as f:
            files = {"file": ("test.mp4", f, "video/mp4")}
            resp = requests.post("http://localhost:8000/api/upload", files=files)
            print(f"✅ Upload response: {resp.json()}")
            
            if resp.status_code == 200:
                analysis_id = resp.json()["analysis_id"]
                
                # Test 3: Start analysis
                print(f"\nStarting analysis for ID: {analysis_id}")
                resp = requests.post(f"http://localhost:8000/api/analyze/{analysis_id}")
                print(f"✅ Analysis started: {resp.json()}")
                
                # Test 4: Check status
                import time
                for i in range(10):
                    time.sleep(2)
                    resp = requests.get(f"http://localhost:8000/api/status/{analysis_id}")
                    status = resp.json()
                    print(f"Progress: {status.get('progress', 0)}% - {status.get('status')}")
                    if status["status"] == "completed":
                        print("✅ Analysis completed!")
                        break
    except Exception as e:
        print(f"❌ Test failed: {e}")

if __name__ == "__main__":
    test_docker_api()