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

## Account setup migration

Run supabase/migrations/002_profiles_and_onboarding.sql after the initial schema.

## Link and code email confirmation

In Supabase, open Authentication -> Email Templates -> Confirm signup and include both variables:

    <p><a href="{{ .ConfirmationURL }}">Confirm account</a></p>
    <p>Confirmation code: <strong>{{ .Token }}</strong></p>

This lets users confirm with either the link or the code inside the app.

## Delete-account Edge Function

Deploy supabase/functions/delete-account/index.ts as a Supabase Edge Function named delete-account.

The function requires the standard project secrets:

- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

Keep JWT verification enabled. The browser sends the current user's access token, and the function verifies that token before deleting the account.