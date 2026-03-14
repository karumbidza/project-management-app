// FOLLO FIX
import 'dotenv/config';
import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
    console.warn('[Email] WARNING: RESEND_API_KEY not found in environment variables');
}

const resend = new Resend(apiKey);
const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@tick-trackpro.com';
const appName = 'Project Management';
const appUrl = process.env.APP_URL || 'http://localhost:5173';

console.info(`[Email] Service initialized with from: ${fromEmail}`);

// Email Templates
const templates = {
    // Workspace invitation email
    workspaceInvite: ({ inviteeName, workspaceName, inviterName, role }) => ({
        subject: `You've been invited to join ${workspaceName}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
                <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 32px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited! 🎉</h1>
                    </div>
                    <div style="padding: 32px;">
                        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                            Hi${inviteeName ? ` ${inviteeName}` : ''},
                        </p>
                        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                            <strong>${inviterName}</strong> has invited you to join <strong>${workspaceName}</strong> as a <strong>${role.toLowerCase()}</strong>.
                        </p>
                        <div style="text-align: center; margin: 32px 0;">
                            <a href="${appUrl}" style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                Accept Invitation
                            </a>
                        </div>
                        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0;">
                            If you don't have an account yet, you'll be prompted to create one. Your invitation will be automatically applied once you sign up.
                        </p>
                    </div>
                    <div style="background: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                            ${appName} • Collaborative Project Management
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `,
    }),

    // Project invitation email
    projectInvite: ({ inviteeName, projectName, workspaceName, inviterName, role, inviteeEmail }) => ({
        subject: `You've been invited to ${projectName}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
                <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); padding: 32px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">Project Invitation 📋</h1>
                    </div>
                    <div style="padding: 32px;">
                        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                            Hi${inviteeName ? ` ${inviteeName}` : ''},
                        </p>
                        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                            <strong>${inviterName}</strong> has invited you to collaborate on <strong>${projectName}</strong> in the <strong>${workspaceName}</strong> workspace as a <strong>${role.toLowerCase()}</strong>.
                        </p>
                        <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 0 0 24px;">
                            <p style="color: #92400e; font-size: 14px; margin: 0;">
                                <strong>Important:</strong> Sign in or create an account using this email address: <strong>${inviteeEmail || 'the email this was sent to'}</strong>
                            </p>
                        </div>
                        <div style="text-align: center; margin: 32px 0;">
                            <a href="${appUrl}?invite_email=${encodeURIComponent(inviteeEmail || '')}" style="display: inline-block; background: #8b5cf6; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                Accept Invitation
                            </a>
                        </div>
                        <p style="color: #6b7280; font-size: 13px; text-align: center; margin: 0;">
                            Already have an account? Make sure to sign out first if using a different email.
                        </p>
                    </div>
                    <div style="background: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                            ${appName} • Collaborative Project Management
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `,
    }),

    // Task assigned email
    taskAssigned: ({ assigneeName, taskTitle, projectName, dueDate, assignerName, priority }) => ({
        subject: `New task assigned: ${taskTitle}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
                <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">New Task Assigned ✅</h1>
                    </div>
                    <div style="padding: 32px;">
                        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                            Hi ${assigneeName},
                        </p>
                        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                            ${assignerName ? `<strong>${assignerName}</strong> has assigned you a new task:` : 'You have been assigned a new task:'}
                        </p>
                        <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
                            <h2 style="color: #111827; font-size: 18px; margin: 0 0 12px;">${taskTitle}</h2>
                            <p style="color: #6b7280; font-size: 14px; margin: 0;">
                                <strong>Project:</strong> ${projectName}<br>
                                ${dueDate ? `<strong>Due:</strong> ${dueDate}<br>` : ''}
                                ${priority ? `<strong>Priority:</strong> <span style="color: ${priority === 'HIGH' ? '#ef4444' : priority === 'MEDIUM' ? '#f59e0b' : '#10b981'}">${priority}</span>` : ''}
                            </p>
                        </div>
                        <div style="text-align: center;">
                            <a href="${appUrl}" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                View Task
                            </a>
                        </div>
                    </div>
                    <div style="background: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                            ${appName} • Collaborative Project Management
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `,
    }),

    // Task due reminder (24 hours before)
    taskDueReminder: ({ assigneeName, taskTitle, projectName, dueDate }) => ({
        subject: `⏰ Reminder: "${taskTitle}" is due tomorrow`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
                <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">Due Tomorrow ⏰</h1>
                    </div>
                    <div style="padding: 32px;">
                        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                            Hi ${assigneeName},
                        </p>
                        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                            This is a friendly reminder that your task is due tomorrow:
                        </p>
                        <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
                            <h2 style="color: #92400e; font-size: 18px; margin: 0 0 12px;">${taskTitle}</h2>
                            <p style="color: #78350f; font-size: 14px; margin: 0;">
                                <strong>Project:</strong> ${projectName}<br>
                                <strong>Due:</strong> ${dueDate}
                            </p>
                        </div>
                        <div style="text-align: center;">
                            <a href="${appUrl}" style="display: inline-block; background: #f59e0b; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                View Task
                            </a>
                        </div>
                    </div>
                    <div style="background: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                            ${appName} • Collaborative Project Management
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `,
    }),

    // Task overdue notification
    taskOverdue: ({ assigneeName, taskTitle, projectName, dueDate, daysOverdue }) => ({
        subject: `🚨 Overdue: "${taskTitle}" was due ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} ago`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
                <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 32px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">Task Overdue 🚨</h1>
                    </div>
                    <div style="padding: 32px;">
                        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                            Hi ${assigneeName},
                        </p>
                        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                            The following task is now overdue and needs your attention:
                        </p>
                        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
                            <h2 style="color: #991b1b; font-size: 18px; margin: 0 0 12px;">${taskTitle}</h2>
                            <p style="color: #7f1d1d; font-size: 14px; margin: 0;">
                                <strong>Project:</strong> ${projectName}<br>
                                <strong>Was due:</strong> ${dueDate}<br>
                                <strong>Overdue by:</strong> ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}
                            </p>
                        </div>
                        <div style="text-align: center;">
                            <a href="${appUrl}" style="display: inline-block; background: #ef4444; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                Complete Task
                            </a>
                        </div>
                    </div>
                    <div style="background: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                            ${appName} • Collaborative Project Management
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `,
    }),

    // Welcome email
    welcome: ({ userName, workspaceName }) => ({
        subject: `Welcome to ${appName}! 🚀`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
                <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 40px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to ${appName}! 🚀</h1>
                    </div>
                    <div style="padding: 32px;">
                        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                            Hi ${userName},
                        </p>
                        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                            Welcome aboard! ${workspaceName ? `You've joined <strong>${workspaceName}</strong>.` : "You're all set to start managing your projects."} Here's what you can do:
                        </p>
                        <ul style="color: #374151; font-size: 16px; line-height: 1.8; margin: 0 0 24px; padding-left: 20px;">
                            <li>📁 Create and organize projects</li>
                            <li>✅ Track tasks with Kanban boards</li>
                            <li>📊 View Gantt charts for timelines</li>
                            <li>👥 Collaborate with your team</li>
                            <li>📈 Monitor progress with analytics</li>
                        </ul>
                        <div style="text-align: center;">
                            <a href="${appUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                Get Started
                            </a>
                        </div>
                    </div>
                    <div style="background: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                            ${appName} • Collaborative Project Management
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `,
    }),

    // New comment notification
    newComment: ({ recipientName, commenterName, taskTitle, projectName, commentPreview, taskUrl, isMedia }) => ({
        subject: `💬 New ${isMedia ? 'media' : 'comment'} on "${taskTitle}"`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
                <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 32px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">New ${isMedia ? 'Media Shared' : 'Comment'} 💬</h1>
                    </div>
                    <div style="padding: 32px;">
                        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                            Hi ${recipientName},
                        </p>
                        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                            <strong>${commenterName}</strong> ${isMedia ? 'shared media' : 'commented'} on a task you're involved with:
                        </p>
                        <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
                            <h2 style="color: #111827; font-size: 16px; margin: 0 0 8px;">${taskTitle}</h2>
                            <p style="color: #6b7280; font-size: 14px; margin: 0 0 12px;">
                                <strong>Project:</strong> ${projectName}
                            </p>
                            ${commentPreview ? `
                            <div style="background: white; border-left: 3px solid #6366f1; padding: 12px 16px; margin-top: 12px;">
                                <p style="color: #374151; font-size: 14px; margin: 0; font-style: italic;">
                                    "${commentPreview.length > 150 ? commentPreview.substring(0, 150) + '...' : commentPreview}"
                                </p>
                            </div>
                            ` : ''}
                        </div>
                        <div style="text-align: center;">
                            <a href="${taskUrl}" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                View Discussion
                            </a>
                        </div>
                    </div>
                    <div style="background: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                            ${appName} • Collaborative Project Management
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `,
    }),
};

