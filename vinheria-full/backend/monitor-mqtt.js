
const mqtt = require("mqtt");

const BROKER = "mqtt://54.91.234.251:1883";

const client = mqtt.connect(BROKER, {
    clientId: `monitor_debug_${Date.now()}`
});

client.on("connect", () => {
    console.log("Conectado ao broker MQTT!");
    console.log("Monitorando vinheria001 e vinheria004...\n");

    client.subscribe("/TEF/#");
});

client.on("message", (topic, message) => {
    console.log(`[${new Date().toLocaleTimeString()}]`);
    console.log(`Tópico: ${topic}`);
    console.log(`Mensagem: ${message.toString()}`);
    console.log("-----------------------------------");
});

client.on("error", (error) => {
    console.error("Erro MQTT:", error.message);
});
