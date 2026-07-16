#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_HOST="${VAA1_BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${VAA1_BACKEND_PORT:-8000}"
FRONTEND_HOST="${VAA1_FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${VAA1_FRONTEND_PORT:-3001}"
CORE_ENV="${VAA1_CORE_ENV:-vaa1_core}"
FACE_ENV="${VAA1_FACE_ENV:-vaa1_face}"
CACHE_ROOT="${VAA1_CACHE_ROOT:-$ROOT_DIR/.cache/vaa1-runtime}"

SETUP_ENVS=0
VERIFY_ENVS=0
REPLACE_PORTS=0
BACKEND_ONLY=0
FRONTEND_ONLY=0
BACKEND_PID=""
FRONTEND_PID=""

usage() {
  cat <<USAGE
Usage: bash scripts/start_vaa1_macos.sh [options]

Options:
  --setup-envs     Update the vaa1_core and vaa1_face Conda environments first.
  --verify-envs    Verify important imports in both Mac Conda environments.
  --replace        Stop existing local listeners on the selected VAA1 ports.
  --backend-only   Start/check only the backend API.
  --frontend-only  Start/check only the frontend.
  --help           Show this help.

Environment overrides:
  VAA1_BACKEND_PORT, VAA1_FRONTEND_PORT, VAA1_CORE_ENV, VAA1_FACE_ENV, VAA1_CACHE_ROOT
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --setup-envs) SETUP_ENVS=1 ;;
    --verify-envs) VERIFY_ENVS=1 ;;
    --replace) REPLACE_PORTS=1 ;;
    --backend-only) BACKEND_ONLY=1 ;;
    --frontend-only) FRONTEND_ONLY=1 ;;
    --help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage; exit 2 ;;
  esac
done

if [[ "$BACKEND_ONLY" -eq 1 && "$FRONTEND_ONLY" -eq 1 ]]; then
  echo "Choose either --backend-only or --frontend-only, not both." >&2
  exit 2
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

port_pid() {
  lsof -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null | head -n 1 || true
}

stop_port_if_requested() {
  local port="$1"
  local name="$2"
  local pid
  pid="$(port_pid "$port")"
  if [[ -z "$pid" ]]; then
    return 0
  fi
  if [[ "$REPLACE_PORTS" -ne 1 ]]; then
    echo "$name port $port is already in use by PID $pid."
    echo "If this is a stale VAA1 process, rerun with --replace."
    return 1
  fi
  echo "Stopping existing $name listener on port $port (PID $pid)."
  kill "$pid" 2>/dev/null || true
  sleep 2
}

backend_health_ok() {
  curl -fsS "http://$BACKEND_HOST:$BACKEND_PORT/api/health" >/dev/null 2>&1
}

backend_matching_route_ok() {
  curl -fsS "http://$BACKEND_HOST:$BACKEND_PORT/openapi.json" 2>/dev/null \
    | grep -q "/api/analysis/{analysis_id}/proliferation/match"
}

frontend_ok() {
  curl -fsS "http://$FRONTEND_HOST:$FRONTEND_PORT/dashboard" >/dev/null 2>&1 \
    || curl -fsS "http://$FRONTEND_HOST:$FRONTEND_PORT" >/dev/null 2>&1
}

wait_for_backend() {
  local attempt
  for attempt in $(seq 1 60); do
    if backend_health_ok; then
      return 0
    fi
    sleep 1
  done
  echo "Backend did not become healthy on http://$BACKEND_HOST:$BACKEND_PORT." >&2
  return 1
}

wait_for_frontend() {
  local attempt
  for attempt in $(seq 1 90); do
    if frontend_ok; then
      return 0
    fi
    sleep 1
  done
  echo "Frontend did not become reachable on http://$FRONTEND_HOST:$FRONTEND_PORT." >&2
  return 1
}

