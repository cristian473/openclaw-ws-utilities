# WhatsApp Sticker Library API (Node.js + Baileys)

API REST para conectar una cuenta de WhatsApp con Baileys y administrar una biblioteca de stickers.

## Features

- Conexión de WhatsApp (single account) con QR por JSON y PNG.
- Guardado manual de stickers desde conversación (`chatId + messageId`).
- Importación de stickers por upload (`.webp`).
- CRUD de stickers con búsqueda por ID, alias y texto.
- Envío de sticker guardado a chats individuales o grupos.
- Persistencia en PostgreSQL + archivos en disco.
- Seguridad por `x-api-key` y rate limit.

## Requisitos

- Node.js 20+
- PostgreSQL 14+

## Configuración

1. Instala dependencias:

```bash
npm install
```

2. Crea variables de entorno:

```bash
cp .env.example .env
```

3. Ajusta `DATABASE_URL` y `API_KEY` en `.env`.

4. Inicia la API:

```bash
npm start
```

El servidor corre en `http://localhost:3000` (o `PORT` configurado).

## Endpoints

### Salud

- `GET /health`

### WhatsApp

- `GET /wa/status`
- `GET /wa/qr`
- `GET /wa/qr.png`
- `POST /wa/connect`
- `POST /wa/disconnect`

### Stickers

- `POST /stickers/import/message`
- `POST /stickers/import/upload`
- `GET /stickers`
- `GET /stickers/:id`
- `PATCH /stickers/:id`
- `DELETE /stickers/:id`
- `POST /stickers/send`

## Ejemplos rápidos

Con API key:

```bash
-H "x-api-key: YOUR_API_KEY"
```

Conectar WhatsApp:

```bash
curl -X POST http://localhost:3000/wa/connect -H "x-api-key: YOUR_API_KEY"
```

Ver QR texto:

```bash
curl http://localhost:3000/wa/qr -H "x-api-key: YOUR_API_KEY"
```

Importar sticker por upload:

```bash
curl -X POST http://localhost:3000/stickers/import/upload \
  -H "x-api-key: YOUR_API_KEY" \
  -F "file=@./mi-sticker.webp" \
  -F "alias=saludo" \
  -F "description=sticker de prueba" \
  -F "tags=hola,prueba"
```

Enviar sticker por alias:

```bash
curl -X POST http://localhost:3000/stickers/send \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"toJid":"1234567890@s.whatsapp.net","alias":"saludo"}'
```

## Notas

- `POST /stickers/import/message` depende de que el mensaje exista en el store de Baileys.
- Los stickers se deduplican por hash SHA-256.
- `alias` es único case-insensitive entre stickers activos.

## Docker

Build image:

```bash
docker build -t sticker-api:latest .
```

Run container (persist stickers/auth and expose port 3000):

```bash
docker run --name sticker-api \
  -p 3000:3000 \
  -e API_KEY=change-me \
  -e DATABASE_URL=postgres://postgres:postgres@host.docker.internal:5432/sticker_api \
  -e BAILEYS_AUTH_DIR=/app/storage/baileys-auth \
  -e STICKERS_DIR=/app/storage/stickers \
  -v $(pwd)/storage:/app/storage \
  sticker-api:latest
```

Notes:
- The API still requires an external PostgreSQL database.
- `host.docker.internal` works on Docker Desktop (macOS/Windows).
- For Linux, replace DB host with your network/database host.
