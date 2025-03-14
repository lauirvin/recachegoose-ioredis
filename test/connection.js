'use strict';
require('should');

const mongoose = require('mongoose');
const cachegoose = require('../dist');

describe('cachegoose connection management', () => {
  before((done) => {
    // Initialize cachegoose with Redis connection
    cachegoose(mongoose, {
      host: '127.0.0.1',
      port: 6379
    });

    // Give some time for the connection to establish
    setTimeout(done, 500);
  });

  afterEach(async () => {
    // Clear cache after each test
    await new Promise((resolve) => {
      cachegoose.clearCache(null, resolve);
    });
  });

  after(async () => {
    // Disconnect Redis after all tests
    await cachegoose.disconnect();
  });

  describe('connection methods', () => {
    it('should be connected on initialization', async () => {
      // Check if we're already connected, if not attempt to connect
      if (!cachegoose.isConnected()) {
        await cachegoose.connect();
      }
      cachegoose.isConnected().should.be.true();
    });

    it('should disconnect and reconnect', async () => {
      // Disconnect from Redis
      await cachegoose.disconnect();
      cachegoose.isConnected().should.be.false();

      // Connect back to Redis
      const result = await cachegoose.connect();
      result.should.be.true();
      cachegoose.isConnected().should.be.true();
    });

    it('should support callback style', (done) => {
      // First disconnect
      cachegoose.disconnect((err) => {
        if (err) return done(err);

        cachegoose.isConnected().should.be.false();

        // Then reconnect with callback
        cachegoose.connect((err, result) => {
          if (err) return done(err);

          result.should.be.true();
          cachegoose.isConnected().should.be.true();
          done();
        });
      });
    });
  });

  describe('setCache method', () => {
    it('should manually set a cache entry', async () => {
      const key = 'test-key';
      const value = { test: 'data', num: 123 };

      // Set cache manually
      const setResult = await cachegoose.setCache(key, value);
      setResult.should.be.true();

      // Verify it was stored properly
      const cachedValue = await new Promise((resolve) => {
        cachegoose._cache.get(key, (err, data) => {
          if (err) throw err;
          resolve(data);
        });
      });

      cachedValue.should.deepEqual(value);
    });

    it('should set with TTL and retrieve before expiration', async function() {
      this.timeout(5000); // Extend timeout for this test

      const key = 'ttl-test-key';
      const value = { ttl: 'test', expires: true };
      const ttl = 2; // 2 seconds TTL

      // Set cache with TTL
      await cachegoose.setCache(key, value, ttl);

      // Check immediately - should exist
      let cachedValue = await new Promise((resolve) => {
        cachegoose._cache.get(key, (err, data) => {
          if (err) throw err;
          resolve(data);
        });
      });

      cachedValue.should.deepEqual(value);

      // Wait for 1 second - should still exist
      await new Promise(resolve => setTimeout(resolve, 1000));

      cachedValue = await new Promise((resolve) => {
        cachegoose._cache.get(key, (err, data) => {
          if (err) throw err;
          resolve(data);
        });
      });

      cachedValue.should.deepEqual(value);

      // Wait for another 2 seconds - should expire
      await new Promise(resolve => setTimeout(resolve, 2000));

      cachedValue = await new Promise((resolve) => {
        cachegoose._cache.get(key, (err, data) => {
          if (err) throw err;
          resolve(data);
        });
      });

      (cachedValue === null).should.be.true();
    });

    it('should support callback style', (done) => {
      const key = 'callback-test-key';
      const value = { callback: 'style' };

      cachegoose.setCache(key, value, -1, (err) => {
        if (err) return done(err);

        cachegoose._cache.get(key, (err, data) => {
          if (err) return done(err);

          data.should.deepEqual(value);
          done();
        });
      });
    });
  });
});