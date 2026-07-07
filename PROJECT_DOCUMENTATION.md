# ChooseYourCollege — Project Documentation

> AI-assisted college **choice filling** and decision platform for engineering admissions counselling.

---

## 1. What is this project?

**ChooseYourCollege** (CYC) is a web application that helps students make data-driven
decisions during the engineering college **counselling / choice-filling** process. Instead
of manually researching hundreds of colleges, a student enters their rank, category and
preferences, and the platform generates a ranked, ready-to-submit list of college/branch
choices backed by government-verified data (placements, cutoffs, salaries, intake, etc.).

The product is monetised through a **freemium + referral + premium** model and processes
payments via **Razorpay**. Form submissions (votes, college data, loan enquiries, referrals)
are captured in **Google Sheets**, while users, authentication and usage tracking live in
**Supabase**.

The site is branded **chooseyourcollege.com** and titled *"ChooseYourCollege - AI-Assisted
Choice Filling"*.

---

## 2. Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | **Next.js 14** (App Router) + React 18 + TypeScript |
| Styling | Tailwind CSS + `tailwindcss-animate`, `next-themes` |
| UI components | **shadcn/ui** built on Radix UI primitives (in [components/ui/](components/ui/)) |
| Auth & database | **Supabase** (Postgres + Auth, email/password + Google OAuth) |
| Payments | **Razorpay** (order creation + signature verification) |
| External data capture | **Google Sheets API** (`googleapis`, `google-auth-library`) |
| PDF generation | `jspdf` + `jspdf-autotable` (choice lists), `pdf-lib` (NIRF stamping) |
| Forms & validation | `react-hook-form` + `zod` |
| Charts | `recharts` |
| Notifications | `sonner` + `react-hot-toast` |
| Analytics | Google Analytics (gtag) |
| Deploy | Netlify (`netlify.toml`); build obfuscates static JS with `javascript-obfuscator` |

---

## 3. High-level architecture

```
Browser (Next.js client components)
        │
        ├──► Next.js App Router pages  (app/*/page.tsx)
        │
        ├──► Next.js API routes        (app/api/*/route.ts)  ──► Supabase (users, usage, referrals)
        │                                                     ──► Razorpay (create/verify payment)
        │                                                     ──► Google Sheets (form submissions)
        │
        └──► Supabase client (lib/supabase.ts) for direct auth/queries from the browser
```

- **Rendering**: App Router. The root [app/page.tsx](app/page.tsx) simply redirects to `/home`.
- **Global providers**: [app/layout.tsx](app/layout.tsx) wraps everything in `AuthProvider`
  (Supabase auth context), a theme `Providers`, and loads the Razorpay + Google Analytics scripts.
- **Auth state**: [app/contexts/AuthContext.tsx](app/contexts/AuthContext.tsx) exposes
  `signIn`, `signUp`, `signInWithGoogle`, `signOut`, email verification helpers, and the
  current `user` to the whole app.

---

## 4. Directory layout

```
app/                    Next.js App Router — pages + API routes
  ├─ api/               ~45 backend route handlers (payments, usage, referrals, form intake)
  ├─ actions/           Server actions (e.g. submit-college-data)
  ├─ admin/             Admin setup pages (DB setup, referral setup/fixes)
  ├─ contexts/          AuthContext (Supabase auth)
  ├─ components/        Page-scoped components (e.g. LoginForm)
  └─ <feature>/page.tsx One folder per user-facing feature (see §5)
components/             Shared components (header, footer, search, PaymentButton, ...)
  └─ ui/                shadcn/ui primitives
lib/                    Core logic: supabase.ts, college-service.ts, college-data.ts, utils
database/               SQL scripts + seed.js for Supabase
config/                 google-credentials.json (service account)
scripts/                stamp-nirf-pdfs.mjs (brand NIRF PDFs)
public/                 Static assets, including nirf-apply-data PDFs
types/                  Ambient TS types (razorpay.d.ts, gtag.d.ts)
```

---

## 5. Core features (user-facing pages)

Each lives under `app/<name>/page.tsx`:

