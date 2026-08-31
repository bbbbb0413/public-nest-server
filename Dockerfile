FROM node:20-slim AS base

RUN useradd --create-home --shell /bin/bash appuser

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

#RUN npm install -g pnpm@9.7.0
RUN corepack enable
RUN corepack prepare pnpm@9.7.0 --activate

WORKDIR /app
RUN mkdir -p /app && chown -R appuser:appuser /app

FROM base AS deps-prod

USER appuser
WORKDIR /app

COPY --chown=appuser:appuser package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile


FROM base AS build

ARG APP_NAME

USER appuser
WORKDIR /app

COPY --chown=appuser:appuser package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY --chown=appuser:appuser nest-cli.json tsconfig.json tsconfig.build.json tsconfig.paths.json ./
COPY --chown=appuser:appuser libs libs
COPY --chown=appuser:appuser apps/$APP_NAME apps/$APP_NAME
RUN pnpm run build:$APP_NAME
RUN if [ -d "dist/libs/rpc/src" ]; then \
      mkdir -p dist/libs/rpc/proto && \
      cp -r libs/rpc/proto/. dist/libs/rpc/proto/; \
    fi


FROM base
USER appuser
WORKDIR /app

COPY --from=build     --chown=appuser:appuser /app/dist /app/dist
COPY --from=deps-prod --chown=appuser:appuser /app/node_modules /app/node_modules
COPY --from=deps-prod --chown=appuser:appuser /app/package.json /app/pnpm-lock.yaml ./

EXPOSE 8080
