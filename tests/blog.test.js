const request = require('supertest');
const app = require('../server');
const pool = require('../db/pool');
const redis = require('../db/redis');

afterAll(async () => {
  if (pool && typeof pool.end === 'function') {
    await pool.end();
  }
  if (redis && typeof redis.quit === 'function') {
    await redis.quit();
  }
});

describe('Blog API & Redis Caching Tests', () => {
  let token;
  let postId;
  let testUser = {
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: 'password123'
  };

  test('1. Should register a user and login to get JWT token', async () => {
    // Register
    await request(app)
      .post('/api/auth/register')
      .send(testUser);

    // Login
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    token = res.body.token;
  });

  test('2. Should create a new blog post when authenticated', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Automated Test Post',
        content: 'This post was created by Jest and Supertest.'
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.post).toHaveProperty('id');
    postId = res.body.post.id;
  });

  test('3. Should return paginated posts with cache header', async () => {
    // First call (Cache Miss)
    const res1 = await request(app).get('/api/posts?page=1&limit=5');
    expect(res1.statusCode).toEqual(200);
    expect(res1.body).toHaveProperty('posts');
    expect(res1.headers['x-cache']).toEqual('MISS');

    // Second call (Cache Hit)
    const res2 = await request(app).get('/api/posts?page=1&limit=5');
    expect(res2.statusCode).toEqual(200);
    expect(res2.headers['x-cache']).toEqual('HIT');
  });

  test('4. Should fail to delete a post if not the author', async () => {
    // Create another user
    const otherUser = {
      username: `other_${Date.now()}`,
      email: `other_${Date.now()}@example.com`,
      password: 'password123'
    };
    await request(app).post('/api/auth/register').send(otherUser);
    const loginRes = await request(app).post('/api/auth/login').send({
      email: otherUser.email,
      password: otherUser.password
    });
    const otherToken = loginRes.body.token;

    // Try deleting our first test post using the other user's token
    const res = await request(app)
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.statusCode).toEqual(403);
  });
});