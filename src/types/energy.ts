/**
 * AI Smart Energy Management System - Core Types
 */

export interface TelemetryReading {
  deviceId: string;
  timestamp: string; // ISO-8601 UTC
  currentA: number; // Measured in Amperes (A)
  voltageV: number | null; // Null if no direct physical AC/DC voltage transformer sensor
  voltageEstimated: number; // Configured baseline for power calculation (e.g. 5.0V prototype or 230V mains)
  powerW: number; // Watts (W) = currentA * voltage
  isPowerEstimated: boolean; // Flag distinguishing actual measured vs calculated
  energyKWh: number; // Cumulative kilowatt-hours (integrated power over time)
  todayKWh: number; // Energy consumed since 00:00 UTC
  monthKWh: number; // Energy consumed this calendar month
  motionDetected: boolean; // HC-SR501 PIR sensor
  ambientLight: number; // LDR raw ADC reading (0 - 1023 or 0 - 4095)
  ambientLux: number; // Estimated illumination in Lux
  lightOn: boolean; // Relay state
  fanOn: boolean; // Fan power state
  fanSpeedPercent: number; // PWM duty cycle 0 - 100%
  deviceMode: 'simulated' | 'physical';
  rssi?: number; // WiFi signal strength in dBm
  uptimeSeconds?: number;
}

export interface ApplianceState {
  lightOn: boolean;
  fanOn: boolean;
  fanSpeedPercent: number; // 0 - 100%
  lightMode: 'manual' | 'auto';
  autoLightReason?: string;
  fanMode: 'manual' | 'auto';
  autoFanReason?: string;
  lastStateChange: string;
}

export type CommandAction =
  | 'SET_LIGHT'
  | 'SET_FAN_STATE'
  | 'SET_FAN_SPEED'
  | 'SET_MODE'
  | 'CALIBRATE_ACS712'
  | 'TRIGGER_BUZZER'
  | 'REBOOT_DEVICE';

export interface DeviceCommand {
  commandId: string;
  deviceId: string;
  action: CommandAction;
  value: boolean | number | string | Record<string, unknown>;
  timestamp: string;
  status: 'pending' | 'acknowledged' | 'timeout' | 'failed';
  responseTimeMs?: number;
  errorMessage?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditionType: 'motion_and_dark' | 'inactivity_timeout' | 'overcurrent_protection' | 'ambient_threshold';
  motionRequired?: boolean;
  lightThreshold?: number; // Trigger if ambientLight is below this (e.g. 350)
  inactivityTimeoutSec?: number; // Turn off if no motion for X seconds (e.g. 60)
  currentThresholdA?: number; // Overcurrent trip point (e.g. 2.0A)
  actionTarget: 'light' | 'fan' | 'buzzer';
  actionValue: boolean | number;
  lastTriggered?: string;
  triggerCount: number;
}

export interface TariffSlab {
  minUnits: number;
  maxUnits: number | null; // null represents infinity / above upper slab
  ratePerUnit: number; // INR (₹)
}

export interface TariffConfig {
  providerName: string;
  state: string;
  category: 'Domestic (Single Phase)' | 'Domestic (Three Phase)' | 'Commercial';
  isSlabBased: boolean;
  slabs: TariffSlab[];
  prototypeFlatRate: number; // Flat ₹/kWh for simple prototyping
  fixedChargesINR: number; // Monthly fixed meter charge
  electricityDutyPercent: number; // E.g. 5% or 9%
  fuelSurchargePerUnit: number; // E.g. ₹0.35/unit
}

export interface MLPrediction {
  currentMonthForecastKWh: number;
  remainingDaysForecastKWh: number;
  estimatedBillINR: number;
  lastMonthKWh: number;
  lastMonthBillINR: number;
  confidenceLowerKWh: number;
  confidenceUpperKWh: number;
  confidenceScorePercent: number;
  modelUsed: 'Random Forest Regressor' | 'Baseline Moving Average' | 'Ridge Regression';
  metrics: {
    mae: number;
    rmse: number;
    r2: number;
    sampleCount: number;
  };
  dataSource: 'simulated' | 'physical' | 'hybrid';
  generatedAt: string;
  featureImportance: Array<{ feature: string; importance: number }>;
}

export interface GPIOPinConfig {
  pirPin: number; // Default 13
  ldrPin: number; // Default 34 (ADC1_CH6)
  acs712Pin: number; // Default 35 (ADC1_CH7)
  relayLightPin: number; // Default 26
  fanPwmPin: number; // Default 27 (LEDC channel 0)
  buzzerPin: number; // Default 25
  redLedPin: number; // Default 32 (Status/Alert)
  greenLedPin: number; // Default 33 (WiFi/MQTT indicator)
  acsSensitivityMvPerA: number; // 185 for 5A module, 100 for 20A, 66 for 30A
  zeroCurrentAdcValue: number; // Approx 2048 (for 3.3V ADC with divider) or calibrated
  circuitOperatingVoltage: number; // 5.0 for low voltage prototype, 230 for AC mains
}

export interface MQTTConfig {
  brokerHost: string;
  brokerPort: number;
  clientId: string;
  username: string;
  password: string;
  keepAlive: number;
  useTls: boolean;
  baseTopic: string;
  isConnected: boolean;
  lastHeartbeat?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  avatarInitials: string;
  token?: string;
}

export interface MQTTLogMessage {
  id: string;
  timestamp: string;
  topic: string;
  type: 'telemetry' | 'state' | 'command' | 'ack' | 'status';
  payload: Record<string, unknown> | string;
  direction: 'inbound' | 'outbound';
}
