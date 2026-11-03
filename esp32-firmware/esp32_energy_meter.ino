/**
 * ============================================================================
 * AI Smart Energy Management System - ESP32 Firmware
 * 
 * ZERO EXTERNAL LIBRARY DEPENDENCIES VERSION:
 * - Requires ONLY <WiFi.h> (comes pre-installed with the ESP32 board in Arduino IDE).
 * - NO "PubSubClient" library required (Built-in lightweight MQTT 3.1.1 engine).
 * - NO "ArduinoJson" library required (Built-in fast C snprintf / JSON parser).
 * - Works immediately on all Arduino IDE versions (1.8.x & 2.x) and ESP32 Cores (v2.x & v3.x).
 * 
 * Hardware Connections:
 * - ACS712 Current Sensor: GPIO 35 (via 2:1 resistor divider to protect 3.3V pin)
 * - LDR Light Sensor: GPIO 34 (with 10k pull-down)
 * - HC-SR501 PIR Motion: GPIO 13 (Digital IN)
 * - 5V Relay (Light Control): GPIO 26 (Active-LOW standard)
 * - Fan Speed PWM (Transistor/MOSFET): GPIO 27 (Hardware PWM)
 * - Active Buzzer: GPIO 25
 * - Status LEDs: Red GPIO 32, Green GPIO 33
 * ============================================================================
 */

#include <WiFi.h>
#include <WiFiClient.h>

// ----------------------------------------------------------------------------
// 1. PIN CONFIGURATION
// ----------------------------------------------------------------------------
#define PIN_PIR_MOTION        13    // HC-SR501 PIR Motion Sensor
#define PIN_LDR_ADC           34    // LDR Light Sensor (ADC1_CH6)
#define PIN_ACS712_ADC        35    // ACS712 Current Sensor (ADC1_CH7)
#define PIN_RELAY_LIGHT       26    // Relay Channel for Light Bulb
#define PIN_FAN_PWM           27    // BC547 Transistor / MOSFET for Fan PWM
#define PIN_BUZZER            25    // 5V Active Alert Buzzer
#define PIN_LED_RED           32    // System Warning / Booting / Disconnected LED
#define PIN_LED_GREEN         33    // WiFi & MQTT Connected LED

// Set to 'true' for standard active-low relay (LOW = ON, HIGH = OFF)
#define RELAY_ACTIVE_LOW      true

// ----------------------------------------------------------------------------
// 2. PWM (LEDC) FAN CONFIGURATION
// ----------------------------------------------------------------------------
#define PWM_CHANNEL           0
#define PWM_FREQ_HZ           5000  // 5 kHz silent frequency
#define PWM_RESOLUTION_BITS   8     // 8-bit resolution (0 - 255)

// ----------------------------------------------------------------------------
// 3. SENSOR & ENERGY CALIBRATION
// ----------------------------------------------------------------------------
#define ACS_SENSITIVITY_MV_PER_A  185.0f // 185 mV/A for ACS712-05B
#define SYSTEM_VOLTAGE_V          230.0f // Set to 230.0 for AC mains, or 5.0 for DC demo
#define MEASURE_AC_RMS            true   // True RMS algorithm for AC household loads
#define ADC_REF_MV                3300.0f
#define ADC_MAX_COUNTS            4095.0f
#define VOLTAGE_DIVIDER_RATIO     0.660f // 2k/1k resistor divider on ACS712 output
#define CURRENT_NOISE_FLOOR_A     0.035f // Suppress noise readings below 35mA

// ----------------------------------------------------------------------------
// 4. NETWORK & MQTT BROKER CONFIGURATION
// ----------------------------------------------------------------------------
// UPDATE WITH YOUR WI-FI CREDENTIALS:
const char* WIFI_SSID         = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD     = "YOUR_WIFI_PASSWORD";

