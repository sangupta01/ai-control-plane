FROM node:22-slim AS base
WORKDIR /app

RUN npm install -g pnpm@10

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY tsconfig.json tsconfig.base.json ./

COPY lib/api-spec/package.json lib/api-spec/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/api-zod/package.json lib/api-zod/
COPY lib/db/package.json lib/db/
COPY artifacts/api-server/package.json artifacts/api-server/
COPY scripts/package.json scripts/

RUN pnpm install --frozen-lockfile

COPY lib/ lib/
COPY artifacts/api-server/ artifacts/api-server/
COPY config/ config/
COPY scripts/ scripts/

RUN pnpm --filter @workspace/api-server run build

FROM node:22-slim AS runtime
WORKDIR /app

RUN npm install -g pnpm@10

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=base /app/artifacts/api-server/node_modules ./artifacts/api-server/node_modules
COPY --from=base /app/config ./config

RUN mkdir -p /data

ENV PORT=8080
ENV BASE_PATH=/api
ENV DB_PATH=/data/ai-control-plane.db
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
