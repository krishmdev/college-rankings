"""Writes docs/results/supabase-tests.manifest.json next to a supabase-test.sh log.

source_files_sha256 is the binding record of what was tested. git_head_at_run is the commit that
was checked out, and dirty_files lists any tracked source that differed from it at run time.
"""

import hashlib
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

SOURCES = [
    "package.json",
    "pnpm-lock.yaml",
    "scripts/supabase-test.sh",
    "supabase/config.toml",
    "supabase/seed.sql",
    *sorted(str(p) for p in Path("supabase/migrations").glob("*.sql")),
    *sorted(str(p) for p in Path("supabase/tests").glob("*.sql")),
    *sorted(str(p) for p in Path("supabase/integration").glob("*.mjs")),
    *sorted(str(p) for p in Path("supabase/templates").glob("*.html")),
]


def sha(path: str) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def git(*args: str) -> str:
    return subprocess.run(["git", *args], capture_output=True, text=True).stdout.strip()


log_path = sys.argv[1]
log = Path(log_path).read_text()
pgtap = re.search(r"Files=\d+, Tests=(\d+)", log)
node_pass = re.search(r"^# pass (\d+)", log, re.M)
node_fail = re.search(r"^# fail (\d+)", log, re.M)
manifest = {
    "recorded_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "command": "pnpm supabase:test",
    "exclusive_run": bool(os.environ.get("RUN_WRAPPER")),
    "supabase_cli": json.loads(Path("package.json").read_text())["devDependencies"]["supabase"],
    "git_head_at_run": git("rev-parse", "HEAD"),
    "dirty_files": [f for f in git("status", "--porcelain", "--", *SOURCES).splitlines() if f],
    "pgtap_result": "PASS" if "Result: PASS" in log else "FAIL",
    "pgtap_tests": int(pgtap.group(1)) if pgtap else None,
    "auth_integration_passed": int(node_pass.group(1)) if node_pass else None,
    "auth_integration_failed": int(node_fail.group(1)) if node_fail else None,
    "log_sha256": sha(log_path),
    "source_files_sha256": {f: sha(f) for f in SOURCES},
}
Path("docs/results/supabase-tests.manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps({k: manifest[k] for k in ("pgtap_result", "pgtap_tests", "auth_integration_passed", "auth_integration_failed")}))
