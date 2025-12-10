#!/usr/bin/env bash
# Engine timing run. Takes the shared compute lease when the portfolio tools are present so the
# numbers aren't polluted by other heavy jobs, and records host state next to the result.
set -euo pipefail
cd "$(dirname "$0")/.."
tools="${PORTFOLIO_TOOLS:-$HOME/Developer/portfolio/.tools}"
out="$PWD/docs/results/engine-bench.json"
run() {
  BENCH_OUT="$out" pnpm --filter @college/ranking-engine bench
}
if [ -x "$tools/compute_lease.py" ] || [ -f "$tools/compute_lease.py" ]; then
  export -f run; export out
  python3 "$tools/compute_lease.py" run college-rankings-bench -- bash -c "
    python3 '$tools/run_manifest.py' --out '$PWD/docs/results/engine-bench.manifest.json' \
      workload=ranking-engine-bench runtime=node warm_index=true && run"
else
  echo "compute lease tools not found; running without a manifest" >&2
  run
fi
