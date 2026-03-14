// FOLLO FIX
import express from 'express';
import { Webhook } from 'svix';
import { inngest } from '../inngest/index.js';

const webhookRouter = express.Router();

// Clerk webhook endpoint with signature verification
webhookRouter.post('/clerk', express.raw({ type: 'application/json' }), async (req, res) => {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
        console.error('CLERK_WEBHOOK_SECRET is not set');
        return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    // Get the headers
    const svix_id = req.headers['svix-id'];
    const svix_timestamp = req.headers['svix-timestamp'];
    const svix_signature = req.headers['svix-signature'];

    // If there are no headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
        return res.status(400).json({ error: 'Missing svix headers' });
    }

    // Get the body
    const body = req.body.toString();

    // Create a new Svix instance with your secret
    const wh = new Webhook(WEBHOOK_SECRET);

    let evt;

    // Verify the webhook signature
    try {
        evt = wh.verify(body, {
            'svix-id': svix_id,
            'svix-timestamp': svix_timestamp,
            'svix-signature': svix_signature,
        });
    } catch (err) {
        console.error('Webhook verification failed:', err.message);
        return res.status(400).json({ error: 'Webhook verification failed' });
    }

    // Get the event type and data
    const eventType = evt.type;
    const eventData = evt.data;

    // Map Clerk event types to Inngest events
    const eventMap = {
        'user.created': 'clerk/user.created',
        'user.updated': 'clerk/user.updated',
        'user.deleted': 'clerk/user.deleted',
        'organization.created': 'clerk/workspace.created',
        'organization.updated': 'clerk/workspace.updated',
        'organization.deleted': 'clerk/workspace.deleted',
        'organizationMembership.created': 'clerk/organizationInvitation.accepted',
        'organizationMembership.deleted': 'clerk/workspace.member.deleted',
        'organizationInvitation.accepted': 'clerk/organizationInvitation.accepted',
    };

    const inngestEventName = eventMap[eventType];

    if (inngestEventName) {
        try {
            // Send event to Inngest
            await inngest.send({
                name: inngestEventName,
                data: eventData,
            });
        } catch (err) {
            console.error('Failed to send event to Inngest:', err);
            return res.status(500).json({ error: 'Failed to process webhook' });
        }
    } else {
        // Unhandled event type — no action needed
    }

    res.status(200).json({ received: true });
});

export default webhookRouter;
