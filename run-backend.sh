#!/bin/bash
export PATH="/home/jcwl/.hermes/node/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

# Source all env vars from .env (skip comments and empty lines)
set -a
while IFS== read -r key value; do
  [[ -z "$key" || "$key" == \#* ]] && continue
  value="${value%\"}"
  value="${value#\"}"
  export "$key=$value"
done < /home/jcwl/workspace/hoppscotch/.env
set +a

cd /home/jcwl/workspace/hoppscotch/packages/hoppscotch-backend
echo "Starting backend..."
node dist/src/main.js
