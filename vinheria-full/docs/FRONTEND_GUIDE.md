# Contrato da API para o Frontend — Vinheria Full

Este documento descreve **o que o backend oferece e como ele se comporta**. Decisões de interface, bibliotecas e arquitetura do frontend são livres. Se for usar uma IA, entregue este arquivo junto com `docs/API.md`, `docs/frontend/vinheria.d.ts` (e, se quiser, `docs/frontend/vinheriaApi.js`) como contexto.

## 1. Fronteira entre as camadas

```
Frontend ──HTTP/JSON──▶ Backend Node.js ──▶ FIWARE ──▶ ESP32 (Wokwi) / dispositivos simulados
```

O frontend conversa **somente** com a API Node.js (`/api/v1`). Não há FIWARE, MQTT nem formato NGSI (`contextResponses`, `object_id`...) do lado do frontend. As regras de alerta rodam no backend; o firmware só executa comandos.

## 2. Configuração do ambiente

- **Base URL:** `http://localhost:3000/api/v1` (porta = `PORT` no `backend/.env`).
- **CORS:** liberado para qualquer origem por padrão (`CORS_ORIGIN=*`). Para restringir, defina a(s) origem(ns) no `.env` do backend.
- **Subir o backend:** `cd backend && npm install && cp .env.example .env`, preencher `FIWARE_HOST` com o IP da VM FIWARE (muda quando a VM é religada) e `npm start`. Requer a infraestrutura FIWARE ligada. Detalhes no `README.md`.
- **Autenticação:** não existe (projeto acadêmico).
- **Tempo real:** não há WebSocket nem SSE; os dados são consultados por requisição.

## 3. O que a API oferece

| Capacidade | Endpoint |
|---|---|
| Listar todas as vinherias (posição, status, valores atuais, alertas ativos) | `GET /devices` |
| Cadastrar/provisionar nova vinheria | `POST /devices` |
| Detalhe de uma vinheria (inclui tópicos MQTT e estado dos atuadores) | `GET /devices/:id` |
| Remover vinheria | `DELETE /devices/:id` |
| Medição atual + estado dos atuadores | `GET /devices/:id/measurements/current` |
| Histórico dos sensores | `GET /devices/:id/measurements/history` |
| Ler / alterar limites (triggers) | `GET`, `PUT /devices/:id/triggers` |
| Ler / alterar configurações (nome, local, posição, alertas automáticos) | `GET`, `PATCH /devices/:id/settings` |
| Alertas ativos e histórico de alertas | `GET /devices/:id/alerts` |
| Enviar comando ao dispositivo | `POST /devices/:id/commands` |
| Saúde do backend / da infraestrutura | `GET /health`, `GET /health/dependencies` |

Bodies, parâmetros, respostas e erros de cada um: **`docs/API.md`**. Tipos de todas as respostas: **`docs/frontend/vinheria.d.ts`**.

## 4. Modelos de dados principais

```jsonc
// GET /devices  ->  { "devices": [ DeviceSummary ], "count": 3 }
{
  "deviceId": "vinheria001",
  "displayName": "Vinheria Real",            // texto livre ou null
  "location": "Adega principal",             // texto livre ou null
  "coordinates": { "latitude": -23.55, "longitude": -46.63 },   // ou null
  "current": { "temperature": 24.7, "humidity": 61.3, "luminosity": 72, "timestamp": "2026-10-06T19:34:57.387Z" },
  "status": "online",                        // "online" | "offline" | "unknown"
  "lastSeen": "2026-10-06T19:34:57.387Z",
  "autoAlertsEnabled": true,
  "activeAlerts": ["temperature"]            // sensores em alerta agora
}
```
Sensores: `temperature` (°C), `humidity` (%), `luminosity` (0–100). Datas em ISO 8601 UTC.

Histórico: `series` por sensor, cada ponto `{ timestamp, value }` em ordem cronológica. Os três sensores costumam compartilhar os mesmos timestamps (um por telemetria), mas isso não é garantido.

Triggers: `{ temperature|humidity|luminosity: { enabled, min, max, hysteresis } }`.

## 5. Comportamento que o frontend precisa conhecer

