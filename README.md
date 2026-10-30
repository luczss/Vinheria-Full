
<div align="center">

# 🍷 VINHERIA FULL

### Monitoramento ambiental inteligente para vinherias

**CP5 — Edge Computing | FIAP | 2026**

Uma solução IoT integrada para monitorar temperatura, umidade e luminosidade utilizando ESP32, MQTT, FIWARE e uma aplicação web.

</div>

---

## 📌 Sobre o projeto

A **Vinheria Full** é uma plataforma de monitoramento ambiental desenvolvida com conceitos de Internet das Coisas (IoT). O sistema acompanha as condições de armazenamento de vinherias por meio de sensores conectados a dispositivos ESP32.

As medições são transmitidas por MQTT para a infraestrutura FIWARE e disponibilizadas por uma API desenvolvida em Node.js e Express. A aplicação web permite visualizar os dispositivos cadastrados, consultar medições atuais, acompanhar dados históricos e identificar situações que exigem atenção.

A lógica de negócio dos alertas fica centralizada no backend. O ESP32 é responsável pela leitura dos sensores, pelo envio da telemetria e pela execução dos comandos recebidos, acionando os componentes físicos de sinalização.

### Funcionalidades

- Monitoramento de temperatura, umidade relativa do ar e luminosidade.
- Cadastro, consulta, listagem e remoção de dispositivos.
- Dashboard com mapa e gráficos das medições disponíveis.
- Consulta de valores atuais e séries históricas.
- Configuração de limites (*triggers*) por sensor por meio da API.
- Identificação automática de leituras fora dos limites configurados.
- Envio de comandos para os dispositivos utilizando FIWARE e MQTT.
- Sinalização de alertas por LED, buzzer e display LCD.
- Simulação de dispositivos individuais ou de uma frota utilizando Python.

---

## 🏗️ Arquitetura

A solução é dividida em quatro camadas, separando a interface, as regras de negócio, a infraestrutura IoT e os dispositivos físicos.

| Camada | Tecnologias e componentes | Responsabilidade |
|---|---|---|
| Apresentação | React e Vite | Exibir o dashboard, mapa, dispositivos e gráficos. |
| Aplicação | Node.js e Express | Disponibilizar a API, aplicar regras de negócio, avaliar triggers e solicitar comandos. |
| Plataforma IoT | Orion Context Broker, IoT Agent Ultralight, STH-Comet e MQTT | Integrar dispositivos, manter o contexto atual e armazenar o histórico. |
| Borda / Hardware | ESP32, DHT, LDR, LED, buzzer e LCD | Coletar medições, publicar telemetria e executar comandos. |

### Diagrama da arquitetura

![Diagrama da arquitetura da Vinheria Full](docs/arquitetura-vinheria-full.jpeg)

### Fluxo de telemetria

1. O ESP32 realiza a leitura de temperatura e umidade pelo sensor DHT e obtém uma escala relativa de luminosidade pelo LDR.
2. A cada cinco segundos, o firmware publica os atributos no tópico MQTT do dispositivo.
3. O IoT Agent Ultralight interpreta a mensagem e atualiza os atributos da entidade no Orion Context Broker.
4. O STH-Comet recebe as notificações configuradas e registra as medições históricas.
5. O backend consulta o Orion para obter os valores atuais e o STH-Comet para consultar o histórico.
6. O frontend consome a API e apresenta os dados disponíveis no dashboard.

Exemplo de telemetria no formato Ultralight:

```text
/TEF/<DEVICE_ID>/attrs

t|24.7|h|61.3|l|72
```

| Identificador | Medição | Unidade |
|---|---|---|
| `t` | Temperatura | °C |
| `h` | Umidade relativa | % |
| `l` | Luminosidade | Escala relativa de 0 a 100 |

### Fluxo de alertas

O backend avalia periodicamente as leituras recebidas e compara cada sensor com os limites configurados. Quando uma leitura ultrapassa a faixa permitida, o backend solicita o comando `alert` para o dispositivo correspondente.

Quando o valor retorna à faixa normal, considerando a histerese configurada, o backend solicita `clearAlert`.

**Os alertas são independentes:** limpar o alerta de temperatura não remove os alertas ativos de umidade ou luminosidade.

---

## 🧰 Tecnologias utilizadas

### Frontend
- React
- Vite
- React Router
- Leaflet / React Leaflet
- Lucide React

### Backend
- Node.js
- Express
- Axios
- dotenv
- CORS

### Plataforma IoT
- FIWARE Orion Context Broker
- FIWARE IoT Agent Ultralight
- FIWARE STH-Comet
- MQTT
- MongoDB (utilizado pela infraestrutura FIWARE)

