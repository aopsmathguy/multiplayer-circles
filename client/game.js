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
						b.timeLeft = 0;
						b.hitId = a.id;
					}
				},
				"obs" : function(){}
			},
			"proj" : {
				"plyr" : function(a, b){
					if (a.timeLeft > 0){
						a.timeLeft = 0;
						a.hitId = b.id;
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

	static encode(data){
		var buffers = [];
		buffers.push(Game.Utils.encodeType(data.gamestepNumber, Uint8Array));
		buffers.push(Game.Utils.encodeUint64(Math.floor(data.wTime * 1000)));

		var lengthPlayers = Object.keys(data.playerPool.playerMap).length;
		buffers.push(Game.Utils.encodeType(lengthPlayers, Uint8Array));
		for (var i in data.playerPool.playerMap){
			buffers.push(Game.Utils.encodeType(i, Uint8Array));
			var p = data.playerPool.playerMap[i];
			buffers.push(Game.Player.encode(p));
		}
		var lengthProjectiles = Object.keys(data.projectilePool.projList).length;
		buffers.push(Game.Utils.encodeType(lengthProjectiles, Uint8Array));
		for (var i in data.projectilePool.projList){
			buffers.push(Game.Utils.encodeType(i, Uint8Array));
			var p = data.projectilePool.projList[i];
			buffers.push(Game.Projectile.encode(p));
		}
		var lengthObstacles = data.obstacles.obstacles.length;
		buffers.push(Game.Utils.encodeType(lengthObstacles, Uint16Array));
		for (var i = 0; i < lengthObstacles; i++){
			var ob = data.obstacles.obstacles[i]
			buffers.push(Game.Utils.encodeF2Body(ob));
		}
		return Game.Utils.joinBuffers(buffers);
	}
	static decode(abr){
		var data = {};
		data.gamestepNumber = abr.readNextType(Uint8Array);
		data.wTime = 1/1000 * abr.readNextUint64();

		data.playerPool = {
			playerMap : {}
		};
		var lengthPlayers = abr.readNextType(Uint8Array);
		for (var i = 0; i < lengthPlayers; i++){
			var idx = abr.readNextType(Uint8Array);
			var p = Game.Player.decode(abr);
			data.playerPool.playerMap[idx] = p;
		}

		data.projectilePool = {
			projList : {}
		};
		var lengthProjectiles = abr.readNextType(Uint8Array);
		for (var i = 0; i < lengthProjectiles; i++){
			var idx = abr.readNextType(Uint8Array);
			var p = Game.Projectile.decode(abr);
			data.projectilePool.projList[idx] = p;
		}

		data.obstacles = {
			obstacles : []
		};
		var lengthObstacles = abr.readNextType(Uint16Array);
		for (var i = 0; i < lengthObstacles; i++){
			var ob = Game.Utils.decodeF2Body(abr);
			data.obstacles.obstacles.push(ob);
		};
		return data;
	}
	static encodeUpdate(data){
		var buffers = [];

		buffers.push(Game.Utils.encodeType(data.gamestepNumber, Uint8Array));
		buffers.push(Game.Utils.encodeUint64(Math.round(data.wTime * 1000)));

		var lengthPlayers = Object.keys(data.playerPool.playerMap).length;
		buffers.push(Game.Utils.encodeType(lengthPlayers, Uint8Array));
		for (var i in data.playerPool.playerMap){
			buffers.push(Game.Utils.encodeType(i, Uint8Array));
			var p = data.playerPool.playerMap[i];
			buffers.push(Game.Player.encodeUpdate(p));
		}


		var lengthEventLog = Object.keys(data.eventLog).length;
		buffers.push(Game.Utils.encodeType(lengthEventLog, Uint8Array));
		for (var i in data.eventLog){
			buffers.push(Game.Utils.encodeType(i, Uint8Array));
			var eventList = data.eventLog[i];
			buffers.push(Game.Utils.encodeType(eventList.length, Uint8Array));
			for (var j = 0; j < eventList.length; j++){
				buffers.push(Game.Event.encode(eventList[j]));
			}
		}
		return Game.Utils.joinBuffers(buffers);
	}
	static decodeUpdate(abr){
		var data = {};

		data.gamestepNumber = abr.readNextType(Uint8Array);
		data.wTime = 1/1000 * abr.readNextUint64();

		data.playerPool = {
			playerMap : {}
		};
		var lengthPlayers = abr.readNextType(Uint8Array);
		for (var i = 0; i < lengthPlayers; i++){
			var idx = abr.readNextType(Uint8Array);
			var p = Game.Player.decodeUpdate(abr);
			data.playerPool.playerMap[idx] = p;
		}


		data.eventLog = {};
		var lengthEventLog = abr.readNextType(Uint8Array);
		for (var i = 0; i < lengthEventLog; i++){
			var time = abr.readNextType(Uint8Array);
			data.eventLog[time] = [];
			var eventListLength = abr.readNextType(Uint8Array);
			for (var j = 0; j < eventListLength; j++){
				data.eventLog[time].push(Game.Event.decode(abr));
			}
		}
		return data;
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
		if (p){
			this.projectilePool.deleteProj(p);
			this.world.removeBody(p.body);
		}
	}
	stepUntil(stepNum){//client function
		var dt = this.dt;
		while(this.gamestepNumber != stepNum){
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
	}
	step(client = 0){
		var dt = this.dt;
		this.gamestepNumber = (this.gamestepNumber + 1) % 256;
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
			case Game.Event.Types.SPAWN_PLAYER://0
				if (this.playerPool.getPlayer(e.id)){return;}
				var plyr = new Game.Player(e.cfg);
				this.addPlayer(plyr, e.id);
				break;
			case Game.Event.Types.REMOVE_PLAYER://1
				this.removePlayer(e.id);
				break;
			case Game.Event.Types.SPAWN_BULLET://2
				this.fireBullet(this.playerPool.getPlayer(e.pid), e.id);
				break;
			case Game.Event.Types.REMOVE_BULLET://3
				var p = this.projectilePool.projList[e.id]
				if (p && p.hitId){
					var plyr = this.playerPool.getPlayer(p.hitId);
					plyr.health -= p.cfg.damage;
				}
				this.removeProj(p);
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
}
Game.Utils = class{
	static ArrayBufferReader = class {
		b;
		start;
		constructor(buffer){
			this.b = buffer;
			this.start = 0;
		}
		readNextType(type){
			var out = Game.Utils.decodeType(this.b.slice(this.start, this.start + type.BYTES_PER_ELEMENT), type)[0];
			this.start += type.BYTES_PER_ELEMENT;
			return out;
		}
		readNextUint64(){
			var out = Game.Utils.decodeUint64(this.b.slice(this.start, this.start + 2 * Uint32Array.BYTES_PER_ELEMENT));
			this.start += 2 * Uint32Array.BYTES_PER_ELEMENT;
			return out;
		}
		readNextChr(){
			var out = this.readNextType(Uint8Array);
			return String.fromCharCode(out);
		}
	}
	static encodeUint64(uint64num) {
	    var buffer = new ArrayBuffer(8);
	    let view = new Uint32Array(buffer);
	    view[0] = Math.floor(uint64num / 2 ** 32);
	    view[1] = uint64num % 2 ** 32;
	    return buffer
	}
	static decodeUint64(buffer) {
	    let view = new Uint32Array(buffer);
	    return view[0] * 2 ** 32 + view[1]
	}
	static encodeType(f, type) {
	    if (!Array.isArray(f)) {
	        f = [f];
	    }
	    var buffer = new ArrayBuffer(f.length * type.BYTES_PER_ELEMENT);
	    let view = new type(buffer);
	    for (var i = 0; i < f.length; i++) {
	        view[i] = f[i];
	    }
	    return buffer;
	}
	static decodeType(buffer, type) {
	    let view = new type(buffer);
		var f = [];
		for (var i = 0; i < view.length; i++) {
			f[i] = view[i];
		}
		return f;
	}
	static encodeChr(chr) {
	    return Game.Utils.encodeType(chr.charCodeAt(0), Uint8Array);
	}
	static joinBuffers(buffers){
		var l = 0;
		for (var i = 0; i < buffers.length; i++){
			l += buffers[i].byteLength;
		}
		var tmp = new Uint8Array(l);
		var idx = 0;
		for (var i = 0; i < buffers.length; i++){
			tmp.set( new Uint8Array( buffers[i] ), idx );
			idx += buffers[i].byteLength;
		}
		return tmp.buffer;
	}

	static encodeF2Shape(data){
		var buffers = [];
		buffers.push(Game.Utils.encodeChr(data.sType));
        switch (data.sType) {
            case "c":
				buffers.push(Game.Utils.encodeType([data.center.x, data.center.y, data.radius], Float32Array));
                break;
            case "p":
				buffers.push(Game.Utils.encodeType(data.vs.length, Uint8Array));
				var buildArray = [];
				for (var i = 0 ; i < data.vs.length; i++){
					buildArray.push(...[data.vs[i].x, data.vs[i].y]);
				}
				buffers.push(Game.Utils.encodeType(buildArray, Float32Array));
                break;
        }
		return Game.Utils.joinBuffers(buffers);
	}
	static decodeF2Shape(abr){
		var data = {};
		data.sType = abr.readNextChr();
		switch (data.sType) {
            case "c":
				data.center = {
					x: abr.readNextType(Float32Array),
					y: abr.readNextType(Float32Array)
				}
				data.radius = abr.readNextType(Float32Array);
                break;
            case "p":
				var length = abr.readNextType(Uint8Array);
				data.vs = [];
				for (var i = 0 ; i < length; i++){
					data.vs.push({
						x: abr.readNextType(Float32Array),
						y: abr.readNextType(Float32Array)
					});
				}
                break;
        }
		return data;
	}
	static encodeF2Body(data){
		var buffers = [];
		buffers.push(Game.Utils.encodeType(data.shapes.length, Uint8Array));
		for (var i = 0; i < data.shapes.length; i++){
			buffers.push(Game.Utils.encodeF2Shape(data.shapes[i]));
		}
		buffers.push(Game.Utils.encodeType([
			data.mass,
			data.inertia,
			data.kFriction,
			data.sFriction,
			data.elasticity,

			data.position.x, data.position.y,
			data.velocity.x, data.velocity.y,
			data.angle,
			data.angleVelocity
		], Float32Array));
		return Game.Utils.joinBuffers(buffers);
	}
	static decodeF2Body(abr){
		var data = {};
		var length = abr.readNextType(Uint8Array);
		data.shapes = [];
		for (var i = 0; i < length; i++){
			data.shapes.push(Game.Utils.decodeF2Shape(abr));
		}
		data.mass = abr.readNextType(Float32Array);
		data.inertia = abr.readNextType(Float32Array);
		data.kFriction = abr.readNextType(Float32Array);
		data.sFriction = abr.readNextType(Float32Array);
		data.elasticity = abr.readNextType(Float32Array);

		data.position = {
			x : abr.readNextType(Float32Array),
			y : abr.readNextType(Float32Array)
		}
		data.velocity = {
			x : abr.readNextType(Float32Array),
			y : abr.readNextType(Float32Array)
		}
		data.angle = abr.readNextType(Float32Array);
		data.angleVelocity = abr.readNextType(Float32Array);
		return data;
	}
	static encodeF2BodyDynamics(data){
		var buffers = [];
		buffers.push(Game.Utils.encodeType([
			data.position.x, data.position.y,
			data.velocity.x, data.velocity.y,
			data.angle,
			data.angleVelocity
		], Float32Array));
		return Game.Utils.joinBuffers(buffers);
	}
	static decodeF2BodyDynamics(abr){
		var data = {};
		data.position = {
			x : abr.readNextType(Float32Array),
			y : abr.readNextType(Float32Array)
		}
		data.velocity = {
			x : abr.readNextType(Float32Array),
			y : abr.readNextType(Float32Array)
		}
		data.angle = abr.readNextType(Float32Array);
		data.angleVelocity = abr.readNextType(Float32Array);
		return data;
	}
};
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
	static Types = {
		SPAWN_PLAYER : 0,
		REMOVE_PLAYER : 1,
		SPAWN_BULLET : 2,
		REMOVE_BULLET : 3,
		KEY_DOWN : 4,
		KEY_UP : 5,
		MOUSE_MOVE : 6,
		MOUSE_DOWN : 7,
		MOUSE_UP : 8
	}
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
	static encode(data){
		var buffers = [];
		buffers.push(Game.Utils.encodeType(data.origin, Uint8Array));
		var ed = data.eData;
		buffers.push(Game.Utils.encodeType(ed.type, Uint8Array));
		var eventData = ed.e;
		switch(ed.type){
		case Game.Event.Types.SPAWN_PLAYER:
			buffers.push(Game.Utils.encodeType(eventData.id, Uint8Array));
			buffers.push(Game.Player.Config.encode(eventData.cfg));
			break;
		case Game.Event.Types.REMOVE_PLAYER:
			buffers.push(Game.Utils.encodeType(eventData.id, Uint8Array));
			break;
		case Game.Event.Types.SPAWN_BULLET:
			buffers.push(Game.Utils.encodeType([eventData.id, eventData.pid], Uint8Array));
			break;
		case Game.Event.Types.REMOVE_BULLET:
			buffers.push(Game.Utils.encodeType(eventData.id, Uint8Array));
			buffers.push(Game.Utils.encodeType(eventData.hitId, Uint8Array));
			break;
		case Game.Event.Types.KEY_DOWN:
			buffers.push(Game.Utils.encodeChr(eventData.key));
			break;
		case Game.Event.Types.KEY_UP:
			buffers.push(Game.Utils.encodeChr(eventData.key));
			break;
		case Game.Event.Types.MOUSE_MOVE:
			buffers.push(Game.Utils.encodeType(eventData.angle, Float32Array));
			break;
		case Game.Event.Types.MOUSE_DOWN:
			break;
		case Game.Event.Types.MOUSE_UP:
			break;
		}
		return Game.Utils.joinBuffers(buffers);
	}
	static decode(abr){
		var data = {};
		data.origin = abr.readNextType(Uint8Array);
		data.eData = {};
		data.eData.type = abr.readNextType(Uint8Array);

		switch(data.eData.type){
		case Game.Event.Types.SPAWN_PLAYER:
			data.eData.e = {
				id : abr.readNextType(Uint8Array),
				cfg : Game.Player.Config.decode(abr)
			}
			break;
		case Game.Event.Types.REMOVE_PLAYER:
			data.eData.e = {
				id : abr.readNextType(Uint8Array)
			}
			break;
		case Game.Event.Types.SPAWN_BULLET:
			data.eData.e = {
				id : abr.readNextType(Uint8Array),
				pid : abr.readNextType(Uint8Array)
			}
			break;
		case Game.Event.Types.REMOVE_BULLET:
			data.eData.e = {
				id : abr.readNextType(Uint8Array),
				hitId : abr.readNextType(Uint8Array)
			}
			break;
		case Game.Event.Types.KEY_DOWN:
			data.eData.e = {
				key : abr.readNextChr()
			}
			break;
		case Game.Event.Types.KEY_UP:
			data.eData.e = {
				key : abr.readNextChr()
			}
			break;
		case Game.Event.Types.MOUSE_MOVE:
			data.eData.e = {
				angle : abr.readNextType(Float32Array)
			}
			break;
		case Game.Event.Types.MOUSE_DOWN:
			break;
		case Game.Event.Types.MOUSE_UP:
			break;
		}
		return data;
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

			var recoil = 0.4 * Math.max(that.shootTimer, 0)/(60/that.cfg.fireRate);
			ctx.translate(-recoil,0);
			ctx.lineWidth = 0.2;
			ctx.strokeStyle = "rgba(255,255,255,1)";
			ctx.beginPath();
			ctx.moveTo(that.cfg.radius,0);
			ctx.lineTo(that.cfg.radius + that.cfg.gunLength, 0);
			ctx.stroke();

			ctx.lineWidth = 0.1;
			ctx.strokeStyle = "rgba(255,0,0,1)";
			ctx.beginPath();
			ctx.moveTo(that.cfg.radius, 0);
			ctx.lineTo(that.cfg.radius + that.cfg.gunLength * that.health/100, 0);
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
			case Game.Event.Types.KEY_DOWN://0
				this.inputs.keysPressed.add(ie.e.key);
				break;
			case Game.Event.Types.KEY_UP://1
				this.inputs.keysPressed.delete(ie.e.key);
				break;
			case Game.Event.Types.MOUSE_MOVE://2
				this.inputs.angle = ie.e.angle;
				break;
			case Game.Event.Types.MOUSE_DOWN://3
				this.inputs.mouseDown = true;
				break;
			case Game.Event.Types.MOUSE_UP://4
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
	            type : Game.Event.Types.REMOVE_PLAYER,
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
				type : Game.Event.Types.SPAWN_BULLET,
				e : {
					id : game.projectilePool.createID(),
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
			health : plyr.health
		}
	}
	static deserialize(data){
		var plyr = new Game.Player(data.cfg);
		plyr.body.updateDynamics(data.body);
		plyr.inputs.useSerializedData(data.inputs);
		plyr.health = data.health
		return plyr;
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
	static encode(data){
		var buffers = [];
		buffers.push(Game.Utils.encodeF2BodyDynamics(data.body));
		buffers.push(Game.Player.Config.encode(data.cfg));
		buffers.push(Game.Player.Inputs.encode(data.inputs));
		buffers.push(Game.Utils.encodeType(data.health, Float32Array));
		return Game.Utils.joinBuffers(buffers);
	}
	static decode(abr){
		var data = {};
		data.body = Game.Utils.decodeF2BodyDynamics(abr);
		data.cfg = Game.Player.Config.decode(abr);
		data.inputs = Game.Player.Inputs.decode(abr);
		data.health = abr.readNextType(Float32Array);
		return data;
	}
	static encodeUpdate(data){
		var buffers = [];
		buffers.push(Game.Utils.encodeF2BodyDynamics(data.body));
		buffers.push(Game.Utils.encodeType(data.health, Float32Array));
		buffers.push(Game.Utils.encodeType(data.shootTimer, Float32Array));
		return Game.Utils.joinBuffers(buffers);
	}
	static decodeUpdate(abr){
		var data = {};
		data.body = Game.Utils.decodeF2BodyDynamics(abr);
		data.health = abr.readNextType(Float32Array);
		data.shootTimer = abr.readNextType(Float32Array);
		return data;
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
		this.gunLength = opts.gunLength || 1.0;
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

	static encode(data){
		var buffers = [];
		buffers.push(
			Game.Utils.encodeType(data.radius, Float32Array),
			Game.Utils.encodeType(data.gunLength, Float32Array),
			Game.Utils.encodeType(data.maxSpeed, Float32Array),
			Game.Utils.encodeType(data.accConst, Float32Array),
			Game.Utils.encodeType(data.projSpeed, Float32Array),
			Game.Utils.encodeType(data.fireRate, Float32Array),
			Game.Projectile.Config.encode(data.projCfg)
		);
		return Game.Utils.joinBuffers(buffers);
	}
	static decode(abr){
		var data = {};
		data.radius = abr.readNextType(Float32Array);
		data.gunLength = abr.readNextType(Float32Array);
		data.maxSpeed = abr.readNextType(Float32Array);
		data.accConst = abr.readNextType(Float32Array);
		data.projSpeed = abr.readNextType(Float32Array);
		data.fireRate = abr.readNextType(Float32Array);
		data.projCfg = Game.Projectile.Config.decode(abr);
		return data;
	}
}
Game.Player.Pool = class{
	playerMap;
	constructor(){
		this.playerMap = {};
	}
	createID(){
		var id = 0;
		while (id == 0 || this.playerMap[id]){
			id = Math.floor(256 * Math.random());
		}
		return id;
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
	static encode(data){
		var buffers = [];
		buffers.push(Game.Utils.encodeType(data.angle, Float32Array));
		buffers.push(Game.Utils.encodeType(data.mouseDown ? 1 : 0, Uint8Array));

		buffers.push(Game.Utils.encodeType(data.keysPressed.length, Uint8Array));
		for (var i = 0; i < data.keysPressed.length; i++){
			buffers.push(Game.Utils.encodeChr(data.keysPressed[i]));
		}
		return Game.Utils.joinBuffers(buffers);
	}
	static decode(abr){
		var data = {};
		data.angle = abr.readNextType(Float32Array);
		data.mouseDown = abr.readNextType(Uint8Array);

		data.keysPressed = [];
		var length = abr.readNextType(Uint8Array);
		for (var i = 0; i < length; i++){
			data.keysPressed.push(abr.readNextChr());
		}
		return data;
	}
}
Game.Projectile = class{
	body;
	timeLeft;
	cfg;

	id;
	originId;
	hitId;
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

		this.hitId = 0;
	}
	static createFromPlayer(player){
		var proj = new Game.Projectile(player.cfg.projCfg);
		proj.body.position = player.body.position.add(f2.Vec2.fromPolar(player.cfg.radius + player.cfg.gunLength, player.body.angle));
		proj.body.angle = player.body.angle;
		proj.body.velocity = player.body.velocity.add(f2.Vec2.fromPolar(player.cfg.projSpeed, proj.body.angle));
		proj.body.angleVelocity = 0;
		proj.originId = player.id;
		return proj;
	}
	static serialize(proj){
		return {
			cfg : Game.Projectile.Config.serialize(proj.cfg),
			body : f2.Body.serializeDynamics(proj.body),
			timeLeft : proj.timeLeft,
			originId : proj.originId
		}
	}
	static deserialize(data){
		var proj = new Game.Projectile(data.cfg);
		proj.body.updateDynamics(data.body);
		proj.timeLeft = data.timeLeft;
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

	static encode(data){
		var buffers = [];
		buffers.push(Game.Projectile.Config.encode(data.cfg));
		buffers.push(Game.Utils.encodeF2BodyDynamics(data.body));
		buffers.push(Game.Utils.encodeType(data.timeLeft, Float32Array));
		buffers.push(Game.Utils.encodeType(data.originId, Uint8Array));
		return Game.Utils.joinBuffers(buffers);
	}
	static decode(abr){
		var data = {};
		data.cfg = Game.Projectile.Config.decode(abr);
		data.body = Game.Utils.decodeF2BodyDynamics(abr);
		data.timeLeft = abr.readNextType(Float32Array);
		data.originId = abr.readNextType(Uint8Array);
		return data;
	}
	step(game, client = 0){
		var dt = game.dt;
		this.body.velocity = this.body.velocity.multiply(1 - this.cfg.drag * dt)
		this.timeLeft -= dt;
		if (this.timeLeft <= 0){
			var e = new Game.Event(0, {
				type : Game.Event.Types.REMOVE_BULLET,
				e : {
					id : this.id,
					hitId : this.hitId
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
	static encode(data){
		var buffers = [];
		buffers.push(
			Game.Utils.encodeType(data.damage, Float32Array),
			Game.Utils.encodeType(data.expireT, Float32Array),
			Game.Utils.encodeType(data.drag, Float32Array),
			Game.Utils.encodeType(data.body.width, Float32Array),
			Game.Utils.encodeType(data.body.length, Float32Array),
			Game.Utils.encodeType(data.body.mass, Float32Array)
		);
		return Game.Utils.joinBuffers(buffers);
	}
	static decode(abr){
		var data = {};
		data.damage = abr.readNextType(Float32Array);
		data.expireT = abr.readNextType(Float32Array);
		data.drag = abr.readNextType(Float32Array);
		data.body = {
			width : abr.readNextType(Float32Array),
			length : abr.readNextType(Float32Array),
			mass : abr.readNextType(Float32Array)
		}
		return data;
	}
}
Game.Projectile.Pool = class{
	projList;
	constructor(opts){
		this.projList = {};
	}
	createID(){
		var id = 0;
		while (id == 0 || this.projList[id]){
			id = Math.floor(256 * Math.random());
		}
		return id;
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
