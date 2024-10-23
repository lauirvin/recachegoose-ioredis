'use strict';

const Redis = require('ioredis');
const noop = () => {};
class Cache {
  constructor(options = {}) {
    const redisOptions = {
      host: options.host || '127.0.0.1',
      port: options.port || 6379
    };
    Object.assign(redisOptions, options);
    this._cache = new Redis(redisOptions);
    this._prefix = 'cachegoose:';
  }
  async get(key, cb = noop) {
    try {
      const value = await this._cache.get(this._prefix + key);
      if (value === null) {
        cb(null, null);
        return null;
      }
      const parsed = JSON.parse(value);
      cb(null, parsed);
      return parsed;
    } catch (err) {
      cb(err);
      return null;
    }
  }
  async set(key, value, ttl, cb = noop) {
    try {
      const serialized = JSON.stringify(value);
      if (ttl === -1) {
        await this._cache.set(this._prefix + key, serialized);
      } else {
        await this._cache.set(this._prefix + key, serialized, 'EX', ttl);
      }
      cb(null);
      return true;
    } catch (err) {
      cb(err);
      return false;
    }
  }
  async del(key, cb = noop) {
    try {
      await this._cache.del(this._prefix + key);
      cb(null);
      return true;
    } catch (err) {
      cb(err);
      return false;
    }
  }
  async clear(cb = noop) {
    try {
      // Get all keys with the prefix and delete them
      const keys = await this._cache.keys(this._prefix + '*');
      if (keys.length > 0) {
        await this._cache.del(keys);
      }
      cb(null);
      return true;
    } catch (err) {
      cb(err);
      return false;
    }
  }

  // Add a method to close the Redis connection
  async close() {
    await this._cache.quit();
  }
}
module.exports = function (options) {
  return new Cache(options);
};