**Posição (coordenadas)**
- `coordinates` é `null` quando a vinheria não tem posição definida. É responsabilidade de quem consome decidir o que fazer com elas.
- A posição pode ser informada **no cadastro** (`POST /devices` com `latitude` e `longitude`) ou **depois** (`PATCH /devices/:id/settings`). As duas sempre juntas. `null` e `null` removem a posição.
- Faixas: latitude −90 a 90, longitude −180 a 180. Fora disso: `400 INVALID_COORDINATES`.
- A posição fica gravada no FIWARE (sobrevive a reinícios). Se uma vinheria for removida (`DELETE`) e cadastrada de novo, a posição precisa ser informada novamente.
- O backend **não faz geocodificação**: recebe latitude/longitude prontas, como números, com qualquer quantidade de casas decimais. De onde elas vêm (clique no mapa, busca de endereço, digitação) é decisão do frontend.
- Atenção: bibliotecas de mapa podem devolver longitude **fora de −180..180** quando o mapa é arrastado além do meridiano (ex.: 190 ou −200). Normalize a longitude antes de enviar; do contrário a API responde `400 INVALID_COORDINATES`.
- `location` (texto) é independente das coordenadas: o backend não o preenche a partir da posição.

**Cadastro de vinheria (`POST /devices`)**
- `deviceId` é opcional. Sem ele o backend gera o próximo livre no padrão `vinheriaNNN` e o devolve na resposta. Com ele, formato: 1–64 caracteres `A-Za-z0-9_-`.
- Campos opcionais: `displayName` (≤80), `location` (≤120), `latitude`, `longitude`.
- Textos não aceitam os caracteres `< > " ' = ; ( )` (rejeitados pelo Orion): `400 INVALID_FIELD`.
- Leva alguns segundos (provisiona IoT Agent, Orion e histórico). Resposta `201` com o dispositivo completo.
- O provisionamento cria o dispositivo **no FIWARE**, não o hardware. A vinheria só passa a `online` quando o dispositivo físico ou simulado publicar no tópico MQTT `provisioning.telemetryTopic` devolvido na resposta, usando o mesmo `deviceId`. Até lá: `status: "unknown"` e valores `null`.
- Erros: `409 DEVICE_ALREADY_EXISTS`; `502 PROVISIONING_FAILED` (`error.details.step` indica a etapa, `error.details.completedSteps` o que já foi feito; repetir o `POST` retoma de onde parou).

**Status**
- `online`: houve telemetria nos últimos 2 minutos (`DEVICE_ONLINE_TIMEOUT_SECONDS`). `offline`: passou disso. `unknown`: nunca enviou dados.
- Valores de sensores podem ser `null` (dispositivo novo ou sem dados).

**Atualização dos dados**
- A telemetria dos dispositivos chega a cada ~5 s. `GET /devices` e `measurements/current` devolvem o último valor conhecido.
- O motor de alertas avalia a cada ~10 s: um alerta aparece/limpa com até ~15–20 s de atraso. É esperado.

**Histórico**
- No máximo **100 pontos por requisição**; não há agregação (média por hora etc.).
- Parâmetros: `attribute` (um sensor; omitido = os três), `lastN`, ou intervalo `from`/`to` (ISO 8601) com `limit`/`offset`.
- Sem dados ainda = listas vazias (não é erro). O histórico começa a partir do cadastro e só acumula enquanto o dispositivo envia dados.

**Alertas e triggers**
- O backend compara cada leitura com os triggers e, **somente ao mudar de estado**, envia `alert` ou `clearAlert` ao dispositivo. Cada sensor tem estado independente.
- Dispara quando `valor < min` ou `valor > max`; só limpa quando volta para `[min + hysteresis, max − hysteresis]`. Com `hysteresis = 0`, um valor oscilando em torno do limite liga/desliga o alerta repetidamente.
- `PUT /triggers` aceita corpo parcial (sensores/campos omitidos permanecem). Erros de validação: `400 INVALID_TRIGGERS` com `error.details.errors` (lista legível). Regras: `min ≤ max`, `hysteresis ≥ 0` e `2·hysteresis ≤ max − min`. Após o `PUT` a avaliação é refeita imediatamente.
- Valores padrão de um dispositivo novo: temperatura 10–25, umidade 40–70, luminosidade 20–80 (configuráveis no `.env` do backend).
- `autoAlertsEnabled=false` (em `PATCH /settings`) pausa o envio automático de `alert`/`clearAlert` para aquele dispositivo.
- `GET /alerts`: `active` (sensor, desde quando, valor, limites) e `history` (mais recente primeiro, até 50 eventos; `event` = `ALERT_ACTIVATED` | `ALERT_CLEARED`).

