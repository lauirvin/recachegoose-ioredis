'use strict';

const Redis = require('ioredis');
const noop = () => {};
class Cache {
  constructor(options = {}) {
    this._redisOptions = {
      host: options.host || '127.0.0.1',
      port: options.port || 6379,
      // Default connection options that work well for serverless
      connectTimeout: options.connectTimeout || 5000,
      // 5 second timeout
      maxRetriesPerRequest: options.maxRetriesPerRequest || 3,
      retryStrategy: options.retryStrategy || (times => {
        // Exponential backoff with max 1 second delay
        return Math.min(times * 100, 1000);
      }),
      // Add option for enabling serverless mode
      enableOfflineQueue: options.enableOfflineQueue !== undefined ? options.enableOfflineQueue : true,
      // Add keep-alive for connection reuse
      keepAlive: options.keepAlive !== undefined ? options.keepAlive : 10000,
      // 10 seconds
      // Automatically reconnect
      reconnectOnError: options.reconnectOnError || (err => {
        const targetErrors = [/READONLY/, /ETIMEDOUT/, /ECONNRESET/, /ECONNREFUSED/];
        return targetErrors.some(pattern => pattern.test(err.message));
      })
    };

    // Extract serverless mode option
    this._serverlessMode = options.serverlessMode || false;

    // Get the prefix for cache keys
    this._prefix = options.prefix || 'cachegoose:';
    Object.assign(this._redisOptions, options);
    this._isConnected = false;
    this._cache = null;
    this._connectionPromise = null;
    this._errors = [];
  }

  // Connect to Redis explicitly
  async connect() {
    if (this._isConnected && this._cache) {
      return true;
    }

    // Return existing connection attempt if one is in progress
    if (this._connectionPromise) {
      return this._connectionPromise;
    }
    this._connectionPromise = (async () => {
      try {
        // Create new Redis client if needed
        if (!this._cache) {
          this._cache = new Redis(this._redisOptions);

          // Set up event listeners
          this._cache.on('connect', () => {
            this._isConnected = true;
          });
          this._cache.on('error', err => {
            // Store the last few errors instead of logging them
            this._errors.unshift(err.message);
            // Keep only the last 5 errors
            if (this._errors.length > 5) {
              this._errors.pop();
            }
            this._isConnected = false;
          });
          this._cache.on('end', () => {
            this._isConnected = false;
          });

          // Wait for ready event
          await new Promise(resolve => {
            // Set up a timeout for serverless environments
            const timeout = this._serverlessMode ? setTimeout(() => {
              this._cache.disconnect();
              resolve(false);
            }, this._redisOptions.connectTimeout || 5000) : null;
            this._cache.once('ready', () => {
              this._isConnected = true;
              if (timeout) clearTimeout(timeout);
              resolve(true);
            });
          });
        }
        return this._isConnected;
      } catch (err) {
        this._isConnected = false;
        this._cache = null;
        return false;
      } finally {
        this._connectionPromise = null;
      }
    })();
    return this._connectionPromise;
  }

  // Get the last connection error
  getLastError() {
    return this._errors.length > 0 ? this._errors[0] : null;
  }

  // Check if Redis is connected
  isConnected() {
    return this._isConnected && this._cache && this._cache.status === 'ready';
  }

  // Initialize connection if not already connected
  async _ensureConnection() {
    if (!this._cache || !this.isConnected()) {
      return this.connect();
    }
    return true;
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
        // Use a reasonable default TTL for serverless environments (5 minutes)
        const effectiveTTL = ttl || (this._serverlessMode ? 300 : 60);
        await this._cache.set(this._prefix + key, serialized, 'EX', effectiveTTL);
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