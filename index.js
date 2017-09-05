// Written with support for all ES5+ engines
// Eventual support for ES3+ engines can be figured out in later turn

"use strict";

var assign         = require("es5-ext/object/assign")
  , setPrototypeOf = require("es5-ext/object/set-prototype-of")
  , ensureString   = require("es5-ext/object/validate-stringifiable-value")
  , toShortString  = require("es5-ext/to-short-string-representation")
  , d              = require("d")
  , lazy           = require("d/lazy")
  , ee             = require("event-emitter");

var emitter = ee(), cache = Object.create(null);
var isValidLevel = RegExp.prototype.test.bind(/^[a-z]+$/);
var isValidNsToken = RegExp.prototype.test.bind(/^[a-z0-9-]+$/);

var setEnabledState = function (state) {
	Object.defineProperty(this, "isEnabled", d("ce", state));
};

var createLogger, createLevelLogger, createNsLogger;

var getLevel = function (newLevel) {
	newLevel = ensureString(newLevel);
	if (this.level === newLevel) return this;
	var levelLogger = createLevelLogger(newLevel);
	return this.nsTokens.reduce(function (currentLogger, token) {
		return createNsLogger(currentLogger, token);
	}, levelLogger);
};

var getNs = function (newNs) {
	newNs = ensureString(newNs);
	var newNsTokens = newNs.split(":");
	newNsTokens.forEach(function (newNsToken) {
		if (!isValidNsToken(newNsToken)) {
			throw new TypeError(
				toShortString(newNs) +
					" is not a valid ns string " +
					"(only 'a-z0-9-' chars are allowed and ':' as delimiter)"
			);
		}
	});
	return newNsTokens.reduce(function (currentLogger, token) {
		return createNsLogger(currentLogger, token);
	}, this);
};

var loggerProto = Object.create(
	Function.prototype,
	assign(
		{ isEnabled: d("e", true), emitter: d("", emitter), _nsToken: d("", null) },
		lazy({
			ns: d(
				"e",
				function () {
					return this.nsTokens.join(":") || null;
				},
				{ cacheName: "_ns" }
			),
			nsTokens: d(
				"e",
				function () {
					return this._nsToken
						? Object.getPrototypeOf(this).nsTokens.concat(this._nsToken)
						: [];
				},
				{ cacheName: "_nsTokens" }
			),
			children: d(
				"",
				function () {
					return {};
				},
				{ cacheName: "_children" }
			),
			enable: d(
				function () {
					return setEnabledState.bind(this, true);
				},
				{ cacheName: "_enable" }
			),
			disable: d(
				function () {
					return setEnabledState.bind(this, false);
				},
				{ cacheName: "_disable" }
			),
			getLevel: d(
				function () {
					return getLevel.bind(this);
				},
				{ cacheName: "_getLevel" }
			),
			getNs: d(
				function () {
					return getNs.bind(this);
				},
				{ cacheName: "_getNs" }
			)
		})
	)
);

createLogger = function () {
	// eslint-disable-next-line no-unused-vars
	return function self (msgItem1 /*, ...msgItemn*/) {
		if (!self.isEnabled) return;
		var event = {
			logger: self,
			date: new Date(),
			messageTokens: arguments
		};
		emitter.emit("log:before", event);
		emitter.emit("log", event);
	};
};

createLevelLogger = function (level) {
	if (cache[level]) return cache[level];
	if (!isValidLevel(level)) {
		throw new TypeError(
			toShortString(level) + " is not a valid level name (only 'a-z' chars are allowed)"
		);
	}
	if (level in loggerProto) {
		throw new TypeError(
			toShortString(level) +
				" is not a valid level name (should not override existing property)"
		);
	}
	var logger = Object.defineProperties(setPrototypeOf(createLogger(), loggerProto), {
		level: d("e", level)
	});
	cache[level] = logger;
	var directLevelAccessConf = {};
	directLevelAccessConf[level] = d(
		"e",
		function () {
			return getLevel.call(this, level);
		},
		{ cacheName: "_" + level }
	);
	Object.defineProperties(loggerProto, lazy(directLevelAccessConf));
	emitter.emit("init", { logger: logger });
	return logger;
};

createNsLogger = function (parent, nsToken) {
	if (parent.children[nsToken]) return parent.children[nsToken];
	var logger = Object.defineProperties(setPrototypeOf(createLogger(), parent), {
		_nsToken: d("", nsToken)
	});
	parent.children[nsToken] = logger;
	emitter.emit("init", { logger: logger });
	return logger;
};

module.exports = createLevelLogger("debug");