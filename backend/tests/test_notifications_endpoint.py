import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_connection, set_active_context, init_db
from app.services.habit_engine import detect_habits
from app.services.demo_data import load_realistic_demo_dataset

@pytest.fixture
def clean_env(tmp_path, monkeypatch):
    p_path = str(tmp_path / "notif_personal.db")
    d_path = str(tmp_path / "notif_demo.db")
    monkeypatch.setenv("USUALLY_DB_PATH", p_path)
    monkeypatch.setenv("USUALLY_DEMO_DB_PATH", d_path)
    init_db()
    set_active_context("personal")
    return p_path, d_path

def test_notifications_endpoint_returns_200_and_valid_schema(clean_env):
    """Verifies GET /api/notifications returns 200 and schema compliant observations."""
    client = TestClient(app)
    # Seed demo data
    res_seed = client.post("/api/system/seed-demo")
    assert res_seed.status_code == 200

    res = client.get("/api/notifications")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    for obs in data:
        assert "habit_key" in obs
        assert "headline" in obs
        assert "message" in obs
        assert "habit_type" in obs
        assert "confidence" in obs
        assert "evidence" in obs
        assert "freshness_status" in obs
        assert obs["status"] in ("active", "confirmed")

def test_notifications_endpoint_respects_30_day_window(clean_env):
    """Verifies observations older than 30 days are excluded from the fresh notifications feed."""
    p_path, _ = clean_env
    conn = get_connection("personal")

    # Seed an old habit (60 days ago) and a fresh habit (5 days ago)
    today = datetime(2026, 10, 20).date()
    old_date = (today - timedelta(days=60)).strftime("%Y-%m-%d")
    fresh_date = (today - timedelta(days=5)).strftime("%Y-%m-%d")

    with conn:
        # Insert 4 transactions for OldMerchant (all on consecutive Fridays 10-14 weeks ago)
        for i in range(4):
            d = (today - timedelta(weeks=10+i)).strftime("%Y-%m-%d")
            conn.execute("""
                INSERT INTO transactions (date, raw_description, clean_merchant, category, amount, direction, type, currency, fingerprint, is_user_modified, created_at)
                VALUES (?, ?, 'OldMerchant', 'Food & Dining', 200.0, 'debit', 'expense', 'INR', ?, 0, '2026-10-20T00:00:00')
            """, (d, f"Old order {i}", f"fp_old_{i}"))

        # Insert 4 transactions for FreshMerchant on consecutive Fridays within last 4 weeks
        # Note: 2026-10-20 was a Tuesday. So target Tuesdays or Fridays.
        for i in range(4):
            d = (today - timedelta(weeks=i)).strftime("%Y-%m-%d")
            conn.execute("""
                INSERT INTO transactions (date, raw_description, clean_merchant, category, amount, direction, type, currency, fingerprint, is_user_modified, created_at)
                VALUES (?, ?, 'FreshMerchant', 'Food & Dining', 250.0, 'debit', 'expense', 'INR', ?, 0, '2026-10-20T00:00:00')
            """, (d, f"Fresh order {i}", f"fp_fresh_{i}"))

    client = TestClient(app)
    res = client.get("/api/notifications", params={"reference_date": "2026-10-20"})
    assert res.status_code == 200
    data = res.json()

    merchants = [obs.get("merchant") for obs in data if obs.get("merchant")]
    # Fresh merchant should be present, old merchant (> 30 days) must NOT masquerade as fresh notification
    assert "FreshMerchant" in merchants
    assert "OldMerchant" not in merchants

def test_notifications_endpoint_suppresses_muted_habits(clean_env):
    """Verifies that muting a habit excludes it from /api/notifications."""
    client = TestClient(app)
    client.post("/api/system/seed-demo")

    # Fetch initial notifications
    res_before = client.get("/api/notifications").json()
    assert len(res_before) > 0
    target_key = res_before[0]["habit_key"]

    # Mute the target habit
    res_mute = client.post("/api/habits/feedback", json={"habit_key": target_key, "status": "muted"})
    assert res_mute.status_code == 200

    # Fetch notifications again
    res_after = client.get("/api/notifications").json()
    keys_after = [obs["habit_key"] for obs in res_after]
    assert target_key not in keys_after

def test_notifications_endpoint_context_isolation(clean_env):
    """Verifies that demo notifications never leak into personal notifications."""
    client = TestClient(app)
    # Seed demo
    client.post("/api/system/seed-demo")
    demo_notifs = client.get("/api/notifications").json()
    assert len(demo_notifs) > 0

    # Switch to personal
    client.post("/api/system/context", json={"context": "personal"})
    pers_notifs = client.get("/api/notifications").json()
    # Personal has no transactions seeded, so notifications must be empty
    assert len(pers_notifs) == 0

def test_notifications_honest_empty_state_on_sparse_history(clean_env):
    """Verifies that sparse data returns an honest empty list, not synthetic filler."""
    client = TestClient(app)
    # 0 transactions
    res = client.get("/api/notifications")
    assert res.status_code == 200
    assert res.json() == []
