"""Tests for rounding module."""

from shield.rounding import round_half_away


def test_round_positive_half():
    assert round_half_away(0.5) == 1


def test_round_negative_half():
    assert round_half_away(-0.5) == -1


def test_round_positive_below_half():
    assert round_half_away(0.4) == 0


def test_round_positive_above_half():
    assert round_half_away(0.6) == 1


def test_round_negative_below_half():
    assert round_half_away(-0.4) == 0


def test_round_negative_above_half():
    assert round_half_away(-0.6) == -1


def test_round_exact_integers():
    assert round_half_away(3.0) == 3
    assert round_half_away(-3.0) == -3


def test_round_zero():
    assert round_half_away(0.0) == 0


def test_round_1_5():
    assert round_half_away(1.5) == 2


def test_round_2_5():
    assert round_half_away(2.5) == 3


def test_round_neg_1_5():
    assert round_half_away(-1.5) == -2


def test_round_neg_2_5():
    assert round_half_away(-2.5) == -3
