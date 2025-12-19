#!/bin/bash
set +o histexpand

LOG_FILE="task_timing.log"
TASK_COUNT=5

echo "===== Start: $(date '+%F %T.%3N') =====" | tee -a "$LOG_FILE"

global_start=$(date +%s%3N)

declare -A START_TIME
declare -A PID_MAP

for i in $(seq 1 $TASK_COUNT)
do
    START_TIME[$i]=$(date +%s%3N)

    echo "[$(date '+%T.%3N')] Task $i started" | tee -a "$LOG_FILE"

    powershell -Command "python test_video_upload.py ./samples/finnish_news.mp4" &

    PID_MAP[$i]=$!
done

# 等待每个任务并统计单独耗时
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

echo "===== All tasks completed =====" | tee -a "$LOG_FILE"
echo "Total elapsed: ${total_elapsed} ms" | tee -a "$LOG_FILE"
