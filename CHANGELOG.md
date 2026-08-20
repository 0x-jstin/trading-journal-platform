# Changelog

All notable features, fixes, security changes, and deployment updates are documented here.

## Unreleased

### Planned

- Refined application shell and navigation
- Redesigned performance dashboard
- Unified visual system for forms, tables, dialogs, and feedback states
- Improved responsive layouts and frontend interactions

## 1.0.0 - 2026-08-20

### Added

- Supabase email and password authentication
- Signup confirmation by email link or verification code
- Resend-confirmation workflow
- User profiles and onboarding flow
- Cloud-backed journal state synchronization
- Private trade-chart storage
- Secure account deletion through a Supabase Edge Function
- Vercel production deployment configuration
- Repeatable Supabase setup documentation

### Security

- Added row-level security policies for journal and profile data
- Restricted stored trade charts to user-owned folders
- Kept service-role credentials inside the server-side Edge Function environment
- Limited browser configuration to the Supabase publishable key
- Enabled JWT verification for account deletion

### Fixed

- Made profile and onboarding database setup rerunnable
- Stabilized partially configured Supabase project setup
- Resolved duplicate-policy failures during initial remote migration deployment
- Corrected signup confirmation and email-delivery configuration

### Deployment

- Applied the production database schema and migrations
- Deployed the delete-account Edge Function
- Configured Supabase authentication URLs and confirmation email template
- Verified signup, confirmation, sign-in, persistence, and account workflows in production
