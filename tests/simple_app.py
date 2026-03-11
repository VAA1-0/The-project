# simple_app.py
import os
import subprocess
import time
import webbrowser

def run_application():
    print("Starting Video Analysis Application...")
    
    # Start backend
    print("1. Starting FastAPI backend on http://localhost:8000")
    backend_process = subprocess.Popen(["python", "api_server.py"])
    
    # Wait for backend to start
    time.sleep(3)
    
    # Start frontend
    print("2. Starting Next.js frontend on http://localhost:3000")
    frontend_process = subprocess.Popen(
        ["npm", "run", "dev"], 
        cwd="src/frontend",
        shell=True
    )
    
    # Wait a bit and open browser
    time.sleep(5)
    print("3. Opening browser to http://localhost:3000")
    webbrowser.open("http://localhost:3000")
    
    print("\n✅ Application is running!")
    print("   Frontend: http://localhost:3000")
    print("   Backend API: http://localhost:8000")
    print("   API Docs: http://localhost:8000/docs")
    print("\nPress Enter to stop...")
    
    try:
        input()  # Wait for user input
    except KeyboardInterrupt:
        pass
    finally:
        print("Shutting down...")
        frontend_process.terminate()
        backend_process.terminate()

if __name__ == "__main__":
    run_application()