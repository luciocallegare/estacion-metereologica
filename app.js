const express = require('express')
const res = require('express/lib/response')
const app = express()
const {SerialPort} = require('serialport')
const PORT = 8080
const SERIAL_PATH = "COM4"
const BAUDRATE = 9600
const path = require('path') 
const exphbs = require('express-handlebars')

const mySerial = new SerialPort({path:SERIAL_PATH, baudRate: BAUDRATE })

app.set('views',path.join(__dirname, 'views'))
app.engine('.hbs', exphbs.engine({
    defaultLayout: 'main',
    layoutsDir: path.join(app.get('views'), 'layouts'),
    partialsDir: path.join(app.get('views'), 'partials'),
    extname: '.hbs'
}))

app.set('view engine', '.hbs')

let tempAct = 0

try{
    mySerial.on("open", function () {
        console.log('Puerto Serie Abierto');
        mySerial.on('data', (buffer) => {
            let tempBuff = buffer.toString()
            //console.log(tempBuff.split(","))
            tempAct = parseInt(tempBuff.split(",")[5])
            //console.log(buffer.toString());
        });
      });
}
catch (err){
    console.error("Error abriendo puerto serie, ",err) 
}

app.listen(PORT, ()=>{ 
    console.log('Listening at port',PORT)
})  

app.get('/', (req, res) =>{
    res.render('index',{temperatura: tempAct})
})

app.get('/datos',(req,res)=>{
    console.log("TEMPERATURA",tempAct) // BORRAR DESPUES 
    res.send({'temperatura':tempAct}) 
})   

app.get('/style.css',(req,res)=>{
    res.sendFile('./style.css')
} )