var Game = class{
	constants = {

	};
	world;
	playerPool;
	obstacles;
	eventLog; //implement this so serializing updates works more efficiently
	constructor(opts){
    this.world = new f2.World({ gravity: 0, scale: 1, gridSize: 2, time: Date.now() / 1000 });
		this.playerPool = new Game.Player.Pool();
		this.obstacles = new Game.Obstacles();
		this.eventLog = [];
	}
	display(ctx, opts, delT){
		var followId = opts.followId || 0;
		var scale = opts.scale || 40;
		var canvas = ctx.canvas;
		ctx.save();
		ctx.translate(canvas.width/2, canvas.height/2);
    ctx.scale(scale,scale);
    var world = this.world;
    var plyr = this.playerPool.getPlayer(followId);
    if (plyr){
	    var placement = plyr.body.createPlacement(delT);
			ctx.translate(-placement.position.x, -placement.position.y);
    }
    world.display(ctx, delT);
    ctx.restore();
	}
	static serialize(game){
		var dataPlyrPool = {};
		dataPlyrPool.playerMap = {};
		for (var i in game.playerPool.playerMap){
			dataPlyrPool.playerMap[i] = Game.Player.serialize(game.playerPool.playerMap[i]);
		} 
		return {
      wTime : game.world.time,
			playerPool : dataPlyrPool,
			obstacles : Game.Obstacles.serialize(game.obstacles)
		};
	}
	static deserialize(data, timeDiff){
		timeDiff = timeDiff || 0;
		var game = new Game();
		game.world.time = data.wTime - timeDiff;
		for (var i in data.playerPool.playerMap){
			game.addPlayer(
				Game.Player.deserialize(data.playerPool.playerMap[i]),
				i
			);
		}
		for (var i in data.obstacles.obstacles){
			game.addObstacle(
				f2.Body.deserialize(data.obstacles.obstacles[i])
			);
		}
		return game;
	}
	static serializeUpdate(game){
		var dataPlyrPool = {};
		dataPlyrPool.playerMap = {};
		for (var i in game.playerPool.playerMap){
			dataPlyrPool.playerMap[i] = Game.Player.serializeUpdate(game.playerPool.playerMap[i]);
		}
		var eLog = [];
		for (var i = 0 ; i < game.eventLog.length; i++){
			eLog.push(Game.Event.serialize(game.eventLog[i]));
		}
		return {
      wTime : game.world.time,
			playerPool : dataPlyrPool,
			eventLog : eLog
		}
	}
	useSerializedUpdate(data, timeDiff){
		timeDiff = timeDiff || 0;
		var playerPool = data.playerPool;
		var eventLog = data.eventLog;

		for (var i = 0 ; i < eventLog.length; i++){
			var e = eventLog[i];
			this.handleEvent(e);
		}
		this.world.time = data.wTime - timeDiff;
		for (var i in playerPool.playerMap){
			this.playerPool.getPlayer(i).useSerializedUpdate(playerPool.playerMap[i]);
		}
	}
	createMap(){
		this.addObstacles(Game.generateMap());
	}
	addObstacles(lst){
		for (var i = 0 ; i < lst.length; i++){
			this.addObstacle(lst[i]);
		}
	}
	addObstacle(b){
		this.obstacles.addBody(b);
		this.world.addBody(b);
	}
	addPlayer(p, id){
		if (this.playerPool.getPlayer(id)){return;}
		this.playerPool.addPlayer(p, id);//fix this
		this.world.addBody(p.body);
	}
	removePlayer(id){
		var p = this.playerPool.getPlayer(id);
		if (!p){return;}
		this.playerPool.removePlayer(id);//fix this
		this.world.removeBody(p.body);
	}
	step(dt){
		this.playerPool.step(dt);
		this.world.step(dt);
	}
	clearEventLog(){
		this.eventLog = [];
	}
	onEvent(e){
		this.handleEvent(e);
		this.eventLog.push(e);
	}
	handleEvent(e){
		var data = e.eData;
		if (e.origin === 0){
			var e = data.e;
			switch(data.type){
			case "join":
				if (this.playerPool.getPlayer(e.id)){return;}
				var plyr = new Game.Player(e.cfg);
				this.addPlayer(plyr, e.id);
				break;
			case "leave":
				this.removePlayer(e.id);
				break;
			}
		}else{
			var oId = e.origin;
			var player = this.playerPool.getPlayer(oId);
			if (player){
				player.handleInputEvent(data);
			}
		}
	}
	// handleEvents(){
	// 	for (var i = 0; i < this.eventLog.length; i++){
	// 		this.handleEvent(this.eventLog[i]);
	// 	}
	// }
}
Game.Event = class {
	origin;//0 means system event (not player emitted)
	eData;
	constructor(origin, eData){
		this.origin = origin;
		this.eData = eData;
	}
	static serialize(gEvent){
		return {
			origin : gEvent.origin,
			eData : gEvent.eData
		};
	}
	static deserialize(data){
		return new Game.Event(data.origin, data.eData);
	}
	toString(){
		return "(o: " + this.origin + ", data: " + JSON.stringify(this.eData) + ")";
	}
}
Game.makeid = function(length) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt (Math.floor (Math.random () * charactersLength));
    counter += 1;
  }
  return result;
}
Game.generateMap = function(opts){
	opts = opts || {};
	var width = opts.width || 100;
	var length = opts.length || 100;
	var rectangles = opts.rectangles || 300;
	var lst = [];
	for (var i = 0; i < rectangles; i++){
		var horizontal = Math.floor(Math.random() * 5 );
		lst.push(new f2.RectBody({
			mass : Infinity,
			width : horizontal + 1,
			length : 5 - horizontal,
			position : new f2.Vec2(width * Math.random(), length * Math.random())
		}));
	}
	return lst;
}
Game.Obstacles = class{
	obstacles;
	constructor(opts){
		opts = opts || {};
		this.obstacles = [];
	}
	addBody(b){
		b.setCustomDisplayPlacement(function(ctx, placement){
			ctx.save();
      ctx.translate(placement.position.x, placement.position.y);
      ctx.rotate(placement.angle);
      for (var i = 0; i < this.shapes.length; i++) {
          var s = this.shapes[i];
          ctx.fillStyle = "rgba(255,0,0,0.4)";
          ctx.strokeStyle = "rgba(255,0,0,1)";
	        ctx.lineWidth = 0.1;
          s.display(ctx);
      }
      ctx.restore();
		});
		this.obstacles.push(b);
	}
	static serialize(ob){
		var obs = [];
		for (var i = 0; i < ob.obstacles.length; i++){
			obs[i] = f2.Body.serialize(ob.obstacles[i]);
		}
		return {
			obstacles : obs
		}
	}
}
Game.Player = class{
	body;
	cfg;
	inputs;
	isMe;
	constructor(cfg){
		this.body = new f2.CircleBody({
		  radius : 0.5,
			mass : 1,
			inertia : Infinity
		});
		var that = this;
		this.body.setCustomDisplayPlacement(function(ctx, placement){
			ctx.save();
      ctx.translate(placement.position.x, placement.position.y);
      ctx.rotate(placement.angle);
      if (that.isMe){
	      ctx.fillStyle = "rgba(0,255,0,0.4)";
	      ctx.strokeStyle = "rgba(0,255,0,1)";
      } else{
	      ctx.fillStyle = "rgba(0,0,255,0.4)";
	      ctx.strokeStyle = "rgba(0,0,255,1)";
      }
      ctx.lineWidth = 0.1;
      for (var i = 0; i < this.shapes.length; i++) {
          var s = this.shapes[i];
          s.display(ctx);
      }
      ctx.restore();
		});
		this.body.setUserData("player", this);
		this.cfg = new Game.Player.Config(cfg);

		this.inputs = new Game.Player.Inputs();

		this.isMe = false;
	}
	handleInputEvent(ie){
		switch(ie.type){
			case "keydown":
				this.inputs.keysPressed.add(ie.e.key);
				break;
			case "keyup":
				this.inputs.keysPressed.delete(ie.e.key);
				break;
		}
	}
	step(dt){
		var cfg = this.cfg;

		var inp = this.inputs;
		var k = inp.keysPressed;
		var m = new f2.Vec2(k.has("d") - k.has("a"), k.has("s") - k.has("w"));
		var mag = m.magnitude();
		if (mag != 0){
			m = m.multiply(cfg.maxSpeed/mag);
		}

		var bd = this.body;
		bd.velocity = bd.velocity.add(m.subtract(bd.velocity).multiply(cfg.accConst*dt));
	}
	static serialize(plyr){
		return {
			body : f2.Body.serializeDynamics(plyr.body),
			cfg : Game.Player.Config.serialize(plyr.cfg),
			inputs : Game.Player.Inputs.serialize(plyr.inputs)
		}
	}
	static deserialize(data){
		var plyr = new Game.Player(data.cfg);
		plyr.body.updateDynamics(data.body);
		plyr.inputs.useSerializedData(data.inputs);
		return plyr;
	}
	static serializeUpdate(plyr){
		return {
			body : f2.Body.serializeDynamics(plyr.body)
		}
	}
	useSerializedUpdate(data){
		this.body.updateDynamics(data.body);
	}
}
Game.Player.Config = class{
	maxSpeed;
	accConst;
	constructor(opts){
		opts = opts || {};
		this.maxSpeed = opts.maxSpeed || 4;
		this.accConst = opts.accConst || 1;
	}
	static serialize(cfg){
		return {
			maxSpeed : cfg.maxSpeed,
			accConst : cfg.accConst
		}
	}
	static deserialize(data){
		return new Game.Player.Config(data);
	}
}
Game.Player.Pool = class{
	playerMap;
	constructor(){
		this.playerMap = {};
	}
	getPlayer(id){
		return this.playerMap[id];
	}
	addPlayer(p,id){
		this.playerMap[id] = p;
	}
	removePlayer(id){
		delete this.playerMap[id];
	}
	step(dt){
		for (var p in this.playerMap){
			this.getPlayer(p).step(dt);
		}
	}

}
Game.Player.Inputs = class{
	keysPressed;
	constructor(opts){
		opts = opts || {};
		this.keysPressed = new Set(opts.keysPressed || []);
	}
	static serialize(inp){
		return {
			keysPressed : Array.from(inp.keysPressed)
		}
	}
	useSerializedData(data){
		this.keysPressed = new Set(data.keysPressed);
	}
}
Game.Player.InputEvent = class{
	type;
	e;
	constructor(opts){
		this.type = opts.type;
		this.e = opts.e;
	}
}