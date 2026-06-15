# V-Mail

V-Mail 是一个面向 Cloudflare 临时邮箱服务的双前端项目。仓库中包含普通用户门户和只读管理后台，两者都是 Vite + React 静态应用，可以直接用 Cloudflare Pages 部署。

English documentation: [README.md](README.md).

## 应用组成

| 应用 | 路径 | 用途 |
| --- | --- | --- |
| 用户门户 | `user/` | 注册/登录、创建邮箱地址、查看绑定邮箱、阅读解析后的邮件。 |
| 管理后台 | `admin/` | 使用现有管理员凭据查看账号、地址、邮件、服务状态和用户设置。 |

这两个应用都只包含前端代码。邮箱、用户、管理、邮件解析等能力需要由现有 Worker 或 Pages Functions API 提供。

## 技术栈

- React 18
- Vite 5
- TypeScript
- Tailwind CSS
- Vitest + Testing Library
- 适配 Cloudflare Pages 的静态构建

## 目录结构

```text
.
├── admin/             # 只读管理后台
├── user/              # 普通用户门户，内部也包含 /admin 路由
├── package.json       # 根目录工具依赖，目前主要是 Wrangler
└── .gitignore         # 忽略本地 env、构建产物、依赖和运维导出数据
```

D1 分析文件、邮箱导出数据、本地环境变量、构建产物和依赖目录都已被忽略，不应该提交到公开仓库。

## 环境变量

本项目不使用 `VITE_` 前缀。Vite 配置中显式允许以下公开前端变量前缀：

- `ADMIN_`
- `USER_`
- `MAILBOX_`
- `PUBLIC_`

这些变量会被打包进前端 JavaScript，因此不能放任何密钥。

| 变量 | 使用位置 | 说明 |
| --- | --- | --- |
| `USER_API_BASE_URL` | `user/` | 普通用户 API Base URL。设置为 `mock` 时使用本地模拟数据。 |
| `ADMIN_API_BASE_URL` | `admin/`、`user/src/admin` | 管理 API Base URL。设置为 `mock` 时使用本地模拟数据。 |
| `MAILBOX_DOMAIN` | 两个应用 | 创建或预览邮箱地址时使用的域名。 |
| `PUBLIC_MAILBOX_URL` | 管理后台 | 生成邮箱访问链接时使用的公开邮箱地址。 |

示例文件：

- `admin/.env.example`
- `user/.env.example`

不要把 Cloudflare API Token、JWT 签名密钥、管理员密码、D1 凭据、Turnstile Secret Key 或任何后端私密配置放进这些前端环境变量。

## 本地开发

启动用户门户：

```bash
cd user
npm install
npm run dev -- --host 127.0.0.1
```

启动管理后台：

```bash
cd admin
npm install
npm run dev -- --host 127.0.0.1
```

默认情况下，两个应用都可以使用 mock 数据运行。如果要连接真实 API，请复制对应的 `.env.example` 为 `.env.local`，然后填写当前环境的公开 API 地址和域名配置。

## 测试与构建

运行测试：

```bash
cd admin
npm test

cd ../user
npm test
```

构建生产静态资源：

```bash
cd admin
npm run build

cd ../user
npm run build
```

每个应用的构建产物都会输出到各自的 `dist/` 目录。

## Cloudflare Pages 部署

推荐创建两个 Cloudflare Pages 项目：

### 用户门户

```text
Root directory: user
Build command: npm run build
Build output directory: dist
```

按需配置 Pages 环境变量：

```env
USER_API_BASE_URL=https://api.example.com
ADMIN_API_BASE_URL=https://api.example.com
MAILBOX_DOMAIN=example.com
PUBLIC_MAILBOX_URL=https://mail.example.com
```

### 管理后台

```text
Root directory: admin
Build command: npm run build
Build output directory: dist
```

按需配置 Pages 环境变量：

```env
ADMIN_API_BASE_URL=https://api.example.com
MAILBOX_DOMAIN=example.com
PUBLIC_MAILBOX_URL=https://mail.example.com
```

两个应用都包含 `public/_redirects`：

```text
/* /index.html 200
```

这样在 Cloudflare Pages 上刷新 `/inbox`、`/settings`、`/accounts` 等 React Router 路由时不会返回 404。

## API 约定

接口适配集中在以下文件：

- `user/src/api/userClient.ts`
- `admin/src/api/adminClient.ts`
- `user/src/admin/api/adminClient.ts`

用户门户会通过 `x-user-token` 发送普通用户凭据，通过 `Authorization: Bearer <address jwt>` 发送地址级访问凭据。

管理后台会通过 `x-admin-auth` 发送管理员凭据。所有鉴权都必须由后端执行，不要把前端路由或隐藏 UI 当成安全边界。

## 安全说明

- 只要 `.env.local`、运维导出数据和生成产物继续被忽略，本仓库可以公开。
- 前端环境变量天然是公开信息。
- 真实密钥应该放在后端 Worker 或 Pages Functions 的环境变量/secret 中，不要提交到仓库。
- 建议管理后台单独部署，并用 Cloudflare Access 做额外保护。
- 如果前端和 API 不同源，后端需要显式配置 CORS。

## 许可证

当前尚未声明许可证。如果要接受外部贡献或允许他人复用，建议先补充 LICENSE。
