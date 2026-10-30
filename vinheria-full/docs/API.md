# API do backend — Vinheria Full

Base URL: `http://localhost:3000/api/v1` (porta = `PORT` no `backend/.env`).
Formato: JSON. Todos os `:id` são o **deviceId** (ex.: `vinheria001`).
O frontend nunca recebe estruturas NGSI (`contextResponses`, `object_id`, ...).

## Formato de erro (todos os endpoints)

```json
{ "error": { "code": "NOT_FOUND", "message": "Dispositivo 'x' não encontrado", "details": { } } }
```

`details` aparece quando útil e **inclui o erro original do FIWARE** (`upstreamStatus`, `upstreamBody`). Em `NODE_ENV=production` não há stack trace.

| HTTP | code | Quando |
|---|---|---|
| 400 | `INVALID_DEVICE_ID`, `INVALID_JSON`, `INVALID_TRIGGERS`, `INVALID_SETTINGS`, `INVALID_COMMAND`, `INVALID_PARAMETER`, `INVALID_QUERY`, `INVALID_FIELD`, `INVALID_COORDINATES` | Entrada inválida |
| 404 | `NOT_FOUND`, `ROUTE_NOT_FOUND` | Dispositivo/rota inexistente |
| 409 | `DEVICE_ALREADY_EXISTS` | Dispositivo já cadastrado |
| 502 | `UPSTREAM_ERROR`, `UPSTREAM_UNREACHABLE`, `PROVISIONING_FAILED` | FIWARE respondeu erro / inacessível / falha de provisionamento |
| 504 | `UPSTREAM_TIMEOUT` | Timeout (`REQUEST_TIMEOUT_MS`) |
| 500 | `INTERNAL_ERROR` | Erro inesperado |

---

## Health

### GET `/health`
Verifica só o Node.js (não consulta o FIWARE).
```json
{ "status": "ok", "service": "vinheria-full-backend", "version": "1.0.0" }
```

### GET `/health/dependencies`
Verifica Orion (`GET /version`), IoT Agent (`GET /iot/about`), STH-Comet (`GET /version`) e MQTT (conexão TCP). `200` se tudo `up`, `503` se algo `down`.
```json
{ "status": "degraded", "service": "vinheria-full-backend", "version": "1.0.0",
  "dependencies": {
    "orion":    { "status": "up",   "latencyMs": 12, "info": { } },
    "iotAgent": { "status": "down", "latencyMs": 8003, "error": "Timeout ao chamar IOT_AGENT ...", "code": "UPSTREAM_TIMEOUT" },
    "sthComet": { "status": "up",   "latencyMs": 15, "info": { } },
    "mqtt":     { "status": "up",   "latencyMs": 4,  "info": { "host": "...", "port": 1883 } } } }
```

---

## Dispositivos

### GET `/devices`
Lista os dispositivos cadastrados.
```json
{ "count": 1, "devices": [ {
  "deviceId": "vinheria001", "entityId": "urn:ngsi-ld:VinheriaDevice:001", "entityType": "VinheriaDevice",
  "displayName": "Vinheria Real", "location": "Adega principal",
  "coordinates": { "latitude": -23.55, "longitude": -46.63 },
  "current": { "temperature": 24.7, "humidity": 61.3, "luminosity": 72, "timestamp": "2026-10-05T18:00:00.000Z" },
  "status": "online", "lastSeen": "2026-10-05T18:00:00.000Z",
  "autoAlertsEnabled": true, "activeAlerts": ["temperature"] } ] }
```
`coordinates` é `null` se a vinheria não tiver posição. `current` traz as últimas medições (valores `null` se ainda não chegaram): uma única chamada basta para desenhar o mapa. Máximo de 1000 dispositivos por consulta.
`status`: `online` | `offline` (sem telemetria há mais de `DEVICE_ONLINE_TIMEOUT_SECONDS`) | `unknown` (nunca enviou dados).

### POST `/devices`
Cadastra e **provisiona** a vinheria no FIWARE (IoT Agent service group + device, entidade e registration de comandos no Orion, subscription do STH-Comet).