| Feature | Route | What it does |
|---------|-------|--------------|
| **Home** | `/home` | Landing page; marketing, stats, links to all features |
| **College Search & Comparison** | `/college-search` | Search and filter colleges by parameters |
| **Compare Colleges** | `/compare-colleges` | Side-by-side comparison of selected colleges |
| **Branch Explorer** | `/branch-explorer` | Explore branches/departments and their data |
| **Choice Filling** | `/choice-filling` | ⭐ Flagship: generates a ranked choice list and downloadable PDF (gated by usage/plan) |
| **Add College Data** | (`/college-management-seat`, `/college-scholarship-seat`, `submit-college-data`) | Crowdsourced data submission → Google Sheets |
| **Educational Loans** | `/educational-loan` | Loan enquiry form → Google Sheets |
| **Pricing** | `/pricing` | Plans with Razorpay payment buttons |
| **Blogs / Cheatsheet** | `/blogs`, `/cheatsheet` | Educational content |
| **Vote** | `/vote` | Voting form → Google Sheets |
| **NIRF data** | `/nirf-apply-data`, `/nirf-upload` | Branded NIRF ranking PDFs |
| **Legal** | `/privacy-policy`, `/terms-and-conditions`, `/refund-policy`, `/shipping-delivery` | Policy pages (required by Razorpay) |
| **Auth** | `/login` | Login/signup (email + Google) |
| **Payment success** | `/payment-success` | Post-payment redirect |

---

## 6. The Choice Filling flow (the core product)

This is the heart of the app and ties together auth, usage limits, referrals and payments.

1. **Sign in** — user authenticates via Supabase (email/password or Google).
2. **Check usage** — `/api/check-usage` reads the `choice_filling_usage` table to decide
   whether the user may proceed (free trial, referral trial, or active premium plan).
3. **Generate choices** — the user enters rank/category/preferences; the app ranks colleges
   using data from `lib/college-service.ts` / `lib/college-data.ts` (with a built-in fallback
   dataset) and renders a sorted choice table.
4. **Download PDF** — the list is exported as a branded PDF via `jspdf` + `jspdf-autotable`.
5. **Track usage** — `/api/track-usage` records the session (choices generated, PDF downloaded)
   and decrements the available trials.
6. **When out of trials** — a modal offers two paths: **refer friends** or **buy a premium plan**.

### Plans & limits

| Plan | Choices | Notes |
|------|---------|-------|
| Freemium | 20 | 1 free trial per email |
| Referral (3 referrals) | 75 each | 3 trials earned |
| Referral (5 referrals) | 200 each | 5 trials earned |
| Premium ₹199 | 75 / session | Unlimited for 30 days |
| Premium ₹299 | 200 / session | Unlimited for 30 days |

---

## 7. Referral system

Users earn free trials by referring friends. See [REFERRAL_SYSTEM_README.md](REFERRAL_SYSTEM_README.md)
for full detail.

- Each user has a unique `referral_code` (in `profiles`).
- A referral is recorded (`/api/record-referral`) when a friend signs up with the code, and
  marked **completed** (`/api/complete-referral`) only after the friend finishes choice filling.
- Reaching 3 or 5 completed referrals grants additional trials with higher choice limits.
- Dashboard UI ("Track Referrals") shows pending/completed counts and earned trials.

**Key tables**: `choice_filling_usage`, `user_referrals`, `choice_filling_logs`,
`profiles` (extended with `referral_code`).

---

## 8. Payments (Razorpay)

See [PAYMENT_INTEGRATION_README.md](PAYMENT_INTEGRATION_README.md) for full detail.

- `/api/create-payment` — creates a Razorpay order (server-side, amount in paise).
- `/api/verify-payment` — verifies the payment signature before granting access.
- `/api/update-user-plan` — upgrades the user's plan after successful verification.
- Reusable [components/PaymentButton.tsx](components/PaymentButton.tsx) opens the Razorpay
  checkout modal and fires success/error callbacks.
- The Razorpay checkout script is loaded globally in [app/layout.tsx](app/layout.tsx).

---

## 9. Google Sheets integration

Several forms write directly to Google Sheets via a service-account credential
(`config/google-credentials.json`, referenced by `GOOGLE_CREDENTIALS`). Routes include:

