"""Tests for scanner module."""

from shield.scanner import scan_text


def test_scan_names():
    result = scan_text('James Chen did well in class', {
        'knownNames': ['James Chen'],
    })
    name_flags = [f for f in result['flags'] if f['type'] == 'name']
    assert len(name_flags) >= 1
    assert any(f['value'] == 'James Chen' for f in name_flags)


def test_scan_individual_name_parts():
    result = scan_text('Chen improved this term', {
        'knownNames': ['James Chen'],
    })
    name_flags = [f for f in result['flags'] if f['type'] == 'name']
    assert any(f['value'] == 'Chen' for f in name_flags)


def test_scan_medical_keywords():
    result = scan_text('The student has ADHD and dyslexia', {})
    kw_flags = [f for f in result['flags'] if f['type'] == 'keyword']
    assert any(f['value'].lower() == 'adhd' for f in kw_flags)
    assert any(f['value'].lower() == 'dyslexia' for f in kw_flags)


def test_scan_safeguarding_keywords():
    result = scan_text('Referred to social services for assessment', {})
    kw_flags = [f for f in result['flags'] if f['type'] == 'keyword']
    assert any(f['subtype'] == 'safeguarding' for f in kw_flags)


def test_scan_family_keywords():
    result = scan_text('His mother called to discuss progress', {})
    kw_flags = [f for f in result['flags'] if f['type'] == 'keyword']
    assert any(f['value'].lower() == 'mother' for f in kw_flags)


def test_scan_dates():
    result = scan_text('The incident on 15/03/2024 was significant', {})
    date_flags = [f for f in result['flags'] if f['type'] == 'date']
    assert len(date_flags) == 1
    assert date_flags[0]['value'] == '15/03/2024'


def test_scan_postcodes():
    result = scan_text('Lives at SW1A 2AA', {})
    pc_flags = [f for f in result['flags'] if f['type'] == 'postcode']
    assert len(pc_flags) == 1


def test_scan_emails():
    result = scan_text('Contact j.chen@school.org for details', {})
    email_flags = [f for f in result['flags'] if f['type'] == 'email']
    assert len(email_flags) == 1
    assert email_flags[0]['value'] == 'j.chen@school.org'


def test_scan_phones():
    result = scan_text('Call 07700 900123', {})
    phone_flags = [f for f in result['flags'] if f['type'] == 'phone']
    assert len(phone_flags) >= 1


def test_cleaned_text_redactions():
    result = scan_text('James Chen has ADHD', {
        'knownNames': ['James Chen'],
    })
    assert '[REDACTED NAME]' in result['cleaned']
    assert '[ADDITIONAL NEEDS]' in result['cleaned']
    assert 'James Chen' not in result['cleaned']


def test_cleaned_text_family():
    result = scan_text('His mother called', {})
    assert '[PARENT/GUARDIAN]' in result['cleaned']


def test_scan_empty_text():
    result = scan_text('', {})
    assert result['flags'] == []
    assert result['cleaned'] == ''


def test_scan_no_matches():
    result = scan_text('The weather is nice today', {})
    # No names, no keywords expected
    name_flags = [f for f in result['flags'] if f['type'] == 'name']
    assert len(name_flags) == 0


def test_staff_names():
    result = scan_text('As discussed with Mrs Patel', {
        'staffNames': ['Mrs Patel'],
    })
    name_flags = [f for f in result['flags'] if f['type'] == 'name']
    assert any('Patel' in f['value'] for f in name_flags)
