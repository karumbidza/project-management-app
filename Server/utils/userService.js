// FOLLO FIX
/**
 * Production-grade user service
 * Handles user sync between Clerk and database
 */

import prisma from '../configs/prisma.js';
import { clerkClient } from '@clerk/express';
import { NotFoundError, DatabaseError } from './errors.js';

/**
 * Ensure user exists in database, creating if necessary
 * Uses Clerk as source of truth for user data
 * @param {string} userId - Clerk user ID
 * @returns {Promise<Object>} User object from database
 */
export async function ensureUserExists(userId) {
  // First, check if user exists in our database
  let user = await prisma.user.findUnique({ 
    where: { id: userId } 
  });
  
  if (user) {
    return user;
  }
  
  // User doesn't exist - fetch from Clerk and create
  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress || '';
    const name = [clerkUser.firstName, clerkUser.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() || 'User';
    const image = clerkUser.imageUrl || '';

    user = await prisma.user.create({
      data: { 
        id: userId, 
        name, 
        email, 
        image 
      },
    });
    
    console.info(`[UserService] Created user: ${userId}`);
    return user;
    
  } catch (error) {
    // Handle race condition where another request created the user
    if (error.code === 'P2002') {
      user = await prisma.user.findUnique({ 
        where: { id: userId } 
      });
      
      if (user) {
        return user;
      }
      
      // If email unique constraint - try to find by email
      const clerkUser = await clerkClient.users.getUser(userId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      
      if (email) {
        user = await prisma.user.findUnique({ 
          where: { email } 
        });
        
        if (user) {
          return user;
        }
      }
    }
    
    console.error('[UserService] Failed to create user:', error);
    throw new DatabaseError('Failed to sync user');
  }
}

/**
 * Get user by email - first checks local DB, then Clerk
 * If user exists in Clerk but not local DB, creates local record
 * @param {string} email - User email
 * @returns {Promise<Object|null>} User object or null if not found anywhere
 */
export async function getUserByEmail(email) {
  const normalizedEmail = email.toLowerCase().trim();
  
  // First check local database
  let user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  
  if (user) {
    return user;
  }
  
  // Not in local DB - try to find in Clerk
  try {
    const clerkUsers = await clerkClient.users.getUserList({
      emailAddress: [normalizedEmail],
    });
    
    if (clerkUsers.data && clerkUsers.data.length > 0) {
      const clerkUser = clerkUsers.data[0];
      
      // User exists in Clerk but not in our DB - create local record
      const name = [clerkUser.firstName, clerkUser.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() || 'User';
      const image = clerkUser.imageUrl || '';
      
      user = await prisma.user.create({
        data: {
          id: clerkUser.id,
          name,
          email: normalizedEmail,
          image,
        },
      });
      
      console.info(`[UserService] Created user from Clerk: ${clerkUser.id}`);
      return user;
    }
  } catch (error) {
    // If Clerk lookup fails, just return null
    console.warn(`[UserService] Clerk lookup failed for user:`, error.message);
  }
  
  // User doesn't exist anywhere
  return null;
}

/**
 * Get user by ID (throws if not found)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User object
 * @throws {NotFoundError} If user not found
 */
export async function getUserById(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  
  if (!user) {
    throw new NotFoundError('User');
  }
  
  return user;
}

/**
 * Get multiple users by IDs
 * @param {string[]} userIds - Array of user IDs
 * @returns {Promise<Object[]>} Array of user objects
 */
export async function getUsersByIds(userIds) {
  return prisma.user.findMany({
    where: { 
      id: { in: userIds } 
    },
  });
}
