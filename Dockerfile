# syntax=docker/dockerfile:1.7

# Stage 1: Install dependencies once (includes build deps for native modules)
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# Stage 2: Build frontend and prune to production dependencies
FROM deps AS build
COPY . .
RUN npm run build
RUN npm prune --omit=dev

# Stage 3: Production runtime
FROM node:20-alpine AS runtime
WORKDIR /app
COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY server.cjs ./
COPY server ./server
RUN mkdir -p /app/data
EXPOSE 3001
ENV DATA_DIR=/app/data
ENV PORT=3001
CMD ["node", "server.cjs"]
