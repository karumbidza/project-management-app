// FOLLO ACCESS-SEC
import prisma from '../configs/prisma.js';

/**
 * Verifies caller is still a member of the target workspace.
 * Extracts workspaceId from: route param → query param → body.
 * Only runs the check when a workspaceId is present in the request.
 * Resource-level routes (task/project by ID) rely on service-layer auth.
 */
export const requireWorkspaceMembership = async (req, res, next) => {
  try {
    const { userId } = await req.auth();
    const workspaceId =
      req.params?.workspaceId ??
      req.query?.workspaceId ??
      req.body?.workspaceId;

    if (!workspaceId) return next();

    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
      select: { id: true, role: true },
    });

    if (!member) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'workspace_access_revoked',
          message: 'You no longer have access to this workspace.',
        },
      });
    }

    req.workspaceRole = member.role;
    next();
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', event: 'workspace.membership.check.failed', message: err.message }));
    return res.status(500).json({ success: false, error: { message: 'Authorization check failed' } });
  }
};