- `submit-college-data`, `submit-management-seat`, `submit-scholarship-seat`
- `submit-educational-loan` / `submit-educational-loan-initial`
- `submit-vote`
- `setup-referrals-sheet`, `check-and-move-referrers`

> The target sheet must be shared with the service-account email as **Editor**.

---

## 10. API routes (overview)

All under `app/api/*/route.ts`. Grouped by purpose:

- **Payments**: `create-payment`, `verify-payment`, `update-user-plan`
- **Usage / limits**: `check-usage`, `track-usage`, `create-usage-tables`, `debug-user-usage`
- **Referrals**: `record-referral`, `complete-referral`, `get-user-referrals`,
  `get-user-referral-code`, `update-referral-status`, `add-referral-code-column`,
  `fix-referral-trials`, `setup-referrals-sheet`, `check-and-move-referrers`
- **Auth / profile**: `create-profile`, `confirm-email`, `test-profile-creation`
- **Form intake → Sheets**: `submit-college-data`, `submit-management-seat`,
  `submit-scholarship-seat`, `submit-educational-loan(-initial)`, `submit-vote`,
  `check-educational-loan-status`
- **Setup / debug / tests**: `setup-database`, `setup-referrals`, `test-sheets`,
  `test-referral*`

Admin-only UI for setup lives under `app/admin/` (`setup-database`, `setup-referrals`,
`fix-referral-trials`).

---

## 11. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```env
# Supabase (used by lib/supabase.ts)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
NEXT_PUBLIC_RAZORPAY_KEY_ID=        # optional locally

# Google Sheets (service account JSON)
GOOGLE_CREDENTIALS=
GOOGLE_VOTE_SHEET_ID=

# Site & analytics
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_GA_MEASUREMENT_ID=
```

> Never commit real secrets. `config/google-credentials.json` should not contain live keys
> in version control.

---

## 12. Running the project locally

```bash
# 1. Install dependencies (project has pnpm-lock.yaml and package-lock.json)
pnpm install        # or: npm install

# 2. Configure environment
cp .env.example .env.local   # then fill in values (see §11)

# 3. Set up the database
#    Visit /admin/setup-database in the browser and run the table setup,
#    or apply the SQL in database/ to your Supabase project.

# 4. Start the dev server
pnpm dev            # or: npm run dev
#    → http://localhost:3000  (redirects to /home)
```

### Other scripts (`package.json`)

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build (sourcemaps off) **then obfuscates** `.next/static` JS |
| `npm run start` | Serve the production build |
| `npm run lint` | Next.js lint |
| `npm run obfuscate` | Obfuscate built static JS (runs as part of build) |
| `npm run stamp-nirf-pdfs` | Brand NIRF source PDFs with site header/footer (`scripts/stamp-nirf-pdfs.mjs`) |

---

## 13. Deployment

- Configured for **Netlify** (`netlify.toml`).
- Production build disables source maps and **obfuscates client JS** to protect the ranking
  logic.
- Ensure all environment variables from §11 are set in the deployment environment, and switch
  Razorpay keys from test to **live** before going to production.

---

## 14. Where to look first (for new contributors)

| Goal | Start here |
|------|-----------|
| Understand the data model for colleges | [lib/college-service.ts](lib/college-service.ts), [lib/college-data.ts](lib/college-data.ts) |
| Understand auth | [app/contexts/AuthContext.tsx](app/contexts/AuthContext.tsx), [lib/supabase.ts](lib/supabase.ts) |
| Understand the core product | [app/choice-filling/page.tsx](app/choice-filling/page.tsx) |
| Understand payments | [components/PaymentButton.tsx](components/PaymentButton.tsx), `app/api/create-payment`, `app/api/verify-payment` |
| Understand referrals | [REFERRAL_SYSTEM_README.md](REFERRAL_SYSTEM_README.md) |
| Layout / global setup | [app/layout.tsx](app/layout.tsx) |
| Shared UI | [components/](components/), [components/ui/](components/ui/) |

---

*Generated as an overview of the codebase. The two existing READMEs —
[PAYMENT_INTEGRATION_README.md](PAYMENT_INTEGRATION_README.md) and
[REFERRAL_SYSTEM_README.md](REFERRAL_SYSTEM_README.md) — remain the detailed references for
those subsystems.*
