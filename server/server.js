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
var keywords = new Game.Utils.TwoWayMap(c.keywords);
var game;
var controlsQueues = {};
function encodeStartData(data){
    var buffers = [];
    var c = data.c
    buffers.push(Game.Utils.encodeType(c.physicsStep, Float64Array));
    buffers.push(Game.Utils.encodeType(data.id, Uint8Array));
    buffers.push(Game.encode(data.game));
    return Game.Utils.joinBuffers(buffers);
}
function decodeStartData(abr){
    var data = {};
    data.c = {};
    data.c.physicsStep = abr.readNextType(Float64Array);
    data.id = abr.readNextType(Uint8Array);
    data.game = Game.decode(abr);
    return data;
}

io.on("connection", function onJoin(client){
    var id = game.playerPool.createID();
    client.emit("start", encodeStartData({c : c, id : id, game : Game.serialize(game)}));
    var cd = controlsQueues[id] = new ControlsQueue()
    cd.addEventListener("playerInput", (eData)=>{
        game.onEvent(new Game.Event(id, eData))
    });

    client.on("test", function(data){
        client.emit("test", {clientSendTime : data.clientSendTime, serverTime : Date.now()})
    })
    client.on("join", function(data){
        game.onEvent(new Game.Event(0, {
            type : Game.Event.Types.SPAWN_PLAYER,
            e : {
                id : id,
                cfg : {
                    "radius": 0.5,
                    "gunLength": 1,
                    "maxSpeed": 3,
                    "accConst": 4,
                    "projSpeed": 20,
                    "fireRate": 450,
                    "projCfg": {
                        "damage": 5,
                        "expireT": 0.7,
                        "drag": 1.2,
                        "body": {
                            "width": 0.1,
                            "length": 0.6,
                            "mass": 0.06
                        }
                    }
                }
            }
        }));
    })
    client.on("playerInput", function(data){
        cd.addEvent("playerInput", data.eData, Math.max(data.time, Date.now()/1000))
    })
    client.on('disconnect', function(){
        game.onEvent(new Game.Event(0, {
            type : Game.Event.Types.REMOVE_PLAYER,
            e : {
                id : id
            }
        }));
        delete controlsQueues[id];
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
function step() {
    var world = game.world;
    for (var i in controlsQueues){
        var cd = controlsQueues[i];
        cd.handleEvents(world.time, game.dt);
        cd.removeEvents(world.time)
    }
    game.step();
}
function gameLoop() {
    var world = game.world;
    now = Date.now() / 1000
    while (world.time < now) {
        step()
    }
    setTimeout(gameLoop, c.physicsStep * 1000)
}
function emitLoop(){
    io.sockets.emit('u', Game.encodeUpdate(Game.serializeUpdate(game)));
    game.clearEventLog();
    setTimeout(emitLoop, 50);
}
createGame();
gameLoop();
emitLoop();
