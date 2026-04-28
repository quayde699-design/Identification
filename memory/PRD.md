# Probationary Driver Licence — Mobile Screen

## Overview
Single-screen Expo mobile app that mimics a Victorian Probationary Driver Licence in a digital wallet style, matching the user-provided VicRoads screenshots.

## Key Features
- **Header strip** (orange/red): "PROBATIONARY DRIVER LICENCE / Victoria Australia" + VicRoads-style logo.
- **Photo + QR consent block** (light green): initials avatar with subtle crown-shield watermark overlay, info panel with consent prompt and "Reveal QR code" pill button.
- **Tab bar**: Permit (active) / Identity / Age. Identity & Age render empty placeholder states.
- **Permit details**: full name, permit number, expiry, licence type with "P" badge, DOB, address (multi-line uppercase), cursive signature, permit status (with green check), proficiency, issue/expiry dates, card number, simulated Victoria Police barcode.
- **Edit mode**: top-right pencil icon opens a full-screen modal letting the user edit every field; saved values persist via AsyncStorage.
- **QR Reveal**: tapping the dark pill opens a modal showing a real, generated QR code containing the licence data (react-native-qrcode-svg).
- **Reset**: clears AsyncStorage and restores fake placeholder defaults.

## Tech
- Expo Router single screen (`/app/index.tsx`).
- AsyncStorage for local persistence (`@react-native-async-storage/async-storage`).
- `react-native-qrcode-svg` + `react-native-svg` for QR.
- `@expo/vector-icons` for icons.
- No backend; pure frontend mockup with editable, persistent fake data.

## Default placeholder data
QUAYDE A BURNHAM · permit 873 361 653 · exp 04 Jul 2026 · DOB 04 Jul 2007 · 9 SHARPES RD, MINERS REST 3352 VIC · Card P3497519.
