> This is a fork version of [recachegoose](https://github.com/aalfiann/recachegoose) with following differences:
- Replaced [recacheman](https://github.com/aalfiann/recacheman) with [ioredis](https://github.com/redis/ioredis)
- Improved integration with serverless environment - AWS Amplify, AWS Lambda, Google Cloud Functions, Azure Functions, etc.
- Added proper Promise-based API with backward compatibility for callbacks
- Enhanced error handling and connection management

# recachegoose-ioredis #

#### Mongoose Caching That Actually Works—Now with ioredis ####

[![NPM](https://nodei.co/npm/recachegoose-ioredis.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/recachegoose-ioredis/)  
  
[![npm version](https://img.shields.io/npm/v/recachegoose-ioredis.svg?style=flat-square)](https://www.npmjs.org/package/recachegoose-ioredis)
[![Known Vulnerabilities](https://snyk.io//test/github/lauirvin/recachegoose-ioredis/badge.svg?targetFile=package.json)](https://snyk.io//test/github/lauirvin/recachegoose-ioredis?targetFile=package.json)
![License](https://img.shields.io/npm/l/recachegoose)
![NPM download/month](https://img.shields.io/npm/dm/recachegoose-ioredis.svg)
![NPM download total](https://img.shields.io/npm/dt/recachegoose-ioredis.svg)  

## About ##

A Mongoose caching module that works exactly how you'd expect, fully compatible with the latest version of Mongoose and optimized with ioredis for better integration in serverless environments.

> Important:  
  If you are using Mongoose 4.x or below, you have to use original [cachegoose](https://github.com/boblauer/cachegoose) and use version <= 4.x of it.

## Basic Setup ##

```javascript
const mongoose = require('mongoose');
const cachegoose = require('recachegoose-ioredis');

cachegoose(mongoose, {
  port: 6379,
  host: 'localhost',
  password: 'yourpassword'
});
```

## Usage ##

### Caching Queries

To cache the results of a mongoose query, simply add `.cache()` to the query chain:

```javascript
// Cache for 30 seconds (default is 60 seconds)
Record
  .find({ some_condition: true })
  .cache(30)
  .exec(function(err, records) {
    // Results will be cached for 30 seconds
  });

// With Promises/async-await
const records = await Record
  .find({ some_condition: true })
  .cache(30)
  .exec();

// Cache indefinitely (until manually cleared)
const results = await Record
  .aggregate()
  .group({ total: { $sum: '$some_field' } })
  .cache(0)
  .exec();
```

### Custom Cache Keys

You can use custom keys to give you more control over cache invalidation:

```javascript
const userId = '1234567890';

// Using a custom cache key
const children = await Children
  .find({ parentId: userId })
  .cache(60, `user_${userId}_children`)
  .exec();

// Clear that specific cache entry
await cachegoose.clearCache(`user_${userId}_children`);

// Using cache keys in lifecycle hooks
ChildrenSchema.post('save', function(child) {
  // Clear the parent's cache when a new child is added
  cachegoose.clearCache(`user_${child.parentId}_children`);
});
```

## Connection Management ##

The library provides full control over Redis connections with a Promise-based API:

```javascript
// Check if Redis is connected
const isConnected = cachegoose.isConnected();

// Explicitly connect (returns Promise)
await cachegoose.connect();
// or with callbacks
cachegoose.connect((err, success) => {
  if (err) console.error('Connection failed:', err);
  else console.log('Connected successfully');
});

// Disconnect from Redis (returns Promise)
await cachegoose.disconnect();
// or with callbacks
cachegoose.disconnect((err) => {
  if (err) console.error('Disconnect error:', err);
  else console.log('Disconnected successfully');
});

// Manually set cache values
await cachegoose.setCache('my-key', { some: 'data' });
// With TTL (in seconds)
await cachegoose.setCache('another-key', { expires: true }, 120);
// With callback
cachegoose.setCache('callback-key', { data: true }, 60, (err) => {
  if (err) console.error('Cache error:', err);
});

// Clear specific cache
await cachegoose.clearCache('my-key');
// Clear all cache
await cachegoose.clearCache();
```

### Error Handling

You can check the last error that occurred during Redis operations:

```javascript
// After an operation fails
if (!cachegoose.isConnected()) {
  // Get the last error message
  const lastError = cachegoose._cache.getLastError();
  console.log('Redis connection error:', lastError);
  
  // Attempt to reconnect
  try {
    await cachegoose.connect();
  } catch (error) {
    console.error('Reconnection failed');
  }
}
```

## Serverless Environment Usage ##

This library provides special optimizations for serverless environments like AWS Lambda, Amplify, Google Cloud Functions, and Azure Functions. Use the `serverlessMode` option to enable these optimizations:

```javascript
const mongoose = require('mongoose');
const cachegoose = require('recachegoose-ioredis');

cachegoose(mongoose, {
  port: 6379,
  host: 'redis.example.com',
  password: 'yourpassword',
  // Enable serverless mode
  serverlessMode: true,
  // Optional: customize connection parameters
  connectTimeout: 3000,         // Default: 5000ms
  maxRetriesPerRequest: 2,      // Default: 3
  prefix: 'my-app:',            // Default: 'cachegoose:'
  keepAlive: 5000,              // Default: 10000ms (10s)
  // Any other ioredis options are also supported
});
```

### Serverless Mode Benefits

When serverless mode is enabled:

1. **Lazy connection**: Connections are only established when needed, not at initialization
2. **Optimized TTL**: Default TTL is 5 minutes (300 seconds) instead of 60 seconds
3. **Connection timeouts**: More aggressive timeouts to prevent hanging functions
4. **Retry strategy**: Exponential backoff with sensible limits
5. **Connection pooling**: Optimized for ephemeral container environments
6. **Auto reconnection**: Improved handling of reconnection when containers are reused

### AWS Lambda Example

```javascript
// Lambda handler
exports.handler = async (event) => {
  // Initialize cachegoose once (will be reused if Lambda container is reused)
  if (!mongooseClient.isInitialized()) {
    mongooseClient.init();
  }
  
  try {
    // Connect to database and Redis if needed
    await mongooseClient.connect();
    
    // Use cached query results
    const records = await Record.find({}).cache(60).exec();
    
    return {
      statusCode: 200,
      body: JSON.stringify(records)
    };
  } finally {
    // No need to disconnect in serverless mode
    // The connection will be automatically managed
  }
};

// Helper for database connections
const mongooseClient = {
  isInitialized: () => !!mongoose.models.Record,
  
  init: () => {
    // Set up mongoose models
    // ...
    
    // Initialize cachegoose with serverless mode
    cachegoose(mongoose, {
      port: process.env.REDIS_PORT,
      host: process.env.REDIS_HOST,
      password: process.env.REDIS_PASSWORD,
      serverlessMode: true
    });
  },
  
  connect: async () => {
    // Connect to MongoDB if needed
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    
    // Ensure Redis is connected
    if (!cachegoose.isConnected()) {
      await cachegoose.connect();
    }
  }
};
```

### Advanced Configuration

The library supports all [ioredis configuration options](https://github.com/redis/ioredis/blob/master/API.md#Redis) in addition to the special serverless options:

```javascript
cachegoose(mongoose, {
  // Redis connection
  host: 'redis.example.com',
  port: 6379,
  password: 'secret',
  db: 0,
  
  // Serverless mode
  serverlessMode: true,
  
  // Connection pooling
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 200, 2000),
  
  // Timeouts
  connectTimeout: 5000,
  commandTimeout: 2000,
  
  // TLS options
  tls: {
    // TLS options
  }
});
```

## Clearing the cache ##

Clear specific cache entries by key:

```javascript
// Clear a specific cache entry
await cachegoose.clearCache('my-cache-key');
// or with callback
cachegoose.clearCache('my-cache-key', (err) => {
  if (err) console.error('Failed to clear cache:', err);
});

// Clear all cache
await cachegoose.clearCache();
```

## Caching populated documents ##

When a document is returned from the cache, cachegoose will [hydrate](http://mongoosejs.com/docs/api.html#model_Model.hydrate) it, which initializes it's virtuals/methods. Hydrating a populated document will discard any populated fields (see [Automattic/mongoose#4727](https://github.com/Automattic/mongoose/issues/4727)). To cache populated documents without losing child documents, you must use `.lean()`, however if you do this you will not be able to use any virtuals/methods (it will be a plain object).

```javascript
// For populated documents, use lean() to preserve the populated fields
const users = await User
  .find()
  .populate('posts')
  .lean()
  .cache(60, 'users-with-posts')
  .exec();
```

## Test ##
For development mode, you have to use minimum nodejs 14
```
npm test