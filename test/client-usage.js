'use strict';
require('should');

const mongoose = require('mongoose');
const cachegoose = require('../dist');

// Get the mongoose connection states enum
const STATES = mongoose.ConnectionStates || mongoose.connection.states;

// This test simulates how a client would use the library with our new functions
describe('cachegoose client usage', () => {
  const mongooseClient = {
    connect: async () => {
      if (mongoose.connection.readyState === STATES.connected) {
        return;
      }

      // We're just testing the Redis part, not actually connecting to MongoDB
      // await mongoose.connect('mongodb://127.0.0.1/test');

      // Ensure Redis is connected
      if (!cachegoose.isConnected()) {
        await cachegoose.connect();
      }
      return true;
    },

    disconnect: async () => {
      if (mongoose.connection.readyState !== STATES.disconnected) {
        // await mongoose.disconnect();
        await cachegoose.disconnect();
      }
      return true;
    },

    clearCache: (keyPattern, cb) => {
      return cachegoose.clearCache(keyPattern, cb);
    },

    setCache: (key, value, ttl) => {
      return cachegoose.setCache(key, value, ttl);
    },

    isConnected: () => {
      return cachegoose.isConnected();
    }
  };

  before(async function() {
    this.timeout(3000);
    // Initialize cachegoose
    cachegoose(mongoose, {
      host: '127.0.0.1',
      port: 6379
    });

    // Ensure we start with a clean slate - disconnect any existing connections
    await cachegoose.disconnect();
  });

  after(async () => {
    // Cleanup
    await mongooseClient.disconnect();
  });

  describe('client wrapper methods', () => {
    it('should connect through the client wrapper', async function() {
      this.timeout(3000);
      await mongooseClient.connect();
      mongooseClient.isConnected().should.be.true();
    });

    it('should set cache through the client wrapper', async () => {
      const key = 'client-test';
      const value = { client: 'test', works: true };

      // Ensure we're connected first
      await mongooseClient.connect();

      await mongooseClient.setCache(key, value);

      // Verify using the underlying cache
      const result = await new Promise((resolve) => {
        cachegoose._cache.get(key, (err, data) => {
          if (err) throw err;
          resolve(data);
        });
      });

      result.should.deepEqual(value);
    });

    it('should disconnect through the client wrapper', async function() {
      this.timeout(5000);

      // First ensure we're connected
      await mongooseClient.connect();
      mongooseClient.isConnected().should.be.true();

      // Wait a moment to ensure connection is fully established
      await new Promise(resolve => setTimeout(resolve, 500));

      // Then disconnect
      await mongooseClient.disconnect();

      // Wait a moment to ensure disconnection is complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify disconnection
      mongooseClient.isConnected().should.be.false();
    });

    it('should be able to reconnect after disconnect', async function() {
      this.timeout(5000);

      // First ensure we're disconnected
      await mongooseClient.disconnect();

      // Wait a moment to ensure disconnection is complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify disconnection
      mongooseClient.isConnected().should.be.false();

      // Then reconnect
      await mongooseClient.connect();

      // Wait a moment to ensure connection is complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify connection
      mongooseClient.isConnected().should.be.true();
    });
  });
});