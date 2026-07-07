-- FOLLO MEMBERS — workspace-scoped invitations
-- The Invitation table becomes dual-scope: projectId for a project invite,
-- workspaceId for an org (workspace) invite. This lets an admin invite a
-- brand-new person to the organisation by email before they've signed up.

-- Project scope becomes optional (workspace invites have no project).
ALTER TABLE "Invitation" ALTER COLUMN "projectId" DROP NOT NULL;

-- New workspace scope + role.
ALTER TABLE "Invitation" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Invitation" ADD COLUMN "workspaceRole" "WorkspaceRole";

-- FK + indexes for the workspace scope.
ALTER TABLE "Invitation"
  ADD CONSTRAINT "Invitation_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Invitation_workspaceId_idx" ON "Invitation"("workspaceId");

-- One pending invite per (email, workspace). NULL workspaceId rows (project
-- invites) are treated as distinct by Postgres, so this doesn't collide with
-- the existing (email, projectId) uniqueness.
CREATE UNIQUE INDEX "Invitation_email_workspaceId_key" ON "Invitation"("email", "workspaceId");
