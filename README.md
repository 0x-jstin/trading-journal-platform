# Trading Journal Platform

## Branch workflow

- `main`: stable production releases
- `develop`: tested development changes
- `feature/*`: isolated feature work

## Local development

1. Install dependencies:

   ```powershell
   npm.cmd install
   ```

2. Create `.env.local` from `.env.example`.

3. Run the app:

   ```powershell
   npm.cmd run dev
   ```

4. Build for production:

   ```powershell
   npm.cmd run build
   ```

## Supabase setup

1. Create separate Supabase projects for development and production.
2. Run `supabase/migrations/001_initial_schema.sql` in each project's SQL editor.
3. Enable Email authentication in Supabase Authentication.
4. Create the private account that will own the journal.
5. Set these environment variables:

   ```text
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_ANON_KEY
   ```

Do not enable `VITE_AUTH_MODE=local` in production.

## Vercel

- Build command: `npm run build`
- Output directory: `dist`
- Add the Supabase variables separately to Preview and Production.
- Deploy `develop` as previews and `main` as production.