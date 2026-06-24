# V-Mail

V-Mail 是一个面向 Cloudflare 临时邮箱服务的单次部署前端项目。同一个 Vite + React 静态应用同时提供普通用户门户和管理后台。

English documentation: [README.md](README.md).

## 路由

| 路由组 | 路径 | 用途 |
| --- | --- | --- |
| 用户门户 | `/`、`/login`、`/register`、`/inbox`、`/settings` | 注册/登录、创建邮箱地址、查看绑定邮箱、阅读解析后的邮件。 |
| 管理后台 | `/admin`、`/admin/accounts`、`/admin/settings`、`/admin/status` | 使用现有管理员凭据查看账号、管理邮箱地址、删除账号、查看邮件、检查服务状态和更新用户设置。 |

## 技术栈

- React 18
- Vite 5
- TypeScript
- Tailwind CSS
- Vitest + Testing Library
- 支持 Cloudflare Pages、Vercel、Netlify 等静态托管平台

## 目录结构

```text
.
├── public/            # 静态资源和 Cloudflare/Netlify SPA fallback
├── src/
│   ├── admin/         # 挂载在 /admin/* 的管理后台
│   ├── api/           # 用户 API client
│   ├── auth/          # 用户登录态
│   ├── components/    # 用户门户页面和用户侧 UI
│   └── config/        # 公开前端环境变量
├── index.html
├── package.json
├── vite.config.ts
└── vercel.json        # Vercel SPA fallback
```

## 环境变量

这些变量会被打包进前端 JavaScript，因此不能放任何密钥。

| 变量 | 说明 |
| --- | --- |
| `API_BASE_URL` | 所有 API 请求的基础地址（用户和管理共用）。设置为 `mock` 时使用本地模拟数据。 |
| `MAILBOX_DOMAINS` | UI 支持的邮箱域名列表，使用英文逗号分隔，第一个值作为默认域名。 |
| `PUBLIC_MAILBOX_URL` | 生成邮箱访问链接时使用的公开邮箱地址。 |

本地开发时复制 `.env.example` 为 `.env.local`。

## 本地开发

```bash
npm install
npm run dev -- --host 127.0.0.1
```

默认情况下应用可以使用 mock 数据运行。如果要连接真实 API，请在 `.env.local` 中填写公开 API 地址和域名配置。

## 测试与构建

```bash
npm test
npm run build
```

生产构建产物输出到 `dist/`。

## 部署

只需要创建一个静态站点项目。

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

`public/_redirects` 提供 Cloudflare/Netlify 的 SPA fallback：

```text
/* /index.html 200
```

`vercel.json` 提供 Vercel 的 SPA fallback，确保 `/admin/accounts`、`/inbox`、`/settings` 等 React Router 路由刷新时不会 404。

## API 约定

接口适配集中在以下文件：

- `src/api/userClient.ts`
- `src/admin/api/adminClient.ts`

用户门户会通过 `x-user-token` 发送普通用户凭据，通过 `Authorization: Bearer <address jwt>` 发送地址级访问凭据。

管理后台会通过 `x-admin-auth` 发送管理员凭据。所有鉴权都必须由后端执行，不要把前端路由或隐藏 UI 当成安全边界。

## 安全说明

- 前端环境变量天然是公开信息。
- 真实密钥应该放在后端 Worker 或 Pages Functions 的环境变量/secret 中，不要提交到仓库。
- 如果 `/admin` 需要额外的外围保护，请在同一个已部署站点的路径或主机规则上配置访问控制，同时保持前端只构建和部署一次。
- 如果前端和 API 不同源，后端需要显式配置 CORS。

## 许可证

MIT
