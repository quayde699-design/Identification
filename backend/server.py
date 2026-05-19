from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


def _gen_permit() -> str:
    n = "".join(str(random.randint(0, 9)) for _ in range(9))
    return f"{n[0:3]} {n[3:6]} {n[6:9]}"


def _gen_card() -> str:
    return "P" + "".join(str(random.randint(0, 9)) for _ in range(7))


# ---------- Models ----------
class Licence(BaseModel):
    permitNumber: str = ""
    expiry: str = "15 Jan 2026"
    licenceType: str = "Car"
    dob: str = "01 Jan 2008"
    addressLine1: str = ""
    addressLine2: str = ""
    signatureName: str = ""
    permitStatus: str = "Current"
    proficiency: str = "Probationary"
    issueDate: str = "15 Jan 2027"
    cardNumber: str = ""
    photoUri: str = ""


class Account(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    digits: str
    letters: str
    locked: bool = False
    licence: Licence = Field(default_factory=Licence)


class AccountCreate(BaseModel):
    name: str
    digits: str
    letters: str
    licence: Optional[Licence] = None


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    digits: Optional[str] = None
    letters: Optional[str] = None
    locked: Optional[bool] = None
    licence: Optional[Licence] = None


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "ok"}


@api_router.get("/accounts", response_model=List[Account])
async def list_accounts():
    docs = await db.accounts.find({}, {"_id": 0}).to_list(1000)
    return [Account(**d) for d in docs]


@api_router.post("/accounts", response_model=Account)
async def create_account(payload: AccountCreate):
    # Reject duplicates on (digits, letters)
    existing = await db.accounts.find_one(
        {"digits": payload.digits, "letters": payload.letters.upper()}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=409, detail="Codes already in use")
    licence = payload.licence or Licence()
    if not licence.permitNumber:
        licence.permitNumber = _gen_permit()
    if not licence.cardNumber:
        licence.cardNumber = _gen_card()
    acc = Account(
        name=payload.name,
        digits=payload.digits,
        letters=payload.letters.upper(),
        locked=False,
        licence=licence,
    )
    await db.accounts.insert_one(acc.model_dump())
    return acc


@api_router.put("/accounts/{account_id}", response_model=Account)
async def update_account(account_id: str, payload: AccountUpdate):
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "letters" in update:
        update["letters"] = update["letters"].upper()
    if not update:
        existing = await db.accounts.find_one({"id": account_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Not found")
        return Account(**existing)
    result = await db.accounts.find_one_and_update(
        {"id": account_id},
        {"$set": update},
        return_document=True,
        projection={"_id": 0},
    )
    if not result:
        raise HTTPException(status_code=404, detail="Not found")
    return Account(**result)


@api_router.delete("/accounts/{account_id}")
async def delete_account(account_id: str):
    res = await db.accounts.delete_one({"id": account_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ---------- Support requests ----------
from datetime import datetime, timezone


class SupportRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    reason: str
    channel: str  # "snapchat" | "email" | "other"
    createdAt: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    seen: bool = False


class SupportRequestCreate(BaseModel):
    reason: str
    channel: str


@api_router.post("/support", response_model=SupportRequest)
async def create_support(payload: SupportRequestCreate):
    reason = (payload.reason or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Reason is required")
    if len(reason) > 1000:
        reason = reason[:1000]
    channel = (payload.channel or "other").lower()
    if channel not in ("snapchat", "email", "other"):
        channel = "other"
    req = SupportRequest(reason=reason, channel=channel)
    await db.support_requests.insert_one(req.model_dump())
    logger.info("Support request: channel=%s reason=%r", channel, reason[:120])
    return req


@api_router.get("/support", response_model=List[SupportRequest])
async def list_support():
    docs = (
        await db.support_requests.find({}, {"_id": 0})
        .sort("createdAt", -1)
        .to_list(500)
    )
    return [SupportRequest(**d) for d in docs]


@api_router.put("/support/{request_id}/seen", response_model=SupportRequest)
async def mark_support_seen(request_id: str):
    result = await db.support_requests.find_one_and_update(
        {"id": request_id},
        {"$set": {"seen": True}},
        return_document=True,
        projection={"_id": 0},
    )
    if not result:
        raise HTTPException(status_code=404, detail="Not found")
    return SupportRequest(**result)


@api_router.delete("/support/{request_id}")
async def delete_support(request_id: str):
    res = await db.support_requests.delete_one({"id": request_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def backfill_numbers():
    cursor = db.accounts.find({}, {"_id": 0})
    async for doc in cursor:
        l = doc.get("licence") or {}
        update = {}
        if not l.get("permitNumber"):
            update["licence.permitNumber"] = _gen_permit()
        if not l.get("cardNumber"):
            update["licence.cardNumber"] = _gen_card()
        if update:
            await db.accounts.update_one({"id": doc["id"]}, {"$set": update})


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
