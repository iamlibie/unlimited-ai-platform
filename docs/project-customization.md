# 项目定制说明（品牌、功能、计费、存储）

本文档基于当前仓库代码，整理可直接落地的定制项。

---

## 1. 品牌定制

### 1.1 环境变量

在 `.env` 中设置：

```env
NEXT_PUBLIC_APP_NAME=你的产品名
NEXT_PUBLIC_APP_LOGO_TEXT=LOGO文案
NEXT_PUBLIC_APP_DESCRIPTION=页面描述
```

### 1.2 生效范围

- 浏览器标题与 metadata：`app/layout.tsx`
- 品牌变量读取：`app/config/branding.ts`
- 侧边栏左上角品牌：`components/layout/sidebar.tsx`
- 移动端顶部标题回退：`components/layout/mobile-topbar.tsx`
- 登录/注册页头部：`app/auth/login/page.tsx`、`app/auth/register/page.tsx`

---

## 2. 登录注册与安全策略

### 2.1 当前认证机制

- NextAuth Credentials（邮箱/用户名 + 密码）
- 验证码校验：登录、注册都必须通过
- 非 ACTIVE 用户禁止登录

关键文件：

- `lib/auth.ts`
- `lib/captcha.ts`
- `app/api/auth/captcha/route.ts`
- `app/api/auth/register/route.ts`

### 2.2 建议配置

```env
NEXTAUTH_SECRET=强随机值
CAPTCHA_SECRET=强随机值（建议独立于 NEXTAUTH_SECRET）
NEXTAUTH_URL=https://your-domain
NEXTAUTH_TRUST_HOST=true
```

---

## 3. 聊天请求中的提示词层级（重点）

聊天接口会按照固定优先级合并系统提示词：

1. 平台全局提示词（后台计费配置里设置）
2. 渠道模型提示词（渠道管理里设置）
3. 用户本地全局提示词（API 中心，本地存储）
4. 已启用扩展提示词
5. 角色提示词

实现位置：`app/api/chat/route.ts`

这意味着：

- 你可以在后台强约束平台行为（最高优先级）
- 角色 Prompt 只在低优先级补充，不适合覆盖平台规则

---

## 4. 存储与持久化定制

### 4.1 聊天数据存储策略

- 默认本地 IndexedDB（按用户隔离）
- VIP 用户可开启云端备份（数据库）
- 即使开启云端，前端仍保留本地副本

关键文件：

- `store/chat-store.ts`
- `lib/local-chat-db.ts`
- `components/layout/sidebar.tsx`
- `app/(public)/page.tsx`

### 4.2 上传目录定制

可通过环境变量指定上传根目录：

```env
UPLOAD_DIR=/data/unlimited-ai/uploads
# 或
ROLE_UPLOAD_DIR=/data/unlimited-ai/uploads
```

上传路径用途：

- `role-avatars/`：角色头像
- `role-backgrounds/`：角色背景
- `system/announcement.json`：公告配置
- `system/pricing-display.json`：前台价格公示配置

关键文件：

- `lib/role-upload.ts`
- `app/uploads/[...path]/route.ts`
- `lib/announcement-config.ts`
- `lib/pricing-display-config.ts`

---

## 5. 角色市场定制

### 5.1 可见性与审核流

前台投稿支持：

- `private`：仅本人可见
- `public`：提交审核（状态 `PENDING`）

管理员可在后台执行：

- `approve`：变为公开
- `reject`：拒绝公开

关键接口：

- `GET/POST /api/public/market`
- `PATCH /api/admin/roles/[id]`

### 5.2 角色图片上传限制

- 头像：PNG/JPEG/WEBP，2MB，处理为 512x512 webp
- 背景：PNG/JPEG/WEBP，4MB，处理为 900x1200 webp

接口：

- `POST /api/public/market/avatar-upload`
- `POST /api/public/market/background-upload`

---

## 6. 扩展库定制

扩展是系统级 Prompt 模块，可在对话时开关。

- 前台读取公开扩展：`GET /api/public/extensions`
- 后台管理扩展：`/api/admin/extensions*`
- 聊天请求中按已启用扩展注入 Prompt（优先级低于本地全局，高于角色）

