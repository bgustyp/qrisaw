FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    chromium-sandbox \
    xvfb \
    xauth \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium
ENV NODE_ENV=production
ENV SESSION_FILE=/home/node/session.json

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY app.js ./
COPY src ./src
COPY docs ./docs

USER node

EXPOSE 3000

CMD ["node", "app.js"]
