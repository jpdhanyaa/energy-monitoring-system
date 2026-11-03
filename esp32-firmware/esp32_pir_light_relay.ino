#define PIR_PIN 27
#define RELAY_PIN 26

unsigned long lastMotionTime = 0;
const unsigned long delayTime = 20000;

bool lightState = false;

void setup() {
  pinMode(PIR_PIN, INPUT);
  pinMode(RELAY_PIN, OUTPUT);

  digitalWrite(RELAY_PIN, HIGH); // Relay OFF

  Serial.begin(115200);
}

void loop() {

  int motion = digitalRead(PIR_PIN);

  if (motion == HIGH) {
    lastMotionTime = millis();

    if (!lightState) {
      digitalWrite(RELAY_PIN, LOW); // Relay ON
      lightState = true;
      Serial.println("Motion Detected - Light ON");
    }
  }

  if (lightState && millis() - lastMotionTime >= delayTime) {
    digitalWrite(RELAY_PIN, HIGH); // Relay OFF
    lightState = false;
    Serial.println("No Motion for 20 seconds - Light OFF");
  }
}
