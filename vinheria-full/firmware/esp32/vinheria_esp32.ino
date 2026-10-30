// ============================================================
// CP5 - Vinheria Full | ESP32 + DHT + LDR + LCD I2C + Buzzer + LED
// Base: sketch do projeto no Wokwi (código do Prof. Fábio H. Cabrini, FIWARE Descomplicado)
// Adaptado ao contrato do backend Node.js:
//   - QUEM DECIDE o alerta é o BACKEND (triggers). O ESP32 só executa o comando.
//   - Comandos (provisionados no IoT Agent): alert | clearAlert | displayAlert
//       vinheria001@alert|temperature        vinheria001@clearAlert|temperature
//       vinheria001@alert|humidity           vinheria001@clearAlert|humidity
//       vinheria001@alert|luminosity         vinheria001@clearAlert|luminosity
//       vinheria001@displayAlert|temperature|humidity|luminosity|clear
//   - clearAlert limpa SÓ o sensor informado.
//   - Telemetria combinada:  /TEF/vinheria001/attrs  ->  t|24.7|h|61.3|l|72
//   - Estados dos atuadores: /TEF/vinheria001/attrs  ->  s|on|b|on|d|temperature|a|temperature
//   - Ack do comando:        /TEF/vinheria001/cmdexe ->  vinheria001@alert|ok
//
// Bibliotecas (libraries.txt do Wokwi): PubSubClient, DHT sensor library, LiquidCrystal I2C
// NÃO TESTADO: escrito, mas ainda não compilado nem simulado no Wokwi.
// ============================================================
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ============================================================
// CONFIGURAÇÃO DE REDE / FIWARE — ALTERAR AQUI
// ============================================================
const char* WIFI_SSID   = "Wokwi-GUEST";
const char* WIFI_PASS   = "";
const char* BROKER_MQTT = "13.218.110.201";  // ALTERAR sempre que o IP da VM mudar (mesma VM do Orion)
const int   BROKER_PORT = 1883;
const char* DEVICE_ID   = "vinheria001";     // igual ao deviceId cadastrado no backend
const char* API_KEY     = "TEF";             // igual a FIWARE_APIKEY do backend/.env
const char* ID_MQTT     = "fiware_vinheria001"; // único por dispositivo (dois clientes com o mesmo ID se derrubam)
const unsigned long INTERVALO_PUBLICA = 5000;   // telemetria (ms)

// ============================================================
// CONFIGURAÇÕES DO HARDWARE — ALTERAR AQUI
// ============================================================
// ---- Pinos / sensores ----
#define DHT_PIN     15
#define DHT_TYPE    DHT22     // Wokwi = DHT22; na placa física troque para DHT11
#define LDR_PIN     34
#define LDR_INVERT  true      // true = mesma conta do sketch atual: map(bruto, 4095, 0, 0, 100)
#define BUZZER_PIN  18
#define LED_PIN     2         // LED azul onboard
#define LCD_ADDR    0x27
const unsigned long INTERVALO_LEITURA = 2000;   // DHT precisa de >= 2 s

// ---- LED ----
// Pisca enquanto houver QUALQUER alerta ativo. (LED RGB seria hipótese futura:
// NORMAL=verde, ALERTA=amarelo, TRIGGER EXCEDIDO=vermelho piscando — NÃO implementado.)
const unsigned long INTERVALO_PISCA = 300;

// ---- Buzzer: um padrão por sensor {frequência Hz, duração ms, período ms} ----
struct Som { uint16_t freq; uint16_t duracao; uint16_t periodo; };
const Som SOM[3] = {
  {2000, 150, 1000},   // temperature: agudo curto
  {500,  600, 1000},   // humidity:    grave longo
  {1000, 150, 1000},   // luminosity:  médio curto
};
// Vários alertas ao mesmo tempo: toca o padrão do PRIMEIRO ativo (temperature > humidity > luminosity).

