int analogPin = 2;
int val = 0;

void setup() {
 Serial.begin(9600);
}

void loop() {
  val = analogRead(analogPin);
  Serial.print(map(val,0,1023,0,40));
  Serial.print(',');

}
