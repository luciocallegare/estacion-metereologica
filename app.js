const express = require('express')
const app = express()
const PORT = 8080
const SERIAL_PATH = "COM6"
const BAUDRATE = 9600
const path = require('path') 
const nodemailer = require("nodemailer");
require('dotenv').config();

const exphbs = require('express-handlebars')
var excel = require('excel4node');
const PIN_TEMP = "A2"
const PIN_VIENTO = "A1"
const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://luciocallegare:GdeYsxhi8awC0UZ8@cluster0.7ggn1.mongodb.net/?retryWrites=true&w=majority";
const multer = require('multer');
const upload = multer();
const {SerialPort} = require('serialport');
const { DelimiterParser } = require('@serialport/parser-delimiter')
const webpush = require("web-push");
const publicVapidKey="BIuk2jcnHJihbfXxRuW93KaMM2pg9A4CgR2SqlefGUcvcD7ZFJLz-wL9Dk3D_C7xpxK1j-_D3CcYhhrEbLel2Es"
const privateVapidKey="5h3xNGAYssMWN9XgKElyNp453fwzIoIz38E_q4aP3rQ"



const client = new MongoClient(uri);

/* var five = require("johnny-five");
var board = new five.Board();
 */
const board =  new SerialPort({
    path: SERIAL_PATH,
    baudRate: BAUDRATE
  })  
const parser = board.pipe(new DelimiterParser({ delimiter: '\n' }))
const bodyParser = require('body-parser')
const { isModuleNamespaceObject } = require('util/types')



const urlencodedParser = bodyParser.urlencoded({ extended: true })
const jsonParser = bodyParser.json()

let tempHumSensorStatus = true

app.set('views',path.join(__dirname, 'views'))
app.engine('.hbs', exphbs.engine({
    defaultLayout: 'main',
    layoutsDir: path.join(app.get('views'), 'layouts'),
    partialsDir: path.join(app.get('views'), 'partials'),
    extname: '.hbs',
    helpers: require('./helpers.js')
}))

app.set('view engine', '.hbs')

let data
let usuario
let valido = true
let config
let dbInterval

const setSensors = async ()=>{
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (config.tempState == 'on'){
        console.log('Prueba prendiendo sensor de temperatura')
        
        if (config.sensor_DHT_temp == 'off'){
            board.write('DHTT(0)\n')
        }else{
            board.write('DHTT(1)\n')
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        board.write('SETT(1)\n')
    }


    await new Promise(resolve => setTimeout(resolve, 1000));

    if (config.humState == 'on'){
        console.log('Prueba prendiendo sensor de humedad')

        if (config.sensor_DHT_hum == 'off'){
            board.write('DHTH(0)\n')
        }else{
            board.write('DHTH(1)\n')
        }
        await new Promise(resolve => setTimeout(resolve, 500));

        board.write('SETH(1)\n')
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    if (config.vienState == 'on'){
      console.log('Prueba prendiendo sensor de viento')
      board.write('SETV(1)\n')           
    }
}

const mailer = async (titulo) =>{

    const testAccount = await nodemailer.createTestAccount();

    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USERNAME,
          pass: process.env.EMAIL_PASSWORD,
        },
        tls: {
            // do not fail on invalid certs
            rejectUnauthorized: false
        },
     });

      const html_text =  `<b>ALERTA de condiciones extremas!!</b><br><br> <font size="24">
                        <img src="https://cdn-icons-png.flaticon.com/512/2426/2426702.png" width="50" heigth="50">  Temperatura: <b>${data.temperatura}°C</b>
                        <br><img src="https://cdn-icons-png.flaticon.com/512/219/219816.png" width="50" heigth="50">  humedad: <b>${data.humedad}%</b>
                        <br><img src="https://cdn-icons-png.flaticon.com/512/481/481476.png" width="50" heigth="50">  viento: <b>${data.viento}Kts</b>
                        </font>`
      const mailOptions = {
        from: process.env.EMAIL_USERNAME, // Sender address
        to: config.email, // List of recipients
        subject: `ALERTA - Estacion Meteorologica - ${titulo}`, // Subject line
        //text: 'Hello People!, Welcome to Bacancy!', // Plain text body
        html: html_text,
    };
    
    transporter.sendMail(mailOptions, function(err, info) {
        if (err) {
            console.log(err)
        } else {
            console.log(info);
        }
    });

}

