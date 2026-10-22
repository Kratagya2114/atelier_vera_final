# ATELIER VERA: Website + Email Backend

A Next.js 14 website. The enquiry form sends an email to the studio and a confirmation to the visitor through your SMTP account (e.g. Gmail). There is **no database**: the email is the record.

## Run it on your computer
1. `npm install` (Node 18 or newer)
2. `npm run setup` creates a `.env` file. Open it and fill in `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` and `STUDIO_INBOX_EMAIL`. For Gmail use an **App Password** (Google Account > Security > 2-Step Verification > App passwords), typed without spaces.
3. `npm run mail:test -- you@gmail.com` checks the email login and sends a test email.
4. `npm run dev`, then open http://localhost:3000. `http://localhost:3000/api/health` shows whether email is configured.

## Deploy (Vercel)
Push to GitHub, import the repo in Vercel, and add these Environment Variables (Production): `SMTP_HOST` (smtp.gmail.com), `SMTP_PORT` (587), `SMTP_SECURE` (false), `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `STUDIO_INBOX_EMAIL`, `ALLOWED_ORIGINS` (your live site address). Redeploy after changing variables.

## How it works
- `public/index.html` is the website. Its form posts to `/api/inquiries`.
- `src/middleware.ts` protects every `/api` call: allowed methods, JSON only, 100 KB limit, CORS allow-list, rate limit (5 enquiries per IP per 10 minutes), security headers.
- `src/lib/mailer.ts` sends the emails with Nodemailer. If the studio email cannot be delivered, the visitor sees a friendly "please try again" message instead of a false success.
- `POST /api/configurator/calculate` returns a cost estimate and can email it to the visitor.
- Never commit `.env`; it holds your email password.
