# V-Mail Read-only Admin

Independent read-only admin frontend for a Cloudflare-backed temporary email service.

For the ordinary-user mailbox portal, see `../user/README.md`.

## Scope

- Runs independently from the public mailbox frontend.
- Uses the existing admin password mechanism.
- Sends the admin credential as `x-admin-auth` through the centralized admin API client.
- Shows all accounts, account detail, mailbox addresses, message previews, search, and system status in read-only mode.

## Local Development

```bash
npm install
npm run dev
```

For local demo data, omit `ADMIN_API_BASE_URL`. The app defaults to mock data.

To connect to the real Worker API:

```bash
cp .env.example .env.local
```

Set:

```env
ADMIN_API_BASE_URL=https://api.example.com
MAILBOX_DOMAIN=example.com
PUBLIC_MAILBOX_URL=https://mail.example.com
```

## Build

```bash
npm run build
```

The static output is written to `dist/` and can be deployed to Cloudflare Pages.

## Visual Refresh Verification

Run the admin app locally:

```bash
npm install
npm test
npm run build
npm run dev -- --host 127.0.0.1
```

Before shipping visual changes, check desktop `1440 x 1000`, tablet `820 x 1180`, mobile `390 x 844`, and narrow mobile `320 x 740`. The glass site frame, navigation, dashboard, account table, login card, and dialogs should remain readable without overlapping text.

## Security Notes

- Version one is read-only.
- Do not add create, delete, send, edit, or settings mutation controls without a new design review.
- The admin credential must not be placed in URLs, logs, analytics events, or copied links.
- If the backend returns raw email HTML, render it through a sandboxed or sanitized preview.

## Backend Adapter

Endpoint names are centralized in `src/api/adminClient.ts`.

Default expected paths based on the current Cloudflare Temp Email backend:

- `GET /admin/statistics`
- `GET /admin/users`
- `GET /admin/address`

`ADMIN_API_BASE_URL` points to the Worker or Pages Functions API. `MAILBOX_DOMAIN` controls the mailbox domain used when creating addresses, and `PUBLIC_MAILBOX_URL` is used when generating user-facing mailbox access links.

If the existing Worker uses different endpoint names, update only `src/api/adminClient.ts`.
