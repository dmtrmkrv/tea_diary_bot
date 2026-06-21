# Перенос прод-фронта в Санкт-Петербург (VPS + Docker + Caddy)

Дата: 18.06.2026. Выбранный путь: **VPS в СПб** (App Platform Docker в СПб распродан;
SSR в App Platform СПб недоступен; VPS — единственный способ получить SSR на чистом
питерском IP без рефактора кода).

## Идея
Прод-фронт в Москве (`201.51.0.64`) режется ТСПУ. Переносим **только фронт** на облачный
сервер (VPS) в СПб: запускаем текущее приложение (`next start` = SSR) в Docker за Caddy
(авто-HTTPS), сервер вводим в VPC `TeaBot-VPC`. БД/API/бот/S3 (всё в СПб) не трогаем.
Код приложения не меняем — используем `frontend/Dockerfile` + `deploy/docker-compose.yml` + `deploy/Caddyfile`.

## Что НЕ меняется
- API/бот, PostgreSQL, S3 — в СПб, не трогаем.
- Домен `leafpulse.ru` тот же → BotFather `/setdomain`, `WEB_URL`, `CORS_ORIGINS` без изменений.
- Код фронта — без изменений (только добавлены Dockerfile + deploy-файлы).

---

## Шаг 0. Подготовка (готово в репо)
- `frontend/Dockerfile` — сборка и `next start`.
- `deploy/docker-compose.yml` — frontend + Caddy.
- `deploy/Caddyfile` — авто-HTTPS для `leafpulse.ru`.
- При старте: **закоммитить и запушить** эти файлы в `main`.
- Если репозиторий приватный — понадобится **deploy-ключ** для `git clone` на VPS
  (GitHub → Settings → Deploy keys, read-only; или клонировать по HTTPS с токеном).

## Шаг 1. Создать VPS в СПб
Облачные серверы → Создать:
- **Образ:** Маркетплейс → **Docker** (Docker уже предустановлен) ИЛИ Ubuntu 24.04 (тогда Docker ставим сами).
- **Регион:** Санкт-Петербург (SPB-3).
- **Конфигурация:** **≥ 2 ГБ RAM** (важно: `next build` прожорлив; на 1 ГБ может упасть по памяти), 1–2 vCPU, ~30 ГБ.
- **Сеть:** Публичный IPv4 (вкл) + **Приватная сеть: `TeaBot-VPC`** (чтобы видеть API/БД приватно).
- **Авторизация:** SSH-ключ (свой).
- Создать → записать **публичный IP** и доступ по SSH.

## Шаг 2. Развернуть приложение на VPS
По SSH:
```bash
# (если образ Ubuntu, а не Docker-маркетплейс — сначала установить Docker:)
# curl -fsSL https://get.docker.com | sh

# На всякий случай — своп, чтобы сборка Next не упала по памяти на 2 ГБ:
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile

git clone https://github.com/dmtrmkrv/tea_diary_bot.git
cd tea_diary_bot/deploy
docker compose up -d --build
```
Проверка, что фронт поднялся (на самом VPS):
```bash
curl -I http://localhost:3000        # ожидаем 200/307 от Next
docker compose logs -f frontend      # «Ready»/слушает :3000
```
> Caddy на этом этапе ещё не получит сертификат — это нормально, пока `leafpulse.ru`
> не указывает на VPS (см. шаг 3). Сначала убеждаемся, что само приложение живёт.

## Шаг 3. Переключить `leafpulse.ru` на VPS
1. **Откатить NS** домена на Timeweb: `ns1.timeweb.ru, ns2.timeweb.ru, ns3.timeweb.org, ns4.timeweb.org`.
2. После распространения NS — в DNS Timeweb сделать **A-запись** `leafpulse.ru` → **публичный IP VPS**
   (и `www` → тот же IP, по желанию). Это **обычная A-запись на IP**, без «привязать к сервису».
3. Как только домен резолвится на VPS и открыты порты 80/443 — **Caddy сам выпустит Let's Encrypt**
   (несколько секунд–минут). Проверить: `docker compose logs caddy` (строка про сертификат).
4. Проверить `https://leafpulse.ru` **с РФ-телефона без VPN, вхолодную**.

## Шаг 4. Чистка
- Удалить старый московский **Frontend_Prod** (App Platform).
- Удалить зону **Cloudflare** (NS уже на Timeweb).

## Деплой обновлений фронта (в будущем)
```bash
cd tea_diary_bot && git pull && cd deploy && docker compose up -d --build
```
(можно завернуть в скрипт/CI позже).

## Ops-памятка (это теперь на нас)
- **SSL** — Caddy продлевает сам.
- **Файрвол:** открыть 80/443 (и 22 для SSH), остальное закрыть.
- **Обновления ОС:** `unattended-upgrades` или периодически `apt upgrade`.
- **Перезагрузка:** контейнеры с `restart: unless-stopped` поднимутся сами.
- **Мониторинг:** хотя бы внешний аптайм-чек на `leafpulse.ru`.

## Оптимизация (потом)
VPS в той же VPC, что и API → серверный `API_URL` можно переключить на **приватный IP API**
(`10.20.0.x`): SSR→API по приватной сети. `NEXT_PUBLIC_API_URL` (браузер) остаётся публичным.

## Откат
Старый московский Frontend_Prod не удаляем до подтверждения шага 3. Если VPS не заработает —
`leafpulse.ru` можно вернуть на старый фронт/Cloudflare. Необратимых изменений нет.
