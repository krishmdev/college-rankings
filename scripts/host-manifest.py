"""Writes a small host record next to a timing result: chip, RAM, OS, power source, and whether
the run was wrapped so no other heavy jobs ran alongside it (RUN_WRAPPER set)."""

import json
import os
import platform
import subprocess
import sys
import time


def sh(cmd: list[str]) -> str:
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=10).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return ""


out, *extra = sys.argv[1:]
mem = sh(["sysctl", "-n", "hw.memsize"])
power = sh(["pmset", "-g", "batt"]).splitlines()
manifest = {
    "recorded_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    "host": {
        "chip": sh(["sysctl", "-n", "machdep.cpu.brand_string"]) or platform.processor(),
        "ram_gb": round(int(mem) / 2**30, 1) if mem.isdigit() else None,
        "os": f"{platform.system()} {platform.release()}",
        "power": power[0] if power else "",
    },
    "exclusive_run": bool(os.environ.get("RUN_WRAPPER")),
    "extra": dict(kv.split("=", 1) for kv in extra),
}
with open(out, "w") as fh:
    json.dump(manifest, fh, indent=2)
    fh.write("\n")