关键文件：

- `app/(public)/extensions/page.tsx`
- `app/api/public/extensions/route.ts`
- `app/api/chat/route.ts`

---

## 7. 模型渠道与 API 中心定制

### 7.1 渠道模型（官方）

后台渠道字段：

- `name`、`group`
- `baseUrl`
- `modelName`
- `systemApiKey`
- `summary`
- `systemPrompt`
- `isActive`

管理接口：

- `GET/POST /api/admin/channels`
- `PATCH/DELETE /api/admin/channels/[id]`

### 7.2 用户本地自定义 API（前台）

- API Key 与 Base URL 只保存在浏览器本地
- 不会写入服务端数据库
- 可拉取模型列表并多选自定义模型

关键文件：

- `app/(public)/api-center/page.tsx`
- `app/api/public/models/route.ts`
- `app/api/public/settings/route.ts`

---

## 8. 计费系统定制

### 8.1 计费核心模型

- 用户点数（stamina）
- VIP 订阅（月配额、已用额度、到期时间）
- 模型定价（FREE / ADVANCED）
- 账本流水（消费、发放、过期、兑换码）

核心代码：

- `lib/billing.ts`
- `prisma/schema.prisma`

### 8.2 后台可配置项

在后台计费页面可配置：

- 每日登录奖励点数
- 登录点数累计上限
- VIP 默认月配额
- 平台全局系统提示词
- 模型计费矩阵（普通模型成本、VIP 配额成本、兜底点数成本）
- 前台公告内容
- 前台价格公示（VIP 月/季/年、点数单价）

接口：

- `GET/PATCH /api/admin/billing/config`
- `GET/PATCH /api/admin/billing/pricing`
- `GET/PATCH /api/admin/announcement`
- `GET/PATCH /api/admin/pricing-display`

### 8.3 兑换码体系

支持发放：

- VIP 月数
- VIP 月配额（可选覆盖默认）
- 点数
- 使用次数上限
- 过期时间

接口：

- 后台：`/api/admin/cards*`
- 前台兑换：`POST /api/public/cards/redeem`

---

## 9. 用户与权限定制

### 9.1 权限层级

- `USER`
- `ADMIN`

中间件保护：

- `/admin/*`
- `/api/admin/*`

关键文件：

- `middleware.ts`
- `lib/admin-auth.ts`

### 9.2 后台用户管理能力

- 修改用户角色（USER/ADMIN）
- 修改状态（ACTIVE/SUSPENDED/BANNED）
- 发放点数
- 发放 VIP

接口：

- `GET /api/admin/users`
- `PATCH /api/admin/users/[id]`
- `GET /api/admin/billing/users`
- `PATCH /api/admin/billing/users/[id]`

---

## 10. 公告与前台价格公示

这两项目前存储在上传目录的 `system` 子目录中。

- 公告：`announcement.json`
- 价格：`pricing-display.json`

读取接口：

- `GET /api/public/announcement`
- `GET /api/public/pricing-display`

管理接口：

- `PATCH /api/admin/announcement`
- `PATCH /api/admin/pricing-display`

> 若部署到无状态平台（如 Vercel Serverless），这两项会丢失。建议改造为数据库持久化。

---

## 11. 可选能力开关（按需）

常见可选能力：

- RAG：`ENABLE_RAG` + Supabase/Ollama 相关变量
- Tavily 搜索：`TAVILY_API_KEY`
- 对象存储上传：`R2_*` 或 `S3_*`
- 多 Provider 兼容接口：`OPENAI_*` / `ANTHROPIC_*` / `AZURE_*` / `GOOGLE_*` 等

建议在实际启用前逐项验证接口连通、鉴权与成本控制。

---

## 12. 定制建议（实践顺序）

1. 先完成品牌变量、管理员密钥、数据库和上传目录持久化
2. 配置渠道与模型计费，再开放普通用户使用
3. 最后启用角色投稿、兑换码、公告等运营模块
4. 若上云到无状态平台，优先改造本地文件写入模块

---

如需部署层面的分环境步骤，请查看：`docs/deployment.md`。