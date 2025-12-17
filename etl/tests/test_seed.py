from college_etl.seed import domain_map, email_domain


def test_web_prefixes_are_stripped():
    assert email_domain("web.mit.edu") == "mit.edu"
    assert email_domain("wp.stolaf.edu") == "stolaf.edu"
    assert email_domain("bu.edu") == "bu.edu"
    assert email_domain("new.edu") == "new.edu"


def test_shared_domain_goes_to_largest_campus_and_extras_override():
    schools = [
        {"id": 1, "domain": "ohio.edu", "ugSize": 20000},
        {"id": 2, "domain": "ohio.edu", "ugSize": 1500},
        {"id": 3, "domain": "twin-cities.umn.edu", "ugSize": 30000},
    ]
    m = domain_map(schools, [{"domain": "umn.edu", "unitid": "3"}])
    assert m == {"ohio.edu": 1, "twin-cities.umn.edu": 3, "umn.edu": 3}
