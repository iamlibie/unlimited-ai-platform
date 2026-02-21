FROM node:22-bookworm-slim

WORKDIR /app

# Switch APT mirror to Tencent and bootstrap CA certificates
RUN set -eux;   if [ -f /etc/apt/sources.list.d/debian.sources ]; then     sed -i 's|http://deb.debian.org/debian|https://mirrors.tencent.com/debian|g' /etc/apt/sources.list.d/debian.sources;     sed -i 's|http://security.debian.org/debian-security|https://mirrors.tencent.com/debian-security|g' /etc/apt/sources.list.d/debian.sources;   fi;   if [ -f /etc/apt/sources.list ]; then     sed -i 's|http://deb.debian.org/debian|https://mirrors.tencent.com/debian|g' /etc/apt/sources.list;     sed -i 's|http://security.debian.org/debian-security|https://mirrors.tencent.com/debian-security|g' /etc/apt/sources.list;   fi;   echo 'Acquire::https::Verify-Peer "false";' > /etc/apt/apt.conf.d/99insecure;   echo 'Acquire::https::Verify-Host "false";' >> /etc/apt/apt.conf.d/99insecure;   apt-get update;   apt-get install -y --no-install-recommends ca-certificates openssl;   rm -f /etc/apt/apt.conf.d/99insecure;   update-ca-certificates;   rm -rf /var/lib/apt/lists/*

ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
ENV YARN_CACHE_FOLDER=/tmp/.yarn-cache

RUN corepack enable && corepack prepare yarn@1.22.19 --activate
RUN yarn config set registry https://registry.npmmirror.com

COPY package.json yarn.lock ./
RUN yarn install --non-interactive && yarn cache clean && rm -rf /tmp/.yarn-cache /usr/local/share/.cache/yarn

COPY . .

ARG NEXT_PUBLIC_APP_NAME=Unlimited\ AI
ARG NEXT_PUBLIC_APP_LOGO_TEXT=AI
ARG NEXT_PUBLIC_APP_DESCRIPTION=Unlimited\ AI\ intelligent\ chat\ platform
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_APP_LOGO_TEXT=$NEXT_PUBLIC_APP_LOGO_TEXT
ENV NEXT_PUBLIC_APP_DESCRIPTION=$NEXT_PUBLIC_APP_DESCRIPTION

RUN yarn prisma generate
RUN yarn build
RUN mkdir -p .next/standalone/.next \
  && cp -r .next/static .next/standalone/.next/static \
  && if [ -d public ]; then cp -r public .next/standalone/public; fi \
  && mkdir -p /app/uploads/role-avatars /app/uploads/role-backgrounds

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push && npx tsx prisma/seed.ts && node .next/standalone/server.js"]
