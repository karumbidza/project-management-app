// FOLLO FIX
// FOLLO SECURITY
import prisma from "../configs/prisma.js";
import { clerkClient } from "@clerk/express";

// Ensure user exists in database when they make any authenticated request
const ensureUserInDb = async (userId) => {
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        // Get user data from Clerk and create in our database
        const clerkUser = await clerkClient.users.getUser(userId);
        const email = clerkUser.emailAddresses[0]?.emailAddress?.toLowerCase() || '';
        const name = ((clerkUser.firstName || '') + ' ' + (clerkUser.lastName || '')).trim() || 'User';
        const image = clerkUser.imageUrl || '';

        try {
            user = await prisma.user.create({
                data: { id: userId, name, email, image }
            });
            console.info(JSON.stringify({ level: 'info', event: 'auth.user.created', userId, timestamp: new Date().toISOString() }));
        } catch (error) {
            // Handle duplicate email - user might exist with different Clerk ID
            if (error.code === 'P2002') {
                const existingUser = await prisma.user.findUnique({ where: { email } });
                if (existingUser && existingUser.id !== userId) {
                    // User exists with old Clerk ID - migrate to new ID
                    console.info(JSON.stringify({ level: 'info', event: 'auth.user.migrating', userId, timestamp: new Date().toISOString() }));
                    
                    // Update all relations to use new user ID
                    // Update User.id first so FK constraints are satisfied
                    await prisma.$transaction([
                        prisma.user.update({
                            where: { id: existingUser.id },
                            data: { id: userId, name, image }
                        }),
                        prisma.workspaceMember.updateMany({
                            where: { userId: existingUser.id },
                            data: { userId: userId }
                        }),
                        prisma.projectMember.updateMany({
                            where: { userId: existingUser.id },
                            data: { userId: userId }
                        }),
                        prisma.task.updateMany({
                            where: { assigneeId: existingUser.id },
                            data: { assigneeId: userId }
                        }),
                        prisma.task.updateMany({
                            where: { createdById: existingUser.id },
                            data: { createdById: userId }
                        }),
                        prisma.comment.updateMany({
                            where: { userId: existingUser.id },
                            data: { userId: userId }
                        }),
                        prisma.workspace.updateMany({
                            where: { ownerId: existingUser.id },
                            data: { ownerId: userId }
                        }),
                        prisma.project.updateMany({
                            where: { ownerId: existingUser.id },
                            data: { ownerId: userId }
                        }),
                        prisma.invitation.updateMany({
                            where: { invitedById: existingUser.id },
                            data: { invitedById: userId }
                        }),
                    ]);
                    
                    user = await prisma.user.findUnique({ where: { id: userId } });
                    console.info(JSON.stringify({ level: 'info', event: 'auth.user.migrated', userId, timestamp: new Date().toISOString() }));
                } else {
                    user = existingUser;
                }
            } else {
                throw error;
            }
        }
    }
    return user;
};

export const protect = async (req, res, next) => {
    // FOLLO TESTS — bypass Clerk in test environment
    if (process.env.NODE_ENV === 'test' && req.headers['x-test-user-id']) {
        const testUserId = req.headers['x-test-user-id'];
        req.auth = async () => ({ userId: testUserId });
        req.userId = testUserId;
        return next();
    }

    try {
        const { userId } = await req.auth();
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Auto-create user in our database if they don't exist
        await ensureUserInDb(userId);
        
        // Attach userId to request for downstream use
        req.userId = userId;
        return next();
    } catch (error) {
        console.error('[Auth] middleware error:', error.message);
        return res.status(401).json({ error: 'Unauthorized' });
    }
}