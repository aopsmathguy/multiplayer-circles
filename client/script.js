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
socket.on("start", function(data){
    var alreadyStarted = c ? 1 : 0;
    c = data.c;
    keywords = new Game.Utils.TwoWayMap(c.keywords);

    myId = data.id;
    game.useSerialized(Game.decodeKeys(f2.parse(data.game), keywords), timeDiff);

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
socket.on('update', function(data){
    // console.log(f2.parse(data));
    game.useStateInfo(lastState);//something wrong with inputs when doing this stuff
    game.useSerializedUpdate(Game.decodeKeys(f2.parse(data), keywords), timeDiff);
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
    if (event.repeat) { return }
    var e;
    if (["keydown", "keyup"].includes(event.type)){
        e = {
            key : event.key
        };
    } else if (["mousemove"].includes(event.type)){
        e = {
            angle : getAngle(canvas, event)
        };
    }
    var dataEmit = {
        eData : {
            type : event.type,
            e : e
        },
        time : timeDiff + Date.now()/1000 + delay
    };
    socket.emit("playerInput", dataEmit);
    controlsQueue.addEvent("playerInput", dataEmit.eData, Date.now()/1000 + delay)
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