const checkSensor = async () =>{

    if(tempHumSensorStatus && data.temperatura == 0 && data.humedad == 0){
        console.log("Probable mal funcionamiento o desconexion de sensor temperatura/humedad")
        await mailer("Probable error de Sensor Temperatura/Humedad")
        tempHumSensorStatus = false
    }else if(!tempHumSensorStatus && (data.temperatura != 0 || data.humedad != 0)){
        console.log("Sensor vuelve a funcionamiento")
        await mailer("Sensor Temperatura/Humedad vuelve a funcionar")
        tempHumSensorStatus = true
    }


}
const registrar = async () =>{

    const registro = {
        temperatura: data.temperatura,
        viento: data.viento,
        humedad: data.humedad,
        registeredAt: new Date()
    }

    if(config.tempState == 'on'){
        if(data.temperatura < config.alarmaTempMin){
            await mailer("Alarma de temperatura Minima")
        }
        if(data.temperatura > config.alarmaTempMax){
            await mailer("Alarma de temperatura Maxima")
        }
    }else{
        registro.temperatura = -99
    }
    
    if(config.humState == 'on'){
        if(data.humedad > config.alarmaHumedad){
            await mailer("Alarma de Humedad Maxima")
        }
    }else{
        registro.humedad = -99
    }

    if(config.vienState == 'on'){
        if(data.viento > config.alarmaViento){
            await mailer("Alarma de Viento")
        }
    }else{
        registro.viento = -99
    }

    checkSensor()
    
    const dataWrite  = await client.db('estacionMetereologica').collection('registros').insertOne(registro)
    
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

  const conversor = (funcConv, valor)=>{

    let {aVal,bVal,cVal} = funcConv
    
    if (aVal.length == 0 && bVal.length == 0 && cVal.length == 0){
        return valor
    }

    if (aVal.length == 0){
        aVal = 0
    }

    if (bVal.length == 0){
        bVal = 0
    }

    if (cVal.length == 0){
        cVal = 0
    }

    return (parseFloat(aVal)*(valor^2)+parseFloat(bVal)*valor+parseFloat(cVal)).toFixed(2)
  }


//GdeYsxhi8awC0UZ8
try{
    board.on("open", async function() {
      try {
          await client.connect()
        
          config = await client.db('estacionMetereologica').collection('configuracion').findOne({'ide':'unico'})
          console.log("configuracion:",config)
        
        luminariaOn(config)
          setInterval(()=>{
              if (luminariaOn(config)){
                board.write('SETL(1)\n')
              }else{
                board.write('SETL(0)\n')
              }
          },1000*10)

          webpush.setVapidDetails(
            "mailto:"+config.email,
            publicVapidKey,
            privateVapidKey
        );
          setSensors()

          parser.on('data', (buffer)=>{
            try{
                let bufferString = buffer.toString()

                if (bufferString.indexOf("{") != -1){
                    data = JSON.parse(bufferString)
                    data.viento = conversor(config.funcVien,parseFloat(data.viento))
                    if (config.sensor_DHT_temp == 'off'){
                        data.temperatura = conversor(config.funcTemp,parseFloat(data.temperatura))
                    }

                    if (config.sensor_DHT_hum == 'off'){
                        data.humedad = conversor(config.funcHum,parseFloat(data.humedad))
                    }


                }
            }catch(err){
                console.log(err)
            }

          })
      
          //dbInterval = setInterval( registrar ,30000)
          dbInterval = setInterval( registrar ,1000*60*parseInt(config.tiempoMuestrasMin))
      
        }catch (err){
          console.error(err)
      }
      
    });

}catch (err){
    console.error(err)
}




app.listen(PORT, ()=>{ 
    console.log('Listening at port',PORT)
})  

app.get('/gauges-ejemplos', (req,res)=>{
    res.sendFile(path.join(__dirname,'index.html'))
})

app.get('/', (req, res, next) =>{

    data.usuario = usuario
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

app.get('/logout', (req,res)=>{
    let params
    usuario = ''
    res.render('login',params)
})

app.get('/datos',(req,res)=>{
    if (data){
        data.config = config
    }
    res.send(data) 
})   

app.get('/style.css',(req,res)=>{
    res.sendFile(path.join(__dirname,'views/style.css'))
} )

app.get('/public/:file', (req,res)=>{
    res.sendFile(path.join(__dirname,`views/public/${req.params.file}`))
})
app.get('/worker.js', (req,res)=>{
    res.sendFile(path.join(__dirname,`views/worker.js`))
})


app.get('/enviar-mail', async (req,res)=>{ 
    try {
        await mailer()
        //res.send('mail enviado')
        res.redirect('/')
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

    const temps = [config.alarmaTempMin,config.alarmaTempMax]

    config.funcTemp = {aVal:config.aTemp, bVal:config.bTemp, cVal:config.cTemp}
    config.funcHum = {aVal:config.aHum, bVal:config.bHum, cVal:config.cHum}
    config.funcVien = {aVal:config.aVien, bVal:config.bVien, cVal:config.cVien}

    delete config.aTemp
    delete config.bTemp
    delete config.CTemp

    delete config.aHum
    delete config.bHum
    delete config.CHum

    delete config.aVien
    delete config.bVien
    delete config.cVien

    config.alarmaTemp = temps

    if (!config.tempState){
        config.tempState = 'off'
    }

    if (!config.humState){
        config.humState = 'off'
    }

    if (!config.vienState){
        config.vienState = 'off'
    }

    if (!config.sensor_DHT_temp){
        config.sensor_DHT_temp = 'off'
    }

    if (!config.sensor_DHT_hum){
        config.sensor_DHT_hum = 'off'
    }

    clearInterval(dbInterval)

    dbInterval = setInterval( registrar ,1000*60*parseInt(config.tiempoMuestrasMin))

    setSensors()

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


app.get('/reporte', async(req,res)=>{

    if (!usuario){
        res.redirect('/login')
    }
    else {
        
        res.render('reporte')
        
    }
})


app.post('/generate-report',upload.none(), async(req,res)=>{

    rep_param = req.body

    const registerCollection = client.db('estacionMetereologica').collection('registros')

    console.log(rep_param)

    
    let gte_txt = `${rep_param.fechaInicioReporte}T00:00:00:000Z`
    if(rep_param.horaInicioReporte != ''){
        gte_txt = `${rep_param.fechaInicioReporte}T${rep_param.horaInicioReporte}:00:000Z`
    }
    let lt_txt = `${rep_param.fechaFinReporte}T24:59:59:000Z`
    if(rep_param.horaFinReporte != ''){
        lt_txt = `${rep_param.fechaFinReporte}T${rep_param.horaFinReporte}:59:000Z`
    }

    console.log(gte_txt)
    console.log(lt_txt)
    registros = registerCollection.find({
        registeredAt: {
            $gte: new Date(gte_txt),
            $lt: new Date(lt_txt)
            /*$gte: new Date('2022-06-10'),
            $lt: new Date('2022-06-12')*/
        }
    }).toArray(function(err, result) {
        if (err) throw err;

        var workbook = new excel.Workbook({
            dateFormat: 'm/d/yy hh:mm:ss'
        });

        // Add Worksheets to the workbook
        var worksheet = workbook.addWorksheet('Valores');
        var worksheet2 = workbook.addWorksheet('Sheet 2');
        
        // Create a reusable style
        var st_temp = workbook.createStyle({
            font: {
                color: '#FF0800',
                size: 12
            },
            numberFormat: '#,##0.00 °C; (#,##0.00 °C); -'
        });
        var st_style = workbook.createStyle({
            font: {
                color: '#FF0800',
                size: 12
            },
            numberFormat: '#,##0.00 °C; (#,##0.00 °C); -'
        });
        var st_header = workbook.createStyle({
            font: {
                color: '#FF0800',
                size: 14
            },
            numberFormat: '#,##0.00; (#,##0.00); -'
        });
        var st_date = workbook.createStyle({
            font: {
                color: '#FF0800',
                size: 12
            },
            dateFormat: 'm/d/yy hh:mm:ss'
        });
        
        
        // Set value of cell A1 to 100 as a number type styled with paramaters of style
        worksheet.cell(1,1).string('Reporte generado desde pagina WEB').style(st_header);

        worksheet.cell(3,1).string('Fecha inicio reporte').style(st_header);
        worksheet.cell(3,2).date(rep_param.fechaInicioReporte).style(st_date);

        worksheet.cell(3,3).string('Hora inicio reporte').style(st_header);
        worksheet.cell(3,4).string(rep_param.horaInicioReporte).style(st_date);

        worksheet.cell(4,1).string('Fecha Fin reporte').style(st_header);
        worksheet.cell(4,2).date(rep_param.fechaFinReporte).style(st_date);

        worksheet.cell(4,3).string('Hora Fin reporte').style(st_header);
        worksheet.cell(4,4).string(rep_param.horaFinReporte).style(st_date);

        worksheet.cell(7,1).string('Fecha').style(st_header);
        worksheet.cell(7,2).string('Temperatura').style(st_header);
        worksheet.cell(7,3).string('Viento').style(st_header);
        worksheet.cell(7,4).string('Humedad').style(st_header);
        
        let row = 8;
        
        result.forEach(element => {
            worksheet.cell(row,1).date(element.registeredAt).style(st_date);
            if(element.temperatura != null && element.temperatura != 'NaN'){
                worksheet.cell(row,2).number(parseFloat(element.temperatura)).style(st_temp);
            }
            if(element.viento != null && element.viento != 'NaN'){
                worksheet.cell(row,3).number(parseFloat(element.viento)).style(st_style);
            }
            if(element.humedad != null && element.humedad != 'NaN'){
                worksheet.cell(row,4).number(parseFloat(element.humedad)).style(st_style);
            }
            
            
            row++;
          }
        );
        workbook.write('Excel.xlsx');
        console.log("reporte terminado")
      });
    
})

// Subscribe Route
app.post("/subscribe", jsonParser, (req, res) => {
    // Get pushSubscription object
    const subscription = req.body.subscription;
  
    // Send 201 - resource created
    res.status(201).json({});
  
    // Create payload
    const payload = JSON.stringify({ 
        title: "Alerta de Condiciones Extremas!",
        rest:req.body.mensaje
    });
  
    // Pass object into sendNotification
    webpush
      .sendNotification(subscription, payload)
      .catch(err => console.error(err));
  });