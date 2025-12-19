#!/bin/bash
set +o histexpand

LOG_FILE="task_timing.log"
TASK_COUNT=2

echo "===== Start: $(date '+%F %T.%3N') =====" | tee -a "$LOG_FILE"

global_start=$(date +%s%3N)

declare -A START_TIME
declare -A PID_MAP

for i in $(seq 1 $TASK_COUNT)
do
    START_TIME[$i]=$(date +%s%3N)

    echo "[$(date '+%T.%3N')] Task $i started" | tee -a "$LOG_FILE"

    powershell -Command "python3 test_video_upload.py ./samples/finnish_news.mp4" &
    # gnome-terminal -- bash -c "python3 test_video_upload.py ./samples/finnish_news.mp4" &

    PID_MAP[$i]=$!
done

# Wait for all tasks to complete
for i in "${!PID_MAP[@]}"
do
    pid=${PID_MAP[$i]}
    wait $pid

    end_time=$(date +%s%3N)
    elapsed=$((end_time - START_TIME[$i]))

    echo "[$(date '+%T.%3N')] Task $i finished, elapsed: ${elapsed} ms" \
        | tee -a "$LOG_FILE"
done

global_end=$(date +%s%3N)
total_elapsed=$((global_end - global_start))

unset PID_MAP
unset START_TIME

echo "===== All tasks completed =====" | tee -a "$LOG_FILE"
echo "Total elapsed: ${total_elapsed} ms" | tee -a "$LOG_FILE"
