#include <stdio.h>
#include <stdlib.h>
#include "DHT.h"


/*
 * DECODIFICADOR:
 *    SETL(stateLed): Prender o apagar Led. 0 para apagar 1 para encender
 *    SETT(stateT): Prender o apagar sensor de temperatura
 *    SETH(stateH): Prender o apagar sensor de humedad
 *    SETV(stateV): Prender o apagar sensor de viento
 *    DHTT(stateDHT): Prender o apagar sensor de dht para temperatura
 *    DHTH(stateDHH):Prender o apagar sensor de dht para humedad
 */


String inputString = "";         // a string to hold incoming data
boolean stringComplete = false;  // whether the string is complete


int temp,hum,viento;

#define PINLED 13
#define PINTEMP 1
#define PINHUM 2
#define PINVIEN 3
#define DHTPIN 3
#define DHTTYPE DHT11

DHT dht(DHTPIN,DHTTYPE);

int ledState = LOW;

boolean dhtTemp = true,dhtHum = true,tempCon = false,humCon = false,vienCon =false;

void setup() {
    Serial.begin(9600);
    pinMode(PINLED,OUTPUT);
    pinMode(DHTPIN,INPUT_PULLUP);
    dht.begin();
}

void loop() {
  int temp,hum,viento;
  String res = "{";
  SerialEvent();
  if (stringComplete) 
    {
      decodificar_comandos();
      inputString = "";
      stringComplete = false;
    }
    if (tempCon){
        (dhtTemp)? temp = dht.readTemperature(): temp = analogRead(PINTEMP);
        String tempS = String(temp);
        res+="\"temperatura\":"+tempS+",";
    }
    if (humCon){
        (dhtHum)? hum = dht.readHumidity(): hum = analogRead(PINHUM);  
        String humS = String(hum);
        res+="\"humedad\":"+humS+",";
    }
    if (vienCon){
        viento  = analogRead(PINVIEN);
        String vienS = String(viento);
        res += "\"viento\":"+vienS+",";
    }
    res+="}";
    int iUltComa = res.lastIndexOf(',');
    if (iUltComa != -1){
         res[iUltComa]=' '; 
    }
    Serial.println(res);
    delay(100);
}


void decodificar_comandos()
{
  int led;
  int num_can,val1,inicio,final,n;
  char can, estado;
  char AI[0],DO[0],DI[1];
  //Cambiar para que no sea toggle sino que se le pase un parametro
  if (inputString.substring(0,4)=="SETL")
    {
      int stateLed =String(inputString.charAt(5)).toInt();
      digitalWrite(PINLED,stateLed);
    }
    else if (inputString.substring(0,4)=="SETT")
         {
            int stateT =String(inputString.charAt(5)).toInt();
            tempCon = stateT;
         }
      else if (inputString.substring(0,4)=="SETH")
            {
              int stateH =String(inputString.charAt(5)).toInt();
              humCon = stateH;
             }
           else if (inputString.substring(0,4)=="SETV")
                {
                  int stateV =String(inputString.charAt(5)).toInt();
                  vienCon = stateV;
                 }
              else if (inputString.substring(0,4)=="DHTT")
                    {
                      int stateDHT =String(inputString.charAt(5)).toInt();
                      dhtTemp = stateDHT;
                    }
                  else if (inputString.substring(0,4)=="DHTH")
                    {
                      int stateDHH =String(inputString.charAt(5)).toInt();
                      dhtHum = stateDHH;
                    }
}

void SerialEvent() 
    {
    while (Serial.available()) 
        {
    char inChar = (char)Serial.read(); 
    inputString += inChar;
    if (inChar == '\n') 
            {
             stringComplete = true;
            } 
        }
     }