Body:
```json
{ "deviceId": "vinheria002", "displayName": "Vinheria 2", "location": "Filial Sul", "latitude": -33.45, "longitude": -70.66 }
```
- `deviceId` **opcional** (1–64 de `A-Za-z0-9_-`). Se omitido, o backend gera o próximo livre (`vinheria001`, `vinheria002`, ...). O id gerado vem na resposta.
- `displayName` (≤80) e `location` (≤120): opcionais, sem os caracteres `< > " ' = ; ( )`.
- `latitude` (-90 a 90) e `longitude` (-180 a 180): opcionais, **sempre juntas** (senão `400 INVALID_COORDINATES`). Necessárias para aparecer no mapa.
- O dispositivo físico/simulado precisa publicar no tópico `provisioning.telemetryTopic` devolvido na resposta.

Resposta `201`: o mesmo objeto de `GET /devices/:id`. Erros: `400`, `409`, `502 PROVISIONING_FAILED`:
```json
{ "error": { "code": "PROVISIONING_FAILED", "message": "Falha na etapa IOTA_CREATE_DEVICE: IOT_AGENT respondeu HTTP 400 ...",
  "details": { "step": "IOTA_CREATE_DEVICE", "completedSteps": ["PRECHECK", "IOTA_ENSURE_SERVICE_GROUP"],
    "cause": { "service": "IOT_AGENT", "upstreamStatus": 400, "upstreamBody": { } } } } }
```
Etapas: `PRECHECK` → `IOTA_ENSURE_SERVICE_GROUP` → `IOTA_CREATE_DEVICE` → `ORION_ENSURE_ENTITY` → `ORION_ENSURE_COMMAND_REGISTRATION` → `ORION_ENSURE_STH_SUBSCRIPTION` → (`ORION_ENSURE_TRIGGER_SUBSCRIPTION` se `BACKEND_PUBLIC_URL` definido). As etapas são idempotentes: repetir o `POST` após uma falha retoma o provisionamento.

### GET `/devices/:id`
Detalhe: resumo + `provisioning` (tópicos MQTT), catálogo de `sensors` e `commands`, e `current` (últimas medições/atuadores). Erros: `400`, `404`.

### DELETE `/devices/:id`
Remove do IoT Agent, registrations/subscriptions e entidade do Orion (melhor esforço).
```json
{ "deviceId": "vinheria002", "removed": ["IOTA_DELETE_DEVICE", "ORION_DELETE_REGISTRATIONS", "ORION_DELETE_SUBSCRIPTIONS", "ORION_DELETE_ENTITY"],
  "warnings": [], "note": "O histórico já gravado no STH-Comet não é apagado." }
```
Erros: `400`, `404`, `502`. Falhas parciais vêm em `warnings`.

---

## Medições

### GET `/devices/:id/measurements/current`
```json
{ "deviceId": "vinheria001", "temperature": 24.7, "humidity": 61.3, "luminosity": 72,
  "timestamp": "2026-10-05T18:00:00.000Z", "status": "online",
  "units": { "temperature": "°C", "humidity": "%", "luminosity": "0-100" },
  "actuators": { "ledState": "off", "buzzerState": "off", "displayState": "clear", "alertType": "none" } }
```
Valores ainda não recebidos vêm como `null`. `timestamp` vem do `TimeInstant` do IoT Agent (`null` se ausente).

### GET `/devices/:id/measurements/history`
Query (todos opcionais):

| Param | Descrição |
|---|---|
| `attribute` | `temperature`, `humidity` ou `luminosity`. Omitido = os três |
| `lastN` | Últimos N pontos (1–`HISTORY_MAX_POINTS`, padrão `HISTORY_DEFAULT_LAST_N`) |
| `from`, `to` | Intervalo ISO 8601 (substitui `lastN`) |
| `limit`, `offset` | Paginação com `from`/`to` (limit padrão = `HISTORY_MAX_POINTS`) |

```json
{ "deviceId": "vinheria001",
  "units": { "temperature": "°C" },
  "series": { "temperature": [ { "timestamp": "2026-10-05T17:59:55.000Z", "value": 24.5 } ] },
  "count": { "temperature": 1 } }
```
Pontos em ordem cronológica. Sem dados ainda = lista vazia. Erros: `400 INVALID_QUERY`, `404`, `502`.

