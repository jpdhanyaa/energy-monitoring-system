/**
 * Hardware Bridge Service
 * Handles physical ESP32 connectivity to the web application:
 * 1. Web Serial API (Direct USB Cable connection to browser via COM port at 115200 baud)
 * 2. Network WebSocket / Socket.IO Bridge (Local WiFi or Backend server connection)
 * 3. Fallback to high-fidelity IoT simulation when hardware is disconnected
 */

import { iotSimulator } from './iotSimulator';

export type HardwareConnectionMode = 'simulated' | 'connecting' | 'usb_connected' | 'network_connected' | 'error';

export interface HardwareBridgeStatus {
  mode: HardwareConnectionMode;
  connected: boolean;
  portName?: string;
  networkEndpoint?: string;
  statusMessage: string;
  lastMessageTimestamp?: string;
  isWebSerialSupported: boolean;
}

class HardwareBridgeService {
  private status: HardwareBridgeStatus = {
    mode: 'simulated',
    connected: false,
    statusMessage: 'Using built-in simulation mode. Connect your physical ESP32 to receive live sensor data.',
    isWebSerialSupported: typeof navigator !== 'undefined' && 'serial' in navigator,
  };

  private listeners: Array<(st: HardwareBridgeStatus) => void> = [];

  // Serial Port References
  private serialPort: any = null;
  private serialReader: any = null;
  private serialWriter: any = null;
  private isReadingSerial = false;
  private serialLineBuffer = '';

  // Network WebSocket Reference
  private networkSocket: WebSocket | null = null;
  private pollInterval: number | null = null;

  constructor() {
    this.status.isWebSerialSupported = typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public subscribeStatus(cb: (st: HardwareBridgeStatus) => void): () => void {
    this.listeners.push(cb);
    cb({ ...this.status });
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  public getStatus(): HardwareBridgeStatus {
    return { ...this.status };
  }

  private updateStatus(newPartial: Partial<HardwareBridgeStatus>) {
    this.status = { ...this.status, ...newPartial };
    this.listeners.forEach((cb) => cb({ ...this.status }));
  }

  /**
   * Connect via Web Serial API (USB cable directly into computer's COM port)
   */
  public async connectUSB(): Promise<boolean> {
    if (!this.status.isWebSerialSupported) {
      this.updateStatus({
        mode: 'error',
        connected: false,
        statusMessage: 'Web Serial API is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Opera.',
      });
      return false;
    }

    try {
      this.updateStatus({
        mode: 'connecting',
        connected: false,
        statusMessage: 'Waiting for ESP32 COM port selection...',
      });

      // Request port selection from user
      const nav = navigator as any;
      const port = await nav.serial.requestPort();
      await port.open({ baudRate: 115200 });

      this.serialPort = port;
      this.isReadingSerial = true;

      // Identify port info if available
      const portInfo = port.getInfo ? port.getInfo() : {};
      const usbLabel = portInfo.usbVendorId
        ? `USB COM (VID:0x${portInfo.usbVendorId.toString(16)})`
        : 'ESP32 COM Port';

      this.updateStatus({
        mode: 'usb_connected',
        connected: true,
        portName: usbLabel,
        statusMessage: `Connected to ESP32 via ${usbLabel} at 115200 baud. Live telemetry streaming.`,
        lastMessageTimestamp: new Date().toLocaleTimeString(),
      });

      iotSimulator.setSimulatedMode(false);
      iotSimulator.setESP32Connected(true);

      // Start asynchronous read loop
      this.startSerialReadLoop();
      return true;
    } catch (err: any) {
      console.warn('[HardwareBridge] Serial connection cancelled or failed:', err);
      this.updateStatus({
        mode: 'simulated',
        connected: false,
        statusMessage: err?.message || 'USB Serial connection was not established.',
      });
      return false;
    }
  }

  private async startSerialReadLoop() {
    if (!this.serialPort || !this.serialPort.readable) return;

    try {
      const textDecoder = new TextDecoderStream();
      this.serialPort.readable.pipeTo(textDecoder.writable).catch(() => {});
      const reader = textDecoder.readable.getReader();
      this.serialReader = reader;

      while (this.isReadingSerial) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          this.handleSerialChunk(value);
        }
      }
    } catch (err: any) {
      console.error('[HardwareBridge] Serial read loop encountered error:', err);
      if (this.isReadingSerial) {
        this.disconnect();
      }
    }
  }

