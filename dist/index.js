'use strict';

let hasRun = false;
let cache;
module.exports = function init(mongoose, cacheOptions = {}) {
  if (typeof mongoose.Model.hydrate !== 'function') throw new Error('Cachegoose is only compatible with versions of mongoose that implement the `model.hydrate` method');
  if (hasRun) return;
  hasRun = true;
  init._cache = cache = require('./cache')(cacheOptions);

  // Automatically connect when initializing
  cache.connect();
  require('./extend-query')(mongoose, cache);
  require('./extend-aggregate')(mongoose, cache);
};
module.exports.clearCache = function (customKey, cb = () => {}) {
  if (!cache) return Promise.resolve(false);
  if (!customKey) {
    return cache.clear(cb);
  }
  return cache.del(customKey, cb);
};
module.exports.setCache = function (customKey, value, ttl = -1, cb = () => {}) {
  if (!cache) return Promise.resolve(false);
  return cache.set(customKey, value, ttl, cb);
};
module.exports.disconnect = function (cb = () => {}) {
  if (!cache) return Promise.resolve(false);
  return cache.close(cb);
};
module.exports.connect = function (cb = () => {}) {
  if (!cache) return Promise.resolve(false);
  return cache.connect().then(result => {
    cb(null, result);
    return result;
  }).catch(err => {
    cb(err);
    return false;
  });
};
module.exports.isConnected = function () {
  if (!cache) return false;
  return cache.isConnected();
};