// ---- Display 16x2 ----
const unsigned long INTERVALO_LCD = 3000;       // alterna páginas
const char* ROTULO[3] = {"TEMP", "UMID", "LUZ"}; // texto curto de cada sensor (máx. 16 colunas)
// ============================================================
// FIM DAS CONFIGURAÇÕES DE HARDWARE
// ============================================================

enum { S_TEMP = 0, S_UMID = 1, S_LUZ = 2, S_N = 3 };
const char* NOMES[S_N] = {"temperature", "humidity", "luminosity"};  // nomes usados nos comandos

String TOPICO_CMD    = String("/") + API_KEY + "/" + DEVICE_ID + "/cmd";
String TOPICO_ATTRS  = String("/") + API_KEY + "/" + DEVICE_ID + "/attrs";
String TOPICO_CMDEXE = String("/") + API_KEY + "/" + DEVICE_ID + "/cmdexe";

DHT dht(DHT_PIN, DHT_TYPE);
LiquidCrystal_I2C lcd(LCD_ADDR, 16, 2);
WiFiClient espClient;
PubSubClient MQTT(espClient);

float temperatura = 0, umidade = 0;
int luminosidade = 0;
bool alerta[S_N] = {false, false, false};
String displayState = "clear";
unsigned long tLeitura = 0, tPublica = 0, tPisca = 0, tSom = 0, tLcd = 0;
bool ledEstado = false, lcdPagina = false;

int indiceSensor(const String& nome) {
  for (int i = 0; i < S_N; i++) if (nome == NOMES[i]) return i;
  return -1;
}
int primeiroAtivo() {
  for (int i = 0; i < S_N; i++) if (alerta[i]) return i;
  return -1;
}

// ---------- LCD ----------
void atualizaLCD() {
  lcd.clear();
  if (!lcdPagina) {
    lcd.setCursor(0, 0);
    lcd.printf("T:%.1fC U:%.0f%%", temperatura, umidade);
    lcd.setCursor(0, 1);
    lcd.printf("Luz:%d%%", luminosidade);
  } else {
    lcd.setCursor(0, 0);
    lcd.print("Alertas:");
    lcd.setCursor(0, 1);
    String linha = "";
    for (int i = 0; i < S_N; i++) if (alerta[i]) linha += String(ROTULO[i]) + " ";
    if (linha == "") {
      int d = indiceSensor(displayState);   // displayAlert manual sem alerta ativo
      linha = d >= 0 ? String("Msg: ") + ROTULO[d] : String("Tudo normal");
    }
    lcd.print(linha.substring(0, 16));
  }
}

// ---------- MQTT: estados e telemetria ----------
void publicaEstados() {
  int a = primeiroAtivo();
  String on = a >= 0 ? "on" : "off";
  String tipo = a >= 0 ? String(NOMES[a]) : String("none");
  String p = "s|" + on + "|b|" + on + "|d|" + displayState + "|a|" + tipo;
  MQTT.publish(TOPICO_ATTRS.c_str(), p.c_str());
}
void publicaTelemetria() {
  String p = "t|" + String(temperatura, 1) + "|h|" + String(umidade, 1) + "|l|" + String(luminosidade);
  MQTT.publish(TOPICO_ATTRS.c_str(), p.c_str());
}

// ---------- Comandos vindos do backend (via FIWARE) ----------
// Formato: vinheria001@alert|temperature
void executaComando(const String& msg) {
  int at = msg.indexOf('@'), bar = msg.indexOf('|');
  if (at < 0 || bar < at) return;
  String dev = msg.substring(0, at);
  String cmd = msg.substring(at + 1, bar);
  String param = msg.substring(bar + 1);
  cmd.trim(); param.trim();
  if (dev != DEVICE_ID) return;

  int idx = indiceSensor(param);
  bool ok = true;
  if (cmd == "alert" && idx >= 0) {
    alerta[idx] = true;
    displayState = param;
  } else if (cmd == "clearAlert" && idx >= 0) {
    alerta[idx] = false;                         // só este sensor
    int a = primeiroAtivo();
    displayState = a >= 0 ? String(NOMES[a]) : String("clear");
  } else if (cmd == "displayAlert" && (idx >= 0 || param == "clear")) {
    displayState = param;
  } else {
    ok = false;
  }

  String ack = String(DEVICE_ID) + "@" + cmd + "|" + (ok ? "ok" : "error");
  MQTT.publish(TOPICO_CMDEXE.c_str(), ack.c_str());
  if (ok) {
    lcdPagina = true;       // mostra a página de alertas imediatamente
    tLcd = millis();
    atualizaLCD();
    publicaEstados();
  }
}

