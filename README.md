# V-Mail

V-Mail is a single-deployment web portal for a Cloudflare-backed temporary email service. One Vite + React static app serves both ordinary user routes and admin routes.

中文文档见 [README_CN.md](README_CN.md).

## Routes

| Route group | Paths | Purpose |
| --- | --- | --- |
| User portal | `/`, `/login`, `/register`, `/inbox`, `/settings` | Register or log in, create mailbox addresses, browse bound inboxes, and read parsed messages. |
| Admin console | `/admin`, `/admin/accounts`, `/admin/settings`, `/admin/status` | Use the existing admin credential to inspect accounts, manage mailbox addresses, delete accounts, view messages, check service status, and update user settings. |

## Tech Stack

- React 18
- Vite 5
- TypeScript
- Tailwind CSS
- Vitest + Testing Library
- Static hosting on Cloudflare Pages, Vercel, Netlify, or similar platforms

## Repository Layout

```text
.
├── public/            # Static assets and Cloudflare/Netlify SPA fallback
├── src/
│   ├── admin/         # Admin console mounted at /admin/*
│   ├── api/           # User API client
│   ├── auth/          # User auth state
│   ├── components/    # User portal pages and shared user UI
│   └── config/        # Public frontend environment variables
├── index.html
├── package.json
├── vite.config.ts
└── vercel.json        # Vercel SPA fallback
```

## Environment Variables

These values are bundled into frontend JavaScript, so they must not contain secrets.

| Variable | Description |
| --- | --- |
| `API_BASE_URL` | Base URL for all API calls (user and admin). Use `mock` for local demo data. |
| `MAILBOX_DOMAINS` | Comma-separated mailbox domains supported by the UI. The first value is the default domain. |
| `PUBLIC_MAILBOX_URL` | Public mailbox URL used when generating mailbox access links. |

Copy `.env.example` to `.env.local` for local values.

## Local Development

```bash
npm install
npm run dev -- --host 127.0.0.1
```

By default the app can run against mock data. To connect to a real API, set the public API and domain values in `.env.local`.

## Testing and Builds

```bash
npm test
npm run build
```

The production build is written to `dist/`.

## Deployment

Use one static site project.

Cloudflare Pages:

```text
Root directory: .
Build command: npm run build
Build output directory: dist
```

Vercel:

```text
Framework: Vite
Root Directory: .
Build Command: npm run build
Output Directory: dist
```

`public/_redirects` provides Cloudflare/Netlify SPA fallback:

```text
/* /index.html 200
```

`vercel.json` provides Vercel SPA fallback for React Router paths such as `/admin/accounts`, `/inbox`, and `/settings`.

## API Expectations

Endpoint adapters are centralized in:

- `src/api/userClient.ts`
- `src/admin/api/adminClient.ts`

The user portal sends ordinary-user credentials via `x-user-token` and address-scoped access via `Authorization: Bearer <address jwt>`.

The admin console sends the admin credential via `x-admin-auth`. The backend must enforce all authorization checks. Do not rely on the frontend route structure or hidden UI as a security boundary.

## Security Notes

- Frontend environment variables are public by design.
- Put real secrets in the backend Worker or Pages Functions environment, not in this repository.
- If `/admin` needs an additional perimeter, protect the same deployed site path with host-level access rules while keeping the frontend build unified.
- Keep CORS rules explicit if the frontend and API are on different origins.

## License

MIT
