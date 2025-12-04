import json

from college_etl.config import DATASET_PKG, SNAPSHOTS_DIR
from college_etl.emit import content_hash


def test_committed_snapshot_hash_matches_content():
    doc = json.loads((DATASET_PKG / "snapshot.json").read_text())
    assert content_hash(doc) == doc["contentHash"]
    manifest = json.loads((SNAPSHOTS_DIR / doc["snapshotId"] / "manifest.json").read_text())
    assert manifest["contentHash"] == doc["contentHash"]


def _schools():
    doc = json.loads((DATASET_PKG / "snapshot.json").read_text())
    return {s["id"]: s for s in doc["schools"]}


def test_committed_snapshot_matches_pydantic_schema():
    from college_etl.schema import Snapshot

    Snapshot.model_validate(json.loads((DATASET_PKG / "snapshot.json").read_text()))


def test_joint_herd_members_are_unknown_not_zero():
    schools = _schools()
    # UMD Baltimore, UNMC and OU Health Sciences sit inside their parent's joint HERD row.
    for member, parent in [(163259, 163286), (181428, 181464), (207342, 207500)]:
        s = schools[member]
        assert s["values"]["research_total"] is None
        assert s["values"]["research_per_student"] is None
        assert s["flags"]["research_total"] == "reported_with_parent"
        assert s["reportedWith"]["research_total"] == parent
        assert schools[parent]["values"]["research_total"] > 0
