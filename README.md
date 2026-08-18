# PathPilot

**Your career, clarified.** PathPilot is a placement-prep workspace for students and job seekers — it reads your resume, tells you exactly which skills you're missing for the role you want, builds a personalized learning roadmap, tests you with aptitude/technical MCQs, and matches you against real companies and live job postings.

## Table of contents

- [How it works](#how-it-works)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Database setup](#database-setup)
- [Running locally](#running-locally)
- [Deployment](#deployment)
- [Available scripts](#available-scripts)

## How it works

PathPilot is organized as five guided modules, each unlocking as you make progress through the last:

1. **Auth & Profile** — sign up, verify, and set your target role, college, and background.
2. **Resume Intelligence** — upload a resume (PDF/DOCX) and get an ATS-readiness score, detected skills, and the job roles you currently match.
3. **Skill Direction** — a roadmap of exactly what to learn next, grouped by Must Have / Nice to Have / Advanced, each with a linked tutorial.
4. **Knowledge Check** — aptitude and role-specific technical MCQs, with difficulty that increases as you clear a category.
5. **Before & After** — compare two versions of your resume to see what improved and which new roles opened up.

Alongside these: a dashboard with salary projections and progress tracking, a company-matching view, live job listings for your target role, and an admin panel for account management.

## Features

- **Resume parsing & ATS scoring** for PDF and DOCX resumes, entirely client-side.
- **Skill-gap analysis** against curated per-role skill datasets, with a linked tutorial for every missing skill.
- **AI-powered fallback for any role** — if you type a target role that isn't in the curated list, PathPilot asks an AI model for that role's required skills, salary range, learning roadmap, and a tailored technical quiz, then caches the result so it's only ever generated once.
- **Aptitude & technical testing** with category-specific question banks and difficulty that scales with your attempts.
- **Company matching** ranked by how much of each company's role requirements you already meet.
- **Live job search** for your target role and location via a real jobs API.
- **Resume comparison** to track improvement between versions.
- **Progress-gated navigation** — each module unlocks once the previous one is meaningfully complete.
- **Admin panel** for reviewing users and managing accounts.
- **Security-conscious auth**: strong-password enforcement, one active session per account (signing in elsewhere signs you out immediately), and sessions that don't outlive the browser tab.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Plain CSS (custom design system) |
| Backend / API | Cloudflare Worker (TypeScript) |
| Database & Auth | Supabase (Postgres + Row Level Security) |
| AI | Cloudflare Workers AI |
| Hosting | Cloudflare Workers (static assets + API in one deployment) |

## Architecture

```
Browser (React SPA)
   │
   ├── Supabase client  →  Postgres + Auth (profiles, resumes, roadmap, results…)
   │
   └── fetch("/api/…")  →  Cloudflare Worker
                              ├── /api/roles/infer   → Workers AI (uncurated target roles)
                              ├── /api/jobs/search    → live jobs provider
                              └── /api/admin/users/*  → admin-only account management
```

The frontend talks directly to Supabase for all normal data (profile, resume analyses, roadmap progress, aptitude results) under Row Level Security, so each user can only ever read/write their own rows. The Worker only handles the few things that need a secret credential the browser must never see (deleting accounts, the AI role lookup's cache, proxying the live-jobs API).

## Project structure

```
src/
├── App.tsx              # Routing, layout, and every page/module component
├── context/              # Auth and shared app-data providers
├── lib/                  # Business logic: resume parsing, scoring, roadmap
│                          #   generation, question banks, validation, etc.
├── data/                  # Curated role/company/college/course datasets (JSON)
└── assets/                # Static images

worker/
└── index.ts               # Cloudflare Worker: admin actions, AI role lookup,
                             #   live-jobs proxy; serves the built SPA otherwise

supabase/
└── migrations/             # SQL migrations — schema, RLS policies, seed data
```

## Getting started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Cloudflare](https://cloudflare.com) account (for deployment; not required for local dev)

### Install

```bash
git clone <this-repo-url>
cd project
npm install
```

## Environment variables

Create a `.env` file in the project root (never commit this file):

| Variable | Where it's used | Required |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend — your Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Frontend — Supabase anon/public key | Yes |
| `VITE_PUBLIC_APP_URL` | Frontend — your deployed app URL, used in password-reset email links | Recommended once deployed |
| `SUPABASE_SERVICE_ROLE_KEY` | Local admin scripts / Worker secret — **never expose to the browser** | Only for admin features |

For production, `SUPABASE_SERVICE_ROLE_KEY` is set as an encrypted **secret** on the Cloudflare Worker (dashboard → Worker → Settings → Variables and Secrets), not as a build-time `VITE_` variable. Workers AI needs no separate key — it runs on your Cloudflare account's own free allocation once the `ai` binding is enabled (already configured in `wrangler.jsonc`).

## Database setup

1. Create a Supabase project.
2. Run every SQL file in `supabase/migrations/`, in filename order, via the Supabase SQL Editor (or the Supabase CLI).
3. Copy your project's URL and anon key from Supabase → Project Settings → API into `.env`.

Migrations set up the schema, Row Level Security policies, and any seed data the app expects.

## Running locally

```bash
npm run dev
```

This starts the Vite dev server. Sign up for an account, and you're in.

## Deployment

PathPilot deploys as a single Cloudflare Worker that serves the built frontend and handles the small set of server-side routes.

```bash
npm run build
npx wrangler deploy
```

Required Worker secrets (add via the Cloudflare dashboard, not committed anywhere):

- `SUPABASE_SERVICE_ROLE_KEY` — enables admin account management and the AI role-lookup cache.
- `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` — enables live job search (optional; the feature no-ops cleanly without it).

> Adding a secret via the Cloudflare dashboard creates a new Worker version that isn't automatically promoted to live traffic. Trigger a fresh deploy (e.g. push a commit) afterward so it takes effect.

## Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the local dev server |
| `npm run build` | Build for production (run `npm run typecheck` separately before deploying) |
| `npm run typecheck` | Run TypeScript's type checker without emitting output |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production build locally |
