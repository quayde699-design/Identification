# FID — Probationary Licence Wallet

## Original Problem Statement
Remove the payment screen when creating an account.
Source repo: https://github.com/quayde699-design/Identification

## App Overview
Expo (React Native + web) app for issuing/holding Victorian probationary driver licence cards. Admin console creates accounts (name + 6-digit + 3-letter codes); users sign in with their codes to view their licence.

## Tech Stack
- Frontend: Expo Router (React Native Web), TypeScript, app/index.tsx
- Backend: FastAPI + Motor (MongoDB), /api prefix
- DB: MongoDB (collections: accounts, support_requests, settings)

## Changes Implemented (Jan 2026)
- Removed the 2-step create-account flow (details → payment). Admin now creates an account with a single details screen (name + codes) and a "Create account" button.
- Removed state/UI for product selection, discount chips, payment method chips, live totals, and `goToPaymentStep` / `selectedProduct` / `effectiveDiscountPercent` helpers from the create modal.
- Account creation no longer sends a receipt; backend stores `receipt: null`. Existing receipt viewer & "Manage prices" admin tool are left untouched (they only act on existing accounts/pricing settings, not signup).
- Auto-displayed receipt modal after successful creation is removed.
- Installed Expo dependencies (yarn install) and removed stale CRA `public/index.html` so Expo Router renders properly via `app/+html.tsx`.
- **User-facing licence screen is now read-only**: the "Reveal QR code" button no longer opens the edit modal — it is disabled and does nothing.
- **New admin "Edit account" button** (pencil icon per row) opens a full-feature `AdminEditModal` that lets the admin change profile picture, banner logo, full name, 6-digit + 3-letter sign-in codes (PINs), date of birth, signature, address lines, licence type, permit status, proficiency, issue date, expiry, permit number, and card number. Saves via `PUT /api/accounts/{id}` so changes appear on the user's licence next time they sign in.

## Verified
- `POST /api/accounts` with no `receipt` succeeds (returns `receipt: null`).
- UI smoke test: admin login → "+" → fill name/digits/letters → "Create account" → account appears in list, no payment screen, no receipt popup.

## Admin Credentials (existing in code)
- 4-digit: `4095`
- 6-letter: `QUAYDE`

## Backlog / Future
- Optional: also remove the now-orphan "Manage prices" admin button and existing-account receipt button (`receipt-{id}`) since there is no longer a payment flow that creates receipts. Currently kept as-is per minimal-change scope.
