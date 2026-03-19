// FOLLO TESTS
/**
 * Test client helper
 * Wraps supertest with convenience methods for authenticated requests.
 *
 * server.js exports `default app` (Express instance).
 * prisma.js exports `default prisma`.
 * Auth bypass: send x-test-user-id header with NODE_ENV=test.
 */

import request from 'supertest';
import app from '../../server.js';
import prisma from '../../configs/prisma.js';

// ── Supertest agent wrapping the Express app ──────────────────────────────
export const api = request(app);

// ── Auth helpers ──────────────────────────────────────────────────────────

/**
 * Return supertest request with admin user auth header injected.
 */
export function asAdmin() {
  const userId = process.env.TEST_ADMIN_USER_ID;
  if (!userId) throw new Error('TEST_ADMIN_USER_ID not set in .env');
  return {
    get:    (url) => api.get(url).set('x-test-user-id', userId),
    post:   (url) => api.post(url).set('x-test-user-id', userId),
    patch:  (url) => api.patch(url).set('x-test-user-id', userId),
    put:    (url) => api.put(url).set('x-test-user-id', userId),
    delete: (url) => api.delete(url).set('x-test-user-id', userId),
  };
}

/**
 * Return supertest request with member user auth header injected.
 */
export function asMember() {
  const userId = process.env.TEST_MEMBER_USER_ID;
  if (!userId) throw new Error('TEST_MEMBER_USER_ID not set in .env');
  return {
    get:    (url) => api.get(url).set('x-test-user-id', userId),
    post:   (url) => api.post(url).set('x-test-user-id', userId),
    patch:  (url) => api.patch(url).set('x-test-user-id', userId),
    put:    (url) => api.put(url).set('x-test-user-id', userId),
    delete: (url) => api.delete(url).set('x-test-user-id', userId),
  };
}

/**
 * Make a request as a specific userId.
 */
export function asUser(userId) {
  return {
    get:    (url) => api.get(url).set('x-test-user-id', userId),
    post:   (url) => api.post(url).set('x-test-user-id', userId),
    patch:  (url) => api.patch(url).set('x-test-user-id', userId),
    put:    (url) => api.put(url).set('x-test-user-id', userId),
    delete: (url) => api.delete(url).set('x-test-user-id', userId),
  };
}

// ── DB helpers ────────────────────────────────────────────────────────────

/**
 * Get a workspace the admin user belongs to (for seeding test data).
 */
export async function getAdminWorkspace() {
  const userId = process.env.TEST_ADMIN_USER_ID;
  const member = await prisma.workspaceMember.findFirst({
    where: { userId, role: 'ADMIN' },
    include: { workspace: { include: { projects: { take: 1 } } } },
  });
  return member?.workspace ?? null;
}

/**
 * Get a project accessible to the test admin.
 */
export async function getAdminProject() {
  const ws = await getAdminWorkspace();
  if (!ws) return null;
  return ws.projects[0] ?? null;
}

/**
 * Get a task from the first admin project (if any).
 */
export async function getAdminTask() {
  const project = await getAdminProject();
  if (!project) return null;
  return prisma.task.findFirst({ where: { projectId: project.id } });
}

export { prisma };
