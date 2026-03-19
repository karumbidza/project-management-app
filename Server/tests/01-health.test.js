// FOLLO TESTS
/**
 * 01 — Health & Root endpoint tests
 *
 * Tests:
 *  - GET / → root ping
 *  - GET /api/v1/health → DB liveness
 */

import { describe, it, expect } from '@jest/globals';
import { api } from './helpers/testClient.js';

describe('Health checks', () => {
  it('GET / returns healthy status', async () => {
    const res = await api.get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
    expect(res.body.data.service).toBe('Project Management API');
  });

  it('GET /api/v1/health returns ok with database connected', async () => {
    const res = await api.get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.services.database.status).toBe('connected');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('GET /api/v1/nonexistent returns 404 with error shape', async () => {
    const res = await api.get('/api/v1/nonexistent-route-xyz');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
  });
});
