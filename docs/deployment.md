# 部署手册（多种方式）

本文档面向当前仓库（数据库驱动版 Unlimited AI），提供可落地的多种部署路径。

- 推荐生产：**Docker Compose** 或 **Node + PM2 + PostgreSQL**
- 可快速试用：**Vercel**（有本地文件持久化限制）

---

## 1. 部署方式对比

| 方式 | 适用场景 | 优点 | 注意事项 |
|---|---|---|---|
| Docker Compose | 单机私有化/快速上线 | 一条命令拉起 App + DB；可挂载卷 | 需手动改 `NEXTAUTH_SECRET` |
| Docker 单容器 + 外部 DB | 云数据库、已有数据库环境 | 与数据库解耦、便于弹性扩容 | 必须挂载上传目录卷 |
| Node + PM2 + Nginx | 高可控生产环境 | 运维灵活，易接入监控 | 需自己维护进程、日志、反代 |
| Vercel | 快速体验、低运维 | 上手快、自动 CI/CD | 本地文件写入相关功能不持久 |

---

## 2. 上线前统一准备

### 2.1 必需依赖

- PostgreSQL（建议 14+）
- Node.js >= 22（非容器部署）
- Yarn 1.x（非容器部署）

### 2.2 核心环境变量（最小可运行）

```env
DATABASE_URL=postgresql://user:password@host:5432/unlimited_ai?schema=public
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_TRUST_HOST=true
NEXTAUTH_SECRET=replace-with-a-strong-random-secret
CAPTCHA_SECRET=replace-with-another-strong-random-secret
```

可选但建议：

```env
NEXT_PUBLIC_APP_NAME=Unlimited AI
NEXT_PUBLIC_APP_LOGO_TEXT=AI
NEXT_PUBLIC_APP_DESCRIPTION=Unlimited AI intelligent chat platform
UPLOAD_DIR=/absolute/path/to/uploads
# 或 ROLE_UPLOAD_DIR=/absolute/path/to/uploads
```

### 2.3 初始化数据库（所有部署方式都需要）

```bash
yarn prisma generate
npx prisma db push
npx tsx prisma/seed.ts
```

> `seed.ts` 会创建默认管理员、基础渠道、角色、扩展和计费初始配置。

---

## 3. 方式 A：Docker Compose（推荐）

### 3.1 首次部署

1) 准备环境文件（用于 Compose 变量替换）：

```bash
cp .env.example .env
```

2) 修改 `docker-compose.yml` 中的关键配置：

- `NEXTAUTH_SECRET`：改成强随机字符串
- `NEXTAUTH_URL`：改成真实域名（或本地测试地址）
- PostgreSQL 用户名/密码/库名（按需）

3) 启动：

```bash
docker compose up -d --build
```

4) 查看状态：

```bash
docker compose ps
docker compose logs -f app
```

### 3.2 默认端口与数据卷

- 应用：`3000`
- 数据库：`5432`
- 数据卷：
  - `pg_data`（PostgreSQL 数据）
  - `uploads_data`（角色图片、公告、前台价格配置等）

### 3.3 升级流程

```bash
docker compose pull
docker compose up -d --build
docker compose logs -f app
```

当前 Dockerfile 启动命令会执行：

- `prisma db push`
- `tsx prisma/seed.ts`
- `node .next/standalone/server.js`

因此结构变更会自动同步，seed 使用 upsert，通常可重复执行。

---

## 4. 方式 B：Docker 单容器 + 外部 PostgreSQL

### 4.1 构建镜像

```bash
docker build -t unlimited-ai:latest .
```

### 4.2 运行容器（示例）

```bash
docker run -d \
  --name unlimited-ai \
  -p 3000:3000 \
  -e DATABASE_URL='postgresql://user:pass@db-host:5432/unlimited_ai?schema=public' \
  -e NEXTAUTH_URL='https://chat.example.com' \
  -e NEXTAUTH_TRUST_HOST='true' \
  -e NEXTAUTH_SECRET='replace-with-a-strong-random-secret' \
  -e CAPTCHA_SECRET='replace-with-another-strong-random-secret' \
  -e ROLE_UPLOAD_DIR='/app/uploads' \
  -v /data/unlimited-ai/uploads:/app/uploads \
  unlimited-ai:latest
```

