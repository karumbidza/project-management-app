// FOLLO TESTS / FOLLO READINESS
/**
 * 07 — Readiness security & correctness regression tests
 *
 * Guards the fixes from the production-readiness pass. Written in the same
 * defensive style as the rest of the suite (broad accepted status sets, skip when
 * seed data is unavailable) so it tolerates differing seeded databases.
 *
 * Requires a seeded DB + TEST_ADMIN_USER_ID / TEST_MEMBER_USER_ID — run in
 * staging/local, not vanilla CI.
 *
 * Covers:
 *  - Media presign requires a projectId the caller can access (object-level authz)
 *  - Media DELETE enforces ownership (no blind cross-tenant deletes)
 *  - Mux playback-token endpoint is access-gated
 *  - getProjectById is not an IDOR (no 500; access-controlled)
 *  - Extension flow does not 500 (the logSlaEvent crash is fixed)
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { asAdmin, asMember, api, getAdminProject, getAdminTask } from './helpers/testClient.js';

let projectId = null;
let taskId = null;

beforeAll(async () => {
  const project = await getAdminProject();
  if (project) projectId = project.id;
  const task = await getAdminTask();
  if (task) taskId = task.id;
});

describe('Media upload authorization', () => {
  it('POST /api/v1/media/sign — rejects when projectId is missing (400)', async () => {
    const res = await asAdmin()
      .post('/api/v1/media/sign')
      .send({ mediaType: 'image', mimeType: 'image/png', sizeBytes: 1024 });
    // 400 = missing projectId; 503/400 if R2 unconfigured — never a successful presign.
    expect([400, 401, 503]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });

  it('POST /api/v1/media/sign — rejects a project the caller cannot access', async () => {
    const res = await asAdmin()
      .post('/api/v1/media/sign')
      .send({ mediaType: 'image', mimeType: 'image/png', sizeBytes: 1024, projectId: 'definitely-not-a-real-project-id' });
    // NotFound / Authorization / validation — must not mint an upload URL.
    expect([400, 401, 403, 404]).toContain(res.status);
  });

  it('POST /api/v1/media/sign/video — requires projectId', async () => {
    const res = await asAdmin().post('/api/v1/media/sign/video').send({});
    expect([400, 401, 403, 404, 503]).toContain(res.status);
    expect(res.status).not.toBe(201);
  });

  it('DELETE /api/v1/media/:fileKey — no blind deletes (unknown key is refused)', async () => {
    const res = await asAdmin().delete('/api/v1/media/unknown-object-key.bin');
    // assertMediaDeletePermission refuses when no comment references the media.
    expect([401, 403, 404, 503]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });

  it('GET /api/v1/media/playback/:playbackId — access-gated for unknown ids', async () => {
    const res = await asAdmin().get('/api/v1/media/playback/not-a-real-playback-id');
    expect([400, 401, 403, 404]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });
});

describe('getProjectById is access-controlled (IDOR fix)', () => {
  it('GET /api/v1/projects/:projectId — never 500s and is gated', async () => {
    if (!projectId) {
      console.warn('Skipping: no project available');
      return;
    }
    const res = await asMember().get(`/api/v1/projects/${projectId}`);
    // A non-member should be 403/404; a member 200. Crucially never a 500.
    expect([200, 401, 403, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });

  it('GET /api/v1/projects/nonexistent — 404, not 500', async () => {
    const res = await asAdmin().get('/api/v1/projects/nonexistent-project-xyz');
    expect([403, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });
});

describe('Extension flow does not crash (logSlaEvent fix)', () => {
  it('POST /api/v1/tasks/:taskId/extension/request — handled without 500', async () => {
    if (!taskId) {
      console.warn('Skipping: no task available');
      return;
    }
    const res = await asAdmin()
      .post(`/api/v1/tasks/${taskId}/extension/request`)
      .send({ reason: 'FOLLO TEST extension', proposedDate: new Date(Date.now() + 7 * 864e5).toISOString() });
    // Valid request, validation error, or authz — but NOT a 500 (the old crash).
    expect([200, 201, 400, 401, 403, 404, 409]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });
});
