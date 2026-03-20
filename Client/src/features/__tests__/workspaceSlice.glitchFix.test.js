// FOLLO GLITCH-FIX — tests for stale fetchWorkspaces response guard
// Verifies that a race-condition where a focus-triggered GET overwrites
// a freshly created project is prevented by requestId tracking.

import { describe, it, expect, beforeAll } from 'vitest';

// localStorage is not available in Node — provide a minimal stub
beforeAll(() => {
    const store = {};
    global.localStorage = {
        getItem: (k) => store[k] ?? null,
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; },
        clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    };
});
import reducer, {
    clearWorkspaceState,
    fetchWorkspaces,
    createProjectAsync,
} from '../workspaceSlice';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/** Build a minimal fetchWorkspaces.fulfilled action */
function makeFulfilled(requestId, workspaces) {
    return {
        type: fetchWorkspaces.fulfilled.type,
        payload: workspaces,
        meta: { requestId, requestStatus: 'fulfilled' },
    };
}

/** Build a minimal fetchWorkspaces.pending action */
function makePending(requestId) {
    return {
        type: fetchWorkspaces.pending.type,
        payload: undefined,
        meta: { requestId, requestStatus: 'pending' },
    };
}

/** Build a minimal fetchWorkspaces.rejected action */
function makeRejected(requestId, error = 'Network error') {
    return {
        type: fetchWorkspaces.rejected.type,
        payload: error,
        meta: { requestId, requestStatus: 'rejected' },
    };
}

const baseWorkspace = {
    id: 'ws-1',
    name: 'Test Workspace',
    ownerId: 'user-1',
    members: [{ userId: 'user-1', role: 'ADMIN' }],
    projects: [],
};

const newProject = {
    id: 'proj-new',
    name: 'New Project',
    workspaceId: 'ws-1',
    tasks: [],
    members: [],
};

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('FOLLO GLITCH-FIX: stale fetchWorkspaces guard', () => {

    it('records the latest requestId on pending', () => {
        const state = reducer(undefined, makePending('req-A'));
        expect(state._latestWorkspacesRequestId).toBe('req-A');
    });

    it('updates latestRequestId when a newer dispatch fires', () => {
        let state = reducer(undefined, makePending('req-A'));
        state = reducer(state, makePending('req-B'));
        expect(state._latestWorkspacesRequestId).toBe('req-B');
    });

    it('accepts a fulfilled response when requestId matches latest', () => {
        let state = reducer(undefined, makePending('req-A'));
        const workspacesWithProject = [{ ...baseWorkspace, projects: [newProject] }];
        state = reducer(state, makeFulfilled('req-A', workspacesWithProject));
        expect(state.workspaces[0].projects).toHaveLength(1);
        expect(state.workspaces[0].projects[0].id).toBe('proj-new');
    });

    it('DISCARDS a stale fulfilled response (requestId mismatch)', () => {
        // Simulate:
        // 1. Focus event fires fetchWorkspaces (req-A) — sets latestId=A
        // 2. createProjectAsync optimistically adds project to state
        // 3. User creates project, then dispatches fetchWorkspaces (req-B) — sets latestId=B
        // 4. Stale req-A resolves with OLD data (no new project) → should be discarded

        // Step 1: focus-triggered fetch
        let state = reducer(undefined, makePending('req-A'));

        // Step 2: optimistic add via createProjectAsync.fulfilled
        state = reducer(state, {
            type: createProjectAsync.fulfilled.type,
            payload: { ...newProject },
            meta: { requestId: 'create-1', requestStatus: 'fulfilled' },
        });

        // Bootstrap currentWorkspace so the reducer can push to it
        state = {
            ...state,
            workspaces: [baseWorkspace],
            currentWorkspace: baseWorkspace,
        };
        state = reducer(state, {
            type: createProjectAsync.fulfilled.type,
            payload: { ...newProject },
            meta: { requestId: 'create-1', requestStatus: 'fulfilled' },
        });

        // Step 3: post-creation re-fetch (req-B becomes latest)
        state = reducer(state, makePending('req-B'));
        expect(state._latestWorkspacesRequestId).toBe('req-B');

        // Step 4: stale req-A resolves with empty projects — must be discarded
        const staleWorkspaces = [{ ...baseWorkspace, projects: [] }];
        state = reducer(state, makeFulfilled('req-A', staleWorkspaces));

        // The stale response must NOT overwrite workspaces
        expect(state.workspaces[0].projects.some(p => p.id === 'proj-new')).toBe(true);
    });

    it('DISCARDS a stale rejected response (requestId mismatch)', () => {
        let state = reducer(undefined, makePending('req-A'));
        // A newer request becomes latest
        state = reducer(state, makePending('req-B'));

        // Stale req-A rejects — must not set error or flip roleConfirmed
        state = { ...state, roleConfirmed: true };
        state = reducer(state, makeRejected('req-A'));

        // roleConfirmed should not be touched by the stale rejection
        expect(state.roleConfirmed).toBe(true);
        expect(state.error).toBeNull();
    });

    it('accepts a rejected response when requestId matches latest', () => {
        let state = reducer(undefined, makePending('req-A'));
        state = reducer(state, makeRejected('req-A', 'Server error'));
        expect(state.error).toBe('Server error');
        expect(state.roleConfirmed).toBe(true);
    });

    it('resets _latestWorkspacesRequestId on clearWorkspaceState', () => {
        let state = reducer(undefined, makePending('req-A'));
        expect(state._latestWorkspacesRequestId).toBe('req-A');

        state = reducer(state, clearWorkspaceState());
        expect(state._latestWorkspacesRequestId).toBeNull();
    });

    it('fresh fetchWorkspaces after creation wins over stale focus-triggered one', () => {
        // Full realistic sequence:
        // T0: window:focus → req-A dispatched
        // T1: project created → createProjectAsync updates state + req-B dispatched
        // T2: req-A resolves (stale, no new project) → DISCARDED
        // T3: req-B resolves (fresh, has new project) → ACCEPTED

        let state = reducer(undefined, makePending('req-A')); // T0
        state = reducer(state, makePending('req-B'));          // T1: supersedes req-A

        const staleWorkspaces = [{ ...baseWorkspace, projects: [] }];
        const freshWorkspaces = [{ ...baseWorkspace, projects: [newProject] }];

        // T2: stale req-A resolves
        state = reducer(state, makeFulfilled('req-A', staleWorkspaces));
        // Stale — workspaces should not have updated yet (still no currentWorkspace)
        // But _latestWorkspacesRequestId is req-B, so stale is discarded
        expect(state._latestWorkspacesRequestId).toBe('req-B');

        // T3: fresh req-B resolves
        state = reducer(state, makeFulfilled('req-B', freshWorkspaces));
        expect(state.workspaces[0].projects).toHaveLength(1);
        expect(state.workspaces[0].projects[0].id).toBe('proj-new');
        expect(state.roleConfirmed).toBe(true);
    });
});
