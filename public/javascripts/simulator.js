/**
 * author: Guillaume Malette <gmalette@gmail.com> @gmalette
 * author: Christian Blais <christ.blais@gmail.com> @christianblais
 * website: thirdside.ca
 * date: 07/03/2011
 */


TS.Node = Class.create(TS, {
	initialize: function ($super, id, type, x, y)
	{
		$super();
		this.position	= {x: x, y: y};
		this.velocity	= {x: 0, y: 0};
		this.mass		= 3;
		this.id			= id;
		this.type		= type;
		this.links		= new Array();
		this.playerId	= null;
		this.nbSoldiers	= 0;
	},
	
	linkTo: function (otherNode)
	{
		this.links.push(otherNode.id);
	},
	
	setSoldiers: function(playerId, nbSoldiers)
	{
		this.playerId = playerId,
		this.nbSoldiers = nbSoldiers;
	},

	repulsion: function (otherNode)
	{
		
	},
   
	attraction: function (otherNode)
	{
		
	}
});


TS.NodeGraph = Class.create(TS, {
	initialize: function ($super, map)
	{
		$super();
		this.nodes = {};
		this.map = map;
		this.directed = map.infos.directed || false;
		
		// Create nodes
		this.map.nodes.each(function(node){
			this.nodes[node.id] = new TS.Node(node.id, node.type, node.x, node.y);
		}, this);
		
		// Add paths between the nodes
		this.map.paths.each(function(path){
			this.nodes[path.from].linkTo(this.nodes[path.to]);
			if (!this.directed)
				this.nodes[path.to].linkTo(this.nodes[path.from]);
		}, this);
	},

	// Place the nodes on the graph
	computeNodePositions: function ()
	{
		this.setupNodes();
		var total_energy = 0;
		while (total_energy > 100)
		{
			this.nodes.each(function(node){
				var attraction = {x: 0, y: 0};
				var repulsion = {x: 0, y: 0};
				this.nodes.each(function(otherNode){
					if (otherNode == node) {return;}
					repulsion = node.repulsion(otherNode);
					if (node.isConnected(otherNode))
					{
						attraction = node.attraction(otherNode);
					}
				}, this);
			
				var net_force = {x: attraction.x + repulsion.x, y: attraction.y + repulsion.y};
				node.velocity = {x: net_force.x * NodeGraph.DAMPING * NodeGraph.TIMESTEP, y: net_force.y * NodeGraph.DAMPING * NodeGraph.TIMESTEP};
				node.position = {x: node.position.x + node.velocity.x * NodeGraph.TIMESTEP, y: node.position.y + node.velocity.y * NodeGraph.TIMESTEP}
				var node_energy = node.mass * Math.sqrt(Math.sqrt(Math.pow(node.velocity.x, 2) + Math.pow(node.velocity.y, 2)), 2);
			}, this);
		}
	},
	
	// Initial setup. Ensures that two nodes aren't on the same position
	setupNodes: function()
	{
		for (i= 0; i < this.nodes.length; i++)
		{
			nodes[i].move(i, i);
		}
	}
});


Object.extend(TS.NodeGraph, {
	DAMPING : .5,
	TIMESTEP : .5
})

