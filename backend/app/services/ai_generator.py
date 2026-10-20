import re
import json
import httpx
import time
from typing import Dict, Any, Tuple, Optional
from app.config import OLLAMA_BASE_URL, OLLAMA_MODEL

_OLLAMA_CACHE = {"timestamp": 0.0, "status": (False, "offline")}

def check_ollama_status() -> Tuple[bool, str]:
    """
    Checks if Ollama is accessible locally and if the target model is available.
    Caches the result for 5 seconds to prevent repeated network timeouts when offline.
    """
    now = time.time()
    if now - _OLLAMA_CACHE["timestamp"] < 5.0:
        return _OLLAMA_CACHE["status"]

    try:
        with httpx.Client(timeout=0.5) as client:
            resp = client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if resp.status_code == 200:
                data = resp.json()
                models = [m.get("name", "") for m in data.get("models", [])]
                model_found = any(OLLAMA_MODEL in m for m in models)
                res = (True, (OLLAMA_MODEL if model_found else (models[0] if models else "none")))
                _OLLAMA_CACHE["timestamp"] = now
                _OLLAMA_CACHE["status"] = res
                return res
    except Exception:
        pass
    res = (False, "offline")
    _OLLAMA_CACHE["timestamp"] = now
    _OLLAMA_CACHE["status"] = res
    return res

def generate_deterministic_observation(habit: Dict[str, Any], tone: str = "playful") -> Tuple[str, str, str]:
    """
    Produces high-fidelity observations directly from evidence with tone options:
    - 'playful': Witty, humorous, conversational
    - 'dry': Deadpan, direct, pragmatic
    - 'minimal': Concise, data-focused, single sentence
    Returns: (title, headline, message)
    """
    h_type = habit.get("habit_type")
    evidence = habit.get("evidence", {})
    merchant = habit.get("merchant", "This merchant")
    category = habit.get("category", "General")
    tone = habit.get("tone", tone) or "playful"

    if h_type == "weekday_cadence":
        weekday = evidence.get("target_weekday", "weekday")
        matching = evidence.get("matching_days_count", 0)
        total = evidence.get("total_target_days", 0)
        is_today = evidence.get("today_is_target_day", False)
        has_order = evidence.get("has_order_today", False)

        title = f"{merchant} cadence on {weekday}s"
        if tone == "minimal":
            headline = f"{merchant} on {weekday}s"
            message = f"{merchant} recorded on {matching} of the last {total} {weekday}s."
        elif tone == "dry":
            headline = f"{weekday} recurring pattern."
            message = f"You ordered from {merchant} on {matching} of your last {total} {weekday}s. {'No transaction logged today.' if is_today and not has_order else 'Logged today.'}"
        else:
            # Playful
            if is_today and not has_order:
                headline = f"{weekday} again."
                message = f"You've ordered from {merchant} on {matching} of your last {total} {weekday}s. No order yet today. Cooking tonight, buddy?"
            elif is_today and has_order:
                headline = f"{weekday} tradition honored."
                message = f"Right on cue. That's {matching} of your last {total} {weekday}s with {merchant}. The streak continues unbroken."
            else:
                headline = f"{merchant} on {weekday}s"
                message = f"A recurring pattern: {matching} of your last {total} {weekday}s featured {merchant}. Some habits keep their own calendar."
        return title, headline, message

    elif h_type == "multi_month_recurrent":
        active_m = evidence.get("active_months", 0)
        total_m = evidence.get("total_months", 0)
        has_order = evidence.get("has_order_current_month", False)

        title = f"{merchant} across months"
        if tone == "minimal":
            headline = f"{merchant} consistency"
            message = f"{merchant} appeared in {active_m} of your last {total_m} recorded months."
        elif tone == "dry":
            headline = f"{merchant} longitudinal presence."
            message = f"Recorded in {active_m} of the last {total_m} months. Current month status: {'active' if has_order else 'no entries yet'}."
        else:
            if not has_order:
                headline = f"{merchant} has gone quiet."
                message = f"{merchant} has appeared in {active_m} of your last {total_m} months. A quiet month so far. Are we healing, or is Prime Day still loading?"
            else:
                headline = f"{merchant} checked in right on time."
                message = f"{merchant} has logged orders in {active_m} of your last {total_m} recorded months. Steady as a metronome."
        return title, headline, message

    elif h_type == "pace_shift":
        diff_pct = evidence.get("diff_percentage", 0.0)
        is_higher = evidence.get("is_higher", True)
        as_of_day = evidence.get("as_of_day", 15)

        title = f"{category} spending pace"
        if tone == "minimal":
            headline = f"{category} pacing"
            message = f"{category} spend is {abs(diff_pct):.0f}% {'above' if is_higher else 'below'} baseline pace as of Day {as_of_day}."
        elif tone == "dry":
            headline = f"{category} pace deviation."
            message = f"Current month spending is tracking {abs(diff_pct):.0f}% {'higher' if is_higher else 'lower'} than historical baseline by Day {as_of_day}."
        else:
            if is_higher:
                headline = f"{category} is running warm."
                message = f"Your {category} spending is {abs(diff_pct):.0f}% higher than your usual pace by day {as_of_day} of the month. Something worth celebrating?"
            else:
                headline = f"Noticeable discipline in {category}."
                message = f"You're tracking {abs(diff_pct):.0f}% below your historical baseline pace for {category} this month. Deliberate restraint or just busy?"
        return title, headline, message

    elif h_type == "payee_shift":
        diff_pct = evidence.get("diff_percentage", 0.0)
        cur_avg = evidence.get("current_avg", 0.0)
        prior_avg = evidence.get("prior_avg", 0.0)
        is_higher = evidence.get("is_higher", True)

        title = f"{merchant} ticket size shift"
        if tone == "minimal":
            headline = f"{merchant} average"
            message = f"Average ticket size at {merchant} is ₹{cur_avg:.0f} vs historical ₹{prior_avg:.0f} ({diff_pct:+.0f}%)."
        elif tone == "dry":
            headline = f"Payee ticket shift: {merchant}."
            message = f"Recent transactions average ₹{cur_avg:.0f}, shifted {diff_pct:+.0f}% from prior average of ₹{prior_avg:.0f}."
        else:
            if is_higher:
                headline = f"{merchant} orders creeping up."
                message = f"Your {merchant} orders are averaging ₹{cur_avg:.0f} this month, up {abs(diff_pct):.0f}% from your usual ₹{prior_avg:.0f}. Upgrading the order or dining with company?"
            else:
                headline = f"{merchant} orders tightening."
                message = f"Your {merchant} purchases average ₹{cur_avg:.0f} this month, down {abs(diff_pct):.0f}% from your typical ₹{prior_avg:.0f}. A modest trim on the bill."
        return title, headline, message

    elif h_type == "weekend_surge":
        we_pct = evidence.get("weekend_percentage", 0.0)
        title = f"Weekend weight in {category}"
        if tone == "minimal":
            headline = "Weekend allocation"
            message = f"{we_pct:.0f}% of {category} expenses occur on weekends."
        elif tone == "dry":
            headline = f"Weekend concentration in {category}."
            message = f"Transactions show {we_pct:.0f}% of total {category} volume concentrated on Saturdays and Sundays."
        else:
            headline = "The weekend takes the bill."
            message = f"{we_pct:.0f}% of your {category} spending lands strictly on Saturdays and Sundays. The workweek gets discipline, the weekend gets the rest."
        return title, headline, message

    return (
        f"Pattern in {category}",
        "Observing your rhythm.",
        f"We noted a regular rhythm around {merchant or category}. Longitudinal data will sharpen this as more statements land."
    )

