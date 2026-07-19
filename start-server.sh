#!/bin/bash
# Persistent server runner — restarts Next.js if it crashes
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting Next.js dev server..." >> /home/z/my-project/server-runner.log
  node ./node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE. Restarting in 3s..." >> /home/z/my-project/server-runner.log
  sleep 3
done
