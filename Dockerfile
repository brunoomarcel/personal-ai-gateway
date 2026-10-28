FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3333
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/app/data/gateway.db
ENV DASHBOARD_URL=http://localhost:3333

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/web/dist ./web/dist

RUN mkdir -p /app/data
VOLUME ["/app/data"]
EXPOSE 3333

CMD ["node", "dist/server.js"]
