# Skill: WhatsApp Sticker API Operator

## Objetivo
Operar una API de stickers de WhatsApp basada en Node.js + Baileys para:
- Conectar WhatsApp por QR.
- Guardar stickers (upload o desde mensaje de conversación).
- Listar, buscar y actualizar stickers.
- Enviar stickers guardados a chats o grupos.

## Cuándo usar esta skill
Usa esta skill cuando el usuario pida:
- "Conectar WhatsApp" / "mostrar QR".
- "Guardar este sticker" / "importar sticker".
- "Listar mis stickers" / "buscar por alias o texto".
- "Enviar sticker X a chat/grupo".

No usar para:
- Administrar contactos, texto o multimedia fuera del flujo de stickers.
- Operaciones de múltiples cuentas (esta API es single-account).

## Requisitos
- API corriendo (por defecto `http://localhost:3000`).
- Header `x-api-key` válido.
- Para import por mensaje, el mensaje debe existir en el store de Baileys.

Variables sugeridas:

```bash
export STICKER_API_BASE_URL="http://localhost:3000"
export STICKER_API_KEY="change-me"
```

Helper:

```bash
api() {
  curl -sS "$@" -H "x-api-key: ${STICKER_API_KEY}"
}
```

## Contrato de errores
Todos los errores siguen formato:

```json
{ "code": "...", "message": "...", "details": null }
```

Si `code=STICKER_QUERY_AMBIGUOUS`, el agent debe pedir desambiguación o seleccionar por `stickerId`.

## Flujos operativos

### 1) Verificar salud y estado de WhatsApp

```bash
curl -sS "$STICKER_API_BASE_URL/health"
api "$STICKER_API_BASE_URL/wa/status"
```

### 2) Iniciar conexión y obtener QR

```bash
api -X POST "$STICKER_API_BASE_URL/wa/connect"
api "$STICKER_API_BASE_URL/wa/qr"
```

Si `qrText` es null, revisar estado:

```bash
api "$STICKER_API_BASE_URL/wa/status"
```

### 3) Importar sticker por upload (.webp)

```bash
api -X POST "$STICKER_API_BASE_URL/stickers/import/upload" \
  -F "file=@/ruta/sticker.webp" \
  -F "alias=mi_alias" \
  -F "description=descripcion corta" \
  -F "tags=tag1,tag2"
```

### 4) Importar sticker desde mensaje de WhatsApp

```bash
api -X POST "$STICKER_API_BASE_URL/stickers/import/message" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "1234567890@s.whatsapp.net",
    "messageId": "ABCD1234",
    "alias": "desde_chat",
    "description": "guardado manual",
    "tags": ["chat","manual"]
  }'
```

### 5) Listar y buscar stickers

Listar:

```bash
api "$STICKER_API_BASE_URL/stickers?page=1&limit=20"
```

Buscar por texto libre:

```bash
api "$STICKER_API_BASE_URL/stickers?q=saludo"
```

Filtrar por alias o tag:

```bash
api "$STICKER_API_BASE_URL/stickers?alias=mi_alias"
api "$STICKER_API_BASE_URL/stickers?tag=manual"
```

### 6) Actualizar metadata de sticker

```bash
api -X PATCH "$STICKER_API_BASE_URL/stickers/<stickerId>" \
  -H "Content-Type: application/json" \
  -d '{
    "alias": "nuevo_alias",
    "description": "nueva descripcion",
    "tags": ["favorito"],
    "isFavorite": true
  }'
```

### 7) Enviar sticker

Por ID:

```bash
api -X POST "$STICKER_API_BASE_URL/stickers/send" \
  -H "Content-Type: application/json" \
  -d '{
    "toJid": "1234567890@s.whatsapp.net",
    "stickerId": "<uuid>"
  }'
```

Por alias:

```bash
api -X POST "$STICKER_API_BASE_URL/stickers/send" \
  -H "Content-Type: application/json" \
  -d '{
    "toJid": "1203630xxxx@g.us",
    "alias": "mi_alias"
  }'
```

Por query:

```bash
api -X POST "$STICKER_API_BASE_URL/stickers/send" \
  -H "Content-Type: application/json" \
  -d '{
    "toJid": "1234567890@s.whatsapp.net",
    "query": "saludo"
  }'
```

### 8) Eliminar sticker (soft delete)

```bash
api -X DELETE "$STICKER_API_BASE_URL/stickers/<stickerId>"
```

## Reglas de decisión para el agent
1. Siempre validar conexión WA antes de enviar (`/wa/status`).
2. Priorizar envío por `stickerId` sobre `alias` y `query` para evitar ambigüedad.
3. Si hay conflicto de alias (`ALIAS_TAKEN`), proponer alias alternativo.
4. Si import por mensaje falla con `MESSAGE_NOT_FOUND`, ofrecer import por upload.
5. Si query devuelve múltiples candidatos (`409`), listar candidatos y pedir elección.

## Checklist de ejecución segura
- Confirmar `toJid` antes de enviar.
- No reenviar automáticamente en caso de error sin confirmación explícita.
- Registrar respuesta de envío (`waMessageId`) para trazabilidad.

## Respuesta estándar sugerida del agent
Cuando complete una operación, responder con:
- `accion`: qué se hizo.
- `resultado`: éxito/fallo.
- `id`: stickerId o waMessageId (si aplica).
- `siguiente_paso`: recomendación breve.

Ejemplo:

```json
{
  "accion": "send_sticker",
  "resultado": "ok",
  "id": "wamid.HBgL...",
  "siguiente_paso": "¿Quieres marcar este sticker como favorito?"
}
```
