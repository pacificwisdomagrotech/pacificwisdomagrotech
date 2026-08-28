# Pacific Wisdom Agrotech ERP — Setup Guide

This is a real (not demo) build. Data lives in Firebase so admin and managers
see the same live data from any phone/desktop. Follow these steps once.

## 1. Create a Firebase project (free tier is enough)

1. Go to https://console.firebase.google.com → **Add project** → name it
   (e.g. `pw-agrotech-erp`) → finish the wizard.
2. In the project, click **Build > Authentication > Get started** → enable
   the **Email/Password** sign-in method.
3. Click **Build > Firestore Database > Create database** → start in
   **production mode** → pick a region close to Nagpur (e.g. `asia-south1`).
4. Click the gear icon → **Project settings** → scroll to "Your apps" →
   click the `</>` (web) icon → register an app (any nickname) → copy the
   `firebaseConfig` object it gives you.
5. Open `js/firebase-config.js` and paste your real values into the
   `firebaseConfig = {...}` block.

## 2. Set Firestore security rules

In Firebase Console → Firestore Database → **Rules**, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }
    function myRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    function isAdmin() { return isSignedIn() && myRole() == 'admin'; }

    match /users/{uid} {
      allow read: if isSignedIn();
      allow write: if isAdmin() || request.auth.uid == uid;
    }
    match /products/{id}   { allow read: if isSignedIn(); allow write: if isAdmin(); }
    match /farmers/{id}    { allow read, write: if isAdmin(); }
    match /customers/{id}  { allow read, write: if isAdmin(); }
    match /inventory/{id}  { allow read, write: if isAdmin(); }
    match /enquiries/{id}  { allow read, create: if isSignedIn(); allow update: if isAdmin(); }
    match /orders/{id}     { allow read: if isSignedIn(); allow create: if isSignedIn(); allow update: if isAdmin(); }
    match /sales/{id}      { allow read: if isSignedIn(); allow create: if isSignedIn(); allow update: if isSignedIn(); }
    match /farmerPurchases/{id} { allow read, write: if isAdmin(); }
    match /managerStock/{id}   { allow read: if isSignedIn(); allow write: if isSignedIn(); }
    match /activity/{id}   { allow read: if isAdmin(); allow create: if isSignedIn(); }
  }
}
```

Publish the rules.

## New in this update: crop-trading workflow

The app now models a real 3-tier crop trading flow:

1. **Admin buys from farmers** — Products & Rates page now has two prices per product: a **Wholesale Rate** (what managers pay you) and a **Retail Rate** (the fixed price managers must resell to customers at). Go to **Purchases** to record what you buy from a farmer — it's added straight into your **Warehouse Stock**.
2. **Manager orders from your warehouse** — they pick a product + quantity, confirm the cost in a popup, and it lands in your Orders list as pending.
3. **You approve or reject** — approving moves stock from your warehouse into that manager's own stock ledger, generates a PDF order summary (downloadable inside the app, no email needed), and sends a WhatsApp payment request as before. A popup appears automatically the moment a new order comes in while you're using the app.
4. **Manager sells to a customer** at the fixed retail rate — the app tells them exactly how much to collect, and automatically calculates your 20% profit-share on the wholesale-to-retail margin. You get a popup notification with your share the moment it happens.
5. **Manager marks paid → you acknowledge** — same payment-confirmation loop as before.

## File map — where to look when something needs changing

The app is now split by feature instead of one giant file. Structure:

```
index.html                          — page markup only (login screen, app shell, modal)
css/styles.css                      — all visual styling, themes, layout
manifest.json, sw.js                — PWA install + offline shell
icon-*.png                          — app icons

js/firebase-config.js               — YOUR Firebase project keys (the only file to
                                       touch for initial setup / switching projects)
js/app.js                           — wires everything together + starts the app

js/core/services.js                 — Firebase wrapper, 2FA (TOTP), themes, WhatsApp
                                       links, Excel export, PDF generation, stock
                                       transactions (StockService)
js/core/store.js                    — DataStore (all Firestore data + listeners),
                                       ActivityLogger
js/core/notifications-biometric.js  — in-app notification bell, biometric unlock
js/core/auth.js                     — login, 2FA verification, session restore, logout
js/core/router.js                   — sidebar navigation + page switching

