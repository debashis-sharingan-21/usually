import pytest
import os
import json
import sqlite3
from fastapi.testclient import TestClient
from app.main import app
from app.config import WORKSPACES_DIR

CSV_DATA_USER_A = """Date,Description,Amount,Type
01/03/2026,Swiggy Order #1234,350.00,Debit
02/03/2026,Netflix Subscription,649.00,Debit
03/03/2026,Salary Credit,50000.00,Credit
"""

CSV_DATA_USER_B = """Date,Description,Amount,Type
05/03/2026,Blue Tokai Coffee,280.00,Debit
06/03/2026,Cult Fitness,1500.00,Debit
"""

MAPPING = {
    "date": "Date",
    "description": "Description",
    "amount": "Amount",
    "type": "Type"
}

@pytest.fixture
def client():
    return TestClient(app)

def test_instant_guest_workspace_creation(client):
    res = client.post("/api/auth/guest")
    assert res.status_code == 200
    data = res.json()
    assert "token" in data
    assert data["user"]["is_guest"] is True
    assert data["user"]["id"].startswith("guest_")
    assert data["workspace_type"] == "personal"

def test_multi_user_data_isolation(client):
    # 1. Create two isolated guest users
    res_a = client.post("/api/auth/guest")
    assert res_a.status_code == 200
    token_a = res_a.json()["token"]
    user_id_a = res_a.json()["user"]["id"]

    res_b = client.post("/api/auth/guest")
    assert res_b.status_code == 200
    token_b = res_b.json()["token"]
    user_id_b = res_b.json()["user"]["id"]

    assert user_id_a != user_id_b
    assert token_a != token_b

    # 2. User A imports statement
    import_res_a = client.post(
        "/api/transactions/import",
        headers={"Authorization": f"Bearer {token_a}"},
        files={"file": ("user_a_stmt.csv", CSV_DATA_USER_A, "text/csv")},
        data={"mapping": json.dumps(MAPPING), "currency": "INR"}
    )
    assert import_res_a.status_code == 200
    assert import_res_a.json()["accepted_rows"] == 3

    # 3. User A sees 3 transactions
    tx_res_a = client.get("/api/transactions", headers={"Authorization": f"Bearer {token_a}"})
    assert tx_res_a.status_code == 200
    items_a = tx_res_a.json()["items"]
    assert len(items_a) == 3

    # 4. User B must see ZERO transactions (Strict tenant isolation)
    tx_res_b = client.get("/api/transactions", headers={"Authorization": f"Bearer {token_b}"})
    assert tx_res_b.status_code == 200
    assert tx_res_b.json()["total"] == 0
    assert len(tx_res_b.json()["items"]) == 0

    # User B summary must be completely empty
    sum_b = client.get("/api/accounting/summary", headers={"Authorization": f"Bearer {token_b}"})
    assert sum_b.status_code == 200
    assert sum_b.json()["gross_debit_outflow"] == 0.0
    assert sum_b.json()["total_expenses"] == 0.0

    # 5. User B imports their own statement
    import_res_b = client.post(
        "/api/transactions/import",
        headers={"Authorization": f"Bearer {token_b}"},
        files={"file": ("user_b_stmt.csv", CSV_DATA_USER_B, "text/csv")},
        data={"mapping": json.dumps(MAPPING), "currency": "INR"}
    )
    assert import_res_b.status_code == 200
    assert import_res_b.json()["accepted_rows"] == 2

    # Verify User B has 2 transactions and User A still has exactly 3
    tx_res_b2 = client.get("/api/transactions", headers={"Authorization": f"Bearer {token_b}"})
    assert len(tx_res_b2.json()["items"]) == 2

    tx_res_a2 = client.get("/api/transactions", headers={"Authorization": f"Bearer {token_a}"})
    assert len(tx_res_a2.json()["items"]) == 3