**Comandos (`POST /devices/:id/commands`)**
- `{ "command": "alert" | "clearAlert" | "displayAlert", "parameter": ... }`. Parâmetros: `temperature`, `humidity`, `luminosity`; `displayAlert` aceita também `clear`.
- Resposta `202` com `status: "SENT_TO_FIWARE"`: o FIWARE aceitou o comando; a entrega ao dispositivo **não** é confirmada na resposta. O efeito aparece depois em `measurements/current` → `actuators`.
- Comandos manuais não alteram o estado interno do motor de alertas.

## 6. Erros

Formato único: `{ "error": { "code", "message", "details"? } }`. Em produção não há stack trace.

| HTTP | `code` | Significado |
|---|---|---|
| 400 | `INVALID_DEVICE_ID`, `INVALID_JSON`, `INVALID_TRIGGERS`, `INVALID_SETTINGS`, `INVALID_COMMAND`, `INVALID_PARAMETER`, `INVALID_QUERY`, `INVALID_FIELD`, `INVALID_COORDINATES` | Entrada inválida (ver `message`/`details`) |
| 404 | `NOT_FOUND`, `ROUTE_NOT_FOUND` | Vinheria ou rota inexistente |
| 409 | `DEVICE_ALREADY_EXISTS` | `deviceId` já cadastrado |
| 502 | `UPSTREAM_ERROR`, `UPSTREAM_UNREACHABLE`, `PROVISIONING_FAILED` | FIWARE respondeu erro ou está inacessível (`details` traz o erro original) |
| 504 | `UPSTREAM_TIMEOUT` | Timeout falando com o FIWARE |
| 500 | `INTERNAL_ERROR` | Erro inesperado |

## 7. Dados iniciais para desenvolvimento

No ambiente da equipe já existem `vinheria001` (ESP32 no Wokwi), `vinheria002` e `vinheria003` (simuladas), cadastradas **antes** de existir o campo de posição: elas vêm com `coordinates: null` até receberem uma posição. Faça isto **uma única vez** (a posição fica salva):

```bash
curl -X PATCH http://localhost:3000/api/v1/devices/vinheria001/settings -H "Content-Type: application/json" -d '{"latitude":-23.55,"longitude":-46.63}'
curl -X PATCH http://localhost:3000/api/v1/devices/vinheria002/settings -H "Content-Type: application/json" -d '{"latitude":-33.45,"longitude":-70.66}'
curl -X PATCH http://localhost:3000/api/v1/devices/vinheria003/settings -H "Content-Type: application/json" -d '{"latitude":38.72,"longitude":-9.14}'
```

Vinherias novas criadas pela aplicação **não** precisam disso: basta enviar `latitude`/`longitude` no `POST /devices`.

Para ter muitas vinherias com dados vivos pelo mundo durante o desenvolvimento, use o mock de frota (cadastra e simula até 12 vinherias em regiões vinícolas, com nome, posição e telemetria):

```bash
cd mocks/python && pip install -r requirements.txt
FIWARE_HOST=IP_DA_VM python mock_fleet.py --register --start 4 --count 9      # vinheria004 ... vinheria012
```
O backend precisa estar rodando em `http://localhost:3000` (ou defina `BACKEND_URL`). Os dispositivos simulados enviam dados enquanto o script estiver em execução; ao pará-lo, ficam `offline` depois de 2 minutos. Mais detalhes no `README.md`.

## 8. Limitações

- Sem tempo real (somente consulta por requisição), sem autenticação e sem agregação de histórico.
- Histórico: máximo de 100 pontos por requisição.
- Máximo de 1000 dispositivos por listagem.
- `DELETE` não apaga o histórico já gravado; cadastrar de novo o mesmo `deviceId` reaproveita esse histórico.
- O IP da VM FIWARE muda quando ela é religada: só o backend precisa ser reconfigurado (`FIWARE_HOST`).
