// FOLLO TESTS
/**
 * 02 — Authentication tests
 *
 * Tests:
 *  - Requests without x-test-user-id header get 401
 *  - Requests with valid test userId pass auth and reach handler
 *  - GET /api/v1/workspaces works for authenticated user
 *  - GET /api/v1/projects/my-projects works for authenticated user
 */

import { describe, it, expect } from '@jest/globals';
import { api, asAdmin, asMember } from './helpers/testClient.js';

describe('Authentication middleware', () => {
  it('GET /api/v1/workspaces without auth returns 401', async () => {
    const res = await api.get('/api/v1/workspaces');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/projects/my-projects without auth returns 401', async () => {
    const res = await api.get('/api/v1/projects/my-projects');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/workspaces with admin user returns 200 with data array', async () => {
    const res = await asAdmin().get('/api/v1/workspaces');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/v1/workspaces with member user returns 200 with data array', async () => {
    const res = await asMember().get('/api/v1/workspaces');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/v1/projects/my-projects with admin user returns 200 with data array', async () => {
    const res = await asAdmin().get('/api/v1/projects/my-projects');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('Response envelope always has success, data, error fields', async () => {
    const res = await asAdmin().get('/api/v1/workspaces');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success');
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error');
  });

  it('Error response has an error field when unauthenticated', async () => {
    const res = await api.get('/api/v1/workspaces');
    // Auth middleware returns { error: "Unauthorized" } (not the standard envelope)
    expect(res.body.error).toBeDefined();
    expect(res.status).toBe(401);
  });
});
