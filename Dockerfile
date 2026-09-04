FROM node:24-bookworm-slim AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends unixodbc \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
RUN npm run build

FROM node:24-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl poppler-utils unixodbc \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/app ./app
COPY --from=build /app/public ./public
COPY --from=build /app/server ./server
COPY --from=build /app/dist ./dist

# Review history stays in a named Docker volume. The browser never receives the SQLite file.
RUN mkdir /data && chown node:node /data
USER node

ENV NODE_ENV=production \
    PORT=3000 \
    TAXAP_CONNECTOR_HOST=0.0.0.0 \
    TAXAP_CONNECTOR_PORT=3001 \
    TAXAP_REVIEW_DB=/data/reviews.sqlite

EXPOSE 3000
CMD ["npm", "run", "start:production"]