// Local IP of your PC / Server running Mosquitto (or public broker)
const char* MQTT_BROKER       = "192.168.1.100";
const int   MQTT_PORT         = 1883;
const char* MQTT_USER         = "energy_client";
const char* MQTT_PASS         = "energy_secret_pass";

const char* DEVICE_ID         = "esp32-energy-devkit-01";

// Topics
const char* TOPIC_TELEMETRY   = "energy/esp32-energy-devkit-01/telemetry";
const char* TOPIC_STATE       = "energy/esp32-energy-devkit-01/state";
const char* TOPIC_COMMANDS    = "energy/esp32-energy-devkit-01/commands";
const char* TOPIC_ACK         = "energy/esp32-energy-devkit-01/ack";
const char* TOPIC_STATUS      = "energy/esp32-energy-devkit-01/status";

// ----------------------------------------------------------------------------
// 5. GLOBAL STATE
// ----------------------------------------------------------------------------
WiFiClient netClient;

bool lightOn = false;
bool fanOn = false;
int  fanSpeedPercent = 0; // 0 to 100%
char lightMode[16] = "auto"; // "auto" or "manual"

// Smart Automation Parameters
int  ambientLightThreshold = 350;        // LDR count below this = dark
unsigned long inactivityTimeoutMs = 45000; // 45 seconds timeout
unsigned long lastMotionTimestamp = 0;
bool motionState = false;

// Calibration & Energy Integration
float zeroCurrentAdcOffset = 2048.0f;
double cumulativeEnergyKWh = 0.0;
unsigned long lastTelemetryMillis = 0;
const unsigned long TELEMETRY_INTERVAL_MS = 1500;

unsigned long lastMqttPingMillis = 0;
unsigned long lastReconnectAttempt = 0;
bool mqttConnected = false;

// Forward declarations
void handleIncomingCommand(const char* payload);
void publishConfirmedState();
void sendAck(const char* commandId, const char* action, const char* status, const char* message);

// ----------------------------------------------------------------------------
// 6. HARDWARE CONTROL (RELAY & PWM)
// ----------------------------------------------------------------------------

void writeRelay(bool on) {
  if (RELAY_ACTIVE_LOW) {
    digitalWrite(PIN_RELAY_LIGHT, on ? LOW : HIGH);
  } else {
    digitalWrite(PIN_RELAY_LIGHT, on ? HIGH : LOW);
  }
}

void writeFanPWM(int dutyCycle) {
  dutyCycle = constrain(dutyCycle, 0, 255);
#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
  ledcWrite(PIN_FAN_PWM, dutyCycle);
#else
  ledcWrite(PWM_CHANNEL, dutyCycle);
#endif
}

void initPWM() {
#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
  ledcAttach(PIN_FAN_PWM, PWM_FREQ_HZ, PWM_RESOLUTION_BITS);
#else
  ledcSetup(PWM_CHANNEL, PWM_FREQ_HZ, PWM_RESOLUTION_BITS);
  ledcAttachPin(PIN_FAN_PWM, PWM_CHANNEL);
#endif
  writeFanPWM(0);
}

void setLightState(bool on) {
  lightOn = on;
  writeRelay(on);
  Serial.printf("[Relay] Light switched %s\n", on ? "ON" : "OFF");
}

void setFanSpeed(int percent) {
  fanSpeedPercent = constrain(percent, 0, 100);
  fanOn = (fanSpeedPercent > 0);

  int dutyCycle = 0;
  if (fanSpeedPercent > 0) {
    dutyCycle = map(fanSpeedPercent, 1, 100, 64, 255); // Minimum starting duty
  }
  writeFanPWM(dutyCycle);
  Serial.printf("[Fan] Speed %d%% -> PWM %d/255\n", fanSpeedPercent, dutyCycle);
}

// ----------------------------------------------------------------------------
// 7. CURRENT SENSING & TRUE RMS
// ----------------------------------------------------------------------------

