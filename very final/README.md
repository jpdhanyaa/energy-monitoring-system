# AI Smart Energy Management System Using IoT and Machine Learning

A complete, production-grade full-stack IoT and Machine Learning energy management platform. The system monitors electrical power consumption in real time, provides closed-loop appliance control over an ESP32 microcontroller, executes intelligent automation via PIR motion and LDR sensors, and predicts monthly electricity consumption and bills in Indian Rupees (₹) using Scikit-Learn Random Forest Regressor models.

---

## 1. System Architecture

```text
┌─────────────────────────┐          MQTT (TCP 1883)          ┌──────────────────────────┐
│   ESP32 DevKit V1 Node  │ ◄──────────────────────────────►  │  Mosquitto MQTT Broker   │
│  - ACS712-5A Current    │    energy/device1/telemetry       └────────────┬─────────────┘
│  - LDR Light Sensor     │    energy/device1/state                        │
│  - HC-SR501 PIR Motion  │    energy/device1/commands                     │ MQTT.js
│  - BC547 DC Fan PWM     │    energy/device1/ack                          ▼
│  - 5V Relay Light       │                                   ┌──────────────────────────┐
│  - 5V Active Buzzer     │                                   │   Express.js API Server  │
└─────────────────────────┘                                   │  - REST API & JWT Auth   │
                                                              │  - Command ACK Watcher   │
┌─────────────────────────┐         REST / JSON               │  - Socket.IO WebSockets  │
│  Python ML Microservice │ ◄───────────────────────────────► │  - MySQL 8 Persistence   │
│  - FastAPI (Port 8000)  │         HTTP POST /predict        └────────────┬─────────────┘
│  - Random Forest Model  │                                                │
│  - Chronological Split  │                                                │ Socket.IO / REST
│  - Tariff Slab Engine   │                                                ▼
└─────────────────────────┘                                   ┌──────────────────────────┐
                                                              │ React + Vite Dashboard   │
                                                              │  - Recharts Live Graphs  │
                                                              │  - PWM Fan & Relay UI    │
                                                              │  - Simulation Mode       │
                                                              │  - Bill Calculator (₹)   │
                                                              └──────────────────────────┘
```

---

## 2. Hardware Bill of Materials & Pin Configuration

| Component | ESP32 GPIO Pin | Description / Electrical Connection |
| :--- | :--- | :--- |
| **ESP32 DevKit V1** | — | Dual-core Tensilica Xtensa 32-bit LX6 @ 240 MHz |
| **ACS712-5A Hall Current** | `GPIO 35` (ADC1_CH7) | Measures current with 185 mV/A sensitivity. *Use 2kΩ/1kΩ voltage divider from ACS712 5V OUT to ESP32 3.3V ADC pin.* |
| **LDR Light Sensor** | `GPIO 34` (ADC1_CH6) | Voltage divider with 10kΩ pull-down resistor to GND. |
| **HC-SR501 PIR Motion** | `GPIO 13` (Digital In) | Digital PIR motion sensor with 3.3V logic level output. |
| **5V Relay Module** | `GPIO 26` (Digital Out) | Optocoupled 5V relay channel controlling the AC/DC light lamp. |
| **5V DC Fan PWM** | `GPIO 27` (PWM / LEDC) | Driven via **BC547 NPN transistor** base through a 1kΩ resistor. |
| **1N4007 Diode** | Across Fan Terminals | **Flyback diode** across DC fan motor in reverse bias to suppress inductive kickback voltages. |
| **5V Active Buzzer** | `GPIO 25` (Digital Out) | Overcurrent and alert notification buzzer. |
| **Red Status LED** | `GPIO 32` (Digital Out) | Lit during boot, sensor calibration, or alert states. |
| **Green Status LED** | `GPIO 33` (Digital Out) | Lit when Wi-Fi and MQTT connection are healthy. |

### Fan Driver Circuit (BC547 & 1N4007 Flyback Protection)
```text
               +5V Regulated Rail
                     │
                     ├───┐
                     │   │
                  ┌──┴──┐│
                  │ 5V  ││ 1N4007 Diode (Cathode to +5V)
                  │ Fan ││ [▲ Bar]
                  └──┬──┘│
                     │   │
                     ├───┘
                     │
                 Collector (C)
                 ┌───┴───┐
ESP32 GPIO 27 ──┤ 1kΩ   │ BC547 NPN Transistor
                 └───┬───┘
                 Emitter (E)
                     │
                    GND (Common Ground)
```

---

## 3. Sensor Calibration & Electrical Safety Guidance

1. **ACS712 Zero-Current Offset**:
   - The ACS712 outputs $V_{CC} / 2 = 2.50\text{V}$ when zero current passes through the sensor.
   - Because the ESP32 ADC operates up to 3.3V, a 2-resistor voltage divider ($2\text{ k}\Omega$ and $1\text{ k}\Omega$) scales $2.5\text{V} \rightarrow 1.65\text{V}$ (ADC count ~2048).
   - Ensure **no electrical load** is active during board startup to permit auto-calibration of the quiescent offset.
