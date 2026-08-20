# Trading Journal Platform

A cloud-backed trading journal for planning trades, recording execution, reviewing performance, and improving trading discipline.

## Current Features

- Email and password authentication with email confirmation
- User profiles and first-run onboarding
- Cloud journal synchronization through Supabase
- User-owned data protected by row-level security
- Private chart-image storage
- Secure account deletion through a Supabase Edge Function
- Responsive dashboard, journal, setup, live-trade, and settings views

## Tech Stack

- Vite
- Vanilla JavaScript, HTML, and CSS
- Supabase Auth, Postgres, Storage, and Edge Functions
- Vercel deployment

## Local Development

Requirements: Node.js 20 or newer, npm, and a configured Supabase project.

    npm.cmd install

Create .env.local from .env.example and add:

    VITE_SUPABASE_URL=your-project-url
    VITE_SUPABASE_ANON_KEY=your-publishable-key

Run locally with npm.cmd run dev. Build for production with npm.cmd run build.

## Supabase Setup

Follow SUPABASE_SETUP.md for database, authentication, email confirmation, storage, and Edge Function configuration.

Never place SUPABASE_SERVICE_ROLE_KEY in browser code, VITE_ variables, or tracked files.

## Deployment

- Build command: npm run build
- Output directory: dist
- Production variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

    npx.cmd supabase functions deploy delete-account
    npx.cmd vercel --prod

## Branch Workflow

- main: stable production releases
- develop: tested development changes
- feature/*: isolated feature work

See CHANGELOG.md for features, fixes, security changes, and deployment updates.
