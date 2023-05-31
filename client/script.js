const socket = io("https://multiplayer-circles.onrender.com", { transports: ['websocket', 'polling', 'flashsocket'] })
// const socket = io("http://localhost:3000", { transports: ['websocket', 'polling', 'flashsocket'] })

var c;
var game = new Game();
socket.on("start", function(data){
    if (!c){
        c = data.c;

        game = Game.deserialize(f2.parse(data.game));
        game.playerPool.getPlayer(socket.id).isMe = true;

        gameLoop();
        displayLoop();
        pingTest();
    } else{
        c = data.c;

        game = Game.deserialize(f2.parse(data.game));
        game.playerPool.getPlayer(socket.id).isMe = true;
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
    game.useSerializedUpdate(f2.parse(data));
})

var canvas = document.createElement("canvas");
canvas.width = window.innerWidth
canvas.height = window.innerHeight
var ctx = canvas.getContext("2d");
document.body.appendChild(canvas);

var controlsQueue = new ControlsQueue()
controlsQueue.addEventListener("playerInput", (eData)=>{
    game.handleEvent(new Game.Event(socket.id, eData))
});
function onInput(event){
    if (event.repeat) { return }
    var dataEmit = {
        eData : {
            type : event.type, 
            e : {
                key : event.key
            }
        },
        time : timeDiff + Date.now()/1000 + delay
    };
    socket.emit("playerInput", dataEmit);
    controlsQueue.addEvent("playerInput", dataEmit.eData, Date.now()/1000 + delay)
}
document.body.addEventListener('keydown', onInput);
document.body.addEventListener('keyup', onInput);
// document.body.addEventListener('keydown', (e) => {
//     ball.position = new f2.Vec2(200, 200)
//     ball.angle = 0
//     ball.velocity = new f2.Vec2(0, 0)
//     ball.angleVelocity = 0
// })
function step(dt) {
    controlsQueue.handleEvents(game.world.time, dt)
    game.step(dt)
}
function display(ctx, now){
    var canvas = ctx.canvas;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    var world = game.world;
    game.display(ctx, {followId : socket.id, scale : 40}, (now - world.time));
}
var prevTimes = [];
var fps = 0;
function gameLoop() {
    var world = game.world;
    var now = Date.now() / 1000
    while (world.time < now) {
        step(c.physicsStep)
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