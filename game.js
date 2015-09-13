"use strict";

var gameState = 'idle',
	gameTimer = null,
	score = 0,

	overlay = $('o'),
	container = $('f'),
	scoreboard = $('s'),
	healthboard = $('h'),

	runes = {
		'0': { name: 'Uruz', symbol: 'ᚢ', board: $('ru'), cls: 'rU' },
		'1': { name: 'Teiwaz', symbol: 'ᛏ', board: $('rt'), cls: 'rT' },
		'2': { name: 'Gebo', symbol: 'ᚷ', board: $('rg'), cls: 'rG' },
		'3': { name: 'Hagalaz', symbol: 'ᚻ', board: $('rh'), cls: 'rH' }
	},

	// Field size.
	W = Math.floor(container.offsetWidth / 20),
	H = Math.floor(container.offsetHeight / 20),

	// Gap of hidden Tiles in front and back of the Field.
	xgap = 10,

	// One tick time.
	ticktime = 120,

	// Declare vars in one place.
	controls = {},
	field,
	mage,

	// Service vars, used everywhere.
	key,
	i,
	j;

function $(id) {
	return document.getElementById(id);
}

function rand(x, y) {
	if (x && !y) {
		return Math.floor(Math.random() * x);
	} else if (x && y) {
		return rand(x) + y;
	} else {
		return Math.random();
	}
}

// Random position for new enemies.
function randomY(h) {
	return rand(H - h);
}

// Random Rune (or its absence) to put into enemy.
function randomRune(chance) {
	if (rand() < chance)
		return runes[rand(4)];
}

// Pseudo-inheritance.
function extend(child, parent) {
	for (key in parent)
		if (!child[key])
			child[key] = parent[key];
	child._ = parent.constructor.prototype;
}

function scorecounter(points) {
	score += points;
	scoreboard.innerHTML = score;
}

function healthcounter(hp) {
	healthboard.innerHTML = hp;
	healthboard.className = 'h' + hp;
}

/* FIELD */
function Field() {
	var f = this.f = [],
		hidden;
	for (i = 0; i < H; i++) {
		f[i] = [];
		for (j = 0; j < W + 2*xgap; j++) {
			hidden = j < xgap || j >= W+xgap;
			f[i][j] = new Tile(j, i, hidden);
		}
	}
}

Field.prototype.is = function (x, y) {
	if (this.f[y] && this.f[y][x+xgap]) {
		// If there is a Unit already in a Tile then return -1.
		return this.f[y][x+xgap].u ? -1 : 1;
	} else {
		return 0;
	}
};

Field.prototype.get = function (x, y) {
	return this.f[y][x+xgap];
};

Field.prototype.print = function (msg, delayOff, callback) {
	clearTimeout(this._t);
	overlay.innerHTML = msg;
	overlay.style.display = 'block';
	this._t = setTimeout(function () {
		overlay.style.display = 'none';
		if (callback) setTimeout(callback, 400);
	}, delayOff || 2000);
};

Field.prototype.interrupt = function (callback) {
	clearTimeout(this._t);
	setTimeout(function () {
		overlay.style.display = 'none';
	}, 500);
	callback();
};

/* TILE */
function Tile(x, y, hid) {
	var e = this.e = document.createElement('div');
	this._c();
	if (hid) e.style.display = 'none';
	container.appendChild(e);
}

// Name _c is for setClassName.
Tile.prototype._c = function (name) {
	this.e.className = name ? 'T ' + name : 'T';
};

Tile.prototype.set = function (unit) {
	unit = unit || null;
	this.u = unit;
	this.e.innerHTML = unit ? unit.gl() : '';
	this._c(unit ? unit.cls : 0);
};

/* UNIT */
function Unit(wrd, cls, crd, x, y, hp) {

	var self = this;

	// A word that's used as a texture.
	self.wrd = wrd;
	// Class name for CSS beauty.
	self.cls = cls;
	// Coordinates.
	self.crd = crd;
	// Current X and Y.
	self.cX = x || 0;
	self.cY = y || 0;
	// Hit points.
	self.hp = hp || 1;

	// Default speed and power (kind of fallback).
	self.spd = 1;
	self.pow = 1;

	// Pointer for word-texture rendering.
	self._p = 0;

	// Then draw.
	self.mv();

}

// Name gc is for getCoordinates.
Unit.prototype.gc = function (x, y) {
	return this.crd.map(function (item) {
		return [item[0] + (x|0), item[1] + (y|0)];
	});
};

// Name gl is for getLetter.
Unit.prototype.gl = function () {
	if (this._p >= this.wrd.length) this._p = 0;
	return this.wrd.charAt(this._p++);
};

