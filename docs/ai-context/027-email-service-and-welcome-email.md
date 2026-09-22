# Pulse — Email Delivery Service & Transactional Email Templates (ADR-027)

## Overview
Pulse provides a universal, resilient email dispatch engine powered by Nodemailer. It supports real SMTP delivery (compatible with TempMail, Mail.tm, Gmail, Brevo, Sendgrid, etc.), development Ethereal test inboxes, and console mock logging. Both Welcome Emails and Member Project Invitation Emails are fully templated and integrated.

- **Milestone:** Phase 4, Step 4.04 (`v0.4.4`)
- **ADR Reference:** `ADR-027-E-posta Servisi Entegrasyonu ve Hoş Geldiniz (Welcome) E-postası Mimarisi`
- **Domain Logic:** `src/lib/email-templates.ts` (`renderWelcomeEmail`, `renderInviteMemberEmail`, `validateEmailConfig`, `escapeHtml`)
- **Transport Service:** `src/lib/mail.ts` (`sendEmail`, `sendWelcomeEmail`, `sendInviteMemberEmail`)
- **Auth Registration Endpoint:** `src/app/api/auth/register/route.ts` (Welcome Email dispatch)
- **Member Action:** `src/actions/member.ts` (Member Invitation Email dispatch in `inviteMember`)
- **CLI Testing Tool:** `scripts/test-mail.ts` (`npm run mail:test -- <email> [welcome|invite]`)
- **Test Suite:** `src/lib/__tests__/email-templates.test.ts` (23 tests)
- **Total Test Count:** 416 tests across 22 suites (100% passing)

---

## Architecture & Transporter Strategy

1. **Universal Mail Engine (`sendEmail`):**
   - Central entry point taking `{ to, subject, html, text?, from? }`.
   - Validates recipient email, applies `EMAIL_FROM`, and executes non-blocking delivery.

2. **Hybrid Transport Resolution (`validateEmailConfig`):**
   - **Production SMTP:** Triggered when `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are provided in `.env`. Compatible with all major providers and temporary email inboxes.
   - **Local Development (Ethereal):** Auto-provisions a disposable test inbox via Ethereal Mail if no SMTP credentials are configured, printing a one-click preview URL in the console.
   - **Test & CI (Console / Mock):** Active when `NODE_ENV === "test"` or `EMAIL_TRANSPORT === "console"`, preventing network requests and fast-tracking test runs.

3. **Non-blocking Dispatch Guarantee:**
   - Both user registration (`/register`) and member invitations (`inviteMember`) execute mail dispatch asynchronously with `.catch()` logging.
   - Any transport error, network timeout, or SMTP failure is absorbed without interrupting or rolling back database records or HTTP responses.

4. **Transactional Templates:**
   - **Welcome Email (`renderWelcomeEmail`):** Dark/zinc branded responsive HTML + text fallback, onboarding feature highlights, `/login` CTA button.
   - **Member Invitation (`renderInviteMemberEmail`):** Project name, inviter name, role (`ADMIN` / `MEMBER`), 7-day expiration notice, `/invite/[token]` CTA button.
   - **Security:** Built-in `escapeHtml` neutralizes XSS in user and project names.

5. **Verified Production Delivery:**
   - Confirmed live delivery via Brevo SMTP Relay (`smtp-relay.brevo.com:587`, TLS).
   - Both Welcome and Invitation emails render identically across mobile, web, and desktop email clients with responsive dark styling, role badges, and direct `/invite/[token]` and `/login` CTAs.

