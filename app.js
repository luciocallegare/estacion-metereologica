const express = require('express')
const res = require('express/lib/response')
const app = express()
const PORT = 8080
const SERIAL_PATH = "COM4"
const BAUDRATE = 9600
const path = require('path') 
const exphbs = require('express-handlebars')
const PIN_TEMP = "A2"
const PIN_VIENTO = "A1"

var five = require("johnny-five");
var board = new five.Board();


app.set('views',path.join(__dirname, 'views'))
app.engine('.hbs', exphbs.engine({
    defaultLayout: 'main',
    layoutsDir: path.join(app.get('views'), 'layouts'),
    partialsDir: path.join(app.get('views'), 'partials'),
    extname: '.hbs'
}))

app.set('view engine', '.hbs')

let tempAct = 0
let vientoAct = 0
let data
board.on("ready", function() {
  var led = new five.Led(13);
  led.on()
  var sensorTemp = new five.Sensor(PIN_TEMP);
  var sensorViento = new five.Sensor(PIN_VIENTO)
  
  // Scale the sensor's data from 0-1023 to 0-10 and log changes
  sensorTemp.on("change", function() {
     tempAct = this.scaleTo(0, 40);
  });

  sensorViento.on('change', function() {
    vientoAct =  this.scaleTo(0,100)
  })
  
});



app.listen(PORT, ()=>{ 
    console.log('Listening at port',PORT)
})  

app.get('/gauges-ejemplos', (req,res)=>{
    res.sendFile(path.join(__dirname,'index.html'))
})

app.get('/', (req, res) =>{
    let data = {
        'temperatura':tempAct, 
        'viento':vientoAct
    }
    res.render('index',data)
})

app.get('/datos',(req,res)=>{
    let data = {
        'temperatura':tempAct, 
        'viento':vientoAct
    }
    console.log(data) // BORRAR DESPUES 
    res.send(data) 
})   

app.get('/style.css',(req,res)=>{
    res.sendFile(path.join(__dirname,'views/style.css'))
} )