void calibrateACS712() {
  Serial.println("[ACS712] Calibrating zero-point. Ensure NO electrical load is active...");
  digitalWrite(PIN_LED_RED, HIGH);
  
  long sumAdc = 0;
  const int samples = 400;
  for (int i = 0; i < samples; i++) {
    sumAdc += analogRead(PIN_ACS712_ADC);
    delayMicroseconds(250);
  }
  
  zeroCurrentAdcOffset = (float)sumAdc / (float)samples;
  Serial.printf("[ACS712] Calibrated Offset: %.1f ADC counts\n", zeroCurrentAdcOffset);
  digitalWrite(PIN_LED_RED, LOW);
}

float readCurrentAmperes() {
  if (MEASURE_AC_RMS) {
    // 100ms True RMS integration window (5 full 50Hz mains cycles)
    unsigned long startMs = millis();
    unsigned long count = 0;
    double sumSquaredMv = 0.0;

    while (millis() - startMs < 100) {
      int rawAdc = analogRead(PIN_ACS712_ADC);
      float deltaAdc = (float)rawAdc - zeroCurrentAdcOffset;
      float pinMv = (deltaAdc / ADC_MAX_COUNTS) * ADC_REF_MV;
      float sensorMv = pinMv / VOLTAGE_DIVIDER_RATIO;

      sumSquaredMv += (sensorMv * sensorMv);
      count++;
      delayMicroseconds(150);
    }

    if (count == 0) return 0.0f;

    double vRmsMv = sqrt(sumSquaredMv / count);
    float currentArms = (float)(vRmsMv / ACS_SENSITIVITY_MV_PER_A);

    if (currentArms < CURRENT_NOISE_FLOOR_A) {
      currentArms = 0.0f;
    }
    return currentArms;
  } else {
    // DC measurement
    long sumAdc = 0;
    for (int i = 0; i < 80; i++) {
      sumAdc += analogRead(PIN_ACS712_ADC);
      delayMicroseconds(100);
    }
    float deltaAdc = ((float)sumAdc / 80.0f) - zeroCurrentAdcOffset;
    float pinMv = (deltaAdc / ADC_MAX_COUNTS) * ADC_REF_MV;
    float sensorMv = pinMv / VOLTAGE_DIVIDER_RATIO;
    float currentAmps = fabs(sensorMv / ACS_SENSITIVITY_MV_PER_A);

    if (currentAmps < CURRENT_NOISE_FLOOR_A) {
      currentAmps = 0.0f;
    }
    return currentAmps;
  }
}

// ----------------------------------------------------------------------------
// 8. BUILT-IN LIGHTWEIGHT MQTT 3.1.1 PROTOCOL ENGINE (NO EXTERNAL LIBRARY)
// ----------------------------------------------------------------------------

void writeRemainingLength(uint32_t length) {
  do {
    uint8_t byte = length % 128;
    length /= 128;
    if (length > 0) byte |= 128;
    netClient.write(byte);
  } while (length > 0);
}

bool mqttPublish(const char* topic, const char* payload, bool retain = false) {
  if (!netClient.connected()) return false;

  uint16_t topicLen = strlen(topic);
  uint32_t payloadLen = strlen(payload);
  uint32_t remainingLength = 2 + topicLen + payloadLen;

  // Fixed Header: 0x30 for PUBLISH (QoS 0)
  uint8_t header = 0x30;
  if (retain) header |= 0x01;
  netClient.write(header);

  writeRemainingLength(remainingLength);

  // Variable Header: Topic String
  netClient.write((uint8_t)(topicLen >> 8));
  netClient.write((uint8_t)(topicLen & 0xFF));
  netClient.write((const uint8_t*)topic, topicLen);

  // Payload
  netClient.write((const uint8_t*)payload, payloadLen);
  netClient.flush();
  return true;
}

