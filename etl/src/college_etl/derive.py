from __future__ import annotations

from .transform import SchoolRow


def _ratio(num: float | None, den: float | None) -> float | None:
    if num is None or den is None or den <= 0:
        return None
    return num / den


def derive(s: SchoolRow) -> None:
    total_enrollment = s.ug_size + s.grads
    v = s.values
    # A joint HERD figure is spread over every campus it covers, not just the reporting one.
    v["research_per_student"] = _ratio(v.get("research_total"), total_enrollment + s.member_enrollment)
    v["endowment_per_student"] = _ratio(s.endowment, total_enrollment)
    clubs = v.get("clubs_count")
    v["clubs_per_1k_ug"] = _ratio(clubs * 1000 if clubs is not None else None, s.ug_size)
    price = v.get("net_price")
    v["earnings_to_price"] = _ratio(v.get("median_earnings_10y"), 4 * price if price is not None else None)

    # A derived metric inherits the caveat of the value it was built from.
    for derived, base in (("research_per_student", "research_total"), ("clubs_per_1k_ug", "clubs_count")):
        if base in s.flags and (v.get(derived) is not None or s.flags[base] == "reported_with_parent"):
            s.flags[derived] = s.flags[base]
        if base in s.reported_with:
            s.reported_with[derived] = s.reported_with[base]
