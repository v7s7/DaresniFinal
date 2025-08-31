import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Initialize Firebase Admin SDK
let adminApp;

try {
  if (getApps().length === 0) {
    // Check if we have the required environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      console.warn('Firebase Admin SDK not configured - missing environment variables');
      console.warn('Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
      adminApp = null;
    } else {
      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
        projectId,
      });
      console.log('Firebase Admin SDK initialized successfully');
    }
  } else {
    adminApp = getApps()[0];
  }
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', error);
  adminApp = null;
}

export const adminAuth = adminApp ? getAuth(adminApp) : null;

// User type for request
export interface AuthUser {
  id: string;
  email: string;
  role: 'student' | 'tutor' | 'admin';
  firstName?: string | null;
  lastName?: string | null;
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Middleware to verify Firebase token and upsert user
export const requireUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!adminAuth) {
      return res.status(500).json({ 
        message: 'Firebase Admin SDK not configured', 
        fieldErrors: {} 
      });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        message: 'Authorization header missing or invalid', 
        fieldErrors: {} 
      });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the Firebase ID token
    const decodedToken = await adminAuth.verifyIdToken(token);
    const { uid, email, name } = decodedToken;

    if (!email) {
      return res.status(401).json({ 
        message: 'User email is required', 
        fieldErrors: {} 
      });
    }

    // Parse name into first and last name
    const nameParts = name ? name.split(' ') : [];
    const firstName = nameParts[0] || null;
    const lastName = nameParts.slice(1).join(' ') || null;

    // Upsert user in database
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);

    let user;
    if (existingUser) {
      // Update existing user
      [user] = await db
        .update(users)
        .set({
          email,
          firstName: firstName || existingUser.firstName,
          lastName: lastName || existingUser.lastName,
          updatedAt: new Date(),
        })
        .where(eq(users.id, uid))
        .returning();
    } else {
      // Create new user
      [user] = await db
        .insert(users)
        .values({
          id: uid,
          email,
          firstName,
          lastName,
          role: null, // No default role - user must choose
        })
        .returning();
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email!,
      role: user.role! as 'student' | 'tutor' | 'admin',
      firstName: user.firstName,
      lastName: user.lastName,
    };

    next();
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    return res.status(401).json({ 
      message: 'Invalid or expired token', 
      fieldErrors: {} 
    });
  }
};

// Middleware to require admin role
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ 
      message: 'Authentication required', 
      fieldErrors: {} 
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      message: 'Admin access required', 
      fieldErrors: {} 
    });
  }

  next();
};