"""Run the API and built dashboard locally. Run setup commands in README first."""

import os
from pathlib import Path
import subprocess
import sys
import time

root = Path(__file__).resolve().parents[1]
python = root / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
vite = root / "frontend/node_modules/vite/bin/vite.js"
if (
    not python.exists()
    or not vite.exists()
    or not (root / "frontend/dist/index.html").exists()
):
    sys.exit("Complete the README setup steps (including pnpm build) first.")
processes = []
try:
    processes.append(
        subprocess.Popen(
            [
                str(python),
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                "8000",
            ],
            cwd=root / "backend",
        )
    )
    processes.append(
        subprocess.Popen(
            [
                "node",
                str(vite),
                "preview",
                "--configLoader",
                "native",
                "--host",
                "127.0.0.1",
                "--port",
                "5173",
            ],
            cwd=root / "frontend",
        )
    )
    print(
        "Dashboard: http://127.0.0.1:5173   API docs: http://127.0.0.1:8000/docs",
        flush=True,
    )
    while all(process.poll() is None for process in processes):
        time.sleep(0.5)
    sys.exit("A server stopped. Read its output above.")
except KeyboardInterrupt:
    print("\nStopping OrderFlow.")
finally:
    for process in processes:
        if process.poll() is None:
            process.terminate()
    for process in processes:
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
