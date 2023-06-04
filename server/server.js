const express = require("express");
const socketio = require("socket.io");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: "http://localhost:3000/",
    methods: ["GET", "POST"]
  }
});

const { f2 } = require('./fisyx2d.js');
const { ControlsQueue } = require('./controlsQueue.js');
const { Game } = require('./game.js');

var c = {
    physicsStep : 0.005
}
var game;
var controlsQueues = {};
io.on("connection", function onJoin(client){
    game.onEvent(new Game.Event(0, {
        type : "join",
        e : {
            id : client.id,
            cfg : {
                maxSpeed : 5,
                accConst : 4
            }
        }
    }));
    client.emit("start", {c : c, game : f2.stringify(Game.serialize(game))})
    var cd = controlsQueues[client.id] = new ControlsQueue()
    cd.addEventListener("playerInput", (eData)=>{
        game.onEvent(new Game.Event(client.id, eData))
    });

    client.on("test", function(data){
        client.emit("test", {clientSendTime : data.clientSendTime, serverTime : Date.now()})
    })
    client.on("playerInput", function(data){
        cd.addEvent("playerInput", data.eData, Math.max(data.time, Date.now()/1000))
    })
    client.on('disconnect', function(){
        game.onEvent(new Game.Event(0, {
            type : "leave",
            e : {
                id : client.id
            }
        }));
    });
})
io.listen(process.env.PORT || 3000)
// document.body.addEventListener('mousemove', (e) => {
//     controlsDelayer.handleEventDelay('mousemove', e, 300)
// })
function createGame(){
    game = new Game();
    game.createMap();
}
function step(dt) {
    var world = game.world;
    for (var i in controlsQueues){
        var cd = controlsQueues[i];
        cd.handleEvents(world.time, dt);
        cd.removeEvents(world.time)
    }
    game.step(dt);
}
function gameLoop() {
    var world = game.world;
    now = Date.now() / 1000
    while (world.time < now) {
        step(c.physicsStep)
    }
    setTimeout(gameLoop, c.physicsStep * 1000)
}
function emitLoop(){
    io.sockets.emit('update', f2.stringify(Game.serializeUpdate(game)));
    game.clearEventLog();
    setTimeout(emitLoop, 50);
}
createGame();
gameLoop();
emitLoop();
