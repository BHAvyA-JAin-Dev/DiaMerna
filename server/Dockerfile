# DiaMerna Persistent Server — Dockerfile
# Deploy on Render / Railway / Fly.io with persistent volume

FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3030
ENV DB_DIR=/data

EXPOSE 3030

CMD ["node", "index.js"]
