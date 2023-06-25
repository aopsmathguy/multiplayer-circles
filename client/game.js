var Game = class{
	constants = {

	};
	gamestepNumber;
	world;
	playerPool;
	projectilePool;
	obstacles;
	eventLog; //implement this so serializing updates works more efficiently

	dt;
	constructor(opts){
		opts = opts || {};
		var that = this;

		this.gamestepNumber = 0;
    	this.world = new f2.World({ gravity: 0, scale: 1, gridSize: 2, time: Date.now() / 1000 });
		this.world.setContactFilter(function(m){
			return that.contactFilter(m.A, m.B);
		});
		this.world.setContactListener(function(m){
			that.contactListener(m.A, m.B);
		});

		this.playerPool = new Game.Player.Pool();
		this.projectilePool = new Game.Projectile.Pool();
		this.obstacles = new Game.Obstacles();
		this.eventLog = {};

		this.dt = opts.dt || 0.005;
	}
	contactFilter(worldObjA, worldObjB){
		var a = worldObjA.getUserData("gameObj");
		var b = worldObjB.getUserData("gameObj");
		var checkFuncs = {
			"plyr" : {
				"plyr" : function(){return true;},
				"proj" : function(c,d){return c.id != d.originId;},
				"obs" : function(){return true;}
			},
			"proj" : {
				"plyr" : function(c,d){return d.id != c.originId},
				"proj" : function(){return false;},
				"obs" : function(){return true;}
			},
			"obs" : {
				"plyr" : function(){return true;},
				"proj" : function(){return true;},
				"obs" : function(){return false;}
			}
		}
		return checkFuncs[a.type][b.type](a.obj, b.obj);
	}
	contactListener(worldObjA, worldObjB){
		var a = worldObjA.getUserData("gameObj");
		var b = worldObjB.getUserData("gameObj");
		var checkFuncs = {
			"plyr" : {
				"plyr" : function(){},
				"proj" : function(a, b){
					if (b.timeLeft > 0){
						b.timeLeft = 0
						a.health -= b.cfg.damage;
					}
				},
				"obs" : function(){}
			},
			"proj" : {
				"plyr" : function(a, b){
					if (a.timeLeft > 0){
						a.timeLeft = 0
						b.health -= a.cfg.damage;
					}
				},
				"proj" : function(){},
				"obs" : function(a, b){
					a.timeLeft = 0
				}
			},
			"obs" : {
				"plyr" : function(){},
				"proj" : function(a, b){
					b.timeLeft = 0
				},
				"obs" : function(){}
			}
		}
		checkFuncs[a.type][b.type](a.obj, b.obj);
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
	static saveStateInfo(game){//do inputs as well dumbass
		var dataPlyrPool = {};
		dataPlyrPool.playerMap = {};
		for (var i in game.playerPool.playerMap){
			dataPlyrPool.playerMap[i] = Game.Player.saveStateInfo(game.playerPool.playerMap[i]);
		}

		var dataProjPool = {};
		dataProjPool.projList = {};
		for (var i in game.projectilePool.projList){
			dataProjPool.projList[i] = Game.Projectile.serialize(game.projectilePool.projList[i]);
		}
		return {
			gamestepNumber : game.gamestepNumber,
			wTime : game.world.time,
			playerPool : dataPlyrPool,
			projectilePool : dataProjPool
		}
	}
	useStateInfo(data){
		this.gamestepNumber = data.gamestepNumber;
		this.world.time = data.wTime;
		for (var i in data.playerPool.playerMap){
			this.playerPool.playerMap[i].restoreStateInfo(data.playerPool.playerMap[i]);
		}
		for (var i in this.projectilePool.projList){
			this.removeProj(this.projectilePool.projList[i]);
		}
		// console.log(this.projectilePool.projList);
		for (var i in data.projectilePool.projList){
			this.addProj(
				Game.Projectile.deserialize(data.projectilePool.projList[i]),
				i
			);
		}
	}
	static serialize(game){
		var dataPlyrPool = {};
		dataPlyrPool.playerMap = {};
		for (var i in game.playerPool.playerMap){
			dataPlyrPool.playerMap[i] = Game.Player.serialize(game.playerPool.playerMap[i]);
		}
		var dataProjPool = {};
		dataProjPool.projList = {};
		for (var i in game.projectilePool.projList){
			dataProjPool.projList[i] = Game.Projectile.serialize(game.projectilePool.projList[i]);
		}
		return {
			gamestepNumber : game.gamestepNumber,
      		wTime : game.world.time,
			playerPool : dataPlyrPool,
			projectilePool : dataProjPool,
			obstacles : Game.Obstacles.serialize(game.obstacles)
		};
	}
	useSerialized(data, timeDiff){
		timeDiff = timeDiff || 0;
		this.gamestepNumber = data.gamestepNumber;
		this.world.time = data.wTime - timeDiff;
		for (var i in data.playerPool.playerMap){
			this.addPlayer(
				Game.Player.deserialize(data.playerPool.playerMap[i]),
				i
			);
		}
		for (var i in data.projectilePool.projList){
			this.addProj(
				Game.Projectile.deserialize(data.projectilePool.projList[i]),
				i
			);
		}
		for (var i in data.obstacles.obstacles){
			this.addObstacle(
				f2.Body.deserialize(data.obstacles.obstacles[i])
			);
		}
	}
	static encodeKeys(data, keywords){
		function encode(obj){
			var out;
			if (Array.isArray(obj)){
				out = [];
		        for (var i = 0; i < obj.length; i++){
		            out[i] = encode(obj[i]);
		        }
		    } else if (typeof obj === 'object'){
				out = {};
		        for (var i in obj){
					var key = keywords.revGet(i);
					if (key == undefined){
						// console.log(i)
						key = i;
					}
		            out[key] = encode(obj[i]);
		        }
		    } else{
				if (typeof obj == 'number' && !Number.isInteger(obj)){
					out = Number.parseFloat(obj.toFixed(3))
				}else{
					out = obj;
				}
			}
			return out;
		} return encode(data);
	}
	static decodeKeys(data, keywords){
		function decode(obj){
			var out;
			if (Array.isArray(obj)){
				out = [];
				for (var i = 0; i < obj.length; i++){
					out[i] = decode(obj[i]);
				}
			} else if (typeof obj === 'object'){
				out = {};
				for (var i in obj){
					var key = keywords.get(i);
					if (key == undefined){
						// console.log(i)
						key = i;
					}
					out[key] = decode(obj[i]);
				}
			}else{
				out = obj;
			}
			return out;
		} return decode(data);
	}
	static serializeUpdate(game){
		var dataPlyrPool = {};
		dataPlyrPool.playerMap = {};
		for (var i in game.playerPool.playerMap){
			dataPlyrPool.playerMap[i] = Game.Player.serializeUpdate(game.playerPool.playerMap[i]);
		}
		var eLog = {};
		for (var j in game.eventLog){
			eLog[j] = [];
			for (var i = 0 ; i < game.eventLog[j].length; i++){
				eLog[j].push(Game.Event.serialize(game.eventLog[j][i]));
			}
		}
		return {
			gamestepNumber : game.gamestepNumber,
      		wTime : game.world.time,
			playerPool : dataPlyrPool,
			eventLog : eLog
		}
	}
	useSerializedUpdate(data, timeDiff){
		timeDiff = timeDiff || 0;
		var playerPool = data.playerPool;
		var projectilePool = data.projectilePool;
		var eventLog = data.eventLog;
		for (var j in eventLog){
			this.eventLog[j] = [];
			for (var i = 0 ; i < eventLog[j].length; i++){
				var e = eventLog[j][i];
				this.eventLog[j].push(Game.Event.deserialize(e));
			}
		}
		this.stepUntil(data.gamestepNumber);
		this.world.time = data.wTime - timeDiff;
		for (var i in playerPool.playerMap){
			this.playerPool.getPlayer(i).useSerializedUpdate(playerPool.playerMap[i]);
		}
		// for (var i in projectilePool.projList){
		// 	this.projectilePool.projList[i].useSerializedUpdate(projectilePool.projList[i]);
		// }

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
		this.playerPool.addPlayer(p, id);
		this.world.addBody(p.body);
		p.id = id;
	}
	removePlayer(id){
		var p = this.playerPool.getPlayer(id);
		if (!p){return;}
		this.playerPool.removePlayer(id);
		this.world.removeBody(p.body);
	}
	fireBullet(player, id){
		var proj = Game.Projectile.createFromPlayer(player);
		this.addProj(proj, id);
	}
	addProj(p, id){
		this.projectilePool.addProj(p, id);
		this.world.addBody(p.body);
	}
	removeProj(p){
		this.projectilePool.deleteProj(p);
		this.world.removeBody(p.body);
	}
	stepUntil(stepNum){//client function
		var dt = this.dt;
		while(this.gamestepNumber < stepNum){
			var events = this.eventLog[this.gamestepNumber];
			if (events){
				for (var i = 0 ; i < events.length; i++){
					var e = events[i];
					this.handleEvent(e);
				}
			}
			delete this.eventLog[this.gamestepNumber];
			this.step(2);
		}
		var events = this.eventLog[this.gamestepNumber]
		if (events){
			for (var i = 0 ; i < events.length; i++){
				var e = events[i];
				this.handleEvent(e);
			}
		}
		delete this.eventLog[this.gamestepNumber];
		// console.log(this.eventLog)
		// this.clearEventLog();
	}
	step(client = 0){
		var dt = this.dt;
		this.gamestepNumber += 1;
		this.playerPool.step(this, client);
		this.projectilePool.step(this, client)
		this.world.step(dt);
	}
	clearEventLog(){
		this.eventLog = {};
	}
	onEvent(e){
		this.handleEvent(e);
		if (!this.eventLog[this.gamestepNumber]){
			this.eventLog[this.gamestepNumber] = [];
		}
		this.eventLog[this.gamestepNumber].push(e);
	}
	handleEvent(e){
		var data = e.eData;
		if (e.origin === 0){
			var e = data.e;
			switch(data.type){
			case "j":
				if (this.playerPool.getPlayer(e.id)){return;}
				var plyr = new Game.Player(e.cfg);
				this.addPlayer(plyr, e.id);
				break;
			case "l":
				this.removePlayer(e.id);
				break;
			case "nb":
				this.fireBullet(this.playerPool.getPlayer(e.pid), e.id);
				break;
			case "rb":
				this.removeProj(this.projectilePool.projList[e.id]);
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
	doEvent(e, client){
		if (client == 0){
			this.onEvent(e);
		} else if (client == 1){
			this.handleEvent(e);
		} else if (client == 2){

		}
	}
	doServerOnlyEvent(e, client){
		if (client == 0){
			this.onEvent(e);
		}
	}
	// handleEvents(){
	// 	for (var i = 0; i < this.eventLog.length; i++){
	// 		this.handleEvent(this.eventLog[i]);
	// 	}
	// }
}
Game.Utils = {};
Game.Utils.TwoWayMap = class {
    constructor(map) {
       this.map = map;
       this.reverseMap = {};
       for(const key in map) {
          const value = map[key];
          this.reverseMap[value] = key;
       }
    }
    get(key) { return this.map[key]; }
    revGet(key) { return this.reverseMap[key]; }
}
Game.Utils.makeid = function(length) {
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
			position : new f2.Vec2(Math.floor(width * Math.random()), Math.floor(length * Math.random()))
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
			    ctx.lineWidth = 0.05;
			  s.display(ctx);
			}
			ctx.restore();
		});
		b.setUserData("gameObj", {
			type : "obs"
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
	cfg;
	body;
	inputs;
	id;
	isMe;
	health;

	shootTimer;
	constructor(cfg){
		this.cfg = new Game.Player.Config(cfg);

		this.body = new f2.CircleBody({
		  radius : this.cfg.radius,
			mass : 1,
			inertia : Infinity
		});
		var that = this;
		this.body.setCustomDisplayPlacement(function(ctx, placement){
			ctx.save();
			ctx.translate(placement.position.x, placement.position.y);
			ctx.rotate(placement.angle);
			if (that.isMe){
			    if (that.inputs.mouseDown){
				    ctx.fillStyle = "rgba(0,255,0,0.8)";
				    ctx.strokeStyle = "rgba(0,255,0,1)";
				}else{
				    ctx.fillStyle = "rgba(0,255,0,0.4)";
				    ctx.strokeStyle = "rgba(0,255,0,1)";
				}
			} else{
				if (that.inputs.mouseDown){
					ctx.fillStyle = "rgba(0,0,255,0.8)";
					ctx.strokeStyle = "rgba(0,0,255,1)";
				}else{
					ctx.fillStyle = "rgba(0,0,255,0.4)";
					ctx.strokeStyle = "rgba(0,0,255,1)";
				}
			}
			ctx.lineWidth = 0.05;
			ctx.beginPath();
			ctx.arc(0,0,that.cfg.radius, 0, 2 * Math.PI);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(0,0);
			ctx.lineTo(that.cfg.gunLength, 0);
			ctx.stroke();

			ctx.strokeStyle = "rgba(255,255,255,0.7)";
			ctx.beginPath();
			ctx.moveTo(that.cfg.gunLength, 0);
			ctx.lineTo(that.cfg.gunLength * that.health/100, 0);
			ctx.stroke();

			ctx.restore();



		});
		this.body.setUserData("gameObj", {
			type : "plyr",
			obj : this
		});

		this.inputs = new Game.Player.Inputs();

		this.isMe = false;
		this.health = 100;
		this.shootTimer = 0;
	}
	handleInputEvent(ie){
		switch(ie.type){
			case "keydown":
				this.inputs.keysPressed.add(ie.e.key);
				break;
			case "keyup":
				this.inputs.keysPressed.delete(ie.e.key);
				break;
			case "mousemove":
				this.inputs.angle = ie.e.angle;
				break;
			case "mousedown":
				this.inputs.mouseDown = true;
				break;
			case "mouseup":
				this.inputs.mouseDown = false;
				break;
		}
	}
	move(dt){
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
		bd.angleVelocity = 0;
		bd.angle = this.inputs.angle;
	}
	step(game, client = 0){
		var dt = game.dt;

		var cfg = this.cfg;

		var inp = this.inputs;

		if (this.health <= 0){
			var e = new Game.Event(0, {
	            type : "l",
	            e : {
	                id : this.id
	            }
	        });
			game.doServerOnlyEvent(e, client);
			return;
		}
		this.shootTimer -= dt;
		if (inp.mouseDown && this.shootTimer <= 0){
			this.shootTimer = 60/cfg.fireRate;
			var e = new Game.Event(0, {
				type : "nb",
				e : {
					id : Game.Utils.makeid(4),
					pid : this.id
				}
			});
			game.doEvent(e, client);
		}

		this.move(dt);
	}
	static serialize(plyr){
		return {
			body : f2.Body.serializeDynamics(plyr.body),
			cfg : Game.Player.Config.serialize(plyr.cfg),
			inputs : Game.Player.Inputs.serialize(plyr.inputs),
			health : this.health
		}
	}
	static deserialize(data){
		var plyr = new Game.Player(data.cfg);
		plyr.body.updateDynamics(data.body);
		plyr.inputs.useSerializedData(data.inputs);
		plyr.health = data.health
		return plyr;
	}
	static saveStateInfo(plyr){
		return {
			body : f2.Body.serializeDynamics(plyr.body),
			inputs : Game.Player.Inputs.serialize(plyr.inputs),
			health : plyr.health,
			shootTimer : plyr.shootTimer
		}
	}
	restoreStateInfo(data){
		this.body.updateDynamics(data.body);
		this.inputs.useSerializedData(data.inputs);
		this.health = data.health;
		this.shootTimer = data.shootTimer;
	}
	static serializeUpdate(plyr){
		return {
			body : f2.Body.serializeDynamics(plyr.body),
			health : plyr.health,
			shootTimer : plyr.shootTimer
		}
	}
	useSerializedUpdate(data){
		this.body.updateDynamics(data.body);
		this.health = data.health;
		this.shootTimer = data.shootTimer;
	}
}
Game.Player.Config = class{
	radius;
	gunLength;

	maxSpeed;
	accConst;

	projSpeed;
	fireRate;
	projCfg;
	constructor(opts){
		opts = opts || {};
		this.radius = opts.radius || 0.5;
		this.gunLength = opts.gunLength || 1.5;
		this.maxSpeed = opts.maxSpeed || 2;
		this.accConst = opts.accConst || 1;
		this.projSpeed = opts.projSpeed || 20;
		this.fireRate = opts.fireRate || 600;
		this.projCfg = new Game.Projectile.Config(opts.projCfg);
	}
	static serialize(cfg){
		return {
			radius : cfg.radius,
			gunLength : cfg.gunLength,
			maxSpeed : cfg.maxSpeed,
			accConst : cfg.accConst,
			projSpeed : cfg.projSpeed,
			fireRate : cfg.fireRate,
			projCfg : Game.Projectile.Config.serialize(cfg.projCfg)
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
	step(game, client = 0){
		for (var p in this.playerMap){
			this.getPlayer(p).step(game, client);
		}
	}

}
Game.Player.Inputs = class{
	keysPressed;

	angle;
	mouseDown;
	constructor(opts){
		opts = opts || {};
		this.keysPressed = new Set(opts.keysPressed || []);

		this.angle = opts.angle || 0;
		this.mouseDown = opts.mouseDown == undefined ? false : true;
	}
	static serialize(inp){
		return {
			keysPressed : Array.from(inp.keysPressed),
			angle : inp.angle,
			mouseDown : inp.mouseDown
		}
	}
	useSerializedData(data){
		this.keysPressed = new Set(data.keysPressed);
		this.angle = data.angle;
		this.mouseDown = data.mouseDown;
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
Game.Projectile = class{
	body;
	timeLeft;
	cfg;

	id;
	originId;

	constructor(cfg){
		this.cfg = cfg;
		this.body = new f2.RectBody(cfg.body);
		this.body.setCustomDisplayPlacement(function(ctx, placement){
			ctx.save();
			ctx.translate(placement.position.x, placement.position.y);
			ctx.rotate(placement.angle);
			for (var i = 0; i < this.shapes.length; i++) {
			  var s = this.shapes[i];
			  ctx.fillStyle = "rgba(255,255,0,0.4)";
			  ctx.strokeStyle = "rgba(255,255,0,1)";
			  ctx.lineWidth = 0.05;
			  s.display(ctx);
			}
			ctx.restore();
		});
		this.body.setUserData("gameObj", {
			type : "proj",
			obj : this
		});
		this.timeLeft = cfg.expireT;
	}
	static createFromPlayer(player){
		var proj = new Game.Projectile(player.cfg.projCfg);
		proj.body.position = player.body.position.add(f2.Vec2.fromPolar(player.cfg.gunLength, player.body.angle));
		proj.body.angle = player.body.angle;
		proj.body.velocity = player.body.velocity.add(f2.Vec2.fromPolar(player.cfg.projSpeed, proj.body.angle));
		proj.body.angleVelocity = 0;
		proj.originId = player.id;
		return proj;
	}
	static serialize(proj){
		return {
			body : f2.Body.serializeDynamics(proj.body),
			cfg : Game.Projectile.Config.serialize(proj.cfg),
			originId : proj.originId
		}
	}
	static deserialize(data){
		var proj = new Game.Projectile(data.cfg);
		proj.body.updateDynamics(data.body);
		proj.originId = data.originId;
		return proj;
	}
	static serializeUpdate(proj){
		return {
			body : f2.Body.serializeDynamics(proj.body)
		}
	}
	useSerializedUpdate(data){
		this.body.updateDynamics(data.body);
	}
	step(game, client = 0){
		var dt = game.dt;
		this.body.velocity = this.body.velocity.multiply(1 - this.cfg.drag * dt)
		this.timeLeft -= dt;
		if (this.timeLeft <= 0){
			var e = new Game.Event(0, {
				type : "rb",
				e : {
					id : this.id
				}
			});
			game.doEvent(e, client);
		}
	}
}
Game.Projectile.Config = class{
	damage;
	expireT;
	drag;
	body;
	constructor(opts){
		opts = opts || {};
		this.damage = opts.damage || 5;
		this.expireT = opts.expireT || 0.7;
		this.drag = opts.drag || 1.2;
		this.body = opts.body || {
			width : 0.1,
			length : 0.6,
			mass : 0.06
		};
	}
	static serialize(cfg){
		return {
			damage : cfg.damage,
			expireT : cfg.expireT,
			drag : cfg.drag,
			body : cfg.body
		}
	}
	static deserialize(data){
		return new Game.Projectile.Config(data);
	}
}
Game.Projectile.Pool = class{
	projList;
	constructor(opts){
		this.projList = {};
	}
	step(game, client = 0){
		for (var p in this.projList){
			this.projList[p].step(game, client);
		}
	}
	addProj(proj, id){
		proj.id = id;
		this.projList[proj.id] = proj;
	}
	deleteProj(proj){
		delete this.projList[proj.id];
	}
}