bool mqttSubscribe(const char* topic) {
  if (!netClient.connected()) return false;

  uint16_t topicLen = strlen(topic);
  uint32_t remainingLength = 2 + 2 + topicLen + 1; // PacketID(2) + TopicLen(2) + Topic + QoS(1)

  netClient.write((uint8_t)0x82); // SUBSCRIBE packet
  writeRemainingLength(remainingLength);

  // Packet Identifier: 0x0001
  netClient.write((uint8_t)0x00);
  netClient.write((uint8_t)0x01);

  // Topic
  netClient.write((uint8_t)(topicLen >> 8));
  netClient.write((uint8_t)(topicLen & 0xFF));
  netClient.write((const uint8_t*)topic, topicLen);

  // Requested QoS: 0
  netClient.write((uint8_t)0x00);
  netClient.flush();
  return true;
}

void mqttSendPing() {
  if (!netClient.connected()) return;
  uint8_t ping[2] = { 0xC0, 0x00 };
  netClient.write(ping, 2);
  netClient.flush();
}

bool connectToMqttBroker() {
  if (WiFi.status() != WL_CONNECTED) return false;

  Serial.printf("[MQTT] Connecting to broker %s:%d... ", MQTT_BROKER, MQTT_PORT);
  if (!netClient.connect(MQTT_BROKER, MQTT_PORT, 4000)) {
    Serial.println("Connection Failed.");
    return false;
  }

  // Build MQTT 3.1.1 CONNECT packet
  uint16_t clientIdLen = strlen(DEVICE_ID);
  uint16_t userLen = strlen(MQTT_USER);
  uint16_t passLen = strlen(MQTT_PASS);

  bool hasAuth = (userLen > 0);
  uint8_t connectFlags = 0x02; // Clean Session
  if (hasAuth) connectFlags |= 0xC0; // Username & Password flags

  // Remaining Length:
  // Variable Header: 10 bytes (Protocol Name(6) + Level(1) + Flags(1) + KeepAlive(2))
  // Payload: ClientID(2 + len) + User(2 + len) + Pass(2 + len)
  uint32_t remainingLength = 10 + (2 + clientIdLen);
  if (hasAuth) {
    remainingLength += (2 + userLen) + (2 + passLen);
  }

  netClient.write((uint8_t)0x10); // CONNECT packet
  writeRemainingLength(remainingLength);

  // Variable Header
  uint8_t varHeader[] = {
    0x00, 0x04, 'M', 'Q', 'T', 'T', // Protocol Name
    0x04,                           // Protocol Level (MQTT 3.1.1)
    connectFlags,                   // Connect Flags
    0x00, 0x3C                      // Keep Alive (60s)
  };
  netClient.write(varHeader, sizeof(varHeader));

  // Client Identifier
  netClient.write((uint8_t)(clientIdLen >> 8));
  netClient.write((uint8_t)(clientIdLen & 0xFF));
  netClient.write((const uint8_t*)DEVICE_ID, clientIdLen);

  // User and Password
  if (hasAuth) {
    netClient.write((uint8_t)(userLen >> 8));
    netClient.write((uint8_t)(userLen & 0xFF));
    netClient.write((const uint8_t*)MQTT_USER, userLen);

    netClient.write((uint8_t)(passLen >> 8));
    netClient.write((uint8_t)(passLen & 0xFF));
    netClient.write((const uint8_t*)MQTT_PASS, passLen);
  }
  netClient.flush();

  // Wait for CONNACK response (0x20, 0x02, ackFlags, returnCode)
  unsigned long startWait = millis();
  while (netClient.available() < 4 && millis() - startWait < 3000) {
    delay(10);
  }

  if (netClient.available() >= 4) {
    uint8_t resp[4];
    netClient.read(resp, 4);
    if (resp[0] == 0x20 && resp[3] == 0x00) {
      Serial.println("CONNECTED!");
      mqttConnected = true;
      digitalWrite(PIN_LED_GREEN, HIGH);
      digitalWrite(PIN_LED_RED, LOW);

      // Announce Online Status
      char statusBuf[128];
      snprintf(statusBuf, sizeof(statusBuf),
        "{\"deviceId\":\"%s\",\"status\":\"online\",\"ip\":\"%s\"}",
        DEVICE_ID, WiFi.localIP().toString().c_str()
      );
      mqttPublish(TOPIC_STATUS, statusBuf, true);

      // Subscribe to backend command stream
      mqttSubscribe(TOPIC_COMMANDS);
      publishConfirmedState();
      return true;
    }
  }

  Serial.println("Rejected by broker.");
  netClient.stop();
  mqttConnected = false;
  return false;
}