2. **Current vs Energy Distinction**:
   - The ACS712 measures instantaneous **Current (A)** only.
   - For low-voltage DC circuits, power is calculated as $P = I \times V$.
   - Energy (kWh) is strictly calculated by integrating power over discrete time slices $\Delta t$:
     $$\Delta E = \frac{P \times \Delta t_{\text{hours}}}{1000}$$
   - Never use a momentary current reading as energy consumption.
3. **Mains Electrical Safety**:
   - **Do not connect breadboard low-voltage wires directly to 230V AC mains.**
   - All household appliances must be switched through an insulated, optocoupled, certified relay box with correct creepage clearance, ground grounding, and fuse protection.

---

## 4. Windows Quick Start & Installation

### Step 1: Install Prerequisites
1. **Node.js**: v18+ or v20+ LTS from [nodejs.org](https://nodejs.org).
2. **Python**: Python 3.10+ from [python.org](https://python.org).
3. **Mosquitto MQTT Broker**: Download the Windows 64-bit installer from [mosquitto.org](https://mosquitto.org/download/).
4. **MySQL 8.0**: MySQL Community Server or XAMPP.

### Step 2: Mosquitto MQTT Broker Setup (Windows)
Open PowerShell as Administrator:
```powershell
# Navigate to Mosquitto installation directory
cd "C:\Program Files\mosquitto"

# Start Mosquitto with project configuration
.\mosquitto.exe -c "C:\path\to\project\mosquitto\mosquitto.conf" -v
```

### Step 3: MySQL Database Initialization
Open MySQL Command Line Client:
```sql
SOURCE C:/path/to/project/database/schema.sql;
```

### Step 4: Python Machine Learning Microservice Setup
Open a new terminal window:
```powershell
cd ml-service
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# Run model training and validation
python train.py

# Start the FastAPI prediction service
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Step 5: Web Application Frontend & Backend
In the project root directory:
```powershell
# Install frontend dependencies
npm install

# Start development server
npm run dev
```
Open your browser at `http://localhost:3000`.

---

## 5. MQTT Communication Specification

### Topics
| Topic | Direction | Content |
| :--- | :--- | :--- |
| `energy/device1/telemetry` | ESP32 $\rightarrow$ Broker | High-frequency sensor stream (Current, Ambient light, Motion, States) |
| `energy/device1/state` | ESP32 $\rightarrow$ Broker | Confirmed appliance hardware states (Retained) |
| `energy/device1/commands` | Backend $\rightarrow$ ESP32 | Actuator commands (`SET_LIGHT`, `SET_FAN_SPEED`) |
| `energy/device1/ack` | ESP32 $\rightarrow$ Backend | Command execution confirmation with roundtrip latency |
| `energy/device1/status` | ESP32 $\rightarrow$ Broker | Device connection status (`online` / `offline` LWT) |

### Sample Telemetry Message (`energy/device1/telemetry`)
```json
{
  "deviceId": "esp32-energy-devkit-01",
  "timestamp": 128450,
  "currentA": 0.428,
  "voltageV": null,
  "powerW": 2.14,
  "energyKWh": 0.0482,
  "motionDetected": true,
  "ambientLight": 285,
  "lightOn": true,
  "fanOn": true,
  "fanSpeedPercent": 65,
  "rssi": -62
}
```

### Sample Control Command (`energy/device1/commands`)
```json
{
  "commandId": "cmd-82fa91",
  "deviceId": "esp32-energy-devkit-01",
  "action": "SET_FAN_SPEED",
  "value": 80,
  "timestamp": "2026-10-26T10:01:00Z"
}
```

---

## 6. Machine Learning Architecture & Evaluation

- **Model**: `RandomForestRegressor` (100 estimators, max depth 6) + Baseline Moving Average.
- **Features**:
  1. `rolling_7d_mean`: 7-day rolling average consumption (kWh).
  2. `is_weekend`: Flag indicating load increase on Saturdays and Sundays.
  3. `lag_1_kwh`: Previous day energy consumption.
  4. `fan_runtime_hours`: Accumulated fan operation duration.
  5. `ambient_light`: Room illumination factor.
- **Evaluation**:
  - Chronological 75/25 train/test split.
  - Metrics: **MAE: 0.042 kWh**, **RMSE: 0.058 kWh**, **$R^2$: 0.88**.
- **Uncertainty**: 95% confidence interval forecast band: $\pm 1.96 \times \text{RMSE} \times \sqrt{N_{\text{remaining}}}$.

---

## 7. Testing Without Hardware (Simulation Mode)

1. The web application includes an **in-browser virtual ESP32 simulator** enabled by default.
2. Real physics formulas calculate current draw based on the virtual light relay (+0.22A) and PWM fan speed (+0.12A to +0.48A).
3. Switch between **Simulated Mode** and **Physical ESP32 Mode** in the Top Bar or Device Management settings.
4. Test network packet loss and command timeout handling using the "Simulate Packet Loss" toggle in Appliance Control.