js/pages/base.js                    — shared base class every page extends
js/pages/dashboard.js               — Dashboard
js/pages/enquiries.js               — Enquiries
js/pages/products.js                — Products & Rates (wholesale + retail)
js/pages/purchases.js               — Farmer Purchases
js/pages/orders.js                  — Orders (manager places, admin approves)
js/pages/sales.js                   — Sales & Profit-Share
js/pages/crm.js                     — Farmers & Customers (shared CrmPage class)
js/pages/inventory.js               — Warehouse Stock
js/pages/users.js                   — Manage Managers
js/pages/activity.js                — Activity Log
js/pages/reports.js                 — Reports, Excel export, income/expense chart
js/pages/settings.js                — Theme, notifications, 2FA, biometric unlock
```

**Uploading changes:** each file above is independent — when I hand you an updated
file, only that one needs re-uploading to the matching path in your GitHub repo
(e.g. an Orders fix only needs `js/pages/orders.js` re-uploaded, not the whole app).
GitHub's "Add file" screen lets you type the full path (like `js/pages/orders.js`)
directly into the filename box — it creates the folders automatically if they don't
exist yet.

**First-time upload:** all 23 files need to go up once, preserving this exact folder
structure, before the site will work.

## 3. Create your first Admin account

The app can't create the very first admin (nobody's logged in yet), so do it
once by hand:

1. Firebase Console → Authentication → **Add user** → enter your email and
   password (e.g. `admin123` — change it later from a real password screen
   in a future update, or via Firebase Console).
2. Firebase Console → Firestore Database → **Start collection** → collection
   ID `users` → Document ID = the UID shown next to the user you just
   created in Authentication → add fields:
   - `name` (string) — your name, e.g. `Prafulla`
   - `email` (string) — same email
   - `role` (string) — `admin`
   - `phone` (string) — your WhatsApp number with country code, e.g. `91XXXXXXXXXX`
   - `twoFAEnabled` (boolean) — `false`

Now you can log in as admin at the site and use **Manage Managers** in the
sidebar to add manager/sales accounts through the UI (no more manual steps
needed after this).

## 4. Default passwords

Set whatever temporary password you like when creating each user (the
original brief mentioned `admin123` / `manager123` / `sales123` as
placeholders) — just don't reuse those in a real deployment, since anyone
who reads this file could guess them. The login screen itself shows no
password hints, as required.

## 5. Publish on GitHub Pages

1. Create a new GitHub repo, e.g. `pw-agrotech-erp`.
2. Upload all 23 files, preserving the folder structure shown in the file
   map above (`index.html` and `manifest.json` at the repo root, everything
   else under `css/`, `js/core/`, `js/pages/`, and `icon-*.png` at root).
   GitHub's "Add file" screen lets you type a full path like
   `js/pages/orders.js` into the filename box — it creates folders
   automatically.
3. Repo → **Settings > Pages** → Source: `Deploy from a branch` → Branch:
   `main` / root → Save.
4. Your ERP will be live at `https://<your-username>.github.io/pw-agrotech-erp/`
   in a minute or two. Open it on your phone and choose "Add to Home
   Screen" (Android Chrome) or "Add to Home Screen" from the Share sheet
   (iPhone Safari) to install it like an app.

## What's real vs. what needs a future add-on

- **WhatsApp messages** (order placed, profit-share due, payment
  acknowledgment) use free `wa.me` links — tapping the button opens
  WhatsApp with the Hindi message pre-typed to the right number. You (or
  the manager) still tap Send. True silent auto-send needs the paid
  WhatsApp Business API — say the word if you want that upgrade later.
- **2FA** is a real TOTP implementation (works with Google
  Authenticator/Authy), built with no paid service.
- **Daily sales summary email** — left as a visible-but-disabled toggle in
  Settings, since sending email on a schedule needs a small server
  function (Firebase Cloud Functions, which requires the paid Blaze plan —
  still has a generous free quota). I can wire this up next if you want it.
- **Push notifications when the app is closed** aren't included yet — the
  in-app bell/alerts work whenever the app is open. Real background push
  needs Firebase Cloud Messaging setup, which I can add later.