// Read incoming packets from broker
void processIncomingMqtt() {
  if (!netClient.connected()) {
    mqttConnected = false;
    return;
  }

  while (netClient.available() > 0) {
    uint8_t header = netClient.read();
    uint8_t packetType = header >> 4;

    // Remaining Length decoding
    uint32_t remainingLength = 0;
    uint32_t multiplier = 1;
    uint8_t digit;
    do {
      digit = netClient.read();
      remainingLength += (digit & 127) * multiplier;
      multiplier *= 128;
    } while ((digit & 128) != 0);

    if (packetType == 3) { // PUBLISH
      // Read Topic Length
      uint8_t tLenH = netClient.read();
      uint8_t tLenL = netClient.read();
      uint16_t topicLen = (tLenH << 8) | tLenL;

      char topicBuf[64] = "";
      for (uint16_t i = 0; i < topicLen; i++) {
        char c = (char)netClient.read();
        if (i < sizeof(topicBuf) - 1) topicBuf[i] = c;
      }

      // Read Payload
      int payloadLen = remainingLength - 2 - topicLen;
      char payloadBuf[384] = "";
      for (int i = 0; i < payloadLen; i++) {
        char c = (char)netClient.read();
        if (i < sizeof(payloadBuf) - 1) payloadBuf[i] = c;
      }
      payloadBuf[sizeof(payloadBuf) - 1] = '\0';

      Serial.printf("[MQTT RX] Topic: %s | Payload: %s\n", topicBuf, payloadBuf);
      handleIncomingCommand(payloadBuf);
    } else {
      // Discard remaining bytes of non-publish packets (e.g. SUBACK, PINGRESP)
      for (uint32_t i = 0; i < remainingLength; i++) {
        netClient.read();
      }
    }
  }
}

// ----------------------------------------------------------------------------
// 9. BUILT-IN JSON PARSER & TELEMETRY GENERATOR (NO ARDUINOJSON REQUIRED)
// ----------------------------------------------------------------------------

void sendAck(const char* commandId, const char* action, const char* status, const char* message) {
  char buf[256];
  snprintf(buf, sizeof(buf),
    "{\"commandId\":\"%s\",\"deviceId\":\"%s\",\"action\":\"%s\",\"status\":\"%s\",\"message\":\"%s\",\"timestamp\":%lu}",
    commandId, DEVICE_ID, action, status, message, millis()
  );
  mqttPublish(TOPIC_ACK, buf);
}

void publishConfirmedState() {
  char buf[256];
  snprintf(buf, sizeof(buf),
    "{\"deviceId\":\"%s\",\"lightOn\":%s,\"fanOn\":%s,\"fanSpeedPercent\":%d,\"lightMode\":\"%s\",\"timestamp\":%lu}",
    DEVICE_ID,
    lightOn ? "true" : "false",
    fanOn ? "true" : "false",
    fanSpeedPercent,
    lightMode,
    millis()
  );
  mqttPublish(TOPIC_STATE, buf, true);
}

