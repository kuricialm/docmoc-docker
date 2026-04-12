# Stage 1: Build frontend
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY server.cjs ./
RUN mkdir -p /app/data
EXPOSE 3001
ENV DATA_DIR=/app/data
ENV PORT=3001
CMD ["node", "server.cjs"]
