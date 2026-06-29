# Прод-фронт LeafPulse как Docker-приложение App Platform (регион СПб).
# Тумблер «Frontend + SSR» в СПб недоступен, а тип Docker — да.
# `next start` в контейнере = полноценный SSR в чистом питерском регионе.
FROM node:22-alpine

WORKDIR /app

# Зависимости строго по lock-файлу
COPY package*.json ./
RUN npm ci

# Исходники фронта
COPY . .

# NEXT_PUBLIC_* инлайнятся в клиентский бандл во время build — это ПУБЛИЧНЫЕ
# значения (URL API и юзернейм бота), не секреты, поэтому фиксируем их здесь.
# Меняются редко; при смене — пересборка образа.
ENV NEXT_PUBLIC_API_URL=https://dmtrmkrv-tea-diary-bot-c01d.twc1.net
ENV NEXT_PUBLIC_BOT_USERNAME=TeaNotesBot
RUN npm run build

# next start слушает PORT (по умолчанию 3000)
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "run", "start"]