### Hardware e simulação
- ESP32
- Sensor DHT11 / DHT22
- LDR
- LED
- Buzzer
- Display LCD 16×2 com I²C
- Arduino IDE / Wokwi
- Python
- Paho MQTT

---

## 📁 Estrutura do repositório

```text
cp6web/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── integrations/
│   │   ├── middlewares/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   ├── .env.example
│   └── package.json
│
├── docs/
│   ├── API.md
│   ├── FRONTEND_GUIDE.md
│   └── arquitetura-vinheria-full.jpeg
│
├── firmware/
│   └── esp32/
│       └── vinheria_esp32.ino
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   └── package.json
│
├── mocks/
│   └── python/
│       ├── mock_vinheria.py
│       ├── mock_fleet.py
│       └── requirements.txt
│
└── README.md
```

---

## ⚙️ Requisitos

Antes de executar o projeto, instale:

| Ferramenta | Requisito |
|---|---|
| Node.js | 18.11 ou superior |
| npm | Incluído com o Node.js |
| Git | Para clonar o repositório |
| Python 3 | Para executar os simuladores |
| Arduino IDE ou Wokwi | Para compilar ou simular o firmware |
| FIWARE | Infraestrutura da disciplina em execução |

### Portas padrão

| Serviço | Porta |
|---|---:|
| Frontend Vite | `5173` |
| Backend Express | `3000` |
| Orion Context Broker | `1026` |
| IoT Agent Ultralight | `4041` |
| STH-Comet | `8666` |
| Broker MQTT | `1883` |

As portas podem variar conforme a infraestrutura disponibilizada. O backend precisa alcançar os serviços FIWARE, e o ESP32 precisa alcançar o broker MQTT.

---

## 🚀 Instalação e execução

A execução local depende da infraestrutura FIWARE estar disponível e configurada.

### 1. Clonar o repositório

```bash
git clone https://github.com/CP6WEB/cp6web.git
cd cp6web
```

### 2. Configurar e iniciar o backend

```bash
cd backend
npm install
```

Crie o arquivo local de variáveis de ambiente a partir do modelo:

**Windows PowerShell**

```powershell
Copy-Item .env.example .env
```

**Git Bash, Linux ou macOS**

```bash
cp .env.example .env
```

Edite `backend/.env`. As variáveis principais são:

```env
PORT=3000
NODE_ENV=development
FIWARE_HOST=IP_DA_VM
FIWARE_SERVICE=smart
FIWARE_SERVICEPATH=/
FIWARE_APIKEY=TEF
```

Substitua `IP_DA_VM` pelo endereço atual da máquina virtual FIWARE. Não inclua `http://` nem a porta nessa variável. Consulte `backend/.env.example` para conferir as demais opções.

Inicie o backend:

```bash
npm start
```

Para desenvolvimento, utilize:

```bash
npm run dev
```

### 3. Verificar o backend

Verifique se a API está respondendo:

```text
http://localhost:3000/api/v1/health
```

Verifique também a conectividade com os serviços externos:

```text
http://localhost:3000/api/v1/health/dependencies
```

O endpoint `/health` verifica o processo Node.js. O endpoint `/health/dependencies` informa a conectividade com as dependências externas.

### 4. Configurar e iniciar o frontend

Abra outro terminal na raiz do repositório:

```bash
cd frontend
npm install
npm run dev
```

O Vite disponibiliza a aplicação localmente, normalmente em:

```text
http://localhost:5173
```

O cliente da API utiliza a variável `VITE_API_BASE_URL`. Quando ela não está definida, o endereço padrão é:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

Se o backend estiver em outro host ou porta, crie `frontend/.env` e configure o endereço correspondente.

Depois de alterar uma variável `VITE_`, reinicie o servidor do Vite.

### 5. Acessar a aplicação

Com backend e frontend iniciados, abra:

```text
http://localhost:5173
```

| Rota | Funcionalidade |
|---|---|
| `/` | Página inicial |
| `/mapa` | Dashboard, mapa e gráficos |
| `/dispositivos` | Cadastro, listagem e gerenciamento de dispositivos |

### Gerar a versão de produção do frontend

Para gerar os arquivos de build:

```bash
cd frontend
npm run build
```

Os arquivos gerados ficam em `frontend/dist/`. Esse comando apenas gera a versão de produção; a publicação e a hospedagem devem ser configuradas separadamente, conforme o ambiente utilizado.

---

## 📡 API REST

A API fica disponível localmente em:

```text
http://localhost:3000/api/v1
```

