FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY src ./src
COPY index.js ./
COPY .env.example ./

RUN mkdir -p /app/storage/stickers /app/storage/baileys-auth && chown -R node:node /app

USER node

EXPOSE 3000

CMD ["node", "src/server.js"]
