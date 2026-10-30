#!/usr/bin/env python3
"""
Mock de FROTA: simula VÁRIAS vinherias (uma por região vinícola do mundo) em UM único processo.
Cada vinheria é um dispositivo MQTT/Ultralight completo: publica telemetria, recebe os comandos
alert/clearAlert/displayAlert, responde o ack e publica os estados dos atuadores.

  publica   /<APIKEY>/<deviceId>/attrs   t|18.2|h|55.0|l|48   e   s|on|b|on|d|temperature|a|temperature
  assina    /<APIKEY>/+/cmd              <deviceId>@alert|temperature
  responde  /<APIKEY>/<deviceId>/cmdexe  <deviceId>@alert|ok

Cada dispositivo precisa estar cadastrado no backend ANTES de enviar dados. Use --register para o próprio
script cadastrar (ou atualizar nome/local/posição) via API do backend.

Exemplos (a partir de mocks/python):
  # cadastra e simula 9 vinherias novas: vinheria004 ... vinheria012
  FIWARE_HOST=SEU_IP python mock_fleet.py --register --start 4 --count 9

  # só simula (já cadastradas)
  FIWARE_HOST=SEU_IP python mock_fleet.py --start 4 --count 9

  # ids específicos; --register também atualiza posição de dispositivos que já existem
  FIWARE_HOST=SEU_IP python mock_fleet.py --register --ids vinheria002,vinheria003

  # sem enviar dados MQTT, só cadastrar (cria as vinherias e sai)
  python mock_fleet.py --register --register-only --start 4 --count 9
"""
import argparse
import json
import os
import random
import threading
import time
import urllib.error
import urllib.request

# ============================================================================
# CONFIGURAÇÃO NECESSÁRIA — ALTERAR AQUI (ou use variáveis de ambiente / argumentos)
# ============================================================================
BROKER = os.getenv("MQTT_BROKER_HOST") or os.getenv("FIWARE_HOST", "CONFIGURE_IP_DO_BROKER")  # muda quando a VM é religada
PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
APIKEY = os.getenv("FIWARE_APIKEY", "TEF")                       # igual ao FIWARE_APIKEY do backend/.env
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000/api/v1")
# ============================================================================

SENSORS = ("temperature", "humidity", "luminosity")

# (nome, país, latitude, longitude, temperatura-base °C). Sem os caracteres < > " ' = ; ( ) (o Orion rejeita)
REGIONS = [
    ("Bordeaux", "Franca", 44.84, -0.58, 17),
    ("Napa Valley", "EUA", 38.30, -122.29, 18),
    ("Mendoza", "Argentina", -32.89, -68.84, 19),
    ("Douro", "Portugal", 41.16, -7.79, 18),
    ("Barossa Valley", "Australia", -34.56, 138.95, 19),
    ("Stellenbosch", "Africa do Sul", -33.93, 18.86, 20),
    ("Marlborough", "Nova Zelandia", -41.51, 173.96, 16),
    ("Chianti", "Italia", 43.46, 11.25, 18),
    ("Rioja", "Espanha", 42.29, -2.54, 17),
    ("Mosel", "Alemanha", 49.95, 7.00, 15),
    ("Colchagua", "Chile", -34.65, -71.40, 19),
    ("Serra Gaucha", "Brasil", -29.17, -51.52, 20),
]


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


class SimDevice:
    """Estado e comportamento de uma vinheria simulada (sem I/O, fácil de testar)."""

    def __init__(self, device_id, base_temp, rng):
        self.id = device_id
        self.base = base_temp
        self.rng = rng
        self.temp = base_temp + rng.uniform(-1, 1)
        self.hum = rng.uniform(50, 62)
        self.lux = rng.randint(35, 65)
        self.active = {s: False for s in SENSORS}
        self.display = "clear"
        self.spike_ticks = 0

    def tick(self, spike_chance):
        """Avança a simulação e devolve o payload de telemetria."""
        r = self.rng
        if self.spike_ticks > 0:  # excursão de temperatura em andamento
            self.spike_ticks -= 1
            self.temp = max(self.temp, 27 + r.uniform(0, 4))
        elif r.random() < spike_chance:
            self.spike_ticks = r.randint(4, 8)
        else:  # volta suavemente à temperatura-base
            self.temp += (self.base - self.temp) * 0.15 + r.uniform(-0.3, 0.3)
        self.hum = clamp(self.hum + (56 - self.hum) * 0.1 + r.uniform(-0.8, 0.8), 0, 100)
        self.lux = clamp(self.lux + r.randint(-3, 3), 0, 100)
        return f"t|{self.temp:.1f}|h|{self.hum:.1f}|l|{self.lux}"

    def states(self):
        on = [s for s in SENSORS if self.active[s]]
        led = "on" if on else "off"
        return f"s|{led}|b|{led}|d|{self.display}|a|{on[0] if on else 'none'}"

    def handle(self, text):
        """Processa 'vinheriaNNN@cmd|param'. Devolve (ack, ok) ou None se a mensagem não for para este dispositivo."""
        try:
            head, param = text.split("|", 1)
            dev, cmd = head.split("@", 1)
        except ValueError:
            return None
        if dev != self.id:
            return None
        param = param.strip()
        ok = True
        if cmd == "alert" and param in SENSORS:
            self.active[param] = True
            self.display = param
        elif cmd == "clearAlert" and param in SENSORS:
            self.active[param] = False  # só limpa o sensor informado
            rest = [s for s in SENSORS if self.active[s]]
            self.display = rest[0] if rest else "clear"
        elif cmd == "displayAlert" and (param in SENSORS or param == "clear"):
            self.display = param
        else:
            ok = False
        return f"{self.id}@{cmd}|{'ok' if ok else 'error'}", ok


