const { describe, it, beforeAll, expect } = require('vitest');
const request = require('supertest');

let app;

beforeAll(async () => {
  process.env.API_KEY = 'test-key';
  process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
  app = require('../src/app');
});

describe('health endpoint', () => {
  it('returns service health without api key', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('blocks protected routes without key', async () => {
    const response = await request(app).get('/wa/status');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });
});
