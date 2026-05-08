from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
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
    acc = Account(
        name=payload.name,
        digits=payload.digits,
        letters=payload.letters.upper(),
        locked=False,
        licence=payload.licence or Licence(),
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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
