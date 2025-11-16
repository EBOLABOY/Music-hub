FROM node:20 AS web-build
WORKDIR /app
COPY web/package*.json web/
RUN npm install --prefix web
COPY web ./web
RUN npm run build --prefix web

FROM node:20 AS api-build
WORKDIR /app
COPY api/package*.json api/
RUN npm install --prefix api --omit=dev
COPY api ./api

FROM node:20
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
COPY --from=api-build /app/api /app/api
COPY --from=web-build /app/web/dist /app/web/dist
RUN apt-get update && \
    apt-get install -y dumb-init && \
    rm -rf /var/lib/apt/lists/*
RUN npx playwright install-deps chromium
RUN mkdir -p /ms-playwright && npx playwright install chromium
WORKDIR /app/api
EXPOSE 4000
CMD ["dumb-init", "node", "src/server.js"]
