# Technician Management

Static frontend for Secure Services Technician Management, using Supabase Auth and a protected Supabase Edge Function for data access.

## Deploy through GitHub to Vercel

Push this project directory to a private GitHub repository. Import the repository in Vercel. Use framework **Other**, root directory **./**, no build command, and output directory **dist**. The included vercel.json declares these settings. Vercel's Git integration deploys later commits automatically.

Only dist/ is served as the website. Backend source and SQL must never be copied into dist/.

## Supabase activation (required before live use)

Run Supabase-sync.sql in the project's SQL Editor and deploy supabase/functions/tm-api/index.ts as tm-api with verify_jwt=false. The function itself verifies access tokens and active profiles on protected actions. Complete the Super Admin Auth/profile bootstrap and data import as described in the accompanying activation instructions.

The Supabase project URL and publishable key are intentionally public. Never add a service-role key, secret key, database password, real user passwords, or a browser-data backup to this repository.

Hosted login fails until the backend is deployed. There is no default administrator password fallback in this hosted frontend.

## Updates and data

Frontend changes pushed to the linked GitHub branch trigger Vercel deployment. Changes made inside the running app are saved separately to Supabase, after successful authentication and server deployment; they do not create Git commits. Cross-device record updates are checked every 15 seconds while no field or popup is active. Failed saves are clearly marked and retained locally for recovery.

