const { createClient } = require('redis');

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

client.on('error', (err) => console.error('Redis error:', err));

const connectRedis = async () => {
  await client.connect();
  console.log('Redis connected');
};

module.exports = { client, connectRedis };