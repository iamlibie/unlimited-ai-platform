# Unlimited AI

Unlimited AI 是一个基于 **Next.js 15 + Prisma + NextAuth** 的数据库驱动型 AI 对话系统。
它在原始本地存储形态上，增加了完整服务端能力（认证、数据库、后台管理、计费、角色市场、扩展库、渠道模型管理等），适合私有化部署和二次开发。
<img width="2558" height="1356" alt="image" src="https://github.com/user-attachments/assets/bdd1e548-27bf-4972-82eb-e5eaa7b2f2fd" />
<img width="2558" height="1356" alt="image" src="https://github.com/user-attachments/assets/a025fd7e-0519-4fdc-949d-3d9192519e6d" />
<img width="2558" height="1344" alt="image" src="https://github.com/user-attachments/assets/b58f52ad-8b67-41ee-aec0-d088275f6385" />
<img width="2558" height="1342" alt="image" src="https://github.com/user-attachments/assets/243d182b-8478-4eaa-bdb0-ee38e0f73bbc" />

---

## 1. 功能概览

- 账号体系：邮箱注册/登录（NextAuth + Credentials）+ 图形验证码
- 聊天系统：多会话、历史回放、消息编辑/重试、模型切换
- 提示词分层：平台全局提示词、渠道提示词、本地提示词、扩展提示词、角色提示词
- 模型渠道：支持免费/高级渠道，按渠道配置 Base URL / Model / 系统 Key
- 角色市场：公开角色卡 + 私有角色卡 + 投稿审核流
- 扩展库：可开关的系统级 Prompt 扩展
- 计费体系：登录点数、VIP 月配额、高级模型扣费、兑换码
- 云端聊天备份：VIP 用户可开启（默认本地）
- 后台管理：用户、渠道、角色、扩展、计费、公告、前台价格公示

---

## 2. 技术栈

- **Next.js 15**（App Router）
- **React 19**
- **Prisma + PostgreSQL**
- **NextAuth**（Credentials）
- **Zustand**（前端状态）
- **Tailwind CSS**
- **Sharp**（图片处理，角色头像/背景图上传）

---

## 3. 项目结构（核心）

```text
app/
  (public)/                # 前台页面（聊天、扩展、API中心、计费、角色市场）
  admin/                   # 后台管理页面
  api/                     # API 路由（chat/public/admin/auth/...）
  uploads/[...path]/route.ts # 上传文件访问路由
components/
  admin/                   # 后台管理 UI
  chat/                    # 聊天相关组件
  layout/                  # 侧边栏、移动端顶部、公告弹层
lib/
  auth.ts                  # NextAuth 配置
  billing.ts               # 计费核心逻辑
  db.ts                    # Prisma Client
  role-upload.ts           # 上传目录解析与读写路径策略
prisma/
  schema.prisma            # 数据模型
  seed.ts                  # 初始化种子数据（管理员/默认渠道/默认角色等）
docs/
  deployment.md            # 部署手册（多种方式）
  project-customization.md # 项目定制说明
```

---

## 4. 快速开始（本地开发）

### 4.1 环境准备

- Node.js >= 22
- Yarn 1.x（项目锁定 `yarn@1.22.19`）
- PostgreSQL（建议 14+）

### 4.2 安装依赖

```bash
yarn install
```

### 4.3 配置环境变量

复制 `.env.example` 到 `.env`，并至少补齐以下核心变量：

```env
DATABASE_URL=postgresql://user:password@127.0.0.1:5432/unlimited_ai?schema=public
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_TRUST_HOST=true
NEXTAUTH_SECRET=replace-with-a-strong-random-secret
CAPTCHA_SECRET=replace-with-another-strong-secret
```

可选品牌变量：

```env
NEXT_PUBLIC_APP_NAME=Unlimited AI
NEXT_PUBLIC_APP_LOGO_TEXT=AI
NEXT_PUBLIC_APP_DESCRIPTION=Unlimited AI intelligent chat platform
```

### 4.4 初始化数据库

> 当前仓库未包含 Prisma migrations 目录，首次启动建议直接 `db push`。

```bash
yarn prisma generate
npx prisma db push
npx tsx prisma/seed.ts
```

Seed 完成后会创建默认管理员和基础数据（渠道、角色、扩展、全局配置等）。

### 4.5 启动开发服务

```bash
yarn mask
yarn dev
```

如果你在 Windows 上 `yarn dev` 遇到并行命令兼容问题，可改为双终端：

```bash
# 终端 1
yarn mask:watch

# 终端 2
yarn next dev
```

默认访问：`http://localhost:3000`

---

## 5. 多种部署方式

> 详细部署步骤见 `docs/deployment.md`。这里给出快速索引。

### 5.1 Docker Compose（推荐）

适合单机私有化，自动拉起 PostgreSQL + App。

```bash
docker compose up -d --build
```

- 默认映射：`3000`（应用）/ `5432`（数据库）
- 数据持久化：`pg_data`、`uploads_data` volumes
- ⚠️ 生产务必修改 `docker-compose.yml` 内的 `NEXTAUTH_SECRET`

### 5.2 Docker 单容器 + 外部 PostgreSQL

适合接入云数据库或已有数据库集群。

```bash
docker build -t unlimited-ai:latest .
```

运行时传入 `DATABASE_URL`、`NEXTAUTH_URL`、`NEXTAUTH_SECRET`，并挂载上传目录。

### 5.3 Node.js 裸机 / 云服务器（PM2 / systemd）

适合高可控环境（Nginx + PM2）。

```bash
yarn install --frozen-lockfile
yarn prisma generate
yarn build
npx prisma db push
npx tsx prisma/seed.ts
node .next/standalone/server.js
```

