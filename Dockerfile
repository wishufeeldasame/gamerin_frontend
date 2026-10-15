# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci


FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

RUN npm run build
# Export the config directly for Next's CommonJS loader; TypeScript stays build-only.
RUN node -e "const fs = require('node:fs'); const ts = require('typescript'); const source = fs.readFileSync('next.config.ts', 'utf8'); const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }); fs.writeFileSync('next.config.js', result.outputText + '\nmodule.exports = exports.default;\n');"
RUN npm prune --omit=dev


FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/package-lock.json ./package-lock.json
COPY --from=builder --chown=node:node /app/next.config.js ./next.config.js
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next

EXPOSE 3000

USER node

CMD ["npm", "run", "start"]
