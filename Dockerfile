FROM node:20-alpine AS web-build
WORKDIR /app
COPY web/package*.json web/
RUN npm install --prefix web
COPY web ./web
RUN npm run build --prefix web

FROM node:20-alpine AS api-build
WORKDIR /app
COPY api/package*.json api/
RUN npm install --prefix api --omit=dev
COPY api ./api

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=api-build /app/api /app/api
COPY --from=web-build /app/web/dist /app/web/dist
EXPOSE 4000
WORKDIR /app/api
CMD ["node", "src/server.js"]
