#!/usr/bin/env python3
"""
Mock de vinheria (dispositivo IoT simulado via MQTT, protocolo Ultralight do FIWARE).

Fala exatamente como o ESP32 real:
  publica  /<APIKEY>/<deviceId>/attrs   ->  t|24.7|h|61.3|l|72
  publica  /<APIKEY>/<deviceId>/attrs   ->  s|on|b|on|d|temperature|a|temperature   (estados)
  recebe   /<APIKEY>/<deviceId>/cmd     ->  vinheria002@alert|temperature
  responde /<APIKEY>/<deviceId>/cmdexe  ->  vinheria002@alert|ok

O dispositivo precisa estar CADASTRADO antes (POST /api/v1/devices no backend).

Exemplos:
  python mock_vinheria.py --device vinheria002
  python mock_vinheria.py --device vinheria003 --spike-every 60   # força temperatura alta a cada 60 s
"""
import argparse
import os
import random
import threading
import time

import paho.mqtt.client as mqtt

# ============================================================================
# CONFIGURAÇÃO NECESSÁRIA — ALTERAR AQUI (ou use variáveis de ambiente / argumentos)
# ============================================================================
BROKER = os.getenv("MQTT_BROKER_HOST") or os.getenv("FIWARE_HOST", "CONFIGURE_IP_DO_BROKER")  # IP do MQTT Broker (muda quando a VM é religada)
PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
APIKEY = os.getenv("FIWARE_APIKEY", "TEF")  # mesmo FIWARE_APIKEY do backend/.env
# ============================================================================

parser = argparse.ArgumentParser()
parser.add_argument("--device", required=True, help="deviceId, ex.: vinheria002")
parser.add_argument("--broker", default=BROKER)
parser.add_argument("--port", type=int, default=PORT)
parser.add_argument("--apikey", default=APIKEY)
parser.add_argument("--interval", type=float, default=5.0, help="segundos entre telemetrias")
parser.add_argument("--spike-every", type=float, default=0, help="a cada N s força temperatura alta por ~20 s (0 = desliga)")
args = parser.parse_args()

DEVICE = args.device
T_ATTRS = f"/{args.apikey}/{DEVICE}/attrs"
T_CMD = f"/{args.apikey}/{DEVICE}/cmd"
T_ACK = f"/{args.apikey}/{DEVICE}/cmdexe"

SENSORS = ("temperature", "humidity", "luminosity")
active = {s: False for s in SENSORS}
display_state = "clear"
lock = threading.Lock()


def actuator_payload():
    any_alert = [s for s in SENSORS if active[s]]
    led = "on" if any_alert else "off"
    return f"s|{led}|b|{led}|d|{display_state}|a|{any_alert[0] if any_alert else 'none'}"


def on_connect(client, userdata, flags, rc, *extra):
    print(f"[MQTT] conectado ({rc}) como {DEVICE}; assinando {T_CMD}")
    client.subscribe(T_CMD)
    client.publish(T_ATTRS, actuator_payload())


def on_message(client, userdata, msg):
    global display_state
    text = msg.payload.decode(errors="replace")
    print(f"[MQTT] comando recebido: {text}")
    try:
        head, param = text.split("|", 1)
        device, command = head.split("@", 1)
    except ValueError:
        print("[MQTT] formato inválido, ignorado")
        return
    if device != DEVICE:
        return
    with lock:
        if command == "alert" and param in SENSORS:
            active[param] = True
            display_state = param
        elif command == "clearAlert" and param in SENSORS:
            active[param] = False  # só limpa o sensor informado
            remaining = [s for s in SENSORS if active[s]]
            display_state = remaining[0] if remaining else "clear"
        elif command == "displayAlert" and (param in SENSORS or param == "clear"):
            display_state = param
        else:
            client.publish(T_ACK, f"{DEVICE}@{command}|error")
            return
        payload = actuator_payload()
    client.publish(T_ACK, f"{DEVICE}@{command}|ok")
    client.publish(T_ATTRS, payload)
    print(f"[DEVICE] estados: {payload}")


try:  # paho-mqtt 2.x
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"mock_{DEVICE}")
except AttributeError:  # paho-mqtt 1.x
    client = mqtt.Client(client_id=f"mock_{DEVICE}")
client.on_connect = on_connect
client.on_message = on_message
client.connect(args.broker, args.port, keepalive=60)
client.loop_start()

temp, hum, lux = random.uniform(18, 22), random.uniform(50, 60), random.randint(40, 60)
start = last_spike = time.time()
while True:
    # passeio aleatório suave
    temp += random.uniform(-0.4, 0.4)
    hum += random.uniform(-0.8, 0.8)
    lux = max(0, min(100, lux + random.randint(-3, 3)))
    # excursão programada para exercitar o motor de alertas
    if args.spike_every and (time.time() - start) % args.spike_every < 20:
        temp = max(temp, 30 + random.uniform(0, 2))
    elif temp > 26:
        temp -= 1.5
    hum = max(0, min(100, hum))
    payload = f"t|{temp:.1f}|h|{hum:.1f}|l|{lux}"
    client.publish(T_ATTRS, payload)
    print(f"[DEVICE] {T_ATTRS} <- {payload}")
    time.sleep(args.interval)
