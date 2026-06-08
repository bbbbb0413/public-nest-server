FROM node:20-slim AS base

RUN useradd --create-home --shell /bin/bash appuser

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

#RUN npm install -g pnpm@9.7.0
RUN corepack enable
RUN corepack prepare pnpm@9.7.0 --activate

WORKDIR /app
RUN mkdir -p /app && chown -R appuser:appuser /app

FROM base AS build

ARG APP_NAME

USER appuser
WORKDIR /app

COPY --chown=appuser:appuser package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY --chown=appuser:appuser . .
RUN pnpm run build:$APP_NAME
RUN if [ -d "dist/libs/rpc/src" ]; then \
      mkdir -p dist/libs/rpc/proto && \
      cp -r libs/rpc/proto/. dist/libs/rpc/proto/; \
    fi


FROM base
USER appuser
WORKDIR /app

COPY --from=build --chown=appuser:appuser /app/dist /app/dist
COPY --from=build --chown=appuser:appuser /app/package.json /app/pnpm-lock.yaml ./

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

EXPOSE 8080
