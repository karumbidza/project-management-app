import { useSelector } from 'react-redux';
import { useUser } from '@clerk/clerk-react';

/**
 * Custom hook to get current user's role in the workspace/project
 * Returns role info and helper functions
 * 
 * Handles two scenarios:
 * 1. Admin/Owner: Has workspace membership, can see all projects
 * 2. Member: Only has project membership, can only see assigned projects
 */
export function useUserRole() {
    const { user } = useUser();
    const { currentWorkspace, workspaces, myProjects, currentProject, isMemberView, loadingStates } = useSelector((state) => state.workspace);
    
    // Check if user is in member-only view (has projects but no workspaces)
    // Only true if: isMemberView flag is set, OR user has projects but zero workspaces (and workspaces have finished loading)
    const hasNoWorkspaces = workspaces?.length === 0 && !loadingStates?.workspaces;
    const isProjectMemberOnly = isMemberView || (myProjects?.length > 0 && hasNoWorkspaces && !currentWorkspace);
    
    // Find user's membership in current workspace (if any)
    const workspaceMembership = currentWorkspace?.members?.find(
        (m) => m.user?.email === user?.primaryEmailAddress?.emailAddress
    );
    
    // Find user's role in current project (for member view)
    const projectMembership = currentProject?.members?.find(
        (m) => m.user?.email === user?.primaryEmailAddress?.emailAddress
    ) || (currentProject?.myRole ? { role: currentProject.myRole } : null);
    
    const workspaceRole = workspaceMembership?.role || null;
    const projectRole = projectMembership?.role || null;
    
    const isWorkspaceOwner = currentWorkspace?.ownerId === user?.id || 
                             currentWorkspace?.owner?.email === user?.primaryEmailAddress?.emailAddress;
    
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
    
    // Task permissions - members CAN create and assign tasks
    const canCreateTasks = isAdmin || isProjectOwner || isProjectContributor;
    const canAssignTasks = isAdmin || isProjectOwner || isProjectContributor;
    const canViewGantt = true; // Everyone can view Gantt charts
    
    return {
        // User info
        user,
        userId: user?.id,
        userEmail: user?.primaryEmailAddress?.emailAddress,
        
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
        
        // Workspace/Project info
        currentWorkspace,
        currentProject,
        membership: workspaceMembership || projectMembership,
    };
}

export default useUserRole;
