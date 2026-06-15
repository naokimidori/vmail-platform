# V-Mail User Portal

Independent ordinary-user frontend for temporary mailbox accounts.

## Scope

- Lets ordinary users register, verify email when enabled, log in, and keep a local session.
- Lets logged-in users create temporary mailbox addresses and bind them to their account.
- Shows bound mailbox addresses, address-scoped inbox messages, parsed message details, and user settings.
- Runs independently from the read-only admin frontend in `../admin`.
- Follows the existing admin visual and interaction style incrementally: glass frame, shared UI primitives, lucide icons, toast feedback, loading/empty/error states, and responsive layouts.

This portal does not implement OAuth2 login, passkeys, SMTP/IMAP setup, sending mail, webhook settings, Telegram binding, billing, or super-admin user management.

## Local Development

```bash
npm install
npm run dev -- --host 127.0.0.1
```

By default the app runs against local mock data:

```env
USER_API_BASE_URL=mock
MAILBOX_DOMAIN=example.com
```

To connect to a real Cloudflare Temp Email Worker API, create `.env.local`:

```env
USER_API_BASE_URL=https://api.example.com
ADMIN_API_BASE_URL=https://api.example.com
MAILBOX_DOMAIN=example.com
PUBLIC_MAILBOX_URL=https://mail.example.com
```

## Scripts

```bash
npm test
npm run build
npm run preview
```

The production build is written to `dist/`.

## API Credential Rules

The user portal keeps ordinary-user credentials separate from admin credentials:

- Authenticated user API calls send `x-user-token: <user jwt>`.
- Address-scoped parsed mail calls send `Authorization: Bearer <address jwt>`.
- New address binding sends both the logged-in user token and the newly created address JWT.
- The user portal must not send or depend on `x-admin-auth`.

Endpoint behavior is centralized in `src/api/userClient.ts`.

## Visual Verification

Before shipping user-facing UI changes, run:

```bash
npm test
npm run build
npm run dev -- --host 127.0.0.1
```

Check desktop `1440 x 1000` and mobile `390 x 844`. Login, registration, mailbox list, address creation, inbox, message detail, and settings should remain readable without overlapping text, clipped controls, or unintended horizontal scrolling.
