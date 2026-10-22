import pytest
from unittest.mock import patch
from app.services.ai_generator import (
    generate_deterministic_observation,
    validate_ai_claims,
    generate_observation_with_ai
)

def test_deterministic_generator_content():
    habit = {
        "habit_type": "weekday_cadence",
        "merchant": "Swiggy",
        "evidence": {
            "target_weekday": "Wednesday",
            "matching_days_count": 4,
            "total_target_days": 5,
            "today_is_target_day": True,
            "has_order_today": False
        }
    }
    title, headline, message = generate_deterministic_observation(habit)
    assert "Wednesday again" in headline
    assert "4 of your last 5 Wednesdays" in message
    assert "Cooking tonight, buddy?" in message

def test_validate_ai_claims_accepts_valid_numbers():
    evidence = {
        "active_months": 5,
        "total_months": 6,
        "merchant": "Amazon"
    }
    # Text uses only numbers from evidence
    valid_text = "Amazon has appeared in 5 of your last 6 months. A quiet month so far."
    assert validate_ai_claims(valid_text, evidence) is True

def test_validate_ai_claims_rejects_hallucinated_numbers():
    evidence = {
        "active_months": 5,
        "total_months": 6,
        "merchant": "Amazon"
    }
    # Text hallucinates "14 orders" or "99 dollars" which are NOT in evidence
    hallucinated_text = "Amazon has seen 14 orders across 5 of your last 6 months costing 999 dollars."
    assert validate_ai_claims(hallucinated_text, evidence) is False

def test_validate_ai_claims_rejects_digit_sharing_hallucinations():
    evidence = {
        "matching_days_count": 4,
        "total_target_days": 5
    }
    # Substring trap: 9850 and 500000000 contain digit '5', but are not the number 5
    assert validate_ai_claims("Spent 9850 on 4 of your last 5 days", evidence) is False
    assert validate_ai_claims("Spent 500000000 dollars across 4 days", evidence) is False

def test_validate_ai_claims_rejects_polarity_contradiction():
    evidence = {
        "diff_percentage": 25.0,
        "is_higher": True
    }
    # Polarity conflict: is_higher=True contradicts "dropped by"
    contradicting = "Your spending dropped by 25% this month."
    assert validate_ai_claims(contradicting, evidence) is False

def test_validate_ai_claims_accepts_rounded_floats():
    evidence = {
        "cur_avg": 450.25,
        "prior_avg": 380.0
    }
    valid = "Orders averaged ₹450 compared to typical ₹380."
    assert validate_ai_claims(valid, evidence) is True

def test_ai_fallback_when_ollama_offline():
    habit = {
        "habit_type": "weekday_cadence",
        "merchant": "Swiggy",
        "evidence": {
            "target_weekday": "Wednesday",
            "matching_days_count": 4,
            "total_target_days": 5,
            "today_is_target_day": True,
            "has_order_today": False
        }
    }
    # With Ollama offline, it must return valid observation and indicate deterministic_engine
    with patch("app.services.ai_generator.check_ollama_status", return_value=(False, "offline")):
        title, headline, message, gen_by = generate_observation_with_ai(habit)
        assert gen_by == "deterministic_engine"
        assert "Wednesday" in headline
        assert "Swiggy" in message