def test_cross_tenant_mutation_blocked(client):
    # User A creates a transaction
    res_a = client.post("/api/auth/guest")
    token_a = res_a.json()["token"]
    client.post(
        "/api/transactions/import",
        headers={"Authorization": f"Bearer {token_a}"},
        files={"file": ("a.csv", CSV_DATA_USER_A, "text/csv")},
        data={"mapping": json.dumps(MAPPING), "currency": "INR"}
    )
    txs_a = client.get("/api/transactions", headers={"Authorization": f"Bearer {token_a}"}).json()["items"]
    target_tx_id = txs_a[0]["id"]

    # User B tries to modify User A's transaction
    res_b = client.post("/api/auth/guest")
    token_b = res_b.json()["token"]

    update_res = client.put(
        f"/api/transactions/{target_tx_id}",
        headers={"Authorization": f"Bearer {token_b}"},
        json={"clean_merchant": "Hacked Merchant"}
    )
    # Must fail with 404 because it does not exist in User B's database
    assert update_res.status_code == 404

    # Verify User A's transaction was unmodified
    fresh_txs_a = client.get("/api/transactions", headers={"Authorization": f"Bearer {token_a}"}).json()["items"]
    assert fresh_txs_a[0]["clean_merchant"] != "Hacked Merchant"

def test_demo_context_is_read_only(client):
    res = client.post("/api/auth/guest")
    token = res.json()["token"]

    # In demo context, mutations are strictly rejected with 403 Forbidden
    import_res = client.post(
        "/api/transactions/import",
        headers={"Authorization": f"Bearer {token}", "X-Workspace-Context": "demo"},
        files={"file": ("a.csv", CSV_DATA_USER_A, "text/csv")},
        data={"mapping": json.dumps(MAPPING), "currency": "INR"}
    )
    assert import_res.status_code == 403
    assert "read-only" in import_res.json()["detail"].lower()

def test_safe_workspace_deletion(client):
    res_a = client.post("/api/auth/guest")
    token_a = res_a.json()["token"]
    user_id_a = res_a.json()["user"]["id"]

    res_b = client.post("/api/auth/guest")
    token_b = res_b.json()["token"]
    user_id_b = res_b.json()["user"]["id"]

    # Import data for both
    client.post(
        "/api/transactions/import",
        headers={"Authorization": f"Bearer {token_a}"},
        files={"file": ("a.csv", CSV_DATA_USER_A, "text/csv")},
        data={"mapping": json.dumps(MAPPING), "currency": "INR"}
    )
    client.post(
        "/api/transactions/import",
        headers={"Authorization": f"Bearer {token_b}"},
        files={"file": ("b.csv", CSV_DATA_USER_B, "text/csv")},
        data={"mapping": json.dumps(MAPPING), "currency": "INR"}
    )

    db_file_a = WORKSPACES_DIR / f"workspace_{user_id_a}.db"
    db_file_b = WORKSPACES_DIR / f"workspace_{user_id_b}.db"
    assert db_file_a.exists()
    assert db_file_b.exists()

    # User A deletes their workspace
    del_res = client.delete("/api/auth/workspace", headers={"Authorization": f"Bearer {token_a}"})
    assert del_res.status_code == 200

    # User A's file is physically deleted
    assert not db_file_a.exists()

    # User B's file is untouched and User B still has their data
    assert db_file_b.exists()
    b_txs = client.get("/api/transactions", headers={"Authorization": f"Bearer {token_b}"}).json()
    assert b_txs["total"] == 2

    # Subsequent request with User A's deleted token fails with 401
    fail_res = client.get("/api/transactions", headers={"Authorization": f"Bearer {token_a}"})
    assert fail_res.status_code == 401

def test_user_registration_login_lifecycle(client):
    email = f"user_{os.urandom(4).hex()}@example.com"
    pwd = "SecretPassword123"

    # Register
    reg_res = client.post("/api/auth/register", json={"email": email, "password": pwd})
    assert reg_res.status_code == 200
    token1 = reg_res.json()["token"]
    user_id = reg_res.json()["user"]["id"]
    assert reg_res.json()["user"]["email"] == email

    # Me check
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token1}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == email

    # Logout
    logout_res = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token1}"})
    assert logout_res.status_code == 200

    # Old token invalid
    me_after = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token1}"})
    assert me_after.status_code == 401

    # Login
    login_res = client.post("/api/auth/login", json={"email": email, "password": pwd})
    assert login_res.status_code == 200
    token2 = login_res.json()["token"]

    # Verify authenticated access restored with same user_id
    me_res2 = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token2}"})
    assert me_res2.status_code == 200
    assert me_res2.json()["user_id"] == user_id


