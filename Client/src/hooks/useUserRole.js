// FOLLO AUTH-FIX
// FOLLO ROLE-FIX
// FOLLO ROLE-FLASH
import { useSelector } from 'react-redux';
import { useUser, useAuth } from '@clerk/clerk-react';

/**
 * Custom hook to get current user's role in the workspace/project
 * Returns role info and helper functions
 * 
 * FOLLO AUTH-FIX: Uses useAuth().userId (LIVE Clerk session) for all
 * role matching instead of cached email/user object to prevent stale
 * role detection when switching accounts in the same browser.
 * 
 * Handles two scenarios:
 * 1. Admin/Owner: Has workspace membership, can see all projects
 * 2. Member: Only has project membership, can only see assigned projects
 */
export function useUserRole() {
    const { user } = useUser();
    const { userId: liveUserId, isLoaded } = useAuth();
    const { currentWorkspace, workspaces, myProjects, currentProject, isMemberView, loadingStates, roleConfirmed } = useSelector((state) => state.workspace);
    
    // FOLLO AUTH-FIX: Always use liveUserId from useAuth() — this is the
    // canonical Clerk session ID, not a cached value from a previous session.
    const userId = liveUserId;
    const userEmail = user?.primaryEmailAddress?.emailAddress;
    
    // Check if user is in member-only view
    // True if: (a) isMemberView flag is set, (b) no workspaces at all, OR (c) user is not ADMIN/OWNER in any workspace
    // FOLLO ROLE-FLASH: Use roleConfirmed (not workspacesLoaded) so focus-triggered re-fetches
    // don't temporarily flip loadingStates.workspaces=true and reset role to unknown.
    // roleConfirmed stays true during re-fetches; only clears on user switch.
    const isAdminInAnyWorkspace = roleConfirmed && workspaces?.some(ws => {
        if (ws.ownerId === userId) return true;
        return ws.members?.some(m =>
            (m.userId === userId || m.user?.id === userId) && m.role === 'ADMIN'
        );
    });

    // FOLLO ROLE-FIX: Member determination comes from WorkspaceMember.role, NOT project count.
    // A user is a member if they have MEMBER role in any workspace regardless of project count.
    // New users with 0 memberships → isProjectMemberOnly=false → onboarding/admin state (correct).
    // Admin who deleted last workspace → 0 memberships → isProjectMemberOnly=false → admin state (correct).
    const isMemberInAnyWorkspace = roleConfirmed && (workspaces?.some(ws =>
        ws.members?.some(m =>
            (m.userId === userId || m.user?.id === userId) && m.role === 'MEMBER'
        )
    ) ?? false);
    const isProjectMemberOnly = isMemberView || (roleConfirmed && isMemberInAnyWorkspace && !isAdminInAnyWorkspace);
    
    // FOLLO AUTH-FIX: Match by userId first, fall back to email
    const workspaceMembership = currentWorkspace?.members?.find(
        (m) => m.userId === userId || m.user?.id === userId
    );
    
    // Find user's role in current project (for member view)
    const projectMembership = currentProject?.members?.find(
        (m) => m.userId === userId || m.user?.id === userId
    ) || (currentProject?.myRole ? { role: currentProject.myRole } : null);
    
    const workspaceRole = workspaceMembership?.role || null;
    const projectRole = projectMembership?.role || null;
    
    const isWorkspaceOwner = currentWorkspace?.ownerId === userId;
    
    // Role checks - based on context (workspace or project)
    const isAdmin = !isProjectMemberOnly && (isWorkspaceOwner || workspaceRole === 'ADMIN');
    const isMember = isProjectMemberOnly || workspaceRole === 'MEMBER';
    const isViewer = workspaceRole === 'VIEWER';
    
    // Project-level role checks
    const isProjectOwner = projectRole === 'OWNER';
    const isProjectContributor = projectRole === 'CONTRIBUTOR';
    const isProjectViewer = projectRole === 'VIEWER';
    
    // Permission checks - different for admins vs members
    const canManageWorkspace = isAdmin;
    const canManageProjects = isAdmin;
    const canManageMembers = isAdmin;
    const canViewReports = isAdmin;
    const canCreateProjects = isAdmin; // Only admins can create projects
    const canDeleteWorkspace = isWorkspaceOwner;
    
    // Task permissions — only PM/admin can create tasks (FOLLO PERMISSIONS)
    const canCreateTasks = isAdmin || isProjectOwner || projectRole === 'MANAGER';
    const canAssignTasks = isAdmin || isProjectOwner || projectRole === 'MANAGER';
    const canViewGantt = true; // Everyone can view Gantt charts
    
    // SLA permissions (FOLLO SLA — Phase 8)
    const canSubmitTask = isProjectContributor || isProjectOwner || isAdmin; // assignees submit
    const canApproveReject = isAdmin || isProjectOwner || projectRole === 'MANAGER';
    const canRaiseBlocker = canSubmitTask; // assignees raise blockers
    const canResolveBlocker = canApproveReject; // PMs/admins resolve
    const canViewSla = true; // any member can view SLA summary
    const canManageTemplates = isAdmin || isProjectOwner || projectRole === 'MANAGER';
    const canApplyTemplate = isAdmin || isProjectOwner || projectRole === 'MANAGER';
    
    return {
        // User info
        user,
        userId,
        userEmail,
        isLoaded: isLoaded && !!userId,
        roleConfirmed,  // FOLLO ROLE-FLASH: true after first workspace fetch resolves
        
        // View mode
        isProjectMemberOnly,
        isMemberView: isProjectMemberOnly,
        
        // Role info
        workspaceRole,
        projectRole,
        isOwner: isWorkspaceOwner,
        isAdmin,
        isMember,
        isViewer,
        
        // Project roles
        isProjectOwner,
        isProjectContributor,
        isProjectViewer,
        
        // Permissions
        canManageWorkspace,
        canManageProjects,
        canManageMembers,
        canViewReports,
        canCreateProjects,
        canDeleteWorkspace,
        canCreateTasks,
        canAssignTasks,
        canViewGantt,
        
        // SLA permissions
        canSubmitTask,
        canApproveReject,
        canRaiseBlocker,
        canResolveBlocker,
        canViewSla,
        canManageTemplates,
        canApplyTemplate,
        
        // Workspace/Project info
        currentWorkspace,
        currentProject,
        membership: workspaceMembership || projectMembership,
    };
}

export default useUserRole;