def api(method, path, body=None, timeout=90):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{BACKEND_URL.rstrip('/')}{path}", data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, json.loads(resp.read().decode() or "null")


def register(dev_id, region):
    """Cadastra a vinheria; se já existir, atualiza nome/local/posição."""
    name, country, lat, lng, _ = region
    info = {"displayName": f"Vinheria {name}", "location": f"{name}, {country}", "latitude": lat, "longitude": lng}
    try:
        api("POST", "/devices", {"deviceId": dev_id, **info})
        print(f"[API] {dev_id}: cadastrada ({name})")
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        if e.code == 409:
            api("PATCH", f"/devices/{dev_id}/settings", info)
            print(f"[API] {dev_id}: já existia, nome/local/posição atualizados ({name})")
        else:
            print(f"[API] {dev_id}: ERRO HTTP {e.code}: {detail[:300]}")
    except Exception as e:  # backend fora do ar etc.
        print(f"[API] {dev_id}: falha ao chamar o backend ({BACKEND_URL}): {e}")


def build_devices(args):
    if args.ids:
        ids = [i.strip() for i in args.ids.split(",") if i.strip()]
    else:
        ids = [f"vinheria{n:03d}" for n in range(args.start, args.start + args.count)]
    if len(ids) > len(REGIONS):
        raise SystemExit(f"No máximo {len(REGIONS)} vinherias (uma por região). Edite REGIONS para adicionar mais.")
    rng = random.Random(args.seed)
    return {d: (SimDevice(d, REGIONS[i][4], rng), REGIONS[i]) for i, d in enumerate(ids)}


def main():
    ap = argparse.ArgumentParser(description="Simula uma frota de vinherias via MQTT.")
    ap.add_argument("--start", type=int, default=4, help="primeiro número do deviceId (padrão 4 => vinheria004)")
    ap.add_argument("--count", type=int, default=9, help="quantas vinherias (padrão 9)")
    ap.add_argument("--ids", help="lista de deviceIds separada por vírgula (substitui --start/--count)")
    ap.add_argument("--register", action="store_true", help="cadastra/atualiza as vinherias no backend antes de simular")
    ap.add_argument("--register-only", action="store_true", help="só cadastra e sai (sem MQTT)")
    ap.add_argument("--interval", type=float, default=5.0, help="segundos entre telemetrias")
    ap.add_argument("--spike-chance", type=float, default=0.03, help="chance por ciclo de uma excursão de temperatura (alerta)")
    ap.add_argument("--seed", type=int, default=None, help="semente aleatória (resultados repetíveis)")
    ap.add_argument("--broker", default=BROKER)
    ap.add_argument("--port", type=int, default=PORT)
    ap.add_argument("--apikey", default=APIKEY)
    args = ap.parse_args()

    devices = build_devices(args)
    if args.register or args.register_only:
        for dev_id, (_, region) in devices.items():
            register(dev_id, region)
        if args.register_only:
            return

    import paho.mqtt.client as mqtt  # import tardio: a lógica acima pode ser testada sem paho

    lock = threading.Lock()
    try:  # paho-mqtt 2.x
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"fleet_{os.getpid()}")
    except AttributeError:  # paho-mqtt 1.x
        client = mqtt.Client(client_id=f"fleet_{os.getpid()}")

    attrs = lambda d: f"/{args.apikey}/{d}/attrs"

    def on_connect(c, userdata, flags, rc, *extra):
        print(f"[MQTT] conectado ({rc}); assinando /{args.apikey}/+/cmd para {len(devices)} vinherias")
        c.subscribe(f"/{args.apikey}/+/cmd")
        with lock:
            for d, (dev, _) in devices.items():
                c.publish(attrs(d), dev.states())

    def on_message(c, userdata, msg):
        parts = msg.topic.split("/")  # ['', 'TEF', 'vinheria004', 'cmd']
        entry = devices.get(parts[2]) if len(parts) >= 4 else None
        if not entry:
            return  # comando de outro dispositivo (ex.: o ESP32 real)
        text = msg.payload.decode(errors="replace")
        print(f"[MQTT] {parts[2]} <- {text}")
        with lock:
            result = entry[0].handle(text)
            if result is None:
                return
            ack, ok = result
            states = entry[0].states()
        c.publish(f"/{args.apikey}/{parts[2]}/cmdexe", ack)
        if ok:
            c.publish(attrs(parts[2]), states)
            print(f"[DEVICE] {parts[2]} estados: {states}")

    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(args.broker, args.port, keepalive=60)
    client.loop_start()

    print(f"[FLEET] simulando {', '.join(devices)} a cada {args.interval}s (Ctrl+C para parar)")
    try:
        while True:
            with lock:
                payloads = {d: dev.tick(args.spike_chance) for d, (dev, _) in devices.items()}
            for d, p in payloads.items():
                client.publish(attrs(d), p)
            print(f"[FLEET] {time.strftime('%H:%M:%S')} " + " | ".join(f"{d[-3:]}:{p.split('|')[1]}C" for d, p in payloads.items()))
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\n[FLEET] encerrado")
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
