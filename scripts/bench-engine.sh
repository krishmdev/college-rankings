#!/usr/bin/env bash
# Engine timing run. Writes docs/results/engine-bench.json and a host manifest next to it.
# RUN_WRAPPER (optional, empty by default) is a command prefix that holds off other heavy jobs for
# the duration, so they don't skew the timings.
set -euo pipefail
cd "$(dirname "$0")/.."
out="$PWD/docs/results/engine-bench.json"
python3 scripts/host-manifest.py docs/results/engine-bench.manifest.json \
  workload=ranking-engine-bench runtime=node warm_index=true
${RUN_WRAPPER:-} env BENCH_OUT="$out" pnpm --filter @college/ranking-engine bench