void publishTelemetry() {
  float currentA = readCurrentAmperes();
  float powerW   = currentA * SYSTEM_VOLTAGE_V;

  // Integrate energy: E (kWh) = (Power * dt_hours) / 1000
  double dtHours = (TELEMETRY_INTERVAL_MS / 1000.0) / 3600.0;
  cumulativeEnergyKWh += (powerW * dtHours) / 1000.0;

  int ldrAdc = analogRead(PIN_LDR_ADC);

  char buf[512];
  snprintf(buf, sizeof(buf),
    "{\"deviceId\":\"%s\",\"timestamp\":%lu,\"currentA\":%.3f,\"voltageV\":%.1f,\"powerW\":%.2f,"
    "\"energyKWh\":%.5f,\"motionDetected\":%s,\"ambientLight\":%d,\"lightOn\":%s,\"fanOn\":%s,"
    "\"fanSpeedPercent\":%d,\"rssi\":%d}",
    DEVICE_ID, millis(), currentA, SYSTEM_VOLTAGE_V, powerW,
    cumulativeEnergyKWh, motionState ? "true" : "false", ldrAdc,
    lightOn ? "true" : "false", fanOn ? "true" : "false",
    fanSpeedPercent, WiFi.RSSI()
  );

  // Stream over USB Serial for direct browser connection (Web Serial API)
  Serial.println(buf);

  if (netClient.connected()) {
    mqttPublish(TOPIC_TELEMETRY, buf);
  }
}

// Extract string value between quotes after a key
bool extractString(const char* json, const char* key, char* dest, size_t maxLen) {
  char searchKey[48];
  snprintf(searchKey, sizeof(searchKey), "\"%s\":\"", key);
  const char* p = strstr(json, searchKey);
  if (!p) return false;
  p += strlen(searchKey);
  const char* end = strchr(p, '\"');
  if (!end) return false;
  size_t len = end - p;
  if (len >= maxLen) len = maxLen - 1;
  strncpy(dest, p, len);
  dest[len] = '\0';
  return true;
}

void handleIncomingCommand(const char* payload) {
  char commandId[48] = "unknown";
  char action[32] = "";

  extractString(payload, "commandId", commandId, sizeof(commandId));
  extractString(payload, "action", action, sizeof(action));

  Serial.printf("[Command] Action: %s (ID: %s)\n", action, commandId);

  if (strcmp(action, "SET_LIGHT") == 0) {
    bool req = (strstr(payload, "\"value\":true") != NULL);
    setLightState(req);
    sendAck(commandId, action, "SUCCESS", req ? "Light turned ON" : "Light turned OFF");
    publishConfirmedState();
  }
  else if (strcmp(action, "SET_FAN_STATE") == 0) {
    bool req = (strstr(payload, "\"value\":true") != NULL);
    if (req) {
      setFanSpeed(fanSpeedPercent > 0 ? fanSpeedPercent : 60);
    } else {
      setFanSpeed(0);
    }
    sendAck(commandId, action, "SUCCESS", req ? "Fan turned ON" : "Fan turned OFF");
    publishConfirmedState();
  }
  else if (strcmp(action, "SET_FAN_SPEED") == 0) {
    const char* pVal = strstr(payload, "\"value\":");
    int speed = 0;
    if (pVal) {
      speed = atoi(pVal + 8);
    }
    setFanSpeed(speed);
    sendAck(commandId, action, "SUCCESS", "Fan PWM speed updated");
    publishConfirmedState();
  }
  else if (strcmp(action, "SET_MODE") == 0) {
    if (strstr(payload, "manual") != NULL) {
      strcpy(lightMode, "manual");
    } else {
      strcpy(lightMode, "auto");
    }
    sendAck(commandId, action, "SUCCESS", "Operating mode updated");
    publishConfirmedState();
  }
  else if (strcmp(action, "CALIBRATE_ACS712") == 0) {
    calibrateACS712();
    sendAck(commandId, action, "SUCCESS", "ACS712 zero-current offset recalibrated");
  }
  else if (strcmp(action, "TRIGGER_BUZZER") == 0) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(250);
    digitalWrite(PIN_BUZZER, LOW);
    sendAck(commandId, action, "SUCCESS", "Buzzer alert pulsed");
  }
}

