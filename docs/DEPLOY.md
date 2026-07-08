# 部署手册

API 部署 Heroku,网页版部署 Vercel,数据库用 Neon(已就绪)。
登录一次后,CLI 命令可由结对程序员代跑。

## ✅ 已上线(2026-07-08)

| | 地址 | 状态 |
| --- | --- | --- |
| API | https://aabill-api-3aba7ff414b5.herokuapp.com | ✓ /health、真 OpenAI、Neon、Cloudinary、迁移自动跑 |
| 网页 | https://aabill.vercel.app | ✓ 公开、SPA 深链回退、指向线上 API、CORS 通 |

- Heroku config vars 已设:DATABASE_URL / OPENAI_API_KEY / OPENAI_MODEL / CLOUDINARY_URL / JWT_SECRET;**未设 ALLOW_DEV_LOGIN(生产安全)**。
- Vercel 用 Build Output API(`--prebuilt`)部署静态导出;`config.json` 里 filesystem 优先 + 回退 index.html。
- 部署保护(Deployment Protection)已在 aabill 项目关闭,公开可访问。

### ⚠️ 生产暂时无法登录(待接 Google OAuth)

dev-login 生产关闭、Google/Apple 尚未接线,所以线上 Owner 还不能登录。接 Google 真登录后即可用:
- Google Cloud 的 Web client(已建,Client ID 在手)需配置:
  - **Authorized JavaScript origins**:`https://aabill.vercel.app`
  - **Authorized redirect URIs**:接线时确定(取决于 expo-auth-session 流程)
- 重新导出网页时:`EXPO_PUBLIC_API_URL=https://aabill-api-3aba7ff414b5.herokuapp.com`

### 重新部署命令(备忘)

```bash
# API
git push heroku main
# 网页(在 apps/mobile)
EXPO_PUBLIC_API_URL=https://aabill-api-3aba7ff414b5.herokuapp.com npx expo export --platform web
# 把 dist 内容放进 .vercel/output/static,配 config.json,然后:
npx vercel@latest deploy --prebuilt --prod --token "$VERSAL_TOKEN"
```

## 前置(一次性,你来点)

- `heroku login`(已完成 ✓,登录为 lizhien277@gmail.com)
- `vercel login`

## 一、API → Heroku

### 1. 建 app

```bash
heroku create aabill-api        # 或任意可用名
heroku git:remote -a aabill-api # 关联 git remote
```

### 2. 设 Config Vars(密钥,永不进仓库)

| 变量 | 值来源 |
| --- | --- |
| `DATABASE_URL` | Neon 连接串(.env 里现成的) |
| `OPENAI_API_KEY` | OpenAI(.env 里现成的) |
| `OPENAI_MODEL` | `gpt-4o`(可选) |
| `CLOUDINARY_URL` | Cloudinary(.env 里现成的) |
| `JWT_SECRET` | 强随机串,如 `openssl rand -hex 32` 生成 |

```bash
heroku config:set DATABASE_URL='...' OPENAI_API_KEY='...' CLOUDINARY_URL='...' JWT_SECRET='...' OPENAI_MODEL='gpt-4o'
```

**绝不要设** `ALLOW_DEV_LOGIN` —— 那是本地开发的"邮箱即登录",生产开了等于没鉴权。

### 3. 部署

```bash
git push heroku main
```

Procfile 是 `web: npm start --workspace=server`;server 启动时自动跑迁移(migrate)。
验证:`curl https://aabill-api.herokuapp.com/health` → `{"status":"ok"}`。

### ⚠️ 待验证:monorepo 在 Heroku 上的安装

本仓库是 npm workspaces,`apps/mobile` 带 expo/react-native(体积大)。Heroku 默认在根跑
`npm install` 会把 mobile 依赖也装上,可能拖慢构建或逼近 slug 体积上限。部署时先直接试;
若超限,用以下之一收敛(下个工作段处理):
- `.slugignore` 排除 `apps/mobile`(减小 slug,但 install 仍会跑)
- 或让 Heroku 只装 server 工作区(自定义 `NPM_CONFIG_*` / buildpack)
- server 运行期依赖(hono / pg / tsx / zod / @aabill/core / @aabill/api-types)都在
  `server` 的 dependencies,生产 prune 掉 devDependencies 不影响启动(已验证 `npm start` 可起)。

## 二、网页版 → Vercel

Expo 网页版是静态导出。

```bash
cd apps/mobile
vercel                          # 首次交互式:关联项目
```

或在 Vercel 面板连 GitHub 仓库,设:
- **Root Directory**:`apps/mobile`
- **Build Command**:`npx expo export --platform web`
- **Output Directory**:`dist`
- **环境变量** `EXPO_PUBLIC_API_URL` = Heroku API 地址(如 `https://aabill-api.herokuapp.com`)
  —— 让网页版调线上 API 而非 localhost。

## 三、部署后:接真登录(Apple 网页版)

网页版 Apple 登录需要部署后的域名(回调 URL),所以排在部署之后:

- **你在 Apple Developer**:建 App ID(勾 Sign in with Apple)+ Services ID(网页 client_id)+
  一个 Sign in with Apple Key(.p8),回调 URL 填 Vercel 域名。
- **代码侧**:加 `createAppleVerifier`(验 Apple id token,audience = Services ID),
  `selectVerifier` 支持 apple;网页登录页加 Apple 按钮。TDD,dev-login 生产关闭。

## 已就绪

- Procfile ✓ · migrate 启动自动跑 ✓ · `npm start` 生产启动已验证 ✓
- Config vars 由环境注入(AI / DB / Auth / Store 均按环境切换)✓
