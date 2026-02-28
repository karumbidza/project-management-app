import { Prisma } from "@prisma/client";
import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "project-management" });


//ingest Function to save user data to the database when a user is created in Clerk
const syncUserCreation = inngest.createFunction(
    {id: "sync-user-from-clerk"},
    { event: "clerk/user.created" },
    async ({ event,}) => {
        const {data} = event;
        await Prisma.user.create({
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
        await Prisma.user.delete({
            where: {
                id: data.id,
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
        await Prisma.user.update({
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
];
