"""Tests for identifiers module."""

from shield.identifiers import detect_identifier_columns


def test_detect_upn():
    assert 0 in detect_identifier_columns(['UPN'])


def test_detect_dob():
    assert 0 in detect_identifier_columns(['DOB'])


def test_detect_date_of_birth():
    assert 0 in detect_identifier_columns(['Date of Birth'])


def test_detect_postcode():
    assert 0 in detect_identifier_columns(['Postcode'])


def test_detect_email():
    assert 0 in detect_identifier_columns(['Email'])


def test_detect_phone():
    assert 0 in detect_identifier_columns(['Phone'])


def test_detect_nhs():
    assert 0 in detect_identifier_columns(['NHS Number'])


def test_detect_address():
    assert 0 in detect_identifier_columns(['Address'])


def test_detect_case_insensitive():
    assert 0 in detect_identifier_columns(['upn'])
    assert 0 in detect_identifier_columns(['DOB'])
    assert 0 in detect_identifier_columns(['email'])


def test_no_false_positives():
    result = detect_identifier_columns(['Name', 'Score', 'SEN'])
    assert result == []


def test_multiple_identifiers():
    result = detect_identifier_columns(['Name', 'UPN', 'DOB', 'Score'])
    assert 1 in result
    assert 2 in result
    assert 0 not in result
    assert 3 not in result