TS.AIMap = Class.create(TS, {
	initialize: function ($super, container, config_url)
	{
		$super();
		this.config_url	= config_url;
		this.container	= $(container);
		this.layers		= {};
		this.graphics	= {};
		this.moves		= [];
		this.color		= new TS.Color();
		
		// load config
		new Ajax.Request( config_url, {method: 'get', onComplete: this.onConfigLoaded.bindAsEventListener(this)});
	},
	
	// Callback after the Map's config are loaded
	onConfigLoaded: function (request)
	{
		this.config = request.responseText.evalJSON();
		
		if (!this.config) {alert("Map Error"); return};
		
		this.nodeGraph = new TS.NodeGraph(this.config);
		
		// Create a canvas element for each display layer
		$A(['background', 'paths', 'nodes', 'moves', 'players', 'info']).each(function(layer) {
			this.layers[layer] = Raphael(0, 0, this.config.infos.width,  this.config.infos.height);
			this.container.insert(this.layers[layer].canvas);
		}, this);
		
		// Preload all the images
		this.config.types.each(function(type){
			var img = new Image();
			img.onload = this.onNodeImageLoad.bindAsEventListener(this, type.name);
			img.src = type.image;
		}, this);
		
		this.fire("ready");
	},
	
	// Callback after each image is loaded
	onNodeImageLoad: function (event, type)
	{
		this.graphics.nodes = this.graphics.nodes || {};
		this.graphics.nodes[type] = event.findElement();
		
		if (Object.keys(this.graphics.nodes).length == this.config.types.size())
			this.draw(Object.keys(this.layers));
	},

	// Returns a context associated with a layer's canvas
	getSVG: function (layer)
	{
		return this.layers[layer] ? this.layers[layer] : null;	
	},
	
	// Called every time a new turn happens
	onTurn: function (turn)
	{
		if (turn)
		{
			this.moves = turn.moves;
			turn.states.each(function(nodeState) {
				var node = this.nodeGraph.nodes[nodeState.node_id];
				node.setSoldiers(nodeState.player_id, nodeState.nb_soldiers);
			}, this);
		} else
		{
			this.moves = [];
		}
		this.draw(['moves', 'players']);
	}, 
	
	// Draws the layers to the screen
	draw: function (drawableLayers)
	{
		drawableLayers = $A(drawableLayers);
		
		drawableLayers.each(function (layer){
			this.getSVG(layer).clear();
		}, this);
		
		Object.keys(this.nodeGraph.nodes).each(function(nodeId) {
			
			var node = this.nodeGraph.nodes[nodeId];
			
			// Draw nodes only if necessary (1st time)		
			if (drawableLayers.include('nodes'))
			{
				var img = this.graphics.nodes[node.type];
				// Draw Nodes
				this.getSVG('nodes').image(
						img.src,
						node.position.x - img.width / 2,
						node.position.y - img.height / 2,
						img.width,
						img.height
				);
			}
			
			// Draw paths only if necessary (1st time)
			if (drawableLayers.include('paths'))
			{
				node.links.each(function(otherNodeId) {
					var to = this.nodeGraph.nodes[otherNodeId];
						
					// Draw Paths
					var svg = this.getSVG('paths');
					this.drawArrow(svg, node.position.x, node.position.y, to.position.x, to.position.y, 16, "#444444")
				}, this);
			}
			
			if (drawableLayers.include('players'))
			{
				
				// PLAYERS
				var svg = this.getSVG('players');
				
				var soldiers_box_width	  = 50;
				var soldiers_box_height	 = 25;
				var soldiers_box_padding_x  = 10;
				var soldiers_box_padding_y  = 7;
				
				if (node.nbSoldiers || node.playerId != null)
				{
					var tx = node.position.x + soldiers_box_width / 2 + soldiers_box_padding_x;
					var ty = node.position.y + soldiers_box_padding_y;
					t = svg.text(tx, ty, node.nbSoldiers);
					t.attr({"font-size": 24});
					var dim = {
						x: tx - soldiers_box_padding_x - t[0].clientWidth/2,
						y: ty - soldiers_box_padding_y - t[0].clientHeight/2,
						w: t[0].clientWidth + soldiers_box_padding_x * 2,
						h: t[0].clientHeight + soldiers_box_padding_y * 2
					}
					r = svg.rect(dim.x, dim.y, dim.w, dim.h, 6);
					r.attr({stroke:"#000000", "fill-opacity": .85, fill: this.getPlayerColor(node.playerId)});
					t.insertAfter(r);
				}
			}
		}, this);
		if (drawableLayers.include('moves'))
		{
			this.moves.each(function (move) {
				this.drawMove(move);
			}, this);
		}
	},
	// Fonction pour tester l'etalage des couleurs "aleatoires"
	layOut: function ()
	{
		// PLAYERS
		Object.keys(this.layers).each(function(layer) {
			this.getSVG(layer).clear();
		}, this);
		
		var svg = this.getSVG('info');
		
		var soldiers_box_width	  = 50;
		var soldiers_box_height	 = 25;
		var soldiers_box_padding_x  = 10;
		var soldiers_box_padding_y  = 7;
		for (i = 0; i < 36; i++)
		{
			var tx = ((i%12)+1) * 35;
			var ty = 25 + Math.floor(i/12) * 40;
			t = svg.text(tx, ty, 0);
			t.attr({"font-size": 24});
			var dim = {
				x: tx - soldiers_box_padding_x - t[0].clientWidth/2,
				y: ty - soldiers_box_padding_y - t[0].clientHeight/2,
				w: t[0].clientWidth + soldiers_box_padding_x * 2,
				h: t[0].clientHeight + soldiers_box_padding_y * 2
			}
			r = svg.rect(dim.x, dim.y, dim.w, dim.h, 6);
			r.attr({stroke:"#000000", "fill-opacity": .85, fill: this.color.getColor(i+1)});
			t.insertAfter(r);
		}
	},
	
	
	
	drawMove: function (move)
	{
		var svg = this.getSVG("players");
		var nodeFrom = this.nodeGraph.nodes[move.from];
		var nodeTo = this.nodeGraph.nodes[move.to];
		this.drawArrow(svg, nodeFrom.position.x, nodeFrom.position.y, nodeTo.position.x, nodeTo.position.y, 15, this.getPlayerColor(move.player_id), false);
	},
	
	drawArrow: function (svg, fromX, fromY, toX, toY, size, color, noarrow)
	{
		noarrow = noarrow || false;
		color = color || "#000000";
		
		//var path = "M#{fromX} #{fromY}S#{controlX} #{controlY} #{toX} #{toY}";
		var path = "M#{fromX} #{fromY}L#{toX} #{toY}";
		var inter = {fromX: fromX, fromY: fromY, toX: toX, toY: toY, controlX: toX, controlY: toY - (toY - fromY)/2};
		var attr = {stroke: color, "stroke-width": 4, "stroke-linejoin": "round"};
		pathStr = path.interpolate(inter);
		path = svg.path(pathStr);
		path.attr(attr);
		
		if (!noarrow)
		{
			path = "M#{toX} #{toY}L#{a1X} #{a1Y}L#{a2X} #{a2Y}L#{toX} #{toY}";
			var angle = Math.atan2(toY - fromY, toX - fromX);
			var angle1 = angle + Math.PI / 8;
			var angle2 = angle - Math.PI / 8;
			var inter = Object.extend(inter, {
				a1X: Math.round(toX - Math.cos(angle1) * size),
				a1Y: Math.round(toY - Math.sin(angle1) * size),
				a2X: Math.round(toX - Math.cos(angle2) * size),
				a2Y: Math.round(toY - Math.sin(angle2) * size)
			});
			
			pathStr = path.interpolate(inter);
			path = svg.path(pathStr);
			attr.fill = color;
			path.attr(attr);
		}
	},
	
	getPlayerColor: function (playerId)
	{
		if (!playerId || playerId <= 0)
		{
			return "#CCCCCC";
		}
		
		return this.color.getColor(this.getPlayerIndex(playerId+1));
	},
	
	getPlayerIndex: function (playerId)
	{
		if (this.players)
		{
			for (i = 0; i < this.players.length; i++)
			{
				if (this.players[i].id == playerId) 
				{
					return i;
				}
			}
		}
		
		return -1;
	},
	
	getPlayerInfo: function (playerId)
	{
		var info = {
			soldiers: 0, 
			cities: 0, 
			id: playerId, 
			color: this.getPlayerColor(playerId), 
			name: this.players[this.getPlayerIndex(playerId)].name
		};
		
		Object.keys(this.nodeGraph.nodes).each(function(nodeId) {
			var node = this.nodeGraph.nodes[nodeId];
		
			if (node.playerId == playerId)
			{
				info.cities += 1;
				info.soldiers += node.nbSoldiers;
			}
		}, this);
		
		return info;
	}
});

