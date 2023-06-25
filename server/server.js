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
    physicsStep : 0.005,
	keywords : {
		a : "gamestepNumber",
		b : "wTime",
		c : "playerPool",
		d : "playerMap",
		e : "projectilePool",
		f : "projList",
		g : "body",
		h : "position",
		i : "x",
		j : "y",
		k : "velocity",
		l : "angle",
		m : "angleVelocity",
		n : "shootTimer",
		o : "eventLog",
		p : "origin",
		q : "eData",
		r : "type",
		s : "e",
		t : "id",
		u : "key",
		v : "pid",
        w : "radius",
        x : "maxSpeed",
        y : "accConst",
        z : "projSpeed",
        aa : "fireRate",
        ab : "projCfg",
        ac : "damage",
        ad : "expireT",
        ae : "width",
        af : "length",
        ag : "mass",
        ah : "inputs",
        ai : "keysPressed",
        aj : "mouseDown",
        ak : "obstacles",
        al : "shapes",
        am : "sType",
        an : "vs",
        ao : "mass",
        ap : "inertia",
        aq : "kFriction",
        ar : "sFriction",
        as : "elasticity",
        at : "points",
        au : "cfg",
        av : "points",
        aw : "min",
        ax : "max",
        ay : "originId"
	}
}
var keywords = new Game.Utils.TwoWayMap(c.keywords);
var game;
var controlsQueues = {};
io.on("connection", function onJoin(client){
    var id = Game.Utils.makeid(4);
    game.onEvent(new Game.Event(0, {
        type : "j",
        e : {
            id : id,
            cfg : {
                maxSpeed : 5,
                accConst : 4
            }
        }
    }));
    client.emit("start", {c : c, game : f2.stringify(Game.encodeKeys(Game.serialize(game), keywords)), id : id})
    var cd = controlsQueues[id] = new ControlsQueue()
    cd.addEventListener("playerInput", (eData)=>{
        game.onEvent(new Game.Event(id, eData))
    });

    client.on("test", function(data){
        client.emit("test", {clientSendTime : data.clientSendTime, serverTime : Date.now()})
    })
    client.on("playerInput", function(data){
        cd.addEvent("playerInput", data.eData, Math.max(data.time, Date.now()/1000))
    })
    client.on('disconnect', function(){
        game.onEvent(new Game.Event(0, {
            type : "l",
            e : {
                id : id
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
    io.sockets.emit('update', f2.stringify(Game.encodeKeys(Game.serializeUpdate(game), keywords)));
    game.clearEventLog();
    setTimeout(emitLoop, 50);
}
createGame();
gameLoop();
emitLoop();
