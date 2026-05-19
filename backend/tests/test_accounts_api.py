"""Backend API tests for VicRoads Licence Accounts CRUD."""
import os
import random
import string
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
if not BASE_URL:
    # Fallback to frontend .env
    from pathlib import Path
    env_file = Path("/app/frontend/.env")
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break

assert BASE_URL, "Backend URL not configured"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


def _rand_digits(n=6):
    return "".join(random.choices(string.digits, k=n))


def _rand_letters(n=3):
    return "".join(random.choices(string.ascii_uppercase, k=n))


@pytest.fixture(scope="module")
def created_ids():
    ids = []
    yield ids
    # Cleanup
    for aid in ids:
        try:
            requests.delete(f"{API}/accounts/{aid}", timeout=10)
        except Exception:
            pass


# ---- Health ----
def test_root_ok():
    r = requests.get(f"{API}/", timeout=10)
    assert r.status_code == 200
    assert r.json() == {"message": "ok"}


# ---- List ----
def test_list_accounts_returns_list():
    r = requests.get(f"{API}/accounts", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)


# ---- Create + auto-gen + persistence ----
def test_create_account_autogen_and_persistence(created_ids):
    payload = {
        "name": "TEST_User_Create",
        "digits": _rand_digits(),
        "letters": _rand_letters(),
    }
    r = requests.post(f"{API}/accounts", json=payload, timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["name"] == payload["name"]
    assert data["digits"] == payload["digits"]
    assert data["letters"] == payload["letters"].upper()
    assert data["locked"] is False
    assert "id" in data and len(data["id"]) > 0
    # auto-generated permit & card
    assert data["licence"]["permitNumber"], "permitNumber should be auto-generated"
    assert data["licence"]["cardNumber"].startswith("P"), "cardNumber should start with P"
    created_ids.append(data["id"])

    # Verify GET retrieves the same record
    r2 = requests.get(f"{API}/accounts", timeout=10)
    assert r2.status_code == 200
    found = next((x for x in r2.json() if x["id"] == data["id"]), None)
    assert found is not None
    assert found["licence"]["permitNumber"] == data["licence"]["permitNumber"]


# ---- Duplicate rejection ----
def test_create_duplicate_returns_409(created_ids):
    payload = {
        "name": "TEST_Dup",
        "digits": _rand_digits(),
        "letters": _rand_letters(),
    }
    r1 = requests.post(f"{API}/accounts", json=payload, timeout=10)
    assert r1.status_code == 200
    created_ids.append(r1.json()["id"])

    r2 = requests.post(f"{API}/accounts", json=payload, timeout=10)
    assert r2.status_code == 409
    # lower-case letters duplicate must also be rejected (server uppercases)
    payload2 = dict(payload)
    payload2["letters"] = payload["letters"].lower()
    r3 = requests.post(f"{API}/accounts", json=payload2, timeout=10)
    assert r3.status_code == 409


# ---- Update fields including licence sub-object and locked ----
def test_update_account_fields(created_ids):
    payload = {
        "name": "TEST_Upd",
        "digits": _rand_digits(),
        "letters": _rand_letters(),
    }
    r = requests.post(f"{API}/accounts", json=payload, timeout=10)
    assert r.status_code == 200
    acc = r.json()
    aid = acc["id"]
    created_ids.append(aid)

    # Update licence sub-object
    new_licence = dict(acc["licence"])
    new_licence["addressLine1"] = "1 TEST STREET"
    new_licence["signatureName"] = "Test Signature"
    upd = requests.put(
        f"{API}/accounts/{aid}",
        json={"licence": new_licence, "locked": True},
        timeout=10,
    )
    assert upd.status_code == 200, upd.text
    body = upd.json()
    assert body["locked"] is True
    assert body["licence"]["addressLine1"] == "1 TEST STREET"
    assert body["licence"]["signatureName"] == "Test Signature"

    # Verify via list
    lst = requests.get(f"{API}/accounts", timeout=10).json()
    found = next(x for x in lst if x["id"] == aid)
    assert found["locked"] is True
    assert found["licence"]["addressLine1"] == "1 TEST STREET"


def test_update_not_found():
    r = requests.put(
        f"{API}/accounts/nonexistent-id-xyz",
        json={"name": "x"},
        timeout=10,
    )
    assert r.status_code == 404


# ---- Delete ----
def test_delete_account_and_404_on_missing(created_ids):
    payload = {
        "name": "TEST_Del",
        "digits": _rand_digits(),
        "letters": _rand_letters(),
    }
    r = requests.post(f"{API}/accounts", json=payload, timeout=10)
    assert r.status_code == 200
    aid = r.json()["id"]

    d = requests.delete(f"{API}/accounts/{aid}", timeout=10)
    assert d.status_code == 200
    assert d.json().get("ok") is True

    # Confirm gone
    lst = requests.get(f"{API}/accounts", timeout=10).json()
    assert all(x["id"] != aid for x in lst)

    # Deleting again -> 404
    d2 = requests.delete(f"{API}/accounts/{aid}", timeout=10)
    assert d2.status_code == 404
