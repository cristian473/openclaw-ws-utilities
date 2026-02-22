FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

ARG PORT=3000
ARG API_KEY
ARG DATABASE_URL
ARG BAILEYS_AUTH_DIR=/app/storage/baileys-auth
ARG STICKERS_DIR=/app/storage/stickers
ARG RATE_LIMIT_WINDOW_MS=60000
ARG RATE_LIMIT_MAX=60
ARG MAX_UPLOAD_MB=2

ENV PORT=$PORT \
    API_KEY=$API_KEY \
    DATABASE_URL=$DATABASE_URL \
    BAILEYS_AUTH_DIR=$BAILEYS_AUTH_DIR \
    STICKERS_DIR=$STICKERS_DIR \
    RATE_LIMIT_WINDOW_MS=$RATE_LIMIT_WINDOW_MS \
    RATE_LIMIT_MAX=$RATE_LIMIT_MAX \
    MAX_UPLOAD_MB=$MAX_UPLOAD_MB

RUN apk add --no-cache git

COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY src ./src
COPY index.js ./
COPY .env.example ./

RUN mkdir -p /app/storage/stickers /app/storage/baileys-auth && chown -R node:node /app

USER node

EXPOSE 3000

CMD ["node", "src/server.js"]
