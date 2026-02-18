#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
[ ! -d "venv" ] && python3 -m venv venv
source venv/bin/activate
pip install -q -r requirements.txt
echo "Starting on http://localhost:8000  Docs: http://localhost:8000/docs"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
