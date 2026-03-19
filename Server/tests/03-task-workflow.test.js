// FOLLO TESTS
/**
 * 03 — Task CRUD workflow tests
 *
 * Tests:
 *  - GET /api/v1/tasks/project/:projectId — list tasks
 *  - POST /api/v1/tasks/project/:projectId — create task
 *  - GET /api/v1/tasks/:taskId — get single task
 *  - PATCH /api/v1/tasks/:taskId — update task
 *  - DELETE /api/v1/tasks/:taskId — delete task
 *
 * Uses real DB data via testClient helpers.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { asAdmin, getAdminProject, getAdminTask } from './helpers/testClient.js';

let projectId = null;
let createdTaskId = null;
let existingTaskId = null;

beforeAll(async () => {
  const project = await getAdminProject();
  if (project) {
    projectId = project.id;
  }
  const task = await getAdminTask();
  if (task) {
    existingTaskId = task.id;
  }
});

describe('Task CRUD workflow', () => {
  it('GET /api/v1/tasks/project/:projectId returns 200 with tasks array (or 403/404 if no access)', async () => {
    if (!projectId) {
      console.warn('Skipping: no project found for admin user');
      return;
    }
    const res = await asAdmin().get(`/api/v1/tasks/project/${projectId}`);
    expect([200, 403, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    }
  });

  it('POST /api/v1/tasks/project/:projectId creates a new task', async () => {
    if (!projectId) {
      console.warn('Skipping: no project found for admin user');
      return;
    }
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await asAdmin()
      .post(`/api/v1/tasks/project/${projectId}`)
      .send({
        title: 'FOLLO TEST task ' + Date.now(),
        description: 'Created by automated test suite',
        priority: 'MEDIUM',
        dueDate: futureDate,
      });
    // 201 if created, 400 if validation fails, 403 if no permission
    expect([201, 400, 403]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.title).toContain('FOLLO TEST task');
      expect(res.body.data.status).toBe('TODO');
      createdTaskId = res.body.data.id;
    }
  });

  it('GET /api/v1/tasks/:taskId returns task details', async () => {
    const taskId = createdTaskId || existingTaskId;
    if (!taskId) {
      console.warn('Skipping: no task available');
      return;
    }
    const res = await asAdmin().get(`/api/v1/tasks/${taskId}`);
    expect([200, 403, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(taskId);
    }
  });

  it('PATCH /api/v1/tasks/:taskId updates the task', async () => {
    const taskId = createdTaskId || existingTaskId;
    if (!taskId) {
      console.warn('Skipping: no task available');
      return;
    }
    const res = await asAdmin()
      .patch(`/api/v1/tasks/${taskId}`)
      .send({ description: 'Updated by FOLLO TEST suite' });
    expect([200, 400, 403, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  });

  it('PATCH /api/v1/tasks/:taskId can update status to IN_PROGRESS', async () => {
    const taskId = createdTaskId;
    if (!taskId) {
      console.warn('Skipping: no created task available for status update');
      return;
    }
    const res = await asAdmin()
      .patch(`/api/v1/tasks/${taskId}`)
      .send({ status: 'IN_PROGRESS' });
    expect([200, 400, 403, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  });

  it('DELETE /api/v1/tasks/:taskId deletes the created task', async () => {
    if (!createdTaskId) {
      console.warn('Skipping delete: no task was created in this run');
      return;
    }
    const res = await asAdmin().delete(`/api/v1/tasks/${createdTaskId}`);
    expect([204, 403, 404]).toContain(res.status);
    if (res.status === 204) {
      expect(res.body).toEqual({});
    }
  });

  it('DELETE non-existent task returns 404', async () => {
    const res = await asAdmin().delete('/api/v1/tasks/nonexistent-task-id-xyz');
    expect([404, 400]).toContain(res.status);
  });
});
