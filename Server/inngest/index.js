import { Inngest } from "inngest";
import prisma from "../configs/prisma.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "project-management" });


//ingest Function to save user data to the database when a user is created in Clerk
const syncUserCreation = inngest.createFunction(
    {id: "sync-user-from-clerk"},
    { event: "clerk/user.created" },
    async ({ event,}) => {
        const {data} = event;
        await prisma.user.create({
            data: {
                id: data.id,
                email: data?.email_addresses[0]?.email_address,
                name: data?.first_name + " " + data?.last_name,
                image: data?.image_url,
            }
        })
    }
)
//ingest function to delete user from database.
const syncUserDeletion = inngest.createFunction(
    {id: "sync-user-deletion-from-clerk"},
    { event: "clerk/user.deleted" },
    async ({ event}) => {
        const {data} = event;
        await prisma.user.delete({
            where: {
                id: data.id,
            }
        })
    }
)
//ingest funtion to save workspace data to the database when a workspace is created in Clerk

const syncWorkspaceCreation = inngest.createFunction(
    {id: "sync-workspace-from-clerk"},
    { event: "clerk/workspace.created" },
    async ({ event,}) => {
        const {data} = event;
        await prisma.workspace.create({
            data: {
                id: data.id,
                name: data.name,
                slug: data.slug,
                ownerId: data.created_by,
                image_url: data.image_url,
            }
        })
        //Add creator as admin memeber of the workspace
        await prisma.workspaceMember.create({
            data: {
                userId: data.created_by,
                workspaceId: data.id,
                role: "ADMIN",
            }
        })
    }
)
//inngest function to update workspace data in database.
const syncWorkspaceUpdation = inngest.createFunction(
    {id: "sync-workspace-update-from-clerk"},
    { event: "clerk/workspace.updated" },
    async ({ event}) => {
        const {data} = event;
        await prisma.workspace.update({
            where: {
                id: data.id,
            },
            data: {
                name: data.name,
                slug: data.slug,
                image_url: data.image_url,
            }
        })
    }
)

//inngest function to delete workspace from database.
const syncWorkspaceDeletion = inngest.createFunction(
    {id: "sync-workspace-deletion-from-clerk"},
    { event: "clerk/workspace.deleted" },
    async ({ event}) => {
        const {data} = event;
        await prisma.workspace.delete({
            where: {
                id: data.id,
            }
        })
    }
)

//inngest function to save workspace member data to database
const syncWorkspaceMemberCreation = inngest.createFunction(
    {id: "sync-workspace-member-from-clerk"},
    { event: "clerk/organizationInvitation.accepted" },
    async ({ event,}) => {
        const {data} = event;
        await prisma.workspaceMember.create({
            data: {
                userId: data.user_id,
                workspaceId: data.organization_id,
                role: String(data.role_name).toUpperCase(),
            }
        })
    }
)

//ingest function to delete workspace member from database
const syncWorkspaceMemberDeletion = inngest.createFunction(
    {id: "sync-workspace-member-deletion-from-clerk"},
    { event: "clerk/workspace.member.deleted" },
    async ({ event}) => {
        const {data} = event;
        await prisma.workspaceMember.delete({
            where: {
                userId_workspaceId: {
                    userId: data.user_id,
                    workspaceId: data.workspace_id,
                }
            }
        })
    }
)

//ingest function to update user in database when user is updated in Clerk
const syncUserUpdation = inngest.createFunction(
    {id: "sync-user-update-from-clerk"},
    { event: "clerk/user.updated" },
    async ({ event}) => {
        const {data} = event;
        await prisma.user.update({
            where: {
                id: data.id,
            },
            data: {
                email: data?.email_addresses[0]?.email_address,
                name: data?.first_name + " " + data?.last_name,
                image: data?.image_url,
            }
        })
    }
)
// Create an empty array where we'll export future Inngest functions
export const functions = [
    syncUserCreation,
    syncUserDeletion,
    syncUserUpdation,        
    syncWorkspaceCreation,
    syncWorkspaceUpdation,
    syncWorkspaceDeletion,
    syncWorkspaceMemberCreation,
    syncWorkspaceMemberDeletion,    

];
