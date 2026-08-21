# Jukini-Market (node-auction) — 농작물 직거래 경매 서버
# 단독 실행보다는 저장소 루트의 docker-compose.yml 사용을 권장
FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 8010
CMD ["node", "app.js"]
