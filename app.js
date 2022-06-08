const express = require('express')
const app = express()
const PORT = 8080
const SERIAL_PATH = "COM4"
const BAUDRATE = 9600
const path = require('path') 
const nodemailer = require("nodemailer");
const exphbs = require('express-handlebars')
const PIN_TEMP = "A2"
const PIN_VIENTO = "A1"
const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://luciocallegare:GdeYsxhi8awC0UZ8@cluster0.7ggn1.mongodb.net/?retryWrites=true&w=majority";


const client = new MongoClient(uri);

var five = require("johnny-five");
const res = require('express/lib/response')
var board = new five.Board();


const bodyParser = require('body-parser')


const urlencodedParser = bodyParser.urlencoded({encoded: false})
const jsonParser = bodyParser.json()

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
let usuario
let valido = true

const config = {
    cantSensores:3,
    tiempoMuestrasMin:60,
    alarmaTempMax:40,
    alarmaTempMin:0,

}

const mailer = async () =>{

    const testAccount = await nodemailer.createTestAccount();

    const transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: testAccount.user, // generated ethereal user
          pass: testAccount.pass, // generated ethereal password
        },
      });

    // send mail with defined transport object

    try {
        await transporter.sendMail({
            from: '"Fred Foo 👻" <luciocallegare@gmail.com>', // sender address
            to: "luciocallegare@gmail.com", // list of receivers
            subject: "Hello ✔", // Subject line
            text: "Hello world?", // plain text body
            html: "<b>Hello world?</b>", // html body
        });
        

    }catch (err){
        throw err
    }

}
//GdeYsxhi8awC0UZ8
board.on("ready", async function() {
  try {
      await client.connect()
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
  }catch (err){
      console.error(err)
  }
  
});



app.listen(PORT, ()=>{ 
    console.log('Listening at port',PORT)
})  

app.get('/gauges-ejemplos', (req,res)=>{
    res.sendFile(path.join(__dirname,'index.html'))
})

app.get('/', (req, res, next) =>{
    res.redirect('/login')
})

app.get('/login', (req,res)=>{
    let params
    if (!valido && !usuario){
        params = {
            error : "error"
        }
    }
    res.render('login',params)
})

app.get('/datos',(req,res)=>{
    let data = {
        'temperatura':tempAct, 
        'viento':vientoAct
    }
    res.send(data) 
})   

app.get('/style.css',(req,res)=>{
    res.sendFile(path.join(__dirname,'views/style.css'))
} )

app.get('/fondo-login', (req,res)=>{
    res.sendFile(path.join(__dirname,'views/public/fondo_login.jpg'))
})

app.get('/enviar-mail', async (req,res)=>{ 
    try {
        await mailer()
        res.send('mail enviado')
    } catch (err){
        console.log(err)
        res.send(err)
    }
})

app.post('/home', urlencodedParser, async (req,res)=>{

    let data = {
        'temperatura':tempAct, 
        'viento':vientoAct
    }

    const usersCollection = client.db('estacionMetereologica').collection('users')

    usuario = await usersCollection.findOne(req.body)

    if (usuario){
        res.render('index',data)
    }else {
        valido = false
        res.redirect('login')
    }
})

app.get('/configuracion', async(req,res)=>{

    if (!usuario){
        res.redirect('/login')
    }

    if (usuario.tipo == 'admin'){
        res.send('Usar render configuracion de administrador')
    }

    if (usuario.tipo == 'user'){
        res.send('Usar render configuracion de usuario')
    }
})