def validate_ai_claims(generated_text: str, evidence: Dict[str, Any]) -> bool:
    """
    Validates that:
    1. Numbers mentioned by AI exist in the evidence.
    2. Polarity (higher vs lower) does not contradict evidence.
    """
    found_nums = set(re.findall(r"\b\d+(?:\.\d+)?\b", generated_text))
    valid_nums = set()

    def extract_from_obj(obj):
        if isinstance(obj, (int, float)):
            valid_nums.add(str(int(obj)))
            valid_nums.add(str(round(obj, 1)))
            valid_nums.add(str(round(obj, 0)).split(".")[0])
        elif isinstance(obj, str):
            for n in re.findall(r"\b\d+(?:\.\d+)?\b", obj):
                valid_nums.add(n)
        elif isinstance(obj, dict):
            for v in obj.values():
                extract_from_obj(v)
        elif isinstance(obj, list):
            for v in obj:
                extract_from_obj(v)

    extract_from_obj(evidence)

    safe_digits = {"1", "2", "7", "24", "100"}

    for num in found_nums:
        if num in safe_digits:
            continue
        matched = False
        for v in valid_nums:
            if num == v or num in v or v in num:
                matched = True
                break
        if not matched:
            return False

    # Check polarity contradiction if present
    is_higher = evidence.get("is_higher")
    lowered = generated_text.lower()
    if is_higher is True:
        if any(w in lowered for w in ["dropped by", "decreased by", "fell by", "plummeted", "lower than your usual pace"]):
            return False
    elif is_higher is False:
        if any(w in lowered for w in ["surged by", "increased by", "higher than your usual pace"]):
            return False

    return True

def generate_observation_with_ai(habit: Dict[str, Any]) -> Tuple[str, str, str, str]:
    """
    Attempts to generate observation via local Ollama (Gemma) if available.
    Falls back to deterministic engine if:
    - Ollama is offline
    - Output fails validation
    - Any error occurs
    Returns: (title, headline, message, generated_by)
    """
    tone = habit.get("tone", "playful")
    det_title, det_headline, det_message = generate_deterministic_observation(habit, tone=tone)

    ollama_ok, model_name = check_ollama_status()
    if not ollama_ok:
        return det_title, det_headline, det_message, "deterministic_engine"

    prompt = f"""You are Usually, an observant, local-first finance companion.
Tone: {tone}
Write a short 2-sentence observation grounded ONLY in these verified facts:
Habit: {habit.get('habit_type')}
Merchant: {habit.get('merchant', 'N/A')}
Category: {habit.get('category', 'N/A')}
Facts: {json.dumps(habit.get('evidence', {}))}

Rules:
- Headline: 3 to 6 words.
- Message: Exactly 2 punchy sentences.
- NEVER invent dates, amounts, numbers, or motives. Use ONLY numbers from the Facts.
- Output JSON format with keys: "headline" and "message".
"""
    try:
        with httpx.Client(timeout=1.5) as client:
            resp = client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": model_name,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json"
                }
            )
            if resp.status_code == 200:
                result_json = resp.json()
                raw_out = result_json.get("response", "").strip()
                parsed = json.loads(raw_out)
                hl = parsed.get("headline", "").strip()
                msg = parsed.get("message", "").strip()
                if hl and msg:
                    if validate_ai_claims(hl + " " + msg, habit.get("evidence", {})):
                        return det_title, hl, msg, "ollama_gemma"
    except Exception:
        pass

    return det_title, det_headline, det_message, "deterministic_engine"
