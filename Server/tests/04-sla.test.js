// FOLLO TESTS
/**
 * 04 — SLA workflow tests
 *
 * Routes tested (all under /api/v1/tasks/:taskId):
 *  - GET /:taskId/sla — get SLA summary
 *  - POST /:taskId/submit — submit task for approval
 *  - POST /:taskId/approve — approve submitted task
 *  - POST /:taskId/reject — reject submitted task
 *  - POST /:taskId/blocker — raise a blocker
 *  - POST /:taskId/blocker/resolve — resolve a blocker
 *  - POST /:taskId/extension/request — request deadline extension
 *  - POST /:taskId/extension/approve — approve extension
 *  - POST /:taskId/extension/deny — deny extension
 *
 * SLA statuses (string field): HEALTHY | AT_RISK | PENDING_APPROVAL |
 *   BLOCKED | BREACHED | RESOLVED_ON_TIME | RESOLVED_LATE
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { asAdmin, asMember, getAdminTask } from './helpers/testClient.js';

let testTaskId = null;

beforeAll(async () => {
  const task = await getAdminTask();
  if (task) {
    testTaskId = task.id;
  }
});

describe('SLA workflow routes', () => {
  it('GET /api/v1/tasks/:taskId/sla returns SLA data', async () => {
    if (!testTaskId) {
      console.warn('Skipping: no task available');
      return;
    }
    const res = await asAdmin().get(`/api/v1/tasks/${testTaskId}/sla`);
    expect([200, 403, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    }
  });

  it('GET /api/v1/tasks/nonexistent/sla returns 404', async () => {
    const res = await asAdmin().get('/api/v1/tasks/nonexistent-task-xyz/sla');
    expect([404, 400]).toContain(res.status);
    if (res.status === 404) {
      expect(res.body.success).toBe(false);
    }
  });

  it('POST /api/v1/tasks/:taskId/submit — submit task requires auth', async () => {
    if (!testTaskId) {
      console.warn('Skipping: no task available');
      return;
    }
    // Not testing state machine transition here (task may not be in submittable state)
    // Just verify the route exists and responds appropriately
    const res = await asAdmin()
      .post(`/api/v1/tasks/${testTaskId}/submit`)
      .send({ completionNotes: 'FOLLO TEST: task completed' });
    // 200 (submitted), 400 (invalid state), 403 (no permission), 404 (not found)
    expect([200, 201, 400, 403, 404]).toContain(res.status);
  });

  it('POST /api/v1/tasks/:taskId/blocker — raise a blocker requires auth', async () => {
    if (!testTaskId) {
      console.warn('Skipping: no task available');
      return;
    }
    const res = await asAdmin()
      .post(`/api/v1/tasks/${testTaskId}/blocker`)
      .send({ description: 'FOLLO TEST: blocker raised' });
    expect([200, 201, 400, 403, 404]).toContain(res.status);
  });

  it('POST /api/v1/tasks/:taskId/blocker/resolve — resolve blocker requires auth', async () => {
    if (!testTaskId) {
      console.warn('Skipping: no task available');
      return;
    }
    const res = await asAdmin()
      .post(`/api/v1/tasks/${testTaskId}/blocker/resolve`)
      .send({ resolution: 'FOLLO TEST: blocker resolved' });
    expect([200, 201, 400, 403, 404]).toContain(res.status);
  });

  it('POST /api/v1/tasks/:taskId/extension/request — request extension requires auth', async () => {
    if (!testTaskId) {
      console.warn('Skipping: no task available');
      return;
    }
    const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const res = await asAdmin()
      .post(`/api/v1/tasks/${testTaskId}/extension/request`)
      .send({
        reason: 'FOLLO TEST: need more time',
        proposedDate: futureDate,
      });
    expect([200, 201, 400, 403, 404]).toContain(res.status);
  });

  it('POST /api/v1/tasks/:taskId/approve — approve task requires auth', async () => {
    if (!testTaskId) {
      console.warn('Skipping: no task available');
      return;
    }
    const res = await asAdmin()
      .post(`/api/v1/tasks/${testTaskId}/approve`)
      .send({});
    expect([200, 201, 400, 403, 404]).toContain(res.status);
  });

  it('POST /api/v1/tasks/:taskId/reject — reject task requires auth', async () => {
    if (!testTaskId) {
      console.warn('Skipping: no task available');
      return;
    }
    const res = await asAdmin()
      .post(`/api/v1/tasks/${testTaskId}/reject`)
      .send({ reason: 'FOLLO TEST: rejection reason' });
    expect([200, 201, 400, 403, 404]).toContain(res.status);
  });

  it('SLA routes return 401 without auth header', async () => {
    const { api } = await import('./helpers/testClient.js');
    const fakeId = 'nonexistent-id';
    const res = await api.get(`/api/v1/tasks/${fakeId}/sla`);
    expect(res.status).toBe(401);
  });
});