### Principais endpoints

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/health` | Verifica a disponibilidade do backend. |
| `GET` | `/health/dependencies` | Verifica as dependências externas. |
| `GET` | `/devices` | Lista os dispositivos. |
| `POST` | `/devices` | Cadastra e provisiona um dispositivo. |
| `GET` | `/devices/:id` | Consulta um dispositivo. |
| `DELETE` | `/devices/:id` | Remove um dispositivo. |
| `GET` | `/devices/:id/measurements/current` | Consulta as medições atuais. |
| `GET` | `/devices/:id/measurements/history` | Consulta o histórico de medições. |
| `GET` | `/devices/:id/triggers` | Consulta os limites configurados. |
| `PUT` | `/devices/:id/triggers` | Atualiza os limites dos sensores. |
| `GET` | `/devices/:id/alerts` | Consulta alertas e eventos. |
| `POST` | `/devices/:id/commands` | Envia um comando ao dispositivo. |

### Exemplos de requisições

**Consultar dispositivos**

```bash
curl http://localhost:3000/api/v1/devices
```

**Consultar medições atuais**

```bash
curl http://localhost:3000/api/v1/devices/vinheria001/measurements/current
```

**Consultar histórico de temperatura**

```bash
curl "http://localhost:3000/api/v1/devices/vinheria001/measurements/history?attribute=temperature&lastN=20"
```

**Consultar alertas**

```bash
curl "http://localhost:3000/api/v1/devices/vinheria001/alerts?limit=20"
```

**Enviar comando para o display**

```bash
curl -X POST http://localhost:3000/api/v1/devices/vinheria001/commands \
  -H "Content-Type: application/json" \
  -d '{"command":"displayAlert","parameter":"temperature"}'
