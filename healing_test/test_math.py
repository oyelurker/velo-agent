import pytest
from math_utils import add, subtract, multiply, divide


def test_add():
    assert add(2, 3) == 5


def test_add_negatives():
    assert add(-1, -1) == -2


def test_subtract():
    assert subtract(10, 4) == 6


def test_multiply():
    assert multiply(3, 4) == 12


def test_divide():
    assert divide(10, 2) == 5.0


def test_divide_by_zero():
    with pytest.raises(ValueError):
        divide(5, 0)