cleanup() {
  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup INT TERM EXIT

require_command conda
require_command curl
require_command lsof

if [[ -n "${VIRTUAL_ENV:-}" ]]; then
  echo "Note: the active virtualenv is not a VAA1 runtime environment and will not be used."
  echo "VAA1 uses the documented Conda environments: $CORE_ENV and $FACE_ENV."
  echo "Read docs/vaa1_macos_startup_runbook_2026-05-03.md for the supported startup path."
fi

mkdir -p "$CACHE_ROOT/matplotlib" "$CACHE_ROOT/ultralytics" "$CACHE_ROOT/xdg"

if [[ "$SETUP_ENVS" -eq 1 ]]; then
  echo "Updating Mac Conda environments from repository YAML files."
  conda env update -f "$ROOT_DIR/environment-MacOS-core.yml" --prune
  conda env update -f "$ROOT_DIR/environment-MacOS-face.yml" --prune
  VERIFY_ENVS=1
fi

if [[ "$VERIFY_ENVS" -eq 1 ]]; then
  echo "Verifying $CORE_ENV imports."
  conda run -n "$CORE_ENV" python -c "import whisper, pandas, cv2, fastapi, uvicorn; print('vaa1_core imports ok')"
  echo "Verifying $FACE_ENV imports."
  conda run -n "$FACE_ENV" python -c "import deepface, cv2, pandas, pydantic; print('vaa1_face imports ok')"
fi

if [[ "$FRONTEND_ONLY" -ne 1 ]]; then
  if [[ "$REPLACE_PORTS" -eq 1 ]]; then
    stop_port_if_requested "$BACKEND_PORT" "Backend"
  fi
  if [[ "$REPLACE_PORTS" -ne 1 ]] && backend_health_ok && backend_matching_route_ok; then
    echo "Backend is already healthy and exposes the proliferation matching route."
  else
    if [[ "$REPLACE_PORTS" -ne 1 ]]; then
      stop_port_if_requested "$BACKEND_PORT" "Backend"
    fi
    echo "Starting backend on http://$BACKEND_HOST:$BACKEND_PORT from $CORE_ENV."
    (
      cd "$ROOT_DIR"
      MPLCONFIGDIR="$CACHE_ROOT/matplotlib" \
      YOLO_CONFIG_DIR="$CACHE_ROOT/ultralytics" \
      XDG_CACHE_HOME="$CACHE_ROOT/xdg" \
      conda run -n "$CORE_ENV" python -m uvicorn api_server:app --host "$BACKEND_HOST" --port "$BACKEND_PORT"
    ) &
    BACKEND_PID="$!"
    wait_for_backend
    if ! backend_matching_route_ok; then
      echo "Backend is healthy, but the proliferation matching route is missing." >&2
      echo "Confirm that the latest code is running, then restart with --replace." >&2
      exit 1
    fi
  fi
fi

if [[ "$BACKEND_ONLY" -ne 1 ]]; then
  if [[ "$REPLACE_PORTS" -eq 1 ]]; then
    stop_port_if_requested "$FRONTEND_PORT" "Frontend"
  fi
  if [[ "$REPLACE_PORTS" -ne 1 ]] && frontend_ok; then
    echo "Frontend is already reachable on http://$FRONTEND_HOST:$FRONTEND_PORT."
  else
    if [[ "$REPLACE_PORTS" -ne 1 ]]; then
      stop_port_if_requested "$FRONTEND_PORT" "Frontend"
    fi
    echo "Starting frontend on http://$FRONTEND_HOST:$FRONTEND_PORT."
    (
      cd "$ROOT_DIR/src/frontend"
      NEXT_PUBLIC_API_URL="http://$BACKEND_HOST:$BACKEND_PORT" \
      npm run dev -- --hostname "$FRONTEND_HOST" --port "$FRONTEND_PORT"
    ) &
    FRONTEND_PID="$!"
    wait_for_frontend
  fi
fi

echo
echo "VAA1 is ready."
echo "Backend:  http://$BACKEND_HOST:$BACKEND_PORT/api/health"
echo "Frontend: http://$FRONTEND_HOST:$FRONTEND_PORT/dashboard"
echo

if [[ -z "$BACKEND_PID" && -z "$FRONTEND_PID" ]]; then
  echo "No new services were started; existing services passed the requested checks."
  exit 0
fi

echo "Press Ctrl+C in this terminal to stop services started by this launcher."

while true; do
  if [[ -n "$BACKEND_PID" ]] && ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    wait "$BACKEND_PID"
    exit $?
  fi
  if [[ -n "$FRONTEND_PID" ]] && ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    wait "$FRONTEND_PID"
    exit $?
  fi
  sleep 2
done