### 5.4 Vercel（可部署，但有持久化限制）

可以跑通核心聊天与登录，但以下能力依赖本地文件写入，不适合无状态平台长期使用：

- 角色头像/背景上传（`/uploads/...`）
- 后台公告配置（文件持久化）
- 前台价格公示配置（文件持久化）

若要在 Vercel 生产可用，建议二次开发为对象存储或数据库持久化。

---

## 6. 环境变量说明

### 6.1 核心必填（生产）

| 变量 | 是否必填 | 说明 |
|---|---|---|
| `DATABASE_URL` | 是 | PostgreSQL 连接串（Prisma 使用） |
| `NEXTAUTH_URL` | 是 | 对外访问域名（例如 `https://chat.example.com`） |
| `NEXTAUTH_SECRET` | 是 | NextAuth 会话签名密钥 |
| `NEXTAUTH_TRUST_HOST` | 建议 | 反向代理/容器场景建议设为 `true` |
| `CAPTCHA_SECRET` | 强烈建议 | 验证码签名密钥，不设置会回退到 `NEXTAUTH_SECRET` |

### 6.2 常用可选

| 变量 | 说明 |
|---|---|
| `NEXT_PUBLIC_APP_NAME` | 品牌名（浏览器标题、登录页、侧边栏） |
| `NEXT_PUBLIC_APP_LOGO_TEXT` | 左上角 Logo 文本（建议 1~4 字符） |
| `NEXT_PUBLIC_APP_DESCRIPTION` | 站点描述（metadata description） |
| `UPLOAD_DIR` / `ROLE_UPLOAD_DIR` | 角色图片、公告配置、价格配置的持久化目录 |
| `NEXT_PUBLIC_ENABLE_NODEJS_PLUGIN` | 控制 Node 插件能力（默认 1） |

### 6.3 高级可选（按需）

- RAG：`ENABLE_RAG`、`SUPABASE_URL`、`SUPABASE_PRIVATE_KEY`、`OLLAMA_BASE_URL`、`RAG_EMBEDDING_MODEL`
- Web 搜索：`TAVILY_API_KEY`（以及 LangChain 相关搜索引擎变量）
- 对象存储（通用文件上传）：`R2_*` 或 `S3_*`
- 多 Provider API（兼容旧接口路径）：`OPENAI_*`、`ANTHROPIC_*`、`AZURE_*`、`GOOGLE_*` 等

完整变量请参考：

- `.env.example`
- `app/config/server.ts`

---

## 7. 管理后台与默认账户

Seed 默认创建管理员：

- 邮箱：`admin@unlimited.ai`
- 密码：`admin123`

后台入口：`/admin`

首次上线建议：

1. 立即改掉默认管理员密码（或重建管理员）
2. 在“渠道管理”中替换 seed 里的占位 `systemApiKey`
3. 校验“计费配置/模型计费矩阵/公告与价格公示”

---

## 8. 数据与存储说明

- 聊天消息：
  - 默认本地（IndexedDB）
  - VIP 可切换云端备份（写入数据库）
- 角色图片：写入 `uploads/role-avatars` 与 `uploads/role-backgrounds`
- 公告与价格展示：写入 `uploads/system/*.json`
- 因此生产部署必须提供**可持久化写目录**（容器请挂卷）

---

## 9. 系统提示词优先级（重要）

聊天接口会按以下优先级拼接系统提示词（高 -> 低）：

1. 平台全局提示词（后台）
2. 渠道模型提示词（后台）
3. 用户本地全局提示词（浏览器）
4. 扩展提示词
5. 角色提示词

冲突时以上层为准。

---

## 10. 核心 API 一览

- 认证
  - `GET /api/auth/captcha`
  - `POST /api/auth/register`
  - `GET/POST /api/auth/[...nextauth]`
- 聊天
  - `GET /api/chat`
  - `POST /api/chat`
  - `GET/DELETE /api/chat/[id]`
- 前台数据
  - `GET /api/public/channels`
  - `GET/POST /api/public/market`
  - `POST /api/public/market/avatar-upload`
  - `POST /api/public/market/background-upload`
  - `GET /api/public/extensions`
  - `GET/PATCH /api/public/settings`
  - `GET /api/public/billing`
  - `POST /api/public/cards/redeem`
  - `GET /api/public/announcement`
  - `GET /api/public/pricing-display`
- 后台（需管理员）
  - `/api/admin/users*`
  - `/api/admin/channels*`
  - `/api/admin/roles*`
  - `/api/admin/extensions*`
  - `/api/admin/billing/*`
  - `/api/admin/cards*`
  - `/api/admin/announcement`
  - `/api/admin/pricing-display`

---

## 11. 常见问题

### Q1：页面能打开，但聊天报错“Channel API key is not configured”

说明渠道未配置有效 `systemApiKey`。请登录管理员后台 `/admin/channels` 修改渠道密钥，或在“API 中心”使用本地自定义 API Key + Base URL。

### Q2：角色图片上传后重启容器丢失

说明上传目录未持久化。请挂载 `uploads` 卷，或通过 `UPLOAD_DIR/ROLE_UPLOAD_DIR` 指向持久化路径。

### Q3：为什么我看不到 VIP 模型？

前端会根据 `VIP` 状态过滤高级模型。普通账号只展示免费模型。

### Q4：Vercel 上公告/价格配置改了又丢失

这两个功能当前基于本地文件存储；无状态平台会丢失。请改成数据库/对象存储，或改用自托管部署。

---

## 12. 文档索引

- 部署手册：`docs/deployment.md`
- 项目定制：`docs/project-customization.md`

---

## License

MIT
