#!/usr/bin/env bash
set -euo pipefail

API_ROOT="${VAA1_API_ROOT:-http://127.0.0.1:8000}"
COOLING_SECONDS="${VAA1_QUEUE_COOLING_SECONDS:-600}"
POLL_SECONDS="${VAA1_QUEUE_POLL_SECONDS:-30}"

# Shortest-source-first after the already completed Videos 4 and 6.
ANALYSIS_IDS=(
  "2368228a-f46d-4339-bf7b-5f1966a33ee5"
  "ac1af180-df4a-41cd-aed9-c79b91329197"
  "ca6d0ebf-cbb5-4f7e-8502-f8b0693daf33"
  "c034341f-3fba-495e-a7d1-0af03a46cb6c"
  "00c22625-82e8-4ddc-bb36-317422664214"
)

status_json() {
  # Use the bounded shell status rather than materializing the full analysis
  # payload every 30 seconds while a heavy analysis is running.
  curl -fsS "$API_ROOT/api/status/$1/summary"
}

start_analysis() {
  curl -fsS -X POST \
    "$API_ROOT/api/analyze/$1?pipeline_type=full&analysis_tier=science_scan&modality_focus=multimodal&morphology_pack_policy=core_only&allow_rough_interpretation=true"
}

for index in "${!ANALYSIS_IDS[@]}"; do
  analysis_id="${ANALYSIS_IDS[$index]}"
  current="$(status_json "$analysis_id")"
  state="$(jq -r '.status' <<<"$current")"

  if [[ "$state" == "completed" ]]; then
    echo "$analysis_id already completed."
    continue
  fi
  if [[ "$state" != "processing" ]]; then
    echo "Starting $analysis_id."
    start_analysis "$analysis_id" >/dev/null
  fi

  while true; do
    current="$(status_json "$analysis_id")"
    state="$(jq -r '.status' <<<"$current")"
    progress="$(jq -r '.progress' <<<"$current")"
    message="$(jq -r '.mission_message // ""' <<<"$current")"
    echo "$(date '+%Y-%m-%d %H:%M:%S') $analysis_id $state ${progress}% $message"

    if [[ "$state" == "completed" ]]; then
      break
    fi
    if [[ "$state" == "error" || "$state" == "partial" || "$state" == "failed" ]]; then
      echo "Queue stopped: $analysis_id reached terminal state $state." >&2
      exit 1
    fi
    sleep "$POLL_SECONDS"
  done

  if (( index < ${#ANALYSIS_IDS[@]} - 1 )); then
    echo "Cooling for ${COOLING_SECONDS}s before the next governed run."
    cooling_remaining="$COOLING_SECONDS"
    while (( cooling_remaining > 0 )); do
      sleep "$POLL_SECONDS"
      cooling_remaining=$(( cooling_remaining - POLL_SECONDS ))
      if (( cooling_remaining < 0 )); then cooling_remaining=0; fi
      echo "Cooling: ${cooling_remaining}s remaining."
    done
  fi
done

echo "Remaining Science scan queue completed."
