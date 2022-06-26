const express = require('express')
const app = express()
const PORT = 8080
const SERIAL_PATH = "COM4"
const BAUDRATE = 9600
const path = require('path') 
const nodemailer = require("nodemailer");
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

const client = new MongoClient(uri);

/* var five = require("johnny-five");

var board = new five.Board();
 */
const board =  new SerialPort({
    path: 'COM7',
    baudRate: 9600
  })  
const parser = board.pipe(new DelimiterParser({ delimiter: '\n' }))
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
        temperatura: data.temperatura,
        viento: data.viento,
        humedad: data.humedad,
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

          setSensors()

          parser.on('data', (buffer)=>{
            try{
                let bufferString = buffer.toString()
                if (bufferString.indexOf("{") != -1){
                    //console.log(JSON.parse(bufferString))
                    data = JSON.parse(bufferString)

                }
            }catch(err){
                console.log(err)
            }

          })
      
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

/*     let data = {
        'temperatura':tempAct, 
        'viento':vientoAct,
        'usuario': usuario
    } */

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

    config.funcTemp = {aTemp:config.aTemp,bTemp:config.bTemp,cTemp:config.cTemp}
    config.funcHum = {aHum:config.aHum,bHum:config.bHum,cHum:config.cHum}
    config.funcVien = {aVien:config.aVien,bVien:config.bVien,cVien:config.cVien}

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


    //config.alarmaTemp = temps
    console.log("Entrando");
    

    const registerCollection = client.db('estacionMetereologica').collection('registros')


    console.log(rep_param);
    
    registros = registerCollection.find({
        registeredAt: {
            $gte: new Date(rep_param.fechaInicioReporte),
            $lt: new Date(rep_param.fechaFinReporte)
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
            console.log(element);
            worksheet.cell(row,1).date(element.registeredAt).style(st_date);
            worksheet.cell(row,2).number(element.temperatura).style(st_temp);
            worksheet.cell(row,3).number(element.viento).style(st_style);
            worksheet.cell(row,4).number(element.humedad).style(st_style);
            
            
            row++;
          }
        );

/*
        // Set value of cell B1 to 300 as a number type styled with paramaters of style
        

        // Set value of cell C1 to a formula styled with paramaters of style
        worksheet.cell(1,3).formula('A1 + B1').style(style);

        // Set value of cell A2 to 'string' styled with paramaters of style
        worksheet.cell(2,1).string('string').style(style);

        // Set value of cell A3 to true as a boolean type styled with paramaters of style but with an adjustment to the font size.
        worksheet.cell(3,1).bool(true).style(style).style({font: {size: 14}});
*/
        workbook.write('Excel.xlsx');


      });
      
    //usuario = await usersCollection.findOne(req.body)

    /*
    if (usuario){
        res.redirect('/')

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
    */
    
})

