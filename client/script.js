// const socket = io("https://multiplayer-circles.onrender.com", { transports: ['websocket', 'polling', 'flashsocket'] })
const socket = io("http://localhost:3000", { transports: ['websocket', 'polling', 'flashsocket'] })

var c;
var keywords;
var game = new Game();
var lastState;
var myId;
function join(){
    socket.emit("join");
}
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
    console.log(data);
    console.log(abr.b.byteLength, abr.start)
    return data;
}
socket.on("start", function(data){
    data = decodeStartData(new Game.Utils.ArrayBufferReader(data));
    var alreadyStarted = c ? 1 : 0;
    c = data.c;
    myId = data.id;
    game.useSerialized(data.game, timeDiff);

    game.dt = c.physicsStep;
    lastState = Game.saveStateInfo(game);
    if (!alreadyStarted){
        gameLoop();
        displayLoop();
        pingTest();
    }
})
function pingTest(){
    socket.emit('test', {
        clientSendTime : Date.now()
    })
    setTimeout(pingTest, 3000)
}
var ping = 0;
var timeDiff = 0;
var delay = 0;
socket.on('test', function(data){
    var clientRecieveTime = Date.now()
    var clientSendTime = data.clientSendTime
    var serverTime = data.serverTime
    var p = clientRecieveTime - clientSendTime;
    var td = serverTime - (clientRecieveTime + clientSendTime)/2

    ping += 0.3 * (p/1000 - ping)
    // ping = 1;
    timeDiff += 0.3 * (td/1000 - timeDiff)

    delay = 0.5 * ping;
    // delay = ping
})
socket.on('u', function(data){
    var abr = new Game.Utils.ArrayBufferReader(data);
    data = Game.decodeUpdate(abr);
    // console.log(abr.b.byteLength, abr.start)
    game.useStateInfo(lastState);//something wrong with inputs when doing this stuff
    game.useSerializedUpdate(data, timeDiff);
    lastState = Game.saveStateInfo(game);
})

var canvas = document.createElement("canvas");
canvas.width = window.innerWidth
canvas.height = window.innerHeight
var ctx = canvas.getContext("2d");
document.body.appendChild(canvas);

var button = document.createElement("button");
button.innerHTML = "join";
button.onclick = join;
document.body.appendChild(button);

var controlsQueue = new ControlsQueue()
controlsQueue.addEventListener("playerInput", (eData)=>{
    game.handleEvent(new Game.Event(myId, eData))
});

function getAngle(canvas, evt) {
    var rect = canvas.getBoundingClientRect(), // abs. size of element
        scaleX = canvas.width / rect.width,    // relationship bitmap vs. element for x
        scaleY = canvas.height / rect.height;  // relationship bitmap vs. element for y

    return (new f2.Vec2(
        (evt.clientX - rect.left) * scaleX,   // scale mouse coordinates after they have
        (evt.clientY - rect.top) * scaleY     // been adjusted to be relative to element
    )).subtract(new f2.Vec2(canvas.width/2, canvas.height/2)).ang();
}
function onInput(event){
    var type = onInput.types[event.type];
    if (event.repeat) { return }
    var e;
    if ([Game.Event.Types.KEY_DOWN, Game.Event.Types.KEY_UP].includes(type)){
        e = {
            key : event.key
        };
    } else if ([Game.Event.Types.MOUSE_MOVE].includes(type)){
        e = {
            angle : getAngle(canvas, event)
        };
    }
    var dataEmit = {
        eData : {
            type : type,
            e : e
        },
        time : timeDiff + Date.now()/1000 + delay
    };
    socket.emit("playerInput", dataEmit);
    controlsQueue.addEvent("playerInput", dataEmit.eData, Date.now()/1000 + delay)
}
onInput.types = {
    "keydown" : Game.Event.Types.KEY_DOWN,
    "keyup" : Game.Event.Types.KEY_UP,
    "mousemove" : Game.Event.Types.MOUSE_MOVE,
    "mousedown" : Game.Event.Types.MOUSE_DOWN,
    "mouseup" : Game.Event.Types.MOUSE_UP
}

document.body.addEventListener('keydown', onInput);
document.body.addEventListener('keyup', onInput);
document.body.addEventListener('mousemove', onInput);
document.body.addEventListener('mousedown', onInput);
document.body.addEventListener('mouseup', onInput);
function step() {
    if (game.playerPool.getPlayer(myId)){
        game.playerPool.getPlayer(myId).isMe = true;
        button.hidden = true;
    } else{
        button.hidden = false;
    }
    controlsQueue.handleEvents(game.world.time, game.dt);
    // game.stepClient(dt)
    game.step(1);
}
function display(ctx, now){
    var canvas = ctx.canvas;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    var world = game.world;
    game.display(ctx, {followId : myId, scale : 40}, (now - world.time));
}
var prevTimes = [];
var fps = 0;
function gameLoop() {
    var world = game.world;
    var now = Date.now() / 1000
    while (world.time < now) {
        step()
    }
    setTimeout(gameLoop, 1000 * c.physicsStep);
    // setTimeout(gameLoop, 1);
}
function displayLoop(){
    var now = Date.now() / 1000
    var old = prevTimes[0];
    fps = 1/((now - old)/prevTimes.length)

    prevTimes.push(now);
    if (prevTimes.length > 10){
        prevTimes.shift();
    }
    display(ctx, now)
    requestAnimationFrame(displayLoop)
}
