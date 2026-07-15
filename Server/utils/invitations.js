// FOLLO MEMBERS — shared invitation acceptance.
//
// Converts a freshly-synced user's PENDING invitations into real memberships.
// This must be reachable from BOTH entry points that can create a user:
//   1. the Clerk `user.created` webhook (via Inngest), and
//   2. the auth middleware, which lazily creates the user row on their first
//      authenticated request.
// Historically only (1) processed invitations, and it early-returned when the
// user already existed — so if the auth middleware created the user first (the
// common case: the invitee opens the app), the invitation was never accepted
// and the person never joined the workspace they were invited to.
import prisma from "../configs/prisma.js";
import { invalidateCachePattern, CACHE_KEYS } from "../lib/cache.js";

/**
 * Accept every non-expired PENDING invitation for this user's email.
 * Idempotent and safe to call from multiple entry points concurrently.
 *
 * @param {{ id: string, email?: string | null }} user
 * @returns {Promise<number>} number of invitations accepted
 */
export async function processPendingInvitationsForUser(user) {
  const email = (user?.email || "").toLowerCase().trim();
  if (!user?.id || !email) return 0;

  const pendingInvitations = await prisma.invitation.findMany({
    where: {
      email,
      status: "PENDING",
      expiresAt: { gte: new Date() },
    },
    include: {
      project: { include: { workspace: true } },
      workspace: true,
    },
  });

  if (pendingInvitations.length === 0) return 0;

  // Ensure a WorkspaceMember row exists for (user, workspace). Idempotent.
  const ensureWorkspaceMember = async (workspaceId, role) => {
    if (!workspaceId) return;
    const existing = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId } },
    });
    if (!existing) {
      await prisma.workspaceMember.create({
        data: { userId: user.id, workspaceId, role: role || "MEMBER" },
      });
    }
  };

  const affectedWorkspaceIds = new Set();
  let processed = 0;

  for (const invitation of pendingInvitations) {
    try {
      if (invitation.workspaceId) {
        // ── Workspace (org) invitation ──
        await ensureWorkspaceMember(invitation.workspaceId, invitation.workspaceRole);
        affectedWorkspaceIds.add(invitation.workspaceId);
      } else if (invitation.projectId) {
        // ── Project invitation → project member + parent workspace member ──
        const alreadyMember = await prisma.projectMember.findFirst({
          where: { userId: user.id, projectId: invitation.projectId },
        });
        if (!alreadyMember) {
          await prisma.projectMember.create({
            data: {
              userId: user.id,
              projectId: invitation.projectId,
              role: invitation.role,
            },
          });
        }
        const parentWorkspaceId = invitation.project?.workspaceId;
        await ensureWorkspaceMember(parentWorkspaceId, "MEMBER");
        if (parentWorkspaceId) affectedWorkspaceIds.add(parentWorkspaceId);
      }

      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      processed++;
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "invitation.process.failed",
          invitationId: invitation.id,
          userId: user.id,
          error: error.message,
        })
      );
    }
  }

  if (processed > 0) {
    // Bust the cached workspace list for the joining user AND every existing
    // member of the workspaces they just joined, so their dashboards and task
    // assign dropdowns show the new member without waiting for the cache TTL.
    invalidateCachePattern(CACHE_KEYS.userWorkspaces(user.id));
    invalidateCachePattern(CACHE_KEYS.userProjects(user.id));
    if (affectedWorkspaceIds.size > 0) {
      const coMembers = await prisma.workspaceMember.findMany({
        where: { workspaceId: { in: [...affectedWorkspaceIds] } },
        select: { userId: true },
      });
      for (const m of coMembers) {
        invalidateCachePattern(CACHE_KEYS.userWorkspaces(m.userId));
      }
    }

    console.info(
      JSON.stringify({
        level: "info",
        event: "invitation.processed",
        userId: user.id,
        count: processed,
      })
    );
  }

  return processed;
}
