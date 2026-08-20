# Supabase Setup

Use this guide for both a new project and the current partially configured development project.

## 1. Run the canonical database setup

1. Open the Supabase project dashboard.
2. Open SQL Editor.
3. Select New query.
4. Open supabase/setup.sql locally.
5. Paste the entire file into the query editor.
6. Click Run.

The script is idempotent. It can repair a partial setup and can be run again safely.

Expected result:

    Success. No rows returned

## 2. Configure authentication URLs

Open Authentication -> URL Configuration.

For local development set:

    Site URL: http://localhost:5174

Add these Redirect URLs:

    http://localhost:5174/**
    http://127.0.0.1:5174/**

Later add the Vercel preview and production domains before deploying.

## 3. Configure confirmation email

Open Authentication -> Email Templates -> Confirm signup.

Use a template that contains both the link and token:

    <h2>Confirm your Trading Journal account</h2>
    <p><a href="{{ .ConfirmationURL }}">Confirm account</a></p>
    <p>Or enter this code in the app: <strong>{{ .Token }}</strong></p>

## 4. Deploy account deletion

1. Open Edge Functions.
2. Create or replace a function named delete-account.
3. Paste supabase/functions/delete-account/index.ts.
4. Keep JWT verification enabled.
5. Deploy the function.

Do not manually add secrets whose names start with SUPABASE_. Supabase injects the project URL, anon key, and service-role key into Edge Functions automatically.

## 5. Verify the setup

In Table Editor, confirm these tables exist:

- journal_states
- profiles

In Storage, confirm this private bucket exists:

- trade-charts

In Database -> Policies, confirm both tables and the storage bucket have user-owned row-level security policies.

## 6. Test

1. Reload the Vite app.
2. Create a test account with name, username, email, and password.
3. Confirm it using either the link or code.
4. Complete the first-run tutorial.
5. Make a journal change and confirm the Account tab says Synced.
6. Test account deletion only with a disposable test account.