// Name mv is for move.
Unit.prototype.mv = function (x, y) {

	var self = this,
		collisions,
		collidee,
		nX = self.cX + (x|0),
		nY = self.cY + (y|0),
		cross;

	self._nc = self.gc(nX, nY);
	
	if (self._lc) {
		cross = self._nc.filter(function (item) {
			for (i = 0; i < self._lc.length; i++)
				if (item[0] === self._lc[i][0] && item[1] === self._lc[i][1])
					return false;
			return true;
		});
	} else {
		cross = self._nc;
	}
	
	cross.forEach(function (item) {
		var isPlace = field.is(item[0], item[1]);
		if (isPlace < 1) collisions = true;
		if (isPlace === 0) {
			if (self.type !== 'mage') self.hit(10000);
		} else if (isPlace === -1) {
			collidee = field.get(item[0], item[1]).u;
			if (collidee.type !== self.type) {
				self.hit(collidee.pow, collidee);
				collidee.hit(self.pow, self);
			}
		}
	});

	if (!collisions) {
		self.cX = nX;
		self.cY = nY;
		self.undraw();
		self.draw();
		self._lc = self._nc;
	}

};

Unit.prototype.draw = function () {
	var self = this;
	self._nc.forEach(function (item) {
		field.get(item[0], item[1]).set(self);
	});
};

Unit.prototype.undraw = function () {
	if (!this._lc) return;
	this._lc.forEach(function (item) {
		field.get(item[0], item[1]).set(null);
	});
};

Unit.prototype.hit = function (pow, cause) {
	var self = this;
	self.hp -= pow;
	if (self.hp <= 0) {
		// Getting points.
		if (cause && (cause.type === 'bullet' || cause.type === 'mage'))
			scorecounter(self.points|0);
		// Switching off.
		if (self.timer)
			clearTimeout(self.timer);
		self.undraw();
		if (self.cb)
			self.cb.call(self, self);
		if (self.rune)
			new Rune(self.rune, self.gc(self.cX, self.cY));
	}
};

Unit.prototype._t = function () {
	var self = this;
	// Avoiding endless loop.
	if (self.hp <= 0) return self.undraw();
	// Space economy for tick() methods.
	self.timer = setTimeout(function () {
		self.tick();
	}, ticktime / (self.spd || 1));
};

/* MAGE */
function Mage() {
	var self = this;
	// Passed in Unit: texture symbol, className, coords, x, y, HP.
	extend(self, new Unit('⇒', 'M', [[1,0], [0,1], [1,1], [2,1], [1,2]], 2, 8, 3));
	healthcounter(self.hp);
	self.type = 'mage';
	self.pow = 100;
	self.runes = {
		Uruz: { a: 0, e: null },
		Teiwaz: { a: 0, e: null },
		Gebo: { a: 0, e: null },
		Hagalaz: { a: 0, e: null }
	};
}

Mage.prototype.attack = function () {
	var self = this,
		Urz = self.runes.Uruz.a,
		Twz = self.runes.Teiwaz.a,
		Gbo = self.runes.Gebo.a,
		Hag = self.runes.Hagalaz.a,

		pow = Urz && Twz ? 3 : Urz ? 2 : 1,
		spd = Gbo && Hag ? 3 : Gbo ? 2 : 1,
		
		callback = function (round) {
			var x = round.cX,
				y = round.cY;
			if (Urz && Gbo) {
				new Bullet(x, y, 1, 1, 0, 1);
				new Bullet(x, y, 1, 1, 0, -1);
			}
		};

	if (Hag && Twz) {
		new Bullet(self.cX + 3, self.cY + 1, pow, spd, 1, 1, callback);
		new Bullet(self.cX + 3, self.cY + 1, pow, spd, 1, 0, callback);
		new Bullet(self.cX + 3, self.cY + 1, pow, spd, 1, -1, callback);
	} else {
		new Bullet(self.cX + 3, self.cY + 1, pow, spd, 1, 0, callback);
	}
};

Mage.prototype.hit = function (pow, cause) {
	var self = this;
	if (cause.type === 'rune') {
		self.gain(cause);
		return;
	}
	self._.hit.call(self, pow, cause);
	if (self.hp < 0) self.hp = 0;
	healthcounter(self.hp);
	if (self.hp === 0) gameOver();
};

Mage.prototype.heal = function (hp) {
	var self = this;
	self.hp += hp;
	if (self.hp > 3) self.hp = 3;
	healthcounter(self.hp);
};

Mage.prototype.gain = function (rune) {
	var selfRune = this.runes[rune.name];
	clearTimeout(selfRune.e);
	selfRune.a = 1;
	rune.board.className = 'active';
	selfRune.e = setTimeout(function () {
		selfRune.a = 0;
		rune.board.className = '';
	}, 20000);
	// Heal fully if all 4 Runes is gathered.
	i = 0;
	for (key in this.runes)
		i += this.runes[key].a;
	if (i === 4) this.heal(3);
};

