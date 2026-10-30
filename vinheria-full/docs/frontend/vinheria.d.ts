// Tipos da API Vinheria Full (referência para TypeScript e para IAs). Todas as datas são ISO 8601 em UTC.

export type SensorName = 'temperature' | 'humidity' | 'luminosity';
export type DeviceStatus = 'online' | 'offline' | 'unknown'; // unknown = nunca enviou dados

export interface Measurements {
  temperature: number | null; // °C
  humidity: number | null;    // %
  luminosity: number | null;  // 0-100
  timestamp: string | null;
}

export interface DeviceSummary {
  deviceId: string;                 // ex.: "vinheria001"
  entityId: string;
  entityType: string;
  displayName: string | null;
  location: string | null;          // texto livre
  coordinates: { latitude: number; longitude: number } | null; // null = não aparece no mapa
  current: Measurements;
  status: DeviceStatus;
  lastSeen: string | null;
  autoAlertsEnabled: boolean;
  activeAlerts: SensorName[];       // sensores atualmente em alerta
}

export interface Actuators {
  ledState: string | null;          // "on" | "off"
  buzzerState: string | null;
  displayState: string | null;      // "temperature" | "humidity" | "luminosity" | "clear"
  alertType: string | null;         // sensor em alerta ou "none"
}

export interface DeviceDetail extends DeviceSummary {
  provisioning: { protocol: string; transport: string; service: string; servicePath: string;
                  telemetryTopic: string; commandTopic: string; commandAckTopic: string };
  sensors: Record<SensorName, { objectId: string; type: string; unit: string }>;
  commands: Record<'alert' | 'clearAlert' | 'displayAlert', string[]>;
  current: Measurements & { actuators: Actuators };
}

export interface CurrentMeasurement {
  deviceId: string;
  temperature: number | null; humidity: number | null; luminosity: number | null;
  timestamp: string | null;
  status: DeviceStatus;
  units: Record<SensorName, string>;
  actuators: Actuators;
}

export interface HistoryPoint { timestamp: string; value: number }
export interface History {
  deviceId: string;
  units: Partial<Record<SensorName, string>>;
  series: Partial<Record<SensorName, HistoryPoint[]>>; // ordem cronológica
  count: Partial<Record<SensorName, number>>;
}

export interface TriggerConfig { enabled: boolean; min: number; max: number; hysteresis: number }
export type Triggers = Record<SensorName, TriggerConfig>;

export interface Settings {
  displayName: string | null; location: string | null;
  latitude: number | null; longitude: number | null;
  autoAlertsEnabled: boolean;
}

export interface AlertEvent {
  id: string; sensor: SensorName;
  event: 'ALERT_ACTIVATED' | 'ALERT_CLEARED';
  reason: 'ABOVE_MAX' | 'BELOW_MIN' | 'BACK_TO_NORMAL' | 'TRIGGER_DISABLED';
  value: number | null; limits: { min: number; max: number }; command: string; timestamp: string;
}
export interface Alerts {
  deviceId: string;
  active: { sensor: SensorName; since: string; value: number | null; limits: { min: number; max: number } }[];
  history: AlertEvent[]; // mais recente primeiro
}

export interface CommandResult {
  deviceId: string; command: string; parameter: string; mqttMessage: string; sentAt: string;
  status: 'SENT_TO_FIWARE'; // o Orion aceitou; a entrega ao dispositivo não é confirmada
}

export interface CreateDeviceInput {
  deviceId?: string; displayName?: string; location?: string; latitude?: number; longitude?: number;
}

export interface ApiErrorBody { error: { code: string; message: string; details?: unknown } }
