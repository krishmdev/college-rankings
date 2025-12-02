from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from .config import CACHE_DIR, USER_AGENT


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def client(timeout: float = 60.0) -> httpx.Client:
    return httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=timeout, follow_redirects=True)


@retry(
    retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
    wait=wait_exponential(multiplier=2, max=30),
    stop=stop_after_attempt(4),
    reraise=True,
)
def _download(c: httpx.Client, url: str, dest: Path, etag: str | None) -> tuple[bool, str | None]:
    headers = {"If-None-Match": etag} if etag else {}
    tmp = dest.with_suffix(dest.suffix + ".part")
    with c.stream("GET", url, headers=headers) as r:
        if r.status_code == 304:
            return False, etag
        r.raise_for_status()
        with tmp.open("wb") as fh:
            for chunk in r.iter_bytes(1 << 16):
                fh.write(chunk)
        new_etag = r.headers.get("etag")
    tmp.replace(dest)
    return True, new_etag


def fetch(url: str, name: str, *, refresh: bool = False, cache_dir: Path = CACHE_DIR) -> dict:
    """Download `url` into the cache as `name`, with a sidecar recording sha256, ETag and retrieval time.

    Returns the sidecar metadata. Without `refresh`, a cached file is reused as-is.
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    dest = cache_dir / name
    meta_path = cache_dir / f"{name}.meta.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    if dest.exists() and meta and not refresh:
        return meta
    with client() as c:
        changed, etag = _download(c, url, dest, meta.get("etag") if dest.exists() else None)
    if changed or not meta:
        meta = {
            "url": url,
            "file": name,
            "sha256": sha256_file(dest),
            "bytes": dest.stat().st_size,
            "etag": etag,
            "retrieved": time.strftime("%Y-%m-%d"),
        }
        meta_path.write_text(json.dumps(meta, indent=2) + "\n")
    return meta


def adopt(path: Path, url: str, cache_dir: Path = CACHE_DIR) -> dict:
    """Record sidecar metadata for a file that is already in the cache (e.g. downloaded by hand)."""
    meta = {
        "url": url,
        "file": path.name,
        "sha256": sha256_file(path),
        "bytes": path.stat().st_size,
        "etag": None,
        "retrieved": time.strftime("%Y-%m-%d", time.localtime(path.stat().st_mtime)),
    }
    (cache_dir / f"{path.name}.meta.json").write_text(json.dumps(meta, indent=2) + "\n")
    return meta
