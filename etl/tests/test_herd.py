import polars as pl

from college_etl.sources.herd import Exclusion, Override, join, read_frame


def herd_frame(rows):
    cols = ["inst_id", "ipeds_unitid", "inst_name_long", "inst_state_code", "questionnaire_no", "row", "data"]
    out = []
    for inst_id, unitid, name, usd_k in rows:
        out.append([inst_id, unitid, name, "MD", "01.g", "Total", str(usd_k)])
        out.append([inst_id, unitid, name, "MD", "01.a", "Federal", "1"])  # ignored
    return pl.DataFrame(out, schema=cols, orient="row")


def test_reads_total_rd_in_dollars():
    rows = read_frame(herd_frame([("1", "100", "A", 784355)]), "standard")
    assert len(rows) == 1
    assert rows[0].usd == 784_355_000
    assert rows[0].unitid == 100


def test_missing_unitid_would_be_lost_without_the_crosswalk():
    rows = read_frame(
        herd_frame([("029977", None, "Johns Hopkins University", 4_129_260), ("2", "200", "B", 5)]),
        "standard",
    )
    universe = {162928, 200}
    bare = join(rows, universe, {}, {}, gate_usd=10e6)
    assert 162928 not in bare.usd
    assert [r.inst_id for r in bare.unresolved] == ["029977"]

    ov = {"029977": Override("029977", 162928, "Johns Hopkins University", True, "")}
    fixed = join(rows, universe, ov, {}, gate_usd=10e6)
    assert fixed.usd[162928] == 4_129_260_000
    assert fixed.system_level == {162928}
    assert fixed.unresolved == []


def test_gate_ignores_small_rows_and_explicit_exclusions():
    rows = read_frame(
        herd_frame([("x", None, "Small institute", 5_000), ("y", "999", "Med school", 300_000)]), "standard"
    )
    j = join(rows, {1}, {}, {}, gate_usd=10e6)
    assert [r.inst_id for r in j.unresolved] == ["y"]
    j2 = join(rows, {1}, {}, {"y": Exclusion("y", "Med school", "graduate only")}, gate_usd=10e6)
    assert j2.unresolved == [] and j2.excluded_rows == 1


def test_units_rolling_up_to_one_campus_are_summed():
    rows = read_frame(
        herd_frame([("a", None, "Anschutz", 741_600), ("b", None, "Denver", 24_300)]), "standard"
    )
    ov = {
        "a": Override("a", 126562, "Anschutz", True, ""),
        "b": Override("b", 126562, "Denver", True, ""),
    }
    j = join(rows, {126562}, ov, {}, gate_usd=10e6)
    assert j.usd[126562] == 765_900_000
