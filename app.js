const Koa = require('koa')
const Router = require('koa-router')
const Server = require('socket.io')
const http = require('http')
const fs = require('fs')
const path = require('path')
const static = require('koa-static')
const robot = require('robotjs')
const qr = require('qr-image')
const os = require('os')
const portfinder = require('portfinder')
const ifaces = os.networkInterfaces()

const app = new Koa()
const router = new Router()

const exec = require('child_process').exec
const cmdStr = 'key.vbs'

let ip = ''
let port = 3000

// 静态文件路径
const staticPath = './view/dist'

// 获取内网ip地址
for (let dev in ifaces) {
  ifaces[dev].forEach(function(details, alias) {
    if (dev === 'WLAN') {
      ip = details.address
    }
  })
}

// 获取页面二维码
router.get('/qrcode', ctx => {
  let url = `http://${ip}:${port}/#/control`
  let img = qr.image(url, { size: 10 })
  ctx.status = 200
  ctx.set('Content-Type', 'image/png')
  img.pipe(ctx.res)
})

app.use(router.routes())

app.use(static(path.join(__dirname, staticPath)))

// 获取可使用的端口号
portfinder.basePort = port
portfinder.getPort(function(err, port) {
  if (err) {
    throw err
  }

  const server = http.createServer(app.callback()).listen(port)
  const io = new Server(server)

  let aList = {}
  let pList = {}

  io.on('connection', function(socket) {
    // console.log('user connect')
    let {id} = socket
    if (!aList[id] && !pList[id]) {
      let {type} = socket.handshake.query
      if (type === 'admin') {
        console.log('new admin')
        aList[id] = socket
      } else if (type === 'player') {
        console.log('new player')
        pList[id] = socket
        callAdmin(pList)
      }
    } else {
      let type = aList[id] ? 'admin' : 'player'

      if (type === 'player') {
        socket.on('keydown', function(data) {
          console.log(data, 'down')
          robot.keyToggle(data, 'down')
        })
        socket.on('keyup', function(data) {
          console.log(data, 'up')
          robot.keyToggle(data, 'up')
        })
      }
    }
    socket.on('disconnect', function() {
      let type = aList[id] ? 'admin' : 'player'

      if (type === 'admin') {
        delete aList[id]
      } else if (type === 'player') {
        delete pList[id]
        callAdmin(pList)
      }

      console.log('user disconnected')
    })
  })

  function callAdmin (list) {
    let allList = []
    for (let item in list) {
      allList.push(item)
    }
    for (let item in aList) {
      aList[item].emit('playerChange', allList)
    }
  }
})