```

Os comandos reconhecidos pelo firmware são `alert`, `clearAlert` e `displayAlert`. Os parâmetros válidos são `temperature`, `humidity`, `luminosity` e, para `displayAlert`, também `clear`.

A documentação completa dos endpoints está em [`docs/API.md`](docs/API.md).

> A resposta `SENT_TO_FIWARE` indica que o comando foi aceito pelo Orion para encaminhamento. Ela não comprova, isoladamente, que o ESP32 recebeu ou executou o comando. A confirmação deve ser verificada no dispositivo e nos atributos de atuadores.

---

## 🔌 Firmware ESP32

O código do dispositivo está em:

```text
firmware/esp32/vinheria_esp32.ino
```

### Componentes e conexões

| Componente | Pino / conexão |
|---|---|
| DHT11 / DHT22 | GPIO 15 |
| LDR — saída analógica | GPIO 34 |
| LED azul | GPIO 2 |
| Buzzer | GPIO 18 |
| LCD SDA | GPIO 21 |
| LCD SCL | GPIO 22 |

O LDR deve utilizar um divisor de tensão adequado. As entradas do ESP32 operam em 3,3 V e não são tolerantes a sinais de 5 V.

### Bibliotecas necessárias

- `PubSubClient`
- `DHT sensor library`
- `LiquidCrystal I2C`

`WiFi.h` e `Wire.h` fazem parte do ambiente ESP32.

### Configurações do firmware

Antes de executar, confira:

- Nome e senha da rede Wi-Fi.
- Endereço e porta do broker MQTT.
- `DEVICE_ID`, que deve corresponder ao dispositivo cadastrado.
- `API_KEY`, que deve corresponder à chave configurada no IoT Agent.
- Tipo de sensor definido em `DHT_TYPE`.

O firmware está configurado para DHT22 na simulação. Para a montagem física com DHT11, altere essa definição.

O Wokwi precisa alcançar um broker MQTT acessível pela internet. Um IP privado da rede local não é acessível diretamente pela simulação em nuvem.

### Comportamento dos alertas

| Sensor | Sinal sonoro |
|---|---|
| Temperatura | Tom de aproximadamente 2.000 Hz por 150 ms. |
| Umidade | Tom de aproximadamente 500 Hz por 600 ms. |
| Luminosidade | Tom de aproximadamente 1.000 Hz por 150 ms. |

O LED pisca enquanto houver pelo menos um alerta ativo. O LCD alterna entre as leituras e as mensagens de estado.

Quando vários alertas estão ativos, o buzzer prioriza temperatura, umidade e luminosidade, nessa ordem.

### Testes pelo Monitor Serial

Configure o Monitor Serial em `115200 baud`.

| Entrada | Ação |
|---|---|
| `t` | Ativa alerta de temperatura. |
| `u` | Ativa alerta de umidade. |
| `l` | Ativa alerta de luminosidade. |
| `T` | Limpa alerta de temperatura. |
| `U` | Limpa alerta de umidade. |
| `L` | Limpa alerta de luminosidade. |
| `0` | Limpa todos os alertas. |

Esses comandos permitem testar os atuadores sem depender do backend ou da conexão FIWARE.

---

## 🐍 Simuladores Python

Os simuladores ficam em `mocks/python`:

| Arquivo | Finalidade |
|---|---|
| `mock_vinheria.py` | Simula um dispositivo de vinheria. |
| `mock_fleet.py` | Simula múltiplos dispositivos. |

Instale as dependências:

```bash
cd mocks/python
pip install -r requirements.txt
```

O pacote utilizado para comunicação MQTT é `paho-mqtt`. Configure os simuladores com o endereço do broker e os identificadores compatíveis com os dispositivos provisionados.

---

## 🧪 Testes e validação

Para executar os testes automatizados do backend:

```bash
cd backend
npm test
```

Os testes locais verificam regras de alertas, triggers e validações. Eles não substituem a validação da comunicação com a infraestrutura FIWARE.

### Checklist de validação ponta a ponta

- [ ] Backend iniciado e `/api/v1/health` respondendo.
- [ ] Dependências FIWARE acessíveis.
- [ ] Dispositivo cadastrado e provisionado.
- [ ] Telemetria recebida e consultável pela API.
- [ ] Histórico disponível no STH-Comet.
- [ ] Triggers consultados e atualizados pela API.
- [ ] Alerta gerado após uma leitura fora dos limites.
- [ ] Comando recebido pelo ESP32.
- [ ] LED, buzzer e LCD sinalizando corretamente.
- [ ] Alerta encerrado após o retorno à faixa normal.
- [ ] Dashboard apresentando os dados disponíveis.

---

## ⚠️ Limitações conhecidas

- A API não possui autenticação de usuários nesta versão.
- O frontend realiza consultas HTTP; não há implementação de WebSocket ou Server-Sent Events.
- O status online/offline é calculado pelo tempo desde a última telemetria. O padrão é de 120 segundos.
- O motor de alertas utiliza a última leitura conhecida no Orion. A ausência de novas medições não significa que o sensor voltou à faixa normal.
- O histórico depende das notificações e subscriptions do STH-Comet.
- A consulta histórica possui limite de pontos; o padrão é 50 e o máximo documentado é 100.
- Agregações históricas de longo prazo não estão implementadas.
- O frontend pode apresentar dispositivos demonstrativos locais. Esses registros não comprovam conexão física nem integração com FIWARE.
- A interface React não possui um formulário gráfico para editar triggers nesta versão. A consulta e a atualização são realizadas pela API.
- Comandos aceitos pelo Orion não representam confirmação de execução física pelo ESP32.
- A remoção de um dispositivo não garante a exclusão do histórico já armazenado no STH-Comet.

---

## 🔐 Segurança

- Não versione `backend/.env` nem outros arquivos com credenciais.
- Mantenha no repositório apenas o modelo `backend/.env.example`, sem senhas ou tokens reais.
- Se uma senha ou chave tiver sido publicada, faça a rotação da credencial. Apagar o arquivo em um commit posterior não remove o segredo do histórico Git.
- Restrinja `CORS_ORIGIN` à origem necessária em ambientes compartilhados.
- Não exponha serviços FIWARE ou o broker MQTT à internet sem autorização e controles adequados.
- Não conecte sinais de 5 V diretamente aos GPIOs do ESP32.
- Diferencie dados demonstrativos de leituras reais dos sensores.

---

## 📚 Documentação e referências

| Documento / recurso | Conteúdo |
|---|---|
| [`docs/API.md`](docs/API.md) | Contrato da API, endpoints, parâmetros e respostas. |
| [`docs/FRONTEND_GUIDE.md`](docs/FRONTEND_GUIDE.md) | Guia de integração e comportamento esperado do frontend. |
| [`backend/.env.example`](backend/.env.example) | Modelo das variáveis de ambiente do backend. |
| [`firmware/esp32/vinheria_esp32.ino`](firmware/esp32/vinheria_esp32.ino) | Código do firmware ESP32. |
| [FIWARE — Referência da disciplina](https://github.com/fabiocabrini/fiware) | Infraestrutura FIWARE utilizada na atividade. |
| [FIWARE Orion Context Broker](https://github.com/telefonicaid/fiware-orion) | Documentação e código do Orion. |
| [FIWARE IoT Agent Ultralight](https://github.com/telefonicaid/iotagent-ul) | Documentação e código do IoT Agent. |
| [FIWARE STH-Comet](https://github.com/telefonicaid/fiware-sth-comet) | Documentação e código do STH-Comet. |

---

## 👥 Equipe

Projeto desenvolvido como parte do **Checkpoint 5 — Edge Computing**, na FIAP.

| Integrante |
|---|
| Diego Caio de Ulhôa |
| Eduardo Guzeli Nogueira |
| Enzo Leme Gomes |
| Gabriel Torres Zambo |
| Lucas dos Santos Oliveira |
| Octavio Mello Covre de Souza |

---

<div align="center">

**VINHERIA FULL**

*Monitoramento IoT • Integração FIWARE • Edge Computing*

**FIAP — 2026**

</div>