/* CUBE (ENEMY) */
function Cube() {
	extend(this, new Unit('CUBE', 'C', [[0,0], [1,0], [0,1], [1,1]], W+2, randomY(1), 1));
	this.type = 'enemy';
	this.rune = randomRune(0.25);
	if (this.rune)
		this.points = 10;
	else
		this.points = 1;
	this.tick();
}

/* HYPERCUBE (ENEMY) */
function Hypercube() {
	extend(this, new Unit('HYPERCUBE', 'H', [[0,0], [1,0], [2,0], [0,1], [1,1], [2,1], [0,2], [1,2], [2,2]], W+3, randomY(2), rand(2, 3)));
	this.type = 'enemy';
	this.rune = randomRune(0.5);
	if (this.rune) 
		this.points = 25;
	else
		this.points = 5;
	this.tick();
}

// One tick() method for both enemies.
Cube.prototype.tick = Hypercube.prototype.tick = function () {
	var self = this;
	self.mv(-1, 0);
	self._._t.call(self);
};

/* BULLET */
function Bullet(x, y, pow, spd, dirX, dirY, cb) {
	extend(this, new Unit('•', 'B', [[0,0]], x, y, 0));
	this.type = 'bullet';
	this.pow = pow;
	this.spd = spd;
	this.dirX = dirX;
	this.dirY = dirY || 0;
	this.cb = cb;
	this.tick();
}

Bullet.prototype.tick = function () {
	var self = this;
	// A Very Ugly Bug Fix. Bullets stop sometimes...
	if (self._pX == self.cX && self._pY == self.cY)
		return self.undraw();
	self._pX = self.cX;
	self._pY = self.cY;
	// Moving and passing by.
	self.mv(self.dirX, self.dirY);
	self._._t.call(self);
};

/* RUNE */
function Rune(rune, coords) {
	var runeCoords = [coords[rand(coords.length)]];
	extend(this, new Unit(rune.symbol, 'R ' + rune.cls, runeCoords, 0, 0, 0));
	this.type = 'rune';
	this.name = rune.name;
	this.board = rune.board;
	this.pow = 0;
	this.tick();
}

Rune.prototype.tick = function () {
	var self = this;
	self.mv(-1, 0);
	self._._t.call(self);
};

field = new Field();

function start() {
	if (gameState === 'running') return;
	score = 0;
	scorecounter(0);
	mage = new Mage();
	gameState = 'running';
	tick();
}

function tick() {
	rand() < 0.78 ? new Cube() : new Hypercube();
	gameTimer = setTimeout(tick, rand(1200, 600 - Math.floor(score/10)));
}

function gameOver() {
	gameState = 'idle';
	for (key in controls)
		controls[key] = false;
	clearTimeout(gameTimer);
	field.print('Game over! Your score is ' + score + ' points. Good job!', 3000);
}

(function messages() {

	var pointer = 0,
		messages = [
			['Welcome! This is \'Runes vs Stuff\' game.<br>It was made in two days for <a href="https://twitter.com/js13kGames" target="_blank">@js13kGames</a> competition.<br>I am <a href="https://twitter.com/xenohuntero" target="_blank">@xenohuntero</a>.', 8000],
			['By the way, you can skip that text with pressing on any key.', 4000],
			['Controls are ↑ &amp; ↓ and spacebar.<br>Your goal is to get as much points as possible.', 6000],
			['Runes will increase speed and damage of bullets.<br>Also, some set of active Runes will affect a way you attack.', 7000],
			['If you have all 4 Runes simultaneously, it restores your health.', 4000],
			['When game is over, you can start a new one by pressing spacebar.', 4000],
			['Enjoy!', 2000]
		],
		post = function (callback) {
			if (pointer == messages.length) callback();
			var msg = messages[pointer++];
			field.print(msg[0], msg[1], function () {
				post(callback);
			});
		};

	post(function () {
		window.onkeypress = function () {};
		start();
	});

	window.onkeypress = function () {
		field.interrupt(start);
	};

})();

(function checkControls() {
	// Moving.
	if (controls.up) {
		mage.mv(0, -1);
	} else if (controls.down) {
		mage.mv(0, 1);
	}
	// Attacking.
	if (controls.attack) {
		mage.attack();
	}
	setTimeout(checkControls, ticktime);
})();

window.onkeydown = function (e) {
	if (gameState !== 'running') return;
	var k = e.keyCode;
	if (k == 38) {
		controls.up = true;
		controls.down = false;
	} else if (k == 40) {
		controls.down = true;
		controls.up = false;
	} else if (k == 32) {
		controls.attack = true;
	}
};

window.onkeyup = function (e) {
	if (gameState !== 'running') return;
	var k = e.keyCode;
	if (k == 38)
		controls.up = false;
	else if (k == 40)
		controls.down = false;
	else if (k == 32)
		controls.attack = false;
};