void callbackMQTT(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  Serial.print("Comando recebido: ");
  Serial.println(msg);
  executaComando(msg);
}

// ---------- Conexões ----------
void conectaWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.print("Conectando ao WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(200); Serial.print("."); }
  Serial.println();
}
void conectaMQTT() {
  while (!MQTT.connected()) {
    Serial.print("Conectando ao broker MQTT... ");
    if (MQTT.connect(ID_MQTT)) {
      Serial.println("OK");
      MQTT.subscribe(TOPICO_CMD.c_str());
      publicaEstados();
    } else {
      Serial.println("falhou, nova tentativa em 2s");
      delay(2000);
    }
  }
}

// ---------- Sensores ----------
void leSensores() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t)) temperatura = t;
  if (!isnan(h)) umidade = h;
  int bruto = analogRead(LDR_PIN);
  luminosidade = LDR_INVERT ? map(bruto, 4095, 0, 0, 100) : map(bruto, 0, 4095, 0, 100);
  Serial.printf("T: %.1f C | U: %.1f %% | L: %d %%\n", temperatura, umidade, luminosidade);
}

// ---------- Atuadores: LED pisca e buzzer toca enquanto houver alerta ----------
void atualizaAtuadores() {
  int a = primeiroAtivo();
  unsigned long agora = millis();
  if (a < 0) { digitalWrite(LED_PIN, LOW); noTone(BUZZER_PIN); return; }
  if (agora - tPisca >= INTERVALO_PISCA) { tPisca = agora; ledEstado = !ledEstado; digitalWrite(LED_PIN, ledEstado); }
  if (agora - tSom >= SOM[a].periodo) { tSom = agora; tone(BUZZER_PIN, SOM[a].freq, SOM[a].duracao); }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  dht.begin();
  Wire.begin(21, 22);
  lcd.init(); lcd.backlight();
  lcd.setCursor(0, 0); lcd.print("Vinheria Full");
  lcd.setCursor(0, 1); lcd.print("Conectando...");
  conectaWiFi();
  MQTT.setServer(BROKER_MQTT, BROKER_PORT);
  MQTT.setCallback(callbackMQTT);
  conectaMQTT();
  leSensores();
  publicaTelemetria();
  atualizaLCD();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) conectaWiFi();
  if (!MQTT.connected()) conectaMQTT();
  MQTT.loop();

  unsigned long agora = millis();
  if (agora - tLeitura >= INTERVALO_LEITURA) { tLeitura = agora; leSensores(); }
  if (agora - tPublica >= INTERVALO_PUBLICA) { tPublica = agora; publicaTelemetria(); }
  if (agora - tLcd >= INTERVALO_LCD) { tLcd = agora; lcdPagina = !lcdPagina; atualizaLCD(); }
  atualizaAtuadores();

  // Teste local pelo Serial Monitor (sem backend): t / u / l = alerta; T / U / L = limpa; 0 = limpa tudo
  if (Serial.available()) {
    char c = Serial.read();
    String d = String(DEVICE_ID) + "@";
    if (c == 't') executaComando(d + "alert|temperature");
    if (c == 'u') executaComando(d + "alert|humidity");
    if (c == 'l') executaComando(d + "alert|luminosity");
    if (c == 'T') executaComando(d + "clearAlert|temperature");
    if (c == 'U') executaComando(d + "clearAlert|humidity");
    if (c == 'L') executaComando(d + "clearAlert|luminosity");
    if (c == '0') for (int i = 0; i < S_N; i++) executaComando(d + "clearAlert|" + NOMES[i]);
  }
}