---

## Triggers

### GET `/devices/:id/triggers`
```json
{ "deviceId": "vinheria001", "triggers": {
  "temperature": { "enabled": true, "min": 10, "max": 25, "hysteresis": 0 },
  "humidity":    { "enabled": true, "min": 40, "max": 70, "hysteresis": 0 },
  "luminosity":  { "enabled": true, "min": 20, "max": 80, "hysteresis": 0 } } }
```

### PUT `/devices/:id/triggers`
Body: mesmo formato (completo ou parcial — sensores/campos omitidos permanecem). Regras: `min ≤ max`, `hysteresis ≥ 0` e `2·hysteresis ≤ max−min`. O alerta dispara quando `valor < min` ou `valor > max`, e só limpa quando `min+hysteresis ≤ valor ≤ max−hysteresis`.

Resposta: `{ "deviceId", "triggers": { ... }, "appliedEvents": [ ... ] }` — `appliedEvents` lista alertas ativados/limpos pela reavaliação imediata. Erros: `400 INVALID_TRIGGERS` (com `details.errors`), `404`, `502`.

---

## Configurações

### GET `/devices/:id/settings`
`{ "deviceId": "vinheria001", "settings": { "displayName": "...", "location": "...", "autoAlertsEnabled": true } }`

### PATCH `/devices/:id/settings`
Body com ao menos um de: `displayName` (string), `location` (string), `latitude` e `longitude` (números, juntas; `null` nas duas remove a posição), `autoAlertsEnabled` (boolean). `autoAlertsEnabled=false` pausa o envio automático de `alert`/`clearAlert` pelo motor. Erros: `400 INVALID_SETTINGS`, `404`.

---

## Alertas

### GET `/devices/:id/alerts?limit=20`
`limit` 1–200 (padrão 20).
```json
{ "deviceId": "vinheria001",
  "active": [ { "sensor": "temperature", "since": "2026-10-05T18:01:00.000Z", "value": 26.1, "limits": { "min": 10, "max": 25 } } ],
  "history": [ { "id": "uuid", "sensor": "temperature", "event": "ALERT_ACTIVATED", "reason": "ABOVE_MAX",
                 "value": 26.1, "limits": { "min": 10, "max": 25 }, "command": "alert|temperature", "timestamp": "..." } ] }
```
`event`: `ALERT_ACTIVATED` | `ALERT_CLEARED`. `reason`: `ABOVE_MAX`, `BELOW_MIN`, `BACK_TO_NORMAL`, `TRIGGER_DISABLED`. Histórico mais recente primeiro (até `ALERT_LOG_SIZE`).

---

## Comandos

### POST `/devices/:id/commands`
Body:
```json
{ "command": "displayAlert", "parameter": "temperature" }
```

| command | parameter válido | Mensagem MQTT |
|---|---|---|
| `alert` | `temperature` \| `humidity` \| `luminosity` | `vinheria001@alert\|temperature` |
| `clearAlert` | `temperature` \| `humidity` \| `luminosity` | `vinheria001@clearAlert\|temperature` |
| `displayAlert` | `temperature` \| `humidity` \| `luminosity` \| `clear` | `vinheria001@displayAlert\|clear` |

Resposta `202`:
```json
{ "deviceId": "vinheria001", "command": "displayAlert", "parameter": "temperature",
  "mqttMessage": "vinheria001@displayAlert|temperature", "sentAt": "...", "status": "SENT_TO_FIWARE" }
```
`SENT_TO_FIWARE` = o Orion aceitou o comando; a entrega ao dispositivo **não** é confirmada nesta resposta (confira `actuators` em `measurements/current`). Comandos manuais **não** alteram o estado do motor de alertas. Erros: `400 INVALID_COMMAND | INVALID_PARAMETER`, `404`, `502`.

---

## Interno

### POST `/internal/orion-notifications`
Destino da subscription opcional do Orion (só se `BACKEND_PUBLIC_URL` estiver definido). Aceita notificações NGSIv2 `keyValues`, responde `200 {"received": true}` e avalia os triggers em segundo plano. Não é usado pelo frontend.
