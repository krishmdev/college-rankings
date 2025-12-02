from college_etl.sentinels import scorecard_value, urban_value


def test_scorecard_sentinels():
    assert scorecard_value("NULL") == (None, False)
    assert scorecard_value("NA") == (None, False)
    assert scorecard_value("") == (None, False)
    assert scorecard_value(None) == (None, False)
    assert scorecard_value("PrivacySuppressed") == (None, True)
    assert scorecard_value("0.8866") == (0.8866, False)
    assert scorecard_value("12abc") == (None, False)


def test_urban_negative_codes_are_missing():
    assert urban_value(-1) is None
    assert urban_value(-2.0) is None
    assert urban_value(-3) is None
    assert urban_value(None) is None
    assert urban_value(1994.0) == 1994.0
    assert urban_value(0) == 0.0