### 4.3 说明

- **必须挂载上传目录**，否则角色图片和公告/价格配置会丢失
- 容器首次启动同样会自动执行 `db push + seed`

---

## 5. 方式 C：Node.js + PM2（裸机/云服务器）

### 5.1 安装与构建

```bash
yarn install --frozen-lockfile
yarn prisma generate
yarn build
```

### 5.2 初始化数据库

```bash
npx prisma db push
npx tsx prisma/seed.ts
```

### 5.3 启动服务

```bash
node .next/standalone/server.js
```

或 PM2：

```bash
pm2 start .next/standalone/server.js --name unlimited-ai --time
pm2 save
pm2 startup
```

### 5.4 Nginx 反向代理（示例）

```nginx
server {
  listen 80;
  server_name chat.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

> HTTPS 场景请配合证书，并确保 `NEXTAUTH_URL` 使用 `https://`。

---

## 6. 方式 D：Vercel（可用但有功能限制）

### 6.1 基础步骤

1) 创建 Vercel 项目并连接仓库
2) 配置环境变量：

- `DATABASE_URL`
- `NEXTAUTH_URL`（线上域名）
- `NEXTAUTH_TRUST_HOST=true`
- `NEXTAUTH_SECRET`
- `CAPTCHA_SECRET`

3) 首次部署后，执行一次数据库初始化（本地连接生产库执行即可）：

```bash
yarn prisma generate
npx prisma db push
npx tsx prisma/seed.ts
```

### 6.2 限制（重要）

以下能力依赖本地文件写入，在无状态平台不可稳定持久化：

- 角色头像/背景图上传（`/uploads/role-*`）
- 后台公告配置（`uploads/system/announcement.json`）
- 前台价格配置（`uploads/system/pricing-display.json`）

因此：

- Vercel 更适合试用或轻量场景
- 若要生产稳定，建议改造为数据库/对象存储，或改为自托管

---

## 7. 上线后必做检查

1. 登录默认管理员 `admin@unlimited.ai / admin123`
2. 进入 `/admin/channels`，替换 seed 的占位 API Key
3. 检查 `/api/public/channels` 是否返回可用渠道
4. 执行一次真实聊天，确认计费状态返回正常
5. 上传角色头像/背景图，重启服务后验证是否仍可访问
6. 在后台修改公告和前台价格，刷新前台验证是否生效

---

## 8. 备份与恢复建议

### 8.1 需要备份的内容

- PostgreSQL 数据库
- 上传目录（`uploads/`，含角色图、公告、价格配置）

### 8.2 最简备份策略

- 数据库：每日定时 `pg_dump`
- 上传目录：每日增量同步到对象存储或备份盘

如果只备份数据库，不备份 `uploads/`，会出现：

- 角色图片丢失
- 公告与前台价格配置回退

---

## 9. 常见部署问题

### 9.1 登录成功但马上掉线

- 检查 `NEXTAUTH_URL` 是否与真实访问域名一致
- 检查 `NEXTAUTH_SECRET` 是否稳定（容器重启后不能变化）

### 9.2 聊天报 `Channel API key is not configured`

- 进入 `/admin/channels` 配置 `systemApiKey`
- 或在前台 “API 中心” 使用本地自定义 API Key/Base URL

### 9.3 非 VIP 用户看不到高级模型

这是正常逻辑。模型选择器会依据 `billing.vip.active` 过滤高级渠道。

### 9.4 重启后角色图或公告丢失

说明上传目录未持久化；请挂载卷或设置固定 `UPLOAD_DIR/ROLE_UPLOAD_DIR`。

---

## 10. 生产安全建议

- 关闭默认管理员或重置其密码
- 将数据库、应用、反向代理置于最小暴露面
- 定期轮换 `NEXTAUTH_SECRET` / `CAPTCHA_SECRET`（注意灰度策略）
- 对 `/admin` 加二次访问控制（如 IP 白名单、VPN）
- 监控 API 错误率与数据库连接数

---

如需功能级定制（品牌、提示词层级、计费规则、角色投稿审核流等），请看：`docs/project-customization.md`。