// Email sending functions
export const emailService = {
    /**
     * Send a workspace invitation email
     */
    async sendWorkspaceInvite({ to, inviteeName, workspaceName, inviterName, role }) {
        const template = templates.workspaceInvite({ inviteeName, workspaceName, inviterName, role });
        return sendEmail({ to, ...template });
    },

    /**
     * Send a project invitation email
     */
    async sendProjectInvite({ to, inviteeName, projectName, workspaceName, inviterName, role }) {
        const template = templates.projectInvite({ inviteeName, projectName, workspaceName, inviterName, role, inviteeEmail: to });
        return sendEmail({ to, ...template });
    },

    /**
     * Send task assignment notification
     */
    async sendTaskAssigned({ to, assigneeName, taskTitle, projectName, dueDate, assignerName, priority }) {
        const template = templates.taskAssigned({ assigneeName, taskTitle, projectName, dueDate, assignerName, priority });
        return sendEmail({ to, ...template });
    },

    /**
     * Send task due reminder (24 hours before)
     */
    async sendTaskDueReminder({ to, assigneeName, taskTitle, projectName, dueDate }) {
        const template = templates.taskDueReminder({ assigneeName, taskTitle, projectName, dueDate });
        return sendEmail({ to, ...template });
    },

    /**
     * Send task overdue notification
     */
    async sendTaskOverdue({ to, assigneeName, taskTitle, projectName, dueDate, daysOverdue }) {
        const template = templates.taskOverdue({ assigneeName, taskTitle, projectName, dueDate, daysOverdue });
        return sendEmail({ to, ...template });
    },

    /**
     * Send welcome email
     */
    async sendWelcome({ to, userName, workspaceName }) {
        const template = templates.welcome({ userName, workspaceName });
        return sendEmail({ to, ...template });
    },

    /**
     * Send comment notification to project members
     */
    async sendCommentNotification({ to, recipientName, commenterName, taskTitle, projectName, commentPreview, taskUrl, isMedia }) {
        const template = templates.newComment({ recipientName, commenterName, taskTitle, projectName, commentPreview, taskUrl, isMedia });
        return sendEmail({ to, ...template });
    },

    /**
     * Send comment notifications to multiple recipients (batch)
     */
    async sendBatchCommentNotifications(recipients, { commenterName, taskTitle, projectName, commentPreview, taskUrl, isMedia }) {
        const results = await Promise.allSettled(
            recipients.map(({ email, name }) => 
                this.sendCommentNotification({
                    to: email,
                    recipientName: name,
                    commenterName,
                    taskTitle,
                    projectName,
                    commentPreview,
                    taskUrl,
                    isMedia,
                })
            )
        );
        
        const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
        console.info(`[Email] Batch comment notifications: ${successful}/${recipients.length} sent`);
        return { sent: successful, total: recipients.length };
    },
};

/**
 * Core email sending function
 */
async function sendEmail({ to, subject, html }) {
    try {
        const result = await resend.emails.send({
            from: fromEmail,
            to,
            subject,
            html,
        });

        if (result.error) {
            console.error('[Email] Failed to send:', result.error);
            return { success: false, error: result.error };
        }

        console.info(`[Email] Sent "${subject}" successfully`);
        return { success: true, id: result.data?.id };
    } catch (error) {
        console.error('[Email] Error:', error);
        return { success: false, error: error.message };
    }
}

export default emailService;
