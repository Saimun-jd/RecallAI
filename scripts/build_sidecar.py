import os
import sys
import platform
import subprocess

def get_target_triple():
    system = platform.system().lower()
    machine = platform.machine().lower()

    if system == "windows":
        # Usually x86_64-pc-windows-msvc
        arch = "x86_64" if machine in ["amd64", "x86_64"] else machine
        return f"{arch}-pc-windows-msvc"
    elif system == "darwin":
        # aarch64-apple-darwin or x86_64-apple-darwin
        arch = "aarch64" if machine in ["arm64", "aarch64"] else "x86_64"
        return f"{arch}-apple-darwin"
    elif system == "linux":
        # x86_64-unknown-linux-gnu
        arch = "x86_64" if machine in ["amd64", "x86_64"] else machine
        return f"{arch}-unknown-linux-gnu"
    return f"{machine}-unknown-{system}"

def main():
    target_triple = get_target_triple()
    exe_name = f"recall-backend-{target_triple}"
    
    if platform.system().lower() == "windows":
        exe_name += ".exe"

    # We want to output to desktop/src-tauri/binaries/
    # The script is run from chunk-service, so the path is ../desktop/src-tauri/binaries
    # Actually, the user asked to put desktop in the root of the chunk-service workspace. 
    # Let's output to desktop/src-tauri/binaries relative to chunk-service root.
    
    out_dir = os.path.join("desktop", "src-tauri", "binaries")
    os.makedirs(out_dir, exist_ok=True)

    cmd = [
        "pyinstaller",
        "--name", exe_name.replace(".exe", ""),
        "--onefile",
        "--distpath", out_dir,
        "--hidden-import", "uvicorn.logging",
        "--hidden-import", "uvicorn.loops",
        "--hidden-import", "uvicorn.loops.auto",
        "--hidden-import", "uvicorn.protocols",
        "--hidden-import", "uvicorn.protocols.http",
        "--hidden-import", "uvicorn.protocols.http.auto",
        "--hidden-import", "uvicorn.protocols.websockets",
        "--hidden-import", "uvicorn.protocols.websockets.auto",
        "--hidden-import", "uvicorn.lifespan",
        "--hidden-import", "uvicorn.lifespan.on",
        "--hidden-import", "uvicorn.lifespan.off",
        "--hidden-import", "pydantic_settings",
        "--hidden-import", "platformdirs",
        "--hidden-import", "fastapi",
        "--hidden-import", "pymupdf",
        "--hidden-import", "pymupdf4llm",
        "--hidden-import", "fsrs",
        "--collect-data", "pymupdf",
        "--collect-data", "pymupdf4llm",
        "--exclude-module", "PyQt5",
        "--exclude-module", "PySide6",
        "--exclude-module", "tkinter",
        "--exclude-module", "matplotlib",
        "--exclude-module", "IPython",
        "--exclude-module", "notebook",
        "--exclude-module", "jupyter",
        "--exclude-module", "PIL",
        "--exclude-module", "cv2",
        "--exclude-module", "scipy",
        "--exclude-module", "pandas",
        "--exclude-module", "boto3",
        "--exclude-module", "botocore",
        "--exclude-module", "unittest",
        "--exclude-module", "pytest",
        "--exclude-module", "jinja2",
        "--exclude-module", "torch",
        "--exclude-module", "torchvision",
        "app/__main__.py"
    ]

    print(f"Running build command: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)
    
    print(f"Successfully built sidecar to {os.path.join(out_dir, exe_name)}")

if __name__ == "__main__":
    main()
