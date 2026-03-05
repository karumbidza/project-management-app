import prisma from "../configs/prisma.js";


//Get all workspaces for user
export const getUserWorkspaces = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const workspaces = await prisma.workspace.findMany({
            where: {
                members: {some: {userId: userId}} 
            },
            include: {
                members: {include: {user: true}},
                projects: {
                    include: {
                        tasks: {include: {assignee: true, comments: {include: {user: true}}}},
                        members: {include: {user: true}}    
                    }
                },
                owner: true,
            }
        });
        res.json(workspaces);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Failed to fetch workspaces', details: error.message });
    }
}

//ad member to workspace
export const addMemberToWorkspace = async (req, res) => {
    try {
        const {userId} = await req.auth();
        const {email, role ,workspaceId, message} = req.body;
       //check if user exist
       const user = await prisma.user.findUnique({where: {email}});
       if(!user) {
        return res.status(404).json({error: 'User not found'});
       }
       if(!workspaceId || !role) {
        return res.status(400).json({error: 'Workspace ID and role are required'});
       }

       if(!['ADMIN', 'MEMBER'].includes(role)) {
        return res.status(400).json({error: 'Invalid role. Must be ADMIN or MEMBER'});
       }
       //fetch workspace
       const workspace = await prisma.workspace.findUnique({where: {id: workspaceId}, include: {members: true}});
         if(!workspace) {
            return res.status(404).json({error: 'Workspace not found'});
         }
         //check if requester is admin
         if(!workspace.members.find((member) => member.userId === userId && member.role === 'ADMIN')) {
            return res.status(403).json({error: 'Only workspace admins can add members'});
         }
            //check if user is already a member
            const existingMember = workspace.members.find((member) => member.userId === user.id);
            if(existingMember) {
                return res.status(400).json({error: 'User is already a member of the workspace'});
            }

            const member = await prisma.workspaceMember.create({
                data: {
                    userId: user.id,
                    workspaceId,
                    role,
                    message,
                }
            });
            res.json({member, message: 'Member added to workspace successfully'});
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Failed to add member to workspace', details: error.message });
    }}