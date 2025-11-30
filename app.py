# app.py
import os
import sys
import subprocess
import threading
import time
import webbrowser
from pathlib import Path

def check_npm_available():
    """Check if npm is available in the system"""
    try:
        subprocess.run(["npm", "--version"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def check_frontend_exists():
    """Check if frontend directory and package.json exist"""
    frontend_dir = Path("src/frontend")
    package_json = frontend_dir / "package.json"
    
    if not frontend_dir.exists():
        print(f"❌ Frontend directory not found: {frontend_dir.absolute()}")
        return False
    
    if not package_json.exists():
        print(f"❌ package.json not found in frontend directory")
        return False
    
    print(f"✅ Frontend found at: {frontend_dir.absolute()}")
    return True

def is_port_in_use(port):
    """Check if a port is already in use"""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def start_backend():
    """Start the FastAPI backend"""
    print("🚀 Starting FastAPI backend...")
    
    if is_port_in_use(8000):
        print("✅ Backend already running on http://localhost:8000")
        return None
    
    try:
        backend_process = subprocess.Popen([
            sys.executable, "api_server.py"
        ])
        time.sleep(3)
        print("✅ Backend started on http://localhost:8000")
        print("📚 API Documentation: http://localhost:8000/docs")
        return backend_process
    except Exception as e:
        print(f"❌ Failed to start backend: {e}")
        return None

def start_frontend():
    """Start the Next.js frontend"""
    print("🎨 Starting Next.js frontend...")
    
    if is_port_in_use(3000):
        print("✅ Frontend already running on http://localhost:3000")
        return None
    
    # Check prerequisites
    if not check_npm_available():
        print("❌ npm is not available. Please install Node.js or ensure it's in your PATH")
        return None
    
    if not check_frontend_exists():
        return None
    
    frontend_dir = Path("src/frontend")
    
    try:
        # Check if node_modules exists, if not run npm install first
        node_modules = frontend_dir / "node_modules"
        if not node_modules.exists():
            print("📦 Installing frontend dependencies...")
            install_process = subprocess.run(
                ["npm", "install"], 
                cwd=frontend_dir,
                capture_output=True,
                text=True
            )
            if install_process.returncode != 0:
                print(f"❌ Failed to install dependencies: {install_process.stderr}")
                return None
            print("✅ Dependencies installed")
        
        # Start the frontend development server
        print("🚀 Starting frontend development server...")
        frontend_process = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=frontend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Wait for frontend to start
        time.sleep(8)  # Give it more time to start
        print("✅ Frontend started on http://localhost:3000")
        return frontend_process
        
    except Exception as e:
        print(f"❌ Failed to start frontend: {e}")
        return None

def open_browser():
    """Open browser to the frontend"""
    time.sleep(10)  # Wait longer for servers to start
    print("🌐 Opening browser to http://localhost:3000")
    try:
        webbrowser.open("http://localhost:3000")
    except Exception as e:
        print(f"⚠️ Could not open browser automatically: {e}")
        print("Please manually visit: http://localhost:3000")

def main():
    """Main application runner"""
    print("=" * 60)
    print("🎥 Video Analysis Application")
    print("=" * 60)
    
    # Start backend
    backend_process = start_backend()
    if not backend_process:
        print("❌ Backend failed to start. Exiting.")
        return
    
    # Start frontend  
    frontend_process = start_frontend()
    
    # Open browser
    browser_thread = threading.Thread(target=open_browser)
    browser_thread.daemon = True
    browser_thread.start()
    
    print("\n" + "=" * 60)
    if frontend_process:
        print("✅ Full application is running!")
    else:
        print("⚠️ Backend is running, but frontend failed to start")
    print("📍 Frontend: http://localhost:3000")
    print("📍 Backend API: http://localhost:8000")
    print("📍 API Docs: http://localhost:8000/docs")
    print("\nPress Ctrl+C to stop the application")
    print("=" * 60)
    
    try:
        # Keep the application running
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Shutting down application...")
        
        # Terminate processes
        if frontend_process:
            frontend_process.terminate()
        if backend_process:
            backend_process.terminate()
        
        print("✅ Application stopped")

if __name__ == "__main__":
    main()