import json

from college_etl.config import DATASET_PKG, SNAPSHOTS_DIR
from college_etl.emit import content_hash


def test_committed_snapshot_hash_matches_content():
    doc = json.loads((DATASET_PKG / "snapshot.json").read_text())
    assert content_hash(doc) == doc["contentHash"]
    manifest = json.loads((SNAPSHOTS_DIR / doc["snapshotId"] / "manifest.json").read_text())
    assert manifest["contentHash"] == doc["contentHash"]
