'use strict';

const Redis = require('ioredis');
const noop = () => {};
class Cache {
  constructor(options = {}) {
    this._redisOptions = {
      host: options.host || '127.0.0.1',
      port: options.port || 6379
    };
    Object.assign(this._redisOptions, options);
    this._prefix = 'cachegoose:';
    this._isConnected = false;
    this._cache = null;
  }

  // Connect to Redis explicitly
  async connect() {
    if (this._isConnected) {
      return true;
    }
    try {
      this._cache = new Redis(this._redisOptions);

      // Set up event listeners
      this._cache.on('connect', () => {
        this._isConnected = true;
      });
      this._cache.on('error', () => {
        this._isConnected = false;
      });
      this._cache.on('end', () => {
        this._isConnected = false;
      });

      // Wait for ready event
      await new Promise(resolve => {
        this._cache.once('ready', () => {
          this._isConnected = true;
          resolve();
        });
      });
      return true;
    } catch (err) {
      this._isConnected = false;
      return false;
    }
  }

  // Check if Redis is connected
  isConnected() {
    return this._isConnected && this._cache && this._cache.status === 'ready';
  }

  // Initialize connection if not already connected
  async _ensureConnection() {
    if (!this._cache) {
      return this.connect();
    }
    return this.isConnected();
  }
  async get(key, cb = noop) {
    try {
      await this._ensureConnection();
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
      await this._ensureConnection();
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
      await this._ensureConnection();
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
      await this._ensureConnection();
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

  // Close the Redis connection
  async close(cb = noop) {
    try {
      if (this._cache) {
        await this._cache.quit();
        this._isConnected = false;
        this._cache = null;
      }
      cb(null);
      return true;
    } catch (err) {
      cb(err);
      return false;
    }
  }
}
module.exports = function (options) {
  return new Cache(options);
};