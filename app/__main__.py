import sys
import os
import traceback
import multiprocessing

try:
    with open("backend_startup.log", "w") as f:
        f.write("Backend imports starting...\n")

    import argparse
    import uvicorn
    from app.main import app

    def main():
        parser = argparse.ArgumentParser(description="Recall Backend Sidecar")
        parser.add_argument("--host", type=str, default="127.0.0.1", help="Host bind address")
        parser.add_argument("--port", type=int, default=8000, help="Port number")
        args = parser.parse_args()

        with open("backend_startup.log", "a") as f:
            f.write(f"Starting uvicorn on {args.host}:{args.port}\n")
            
        # Watchdog thread to ensure the backend exits when its parent (Tauri/Bootloader) dies
        import threading
        import psutil
        import time
        def watchdog():
            ppid = os.getppid()
            while True:
                try:
                    if not psutil.pid_exists(ppid):
                        os._exit(0)
                except Exception:
                    pass
                time.sleep(2)
        threading.Thread(target=watchdog, daemon=True).start()

        # Prevent Uvicorn from crashing on Windows when stdin is a pipe (NotImplementedError in ProactorEventLoop)
        if sys.platform == "win32":
            sys.stdin = None
            
        uvicorn.run(app, host=args.host, port=args.port, log_level="info")

    if __name__ == "__main__":
        multiprocessing.freeze_support()
        main()

except Exception as e:
    with open("backend_crash.log", "w") as f:
        f.write(traceback.format_exc())
    sys.exit(1)
