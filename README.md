# V-Mail

V-Mail is a two-frontend web portal for a Cloudflare-backed temporary email service. The repository contains an ordinary-user portal and a read-only admin console, both built as Vite + React static applications that can be deployed with Cloudflare Pages.

中文文档见 [README_CN.md](README_CN.md).

## Applications

| App | Path | Purpose |
| --- | --- | --- |
| User portal | `user/` | Register or log in, create mailbox addresses, browse bound inboxes, and read parsed messages. |
| Admin console | `admin/` | Use the existing admin credential to inspect accounts, addresses, messages, service status, and user settings. |

The apps are intentionally frontend-only. They expect an existing Worker or Pages Functions API to provide mailbox, user, admin, and message endpoints.

## Tech Stack

- React 18
- Vite 5
- TypeScript
- Tailwind CSS
- Vitest + Testing Library
- Cloudflare Pages-ready static builds

## Repository Layout

```text
.
├── admin/             # Read-only admin frontend
├── user/              # Ordinary-user portal, including an embedded /admin route
├── package.json       # Root tooling dependency, currently Wrangler
└── .gitignore         # Keeps local env, build output, dependencies, and operational exports out of Git
```

Operational analysis files, D1 exports, local environment files, build output, and dependency folders are intentionally ignored and should not be committed to a public repository.

## Environment Variables

This project does not use `VITE_` prefixes. The Vite configs explicitly expose these public client-side prefixes:

- `ADMIN_`
- `USER_`
- `MAILBOX_`
- `PUBLIC_`

These values are bundled into frontend JavaScript, so they must not contain secrets.

| Variable | Used by | Description |
| --- | --- | --- |
| `USER_API_BASE_URL` | `user/` | Base URL for ordinary-user API calls. Use `mock` for local demo data. |
| `ADMIN_API_BASE_URL` | `admin/`, `user/src/admin` | Base URL for admin API calls. Use `mock` for local demo data. |
| `MAILBOX_DOMAIN` | both apps | Domain used when creating or previewing mailbox addresses. |
| `PUBLIC_MAILBOX_URL` | admin UI | Public mailbox URL used when generating mailbox access links. |

Example files:

- `admin/.env.example`
- `user/.env.example`

Never put Cloudflare API tokens, JWT signing secrets, admin passwords, D1 credentials, Turnstile secret keys, or any private backend configuration in these frontend environment variables.

## Local Development

Install and run the user portal:

```bash
cd user
npm install
npm run dev -- --host 127.0.0.1
```

Install and run the admin console:

```bash
cd admin
npm install
npm run dev -- --host 127.0.0.1
```

By default, both apps can run against mock data. To connect to a real API, copy the matching `.env.example` to `.env.local` and set the public API/domain values for your environment.

## Testing and Builds

Run tests:

```bash
cd admin
npm test

cd ../user
npm test
```

Build production assets:

```bash
cd admin
npm run build

cd ../user
npm run build
```

Each app writes its static output to `dist/`.

## Cloudflare Pages Deployment

Recommended setup is two Cloudflare Pages projects:

### User Portal

```text
Root directory: user
Build command: npm run build
Build output directory: dist
```

Set Pages environment variables as needed:

```env
USER_API_BASE_URL=https://api.example.com
ADMIN_API_BASE_URL=https://api.example.com
MAILBOX_DOMAIN=example.com
PUBLIC_MAILBOX_URL=https://mail.example.com
```

### Admin Console

```text
Root directory: admin
Build command: npm run build
Build output directory: dist
```

Set Pages environment variables as needed:

```env
ADMIN_API_BASE_URL=https://api.example.com
MAILBOX_DOMAIN=example.com
PUBLIC_MAILBOX_URL=https://mail.example.com
```

Both apps include `public/_redirects` with SPA fallback:

```text
/* /index.html 200
```

This allows React Router routes such as `/inbox`, `/settings`, and `/accounts` to refresh correctly on Cloudflare Pages.

## API Expectations

Endpoint adapters are centralized in:

- `user/src/api/userClient.ts`
- `admin/src/api/adminClient.ts`
- `user/src/admin/api/adminClient.ts`

The user portal sends ordinary-user credentials via `x-user-token` and address-scoped access via `Authorization: Bearer <address jwt>`.

The admin console sends the admin credential via `x-admin-auth`. The backend must enforce all authorization checks. Do not rely on the frontend route structure or hidden UI as a security boundary.

## Security Notes

- This repository is safe to publish only if `.env.local`, operational exports, and generated artifacts remain ignored.
- Frontend environment variables are public by design.
- Put real secrets in the backend Worker or Pages Functions environment, not in this repository.
- Consider deploying the admin console separately and protecting it with Cloudflare Access.
- Keep CORS rules explicit if the frontend and API are on different origins.

## License

No license has been declared yet. Add one before accepting external contributions or reuse.
