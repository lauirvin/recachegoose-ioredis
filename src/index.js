'use strict';

let hasRun = false;
let cache;

module.exports = function init(mongoose, cacheOptions = {}) {
  if (typeof mongoose.Model.hydrate !== 'function') throw new Error('Cachegoose is only compatible with versions of mongoose that implement the `model.hydrate` method');

  // Allow reinitializing with new options
  if (hasRun && cache) {
    // If we're already running but with different serverless settings,
    // close the existing connection and reinitialize
    const currentServerless = cache._serverlessMode;
    const newServerless = cacheOptions.serverlessMode || false;

    if (currentServerless !== newServerless) {
      cache.close().then(() => {
        hasRun = false;
        init(mongoose, cacheOptions);
      }).catch(() => {
        // Ignore errors on close, still try to reinitialize
        hasRun = false;
        init(mongoose, cacheOptions);
      });
      return;
    }

    return;
  }

  hasRun = true;

  init._cache = cache = require('./cache')(cacheOptions);

  // Automatically connect when initializing
  // Unless in serverless mode, where we'll connect on first use
  if (!cacheOptions.serverlessMode) {
    cache.connect();
  }

  require('./extend-query')(mongoose, cache);
  require('./extend-aggregate')(mongoose, cache);
};

module.exports.clearCache = function(customKey, cb = () => { }) {
  if (!cache) return Promise.resolve(false);

  if (!customKey) {
    return cache.clear(cb);
  }
  return cache.del(customKey, cb);
};

module.exports.setCache = function(customKey, value, ttl = -1, cb = () => { }) {
  if (!cache) return Promise.resolve(false);
  return cache.set(customKey, value, ttl, cb);
};

module.exports.disconnect = function(cb = () => { }) {
  if (!cache) return Promise.resolve(false);
  return cache.close(cb);
};

module.exports.connect = function(cb = () => { }) {
  if (!cache) return Promise.resolve(false);
  return cache.connect().then((result) => {
    cb(null, result);
    return result;
  }).catch((err) => {
    cb(err);
    return false;
  });
};

module.exports.isConnected = function() {
  if (!cache) return false;
  return cache.isConnected();
};