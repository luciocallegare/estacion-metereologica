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
const multer = require('multer');
const upload = multer();

const client = new MongoClient(uri);

var five = require("johnny-five");
const res = require('express/lib/response')
var board = new five.Board();


const bodyParser = require('body-parser')


const urlencodedParser = bodyParser.urlencoded({ extended: true })
const jsonParser = bodyParser.json()

app.set('views',path.join(__dirname, 'views'))
app.engine('.hbs', exphbs.engine({
    defaultLayout: 'main',
    layoutsDir: path.join(app.get('views'), 'layouts'),
    partialsDir: path.join(app.get('views'), 'partials'),
    extname: '.hbs',
    helpers: require('./helpers.js')
}))

app.set('view engine', '.hbs')

let tempAct = null
let vientoAct = null
let humedadAct = null
let data
let usuario
let valido = true
let config
let dbInterval

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

const registrar = async () =>{
        
    const registro = {
        temperatura: tempAct,
        viento: vientoAct,
        humedad: humedadAct,
        registeredAt: new Date()
    }

    const data  = await client.db('estacionMetereologica').collection('registros').insertOne(registro)
    console.log(data)
  }


  const luminariaOn = (config) =>{

    const desde = config.horarioLumOn.split(':')
    const hasta = config.horarioLumOff.split(':')

    const tiempoDesde = new Date()
    const tiempoHasta = new Date()

    tiempoDesde.setHours(parseInt(desde[0]),parseInt(desde[1]))
    tiempoHasta.setHours(parseInt(hasta[0]),parseInt(hasta[1]))

    
    const tiempoAhora =  new Date()

    if (tiempoDesde > tiempoHasta ){
       
        if (tiempoAhora > tiempoHasta){
            tiempoHasta.setDate(tiempoAhora.getDate()+1)
        }else {
            tiempoDesde.setDate(tiempoAhora.getDate()-1)
        }
    }
    
    return tiempoAhora > tiempoDesde && tiempoAhora < tiempoHasta

  }


//GdeYsxhi8awC0UZ8
board.on("ready", async function() {
  try {
      await client.connect()

      config = await client.db('estacionMetereologica').collection('configuracion').findOne({'ide':'unico'})
      console.log("configuracion:",config)
      var led = new five.Led(13);
      
    luminariaOn(config)
      setInterval(()=>{
          if (luminariaOn(config)){
              led.on()
          }else{
              led.off()
          }
      },1000*10)

      var sensorTemp = new five.Sensor(PIN_TEMP);
      var sensorViento = new five.Sensor(PIN_VIENTO)
      
      // Scale the sensor's data from 0-1023 to 0-10 and log changes
      sensorTemp.on("change", function() {
         tempAct = this.scaleTo(0, 40);
      });
    
      sensorViento.on('change', function() {
        vientoAct =  this.scaleTo(0,100)
      }) 

      /* five.Pin.read(pin, function(error, value) {
        console.log(value);
      }); hacer esto con los pines de los sensores */
  
      dbInterval = setInterval( registrar ,1000*60*parseInt(config.tiempoMuestrasMin))
  
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

    let data = {
        'temperatura':tempAct, 
        'viento':vientoAct,
        'usuario': usuario
    }

    if (!usuario)
        res.redirect('/login')
    else
        res.render('index',data)
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

app.get('/public/:file', (req,res)=>{
    res.sendFile(path.join(__dirname,`views/public/${req.params.file}`))
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

    const usersCollection = client.db('estacionMetereologica').collection('users')

    usuario = await usersCollection.findOne(req.body)

    if (usuario){
        res.redirect('/')
    }else {
        valido = false
        res.redirect('login')
    }
})

app.get('/configuracion', async(req,res)=>{

    if (!usuario){
        res.redirect('/login')
    }
    else {
        if (usuario.tipo == 'admin'){
            res.render('config',config)
        }
    
        if (usuario.tipo == 'user'){
            res.send('Acceso denegado',404)
    }
    }
})

app.post('/enviar-config',upload.none(), async(req,res)=>{

    config = req.body

    const temps = [config.alarmaTempMax,config.alarmaTempMin]

    config.alarmaTemp = temps

    clearInterval(dbInterval)

    dbInterval = setInterval( registrar ,1000*60*parseInt(config.tiempoMuestrasMin))

    try{
        const data = await client.db('estacionMetereologica').collection('configuracion').updateOne({
            'ide':'unico'
            },
            { $set:config },
            { upsert:true }
        ) 
        console.log(data)
        res.sendStatus(200)
    }catch(err){
        console.error(err)
        res.sendStatus(500)
    }
    
})