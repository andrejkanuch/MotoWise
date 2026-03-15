# MotoWise — Google Play Console Setup Guide

All declarations and settings needed to complete the Google Play Console setup for MotoWise (MotoVault).

---

## Already Completed

- **Privacy policy** — URL set to `https://motovault.app/privacy`
- **Ads** — Declared "No, my app does not contain ads"
- **App access** — Created login instruction with credentials `review@motovault.app` / `Review2026!`

---

## 1. Content Ratings (IARC Questionnaire)

### Step 1 — Category
- **Email address:** `andrejkanuch@sudolabs.io`
- **Category:** Select **"All Other App Types"**
- Click **Next**

### Step 2 — Questionnaire (answer all "No")
MotoWise is a motorcycle learning/diagnostics app with no objectionable content.

| Question | Answer |
|----------|--------|
| Does the app contain violence? | **No** |
| Does the app contain sexual content or nudity? | **No** |
| Is the app interactive (user-generated content, social features, communication)? | **No** |
| Does the app allow purchases of digital goods? | **Yes** (subscriptions via RevenueCat) |
| Does the app share the user's current location with other users? | **No** |
| Does the app contain crude humor? | **No** |
| Does the app contain references to controlled substances (drugs, alcohol, tobacco)? | **No** |
| Does the app contain simulated gambling? | **No** |
| Does the app contain horror/fear-themed content? | **No** |

> Note: The exact questions may vary. The key principle is: MotoWise has NO violence, NO sexual content, NO drugs/alcohol, NO gambling, NO horror. The ONLY "yes" is for in-app purchases (subscriptions). Answer accordingly for any question asked.

- Click **Next**, then **Submit** on the Summary page

---

## 2. Target Audience and Content

- **Target age group:** Select **"18 and over"** only
  - Do NOT select any age groups under 18 (this would trigger additional COPPA requirements)
- **Does this app appeal to children?** **No**
- Click **Save**

---

## 3. Data Safety

This is the most detailed declaration. MotoWise collects and shares the following data:

### Overview Questions
- **Does your app collect or share any of the required user data types?** **Yes**
- **Is all of the user data collected by your app encrypted in transit?** **Yes** (Supabase uses HTTPS)
- **Do you provide a way for users to request that their data is deleted?** **Yes** (via account deletion in app settings or by contacting support)

### Data Types Collected

| Data Type | Collected | Shared | Purpose | Optional? |
|-----------|-----------|--------|---------|-----------|
| **Email address** | Yes | No | Account management, authentication | No (required for account) |
| **Name** (display name) | Yes | No | App functionality, personalization | Yes |
| **Photos** (camera for diagnostics) | Yes | No | App functionality (AI diagnostics) | Yes (only when using diagnostics) |
| **Purchase history** | Yes | No | App functionality (subscription management) | No |
| **App interactions** | Yes | No | Analytics | No |
| **Crash logs** | Yes | No | Analytics | No |
| **Device or other IDs** | Yes | No | Analytics, app functionality | No |

### For each data type, declare:
- **Is this data processed ephemerally?** No (stored on server)
- **Is this data required for your app, or can users choose whether it's collected?** Required (except photos which are optional)

### Data NOT collected (select No for all of these):
- Phone number, address, date of birth, race/ethnicity, political beliefs, religious beliefs, sexual orientation
- Financial info (credit card numbers, bank accounts) — RevenueCat handles payments, you don't touch raw financial data
- Health data, fitness data, SMS/call logs, contacts, calendar, files/docs, audio, browsing history, search history
- Location (precise or approximate) — the app does NOT collect location data

---

## 4. Advertising ID

- **Does your app use advertising ID?** **No**
  - MotoWise does not use ads and does not use the advertising ID
- Click **Save**

---

## 5. Government Apps

- **Is this app created by or on behalf of a government?** **No**
- Click **Save**

---

## 6. Financial Features

- **Does your app provide any financial features?** **No**
  - MotoWise is a motorcycle learning/diagnostics app, not a financial app
- Click **Save**

---

## 7. Health Apps

- **Does your app contain health features?** **No**
  - MotoWise is a motorcycle app, not a health app
- Click **Save**

---

## 8. Store Settings — App Category & Contact Details

Navigate to: **Grow users → Store presence → Store settings**

### App Category
- **App type:** Application
- **Category:** **Auto & Vehicles**
- **Tags:** Select relevant tags like "Vehicles", "Reference", "Education" (pick up to 5)

### Contact Details
- **Email:** `andrejkanuch@sudolabs.io`
- **Phone:** (your phone number — optional but recommended)
- **Website:** `https://motovault.app`

---

## 9. Store Listing — Main Store Listing

Navigate to: **Grow users → Store presence → Main store listing**

### App Details
- **App name:** `MotoWise`
- **Short description (max 80 chars):**
  ```
  AI-powered motorcycle learning, diagnostics & maintenance companion.
  ```
- **Full description (max 4000 chars):**
  ```
  MotoWise is your intelligent motorcycle companion — powered by AI to help you learn, diagnose issues, and maintain your bike like a pro.

  KEY FEATURES

  Smart Diagnostics
  Snap a photo of any motorcycle issue and get instant AI-powered analysis. MotoWise identifies problems, explains causes, and suggests fixes — from strange noises to warning lights.

  Personalized Learning
  Whether you're a beginner rider or seasoned enthusiast, MotoWise delivers curated articles and quizzes tailored to your experience level and bike type. Learn about maintenance, riding techniques, safety, and more.

  Multi-Bike Garage
  Add all your motorcycles to your virtual garage. Get model-specific advice, maintenance schedules, and diagnostics customized to each bike in your collection.

  AI Chat Assistant
  Ask anything about motorcycles and get expert-level answers instantly. From "What oil does my bike need?" to "Why is my engine making a ticking sound?" — MotoWise has you covered.

  Knowledge Library
  Browse a growing library of motorcycle articles covering maintenance, repair, riding skills, gear reviews, and motorcycle culture. Content is regularly updated and covers all major brands and models.

  Progress Tracking
  Take quizzes to test your knowledge, track your learning progress, and earn achievements as you become a more knowledgeable rider.

  SUPPORTED MOTORCYCLES
  MotoWise covers all major motorcycle brands including Honda, Yamaha, Kawasaki, Suzuki, Ducati, BMW, KTM, Harley-Davidson, Triumph, Royal Enfield, and many more.

  SUBSCRIPTION
  MotoWise offers a free tier with limited features. Unlock the full experience with MotoWise Pro, which includes unlimited AI diagnostics, full article library access, and advanced features.

  Download MotoWise today and ride smarter.
  ```

### Graphics (you'll need to provide these manually)
- **App icon:** 512 x 512 px, PNG, 32-bit, no alpha
- **Feature graphic:** 1024 x 500 px
- **Phone screenshots:** Minimum 2, recommended 4-8 (16:9 or 9:16 aspect ratio)
- **7-inch tablet screenshots:** Optional but recommended
- **10-inch tablet screenshots:** Optional but recommended

---

## Checklist Summary

| Declaration | Status | Action |
|-------------|--------|--------|
| Privacy policy | Done | — |
| App access | Done | — |
| Ads | Done | — |
| Content ratings | TODO | Complete IARC questionnaire |
| Target audience | TODO | Select 18+ only |
| Data safety | TODO | Fill in data types (most detailed section) |
| Advertising ID | TODO | Select No |
| Government apps | TODO | Select No |
| Financial features | TODO | Select No |
| Health apps | TODO | Select No |
| Store settings | TODO | Set category & contact |
| Store listing | TODO | Add title, descriptions, screenshots |