  private handleSerialChunk(chunk: string) {
    this.serialLineBuffer += chunk;
    const lines = this.serialLineBuffer.split('\n');
    // Keep incomplete trailing line in buffer
    this.serialLineBuffer = lines.pop() || '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      this.updateStatus({
        lastMessageTimestamp: new Date().toLocaleTimeString(),
      });

      // 1. Try to parse JSON telemetry line
      if (line.startsWith('{') && line.endsWith('}')) {
        try {
          const parsed = JSON.parse(line);
          this.processHardwareJson(parsed);
          continue;
        } catch {
          // Non-JSON or malformed line, fall through to text log check
        }
      }

      // 2. Parse text logs from Arduino Serial prints (e.g. "Motion Detected - Light ON" and "No Motion for 20 seconds - Light OFF")
      const lower = line.toLowerCase();
      if (
        lower.includes('motion detected') ||
        lower.includes('light on') ||
        lower.includes('[automation]')
      ) {
        // Motion detected: light is on alone!
        iotSimulator.ingestPhysicalTelemetry({
          motionDetected: true,
          lightOn: true,
          fanOn: false,
          fanSpeedPercent: 0,
        });
      } else if (
        lower.includes('no motion') ||
        lower.includes('light off') ||
        lower.includes('inactivity timeout')
      ) {
        iotSimulator.ingestPhysicalTelemetry({
          motionDetected: false,
          lightOn: false,
          fanOn: false,
          fanSpeedPercent: 0,
        });
      } else if (lower.includes('relay') && lower.includes('on')) {
        iotSimulator.ingestPhysicalTelemetry({ lightOn: true });
      } else if (lower.includes('relay') && lower.includes('off')) {
        iotSimulator.ingestPhysicalTelemetry({ lightOn: false });
      }
    }
  }

  private processHardwareJson(data: any) {
    // Normalizes hardware packet
    const isMotion = Boolean(
      data.motionDetected === true ||
      data.motionDetected === 1 ||
      data.motion === true ||
      data.motion === 1 ||
      data.pir === 1
    );

    // Light state
    const isLightOn = Boolean(
      data.lightOn === true ||
      data.lightOn === 1 ||
      data.relay === 1 ||
      data.relayLight === 1
    );

    // Fan is kept as adjusting feature alone:
    const fanSpeed = typeof data.fanSpeedPercent === 'number' ? data.fanSpeedPercent : 0;
    const isFanOn = typeof data.fanOn === 'boolean' ? data.fanOn : false;

    iotSimulator.ingestPhysicalTelemetry({
      deviceId: data.deviceId || 'esp32-physical-hardware',
      currentA: typeof data.currentA === 'number' ? data.currentA : (isLightOn ? 0.22 : 0.045),
      voltageV: typeof data.voltageV === 'number' ? data.voltageV : 5.0,
      powerW: typeof data.powerW === 'number' ? data.powerW : (isLightOn ? 1.10 : 0.225),
      energyKWh: typeof data.energyKWh === 'number' ? data.energyKWh : undefined,
      motionDetected: isMotion,
      ambientLight: typeof data.ambientLight === 'number' ? data.ambientLight : 280,
      lightOn: isLightOn,
      fanOn: isFanOn,
      fanSpeedPercent: fanSpeed,
      rssi: typeof data.rssi === 'number' ? data.rssi : -54,
    });
  }

  /**
   * Connect via Network (ESP32 IP or Local Server)
   */
  public async connectNetwork(url: string): Promise<boolean> {
    const trimmed = url.trim();
    if (!trimmed) return false;

    this.disconnect();

    this.updateStatus({
      mode: 'connecting',
      connected: false,
      networkEndpoint: trimmed,
      statusMessage: `Connecting to ${trimmed}...`,
    });

    try {
      if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
        const ws = new WebSocket(trimmed);
        this.networkSocket = ws;

        ws.onopen = () => {
          this.updateStatus({
            mode: 'network_connected',
            connected: true,
            networkEndpoint: trimmed,
            statusMessage: `Connected to ESP32 WebSocket at ${trimmed}`,
            lastMessageTimestamp: new Date().toLocaleTimeString(),
          });
          iotSimulator.setSimulatedMode(false);
          iotSimulator.setESP32Connected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.processHardwareJson(data);
            this.updateStatus({ lastMessageTimestamp: new Date().toLocaleTimeString() });
          } catch {
            // Ignore non-json
          }
        };

        ws.onerror = (err) => {
          console.warn('[HardwareBridge] WebSocket error:', err);
          this.updateStatus({
            mode: 'error',
            connected: false,
            statusMessage: `Failed to connect to ${trimmed}. Check IP address and network.`,
          });
        };

        ws.onclose = () => {
          if (this.status.mode === 'network_connected') {
            this.disconnect();
          }
        };

        return true;
      } else {
        // HTTP REST Polling endpoint (e.g. http://192.168.1.50/telemetry or http://localhost:5000/api/telemetry)
        const checkRes = await fetch(trimmed, { method: 'GET' });
        if (checkRes.ok) {
          this.updateStatus({
            mode: 'network_connected',
            connected: true,
            networkEndpoint: trimmed,
            statusMessage: `Connected to ESP32 HTTP endpoint at ${trimmed}`,
            lastMessageTimestamp: new Date().toLocaleTimeString(),
          });
          iotSimulator.setSimulatedMode(false);
          iotSimulator.setESP32Connected(true);

          // Start polling every 1.5s
          this.pollInterval = window.setInterval(async () => {
            try {
              const res = await fetch(trimmed);
              if (res.ok) {
                const json = await res.json();
                this.processHardwareJson(json);
                this.updateStatus({ lastMessageTimestamp: new Date().toLocaleTimeString() });
              }
            } catch {
              // Ignore transient poll drops
            }
          }, 1500);

          return true;
        } else {
          throw new Error(`HTTP error ${checkRes.status}: ${checkRes.statusText}`);
        }
      }
    } catch (err: any) {
      this.updateStatus({
        mode: 'error',
        connected: false,
        statusMessage: `Could not connect to ${trimmed}: ${err?.message || 'Check connection'}`,
      });
      return false;
    }
  }

  /**
   * Send command directly to physical hardware (over USB Serial or Network)
   */
  public async sendHardwareCommand(action: string, value: any): Promise<boolean> {
    const payload = JSON.stringify({ action, value }) + '\n';

    // 1. If USB Serial is connected, write to physical ESP32
    if (this.status.mode === 'usb_connected' && this.serialPort && this.serialPort.writable) {
      try {
        const textEncoder = new TextEncoder();
        const writer = this.serialPort.writable.getWriter();
        await writer.write(textEncoder.encode(payload));
        writer.releaseLock();
        return true;
      } catch (err) {
        console.error('[HardwareBridge] Failed to write command to USB Serial:', err);
      }
    }

    // 2. If Network WebSocket is connected
    if (this.status.mode === 'network_connected' && this.networkSocket && this.networkSocket.readyState === WebSocket.OPEN) {
      try {
        this.networkSocket.send(payload);
        return true;
      } catch (err) {
        console.error('[HardwareBridge] Failed to write command to WebSocket:', err);
      }
    }

    return false;
  }

  /**
   * Disconnect and revert to simulation mode
   */
  public async disconnect(): Promise<void> {
    this.isReadingSerial = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.networkSocket) {
      try {
        this.networkSocket.close();
      } catch {}
      this.networkSocket = null;
    }

    if (this.serialReader) {
      try {
        await this.serialReader.cancel();
      } catch {}
      this.serialReader = null;
    }

    if (this.serialPort) {
      try {
        await this.serialPort.close();
      } catch {}
      this.serialPort = null;
    }

    this.updateStatus({
      mode: 'simulated',
      connected: false,
      portName: undefined,
      networkEndpoint: undefined,
      statusMessage: 'Using built-in simulation mode. Physical hardware disconnected.',
    });

    iotSimulator.setSimulatedMode(true);
    iotSimulator.setESP32Connected(true);
  }
}

export const hardwareBridge = new HardwareBridgeService();