def test_authenticated_personal_workspace_editing_persists(client):
    """Verifies that an authenticated personal user can edit merchants and categories, and updates persist."""
    res = client.post("/api/auth/guest")
    assert res.status_code == 200
    token = res.json()["token"]

    # Import statement
    client.post(
        "/api/transactions/import",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("edit_stmt.csv", CSV_DATA_USER_A, "text/csv")},
        data={"mapping": json.dumps(MAPPING), "currency": "INR"}
    )

    txs = client.get("/api/transactions", headers={"Authorization": f"Bearer {token}"}).json()["items"]
    assert len(txs) == 3
    first_tx = txs[0]

    # Edit merchant and category
    update_res = client.put(
        f"/api/transactions/{first_tx['id']}",
        headers={"Authorization": f"Bearer {token}"},
        json={"clean_merchant": "Swiggy Gourmet Delivery", "category": "Food & Dining"}
    )
    assert update_res.status_code == 200

    # Fetch fresh and verify persistence
    updated_txs = client.get("/api/transactions", headers={"Authorization": f"Bearer {token}"}).json()["items"]
    matched = [t for t in updated_txs if t["id"] == first_tx["id"]][0]
    assert matched["clean_merchant"] == "Swiggy Gourmet Delivery"
    assert matched["category"] == "Food & Dining"
    assert matched["is_user_modified"] is True

def test_authenticated_personal_learning_and_feedback(client):
    """Verifies habit feedback can be submitted and persists in personal workspace."""
    res = client.post("/api/auth/guest")
    token = res.json()["token"]

    feedback_res = client.post(
        "/api/habits/feedback",
        headers={"Authorization": f"Bearer {token}"},
        json={"habit_key": "weekday_dining_surge", "status": "confirmed", "notes": "Observed regularly"}
    )
    assert feedback_res.status_code == 200
    assert feedback_res.json()["new_status"] == "confirmed"

def test_hosted_public_demo_mode_allows_authenticated_personal_mutations(client, monkeypatch):
    """
    Demonstrates that running in USUALLY_DEPLOYMENT_MODE='public_demo' blocks unauthenticated mutations
    on the demo database, but fully allows authenticated users to mutate their own personal workspaces.
    """
    monkeypatch.setenv("USUALLY_DEPLOYMENT_MODE", "public_demo")

    # 1. Unauthenticated mutation attempt fails with 403
    unauth_res = client.post(
        "/api/transactions/import",
        files={"file": ("stmt.csv", CSV_DATA_USER_A, "text/csv")},
        data={"mapping": json.dumps(MAPPING), "currency": "INR"}
    )
    assert unauth_res.status_code == 403

    # 2. Authenticated user creates a private guest workspace
    guest_res = client.post("/api/auth/guest")
    assert guest_res.status_code == 200
    token = guest_res.json()["token"]

    # 3. Authenticated personal mutation SUCCEEDS even while server is in public_demo mode!
    auth_import_res = client.post(
        "/api/transactions/import",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("stmt.csv", CSV_DATA_USER_A, "text/csv")},
        data={"mapping": json.dumps(MAPPING), "currency": "INR"}
    )
    assert auth_import_res.status_code == 200
    assert auth_import_res.json()["accepted_rows"] == 3

    # 4. Authenticated transaction edit SUCCEEDS
    txs = client.get("/api/transactions", headers={"Authorization": f"Bearer {token}"}).json()["items"]
    edit_res = client.put(
        f"/api/transactions/{txs[0]['id']}",
        headers={"Authorization": f"Bearer {token}"},
        json={"clean_merchant": "Updated Under Public Demo Mode"}
    )
    assert edit_res.status_code == 200

    # 5. Shared demo dataset remains completely untouched (read-only)
    demo_txs = client.get("/api/transactions", headers={"Authorization": f"Bearer {token}", "X-Workspace-Context": "demo"}).json()
    assert all(t["clean_merchant"] != "Updated Under Public Demo Mode" for t in demo_txs["items"])
