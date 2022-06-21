
#include <Ethernet.h>
#include <PubSubClient.h>


// Direccion MAC
byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED };

// IP del servidor
//IPAddress mqtt_server (5,196,95,208); // test.mosquito.org
IPAddress mqtt_server (192, 168, 0, 103);

// topicName es el Topic con el que trabajamos para publicar la informacion del canal
// analogico 2, que en este ejemplo, lo suponemos conectado a un sensor de temperatura 
const char* topicName = "temperatura";

// tema es el topic que usaremos para suscribir a un estado encendido/apagado de una 
// llave en la aplicacion Android IoT MQTT
const char* tema="estado";

// declaraciones de un objeto "ethClient" como cliente Ethernet para utilizar el shield Ethernet y  
// el objeto "client" sobre la conexion Ethernet como nodo publicador IoT
EthernetClient ethClient;
PubSubClient client(ethClient);

int analogPin = 2;
int val = 0;


void setup()
{
  // Configuracion del puerto serie para reportar sobre el monitor del IDE de Arduino
  // si se establecio la configuracion Ethernet 
  Serial.begin(9600);
  if (Ethernet.begin(mac) == 0) {
    Serial.println("Failed to configure Ethernet using DHCP");
     }

 // Configuracion de los pines de entrada y salida digital que se utilizaran    
   pinMode(2,INPUT);
    pinMode(3,INPUT);
    pinMode(6,OUTPUT);
    pinMode(9,OUTPUT);

 // Configuracion del servidor (MQTT Broker) y el evento callback como suscriptor    
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
  }

void callback(char* tema, byte* payload, unsigned int length) 
    {
 // como se espera informacion como texto ascii se comprueba la llegada del ascii del numero 0
 // o el numero 1, para apagar o encender el led en el pin 6, respectivamente      
     if (payload[0]==49)
              {
                digitalWrite(6,1);
              }
          else if (payload[0]==48){
                digitalWrite(6,0);
              }
              
if (payload[0]==50)
              {
                digitalWrite(9,1);
              }
          else if (payload[0]==51){
                digitalWrite(9,0);
              }
    }
void loop()
{
  if (!client.connected()) {
    Serial.print("Connecting ...\n");
    client.connect("Arduino Client");
    client.subscribe(tema);
  }
  else {
    // Envio de la informacion correspondiente a los topics: "temperatura", "humedad", "viento" 
    // correspondientes a las entradas analogicas 2,3 y 4 respectivamente
    val = analogRead(analogPin);
    Serial.print(map(val,0,1023,0,40));
    Serial.print(',');
  
    float temp = analogRead(2)/10;
    float humedad=analogRead(3)/10;
    float viento=analogRead(4)/10;
    char buffer[10];
    int estado;
    
    dtostrf(temp,0, 0, buffer);
    client.publish(topicName, buffer);
    dtostrf(humedad,0, 0, buffer); // va humedad en vez de V15
    client.publish("humedad", buffer); // va "humedad" en vez de V15
    dtostrf(viento,0, 0, buffer);
    client.publish("viento", buffer);
    
     // envio de los topics "luz1" y "luz2" con los estados ("0" o "1") de los pines digitales 2 y 3 
     // respectivamente
     boolean luz=digitalRead(2);
        if (luz==true)
                { estado=1;}
        else
                {
                 estado=0;
                }
    dtostrf(estado,0, 0, buffer);
    client.publish("luz1",buffer);
    
    // estado del pin 3
    luz=digitalRead(3);
        if (luz==true)
                { estado=1;}
        else
                {
                 estado=0;
                }
    dtostrf(estado,0, 0, buffer);
    client.publish("luz2",buffer);
   }
  // Tiempo entre envios (en ms)
  delay(500);
    client.loop();
}