// ----------------------------------------------------------------------------
// 10. LOCAL SMART AUTOMATION
// ----------------------------------------------------------------------------

void checkLocalAutomation() {
  int pirVal = digitalRead(PIN_PIR_MOTION);

  if (pirVal == HIGH) {
    motionState = true;
    lastMotionTimestamp = millis();
  } else {
    motionState = false;
  }

  if (strcmp(lightMode, "auto") == 0) {
    // Turn light ON alone when motion is detected (fan is an adjusting feature alone, not used in hardware)
    if (motionState && !lightOn) {
      Serial.println("[Automation] Motion detected -> Light is ON alone");
      setLightState(true);
      publishConfirmedState();
    }
    // Turn light OFF if no motion for timeout period
    else if (!motionState && ((millis() - lastMotionTimestamp) > inactivityTimeoutMs) && lightOn) {
      Serial.println("[Automation] Inactivity timeout -> Light is OFF");
      setLightState(false);
      publishConfirmedState();
    }
  }
}

// ----------------------------------------------------------------------------
// 11. SETUP & MAIN LOOP
// ----------------------------------------------------------------------------

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=======================================================");
  Serial.println("  AI Smart Energy Management System - Zero-Lib ESP32  ");
  Serial.println("  Motion: Light ON alone | Fan: Adjusting Feature Alone");
  Serial.println("=======================================================");

  // Pin Configuration
  pinMode(PIN_PIR_MOTION, INPUT_PULLDOWN);
  pinMode(PIN_LDR_ADC, INPUT);
  pinMode(PIN_ACS712_ADC, INPUT);
  pinMode(PIN_RELAY_LIGHT, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);

  // Initial States: Light and Fan start OFF; Fan remains adjusting feature alone
  writeRelay(false);
  lightOn = false;
  fanOn = false;
  fanSpeedPercent = 0;
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_LED_RED, HIGH);
  digitalWrite(PIN_LED_GREEN, LOW);

  // ADC Configuration
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_ACS712_ADC, ADC_11db);
  analogSetPinAttenuation(PIN_LDR_ADC, ADC_11db);

  // Hardware PWM for Fan (Adjusting feature alone)
  initPWM();

  // Calibrate ACS712 zero offset
  calibrateACS712();

  // Connect to Wi-Fi
  Serial.printf("\n[WiFi] Connecting to %s ", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 25) {
    delay(400);
    Serial.print(".");
    tries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WiFi] Running USB Serial / Standalone local automation mode.");
  }

  // Attempt initial broker connection
  connectToMqttBroker();
}

void loop() {
  unsigned long now = millis();

  // 1. Process USB Serial commands directly from browser (Web Serial API)
  if (Serial.available()) {
    String serialLine = Serial.readStringUntil('\n');
    serialLine.trim();
    if (serialLine.length() > 0) {
      handleIncomingCommand(serialLine.c_str());
    }
  }

  // 2. Wi-Fi & MQTT reconnection logic
  if (WiFi.status() == WL_CONNECTED) {
    if (!netClient.connected()) {
      mqttConnected = false;
      digitalWrite(PIN_LED_GREEN, LOW);
      digitalWrite(PIN_LED_RED, HIGH);

      if (now - lastReconnectAttempt > 5000) {
        lastReconnectAttempt = now;
        connectToMqttBroker();
      }
    } else {
      // Process incoming MQTT commands
      processIncomingMqtt();

      // Send MQTT PINGREQ every 30 seconds
      if (now - lastMqttPingMillis > 30000) {
        lastMqttPingMillis = now;
        mqttSendPing();
      }
    }
  }

  // 3. Local Smart Automation (Motion detected -> Light is ON alone)
  checkLocalAutomation();

  // 4. Periodic Telemetry (Always streams over USB Serial + MQTT if connected)
  if (now - lastTelemetryMillis >= TELEMETRY_INTERVAL_MS) {
    publishTelemetry();
    lastTelemetryMillis = now;
  }

  delay(10);
}