TS.AIPlayback = Class.create(TS, {
	initialize: function ($super, container, controls, map_url, game_description_url)
	{
		$super();
		this.turnNumber = 0;
		this.template = '<li><div class="color-box" style="background-color: #{color};"></div><span>#{name}: #{cities}, #{soldiers}</span></li>';
		this.map = new TS.AIMap(container, map_url);
		this.map.observe('ready', this.onMapReady.bindAsEventListener(this));
		this.ready = {map:false, self:false};
		this.controls = $(controls);
		this.buttons = ["rewind", "back", "play", "pause", "next", "end"];
		this.buttons.each(function (control) {
			this[control] = this.controls.down("#" + control);
			this[control].observe("click", this["on" + control.capitalize()].bindAsEventListener(this));
		}, this);
		
		this.timer = new TS.Timer();
		this.timer.observe("timer", this.onTimer.bind(this));
		
		this.playerList = $("player-list");
		
		this.enableControls();
		
		new Ajax.Request( game_description_url, {method: 'get', onComplete: this.onGameDescriptionLoaded.bindAsEventListener(this)});
	},
	
	onRewind: function (e)
	{
		this.onPause();
		this.turnNumber = 0;
		this.drawCurrentTurn();
	},
	
	onBack: function (e)
	{
		this.onPause();
		this.turnNumber--;
		this.drawCurrentTurn();
	},
	
	onPlay: function (e)
	{
		if (this.turnNumber >= this.getMaxTurn())
		{
			this.turnNumber = 0;
		}
		
		this.start();
		this.enableControls();
	},
	
	onPause: function ()
	{
		this.stop();
		this.enableControls();
	},
	
	onNext: function (e)
	{
		this.onPause();
		this.turnNumber++;
		this.drawCurrentTurn();
	},
	
	onEnd: function (e)
	{
		this.turnNumber = this.getMaxTurn();
		this.drawCurrentTurn();
	},
	
	drawCurrentTurn: function (clear)
	{
		clear = clear || false;
		
		if (clear)
		{
			this.turn = null;
		} else {
			this.turn = this.gameDescription.turns[this.turnNumber];
		}
		
		this.map.onTurn(this.turn);
		this.enableControls();
		this.updatePlayerList();
	},
	
	updatePlayerList: function ()
	{
		this.playerList.update();
		var playerInfos = this.gameDescription.infos.players.collect(function(player) {
			return this.map.getPlayerInfo(player.id);
		}, this).sortBy(function(infos){
			return infos.cities;
		}).reverse().each(function(infos){
			infos.name = 
			this.playerList.insert(this.template.interpolate(infos));
		}, this);
	},
	
	getMaxTurn: function ()
	{
		return this.gameDescription.turns.length - 1;
	},
	
	onMapReady: function ()
	{
		this.ready.map = true;
		if (this.isReady())
		{
			this.enableControls();
		}
	},
	
	enableControls: function ()
	{
		this.buttons.each(function(control){
			this[control].disabled = this.isReady() ? "" : "disabled";
		},this);
		
		this.play[this.timer.isRunning() ? "hide" : "show"]();
		this.pause[this.timer.isRunning() ? "show" : "hide"]();
		
		if (this.turnNumber == 0)
		{
			this.back.disabled = "disabled";
			this.rewind.disabled = "disabled";
		} else if (this.turnNumber >= this.getMaxTurn())
		{
			this.next.disabled = "disabled";
			this.end.disabled = "disabled;"
		}
	},
	
	onGameDescriptionLoaded: function (request)
	{
		this.ready.self = true;
		
		this.gameDescription = request.responseText.evalJSON();
		
		this.map.players = this.gameDescription.infos.players;
		
		if (this.isReady())
		{
			this.enableControls();
		}
	},
	
	isReady: function ()
	{
		return $H(this.ready).all();
	},
	
	stop: function ()
	{
		this.timer.stop();
	},
	
	start: function ()
	{
		this.timer.start(500, -1);
	},
	
	onTimer: function ()
	{
		var clear = false;
		if (this.getMaxTurn() >= this.turnNumber)
		{
			if (this.turn)
			{
				clear = true;
			}
		} else
		{
			clear = true;
			this.timer.stop();
		}
		
		this.drawCurrentTurn(clear);
		this.enableControls();
		
		if (this.timer.isRunning() && clear)
		{
			this.turnNumber++;
		}
		
		// Juste pour afficher les couleurs generees
		if (this.getMaxTurn() < this.turnNumber)
		{
			//this.map.layOut();
		}
	}
})