// server/firebase-admin.ts
import { initializeApp, cert, getApps, getApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { Request, Response, NextFunction } from "express";

// -------------------------------------
// Initialize Firebase Admin (once)
// -------------------------------------
let adminApp: App | null = null;

try {
  if (getApps().length) {
    adminApp = getApp();
  } else {
    const projectId = process.env.FIREBASE_PROJECT_ID || "";
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "";
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
      console.warn("Firebase Admin not configured: missing env vars.");
      adminApp = null;
    } else {
      adminApp = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        projectId,
      });
      console.log("Firebase Admin SDK initialized");
    }
  }
} catch (err) {
  console.error("Failed to initialize Firebase Admin SDK:", err);
  adminApp = null;
}

// Export Admin services (nullable if not configured)
export const adminAuth = adminApp ? getAuth(adminApp) : null;
export const fdb = adminApp ? getFirestore(adminApp) : null;

// -------------------------------------
// Types & Express augmentation
// -------------------------------------
export interface AuthUser {
  id: string;
  email: string;
  role: "student" | "tutor" | "admin" | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// -------------------------------------
// Middleware: requireUser (verifies ID token, upserts Firestore user)
// -------------------------------------
export const requireUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!adminAuth || !fdb) {
      return res.status(500).json({
        message: "Firebase Admin SDK not configured",
        fieldErrors: {},
      });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authorization header missing or invalid",
        fieldErrors: {},
      });
    }

    const token = authHeader.slice("Bearer ".length);
    const decoded = await adminAuth.verifyIdToken(token);

    const uid = decoded.uid;
    const email = decoded.email;
    const name = decoded.name || "";

    if (!email) {
      return res.status(401).json({ message: "User email is required", fieldErrors: {} });
    }

    const [firstName, ...rest] = name.trim().split(" ").filter(Boolean);
    const lastName = rest.join(" ") || null;

    // Upsert user document in Firestore
    const userRef = fdb.collection("users").doc(uid);
    const snap = await userRef.get();

    let role: "student" | "tutor" | "admin" | null = null;
    let profileImageUrl: string | null = null;

    if (snap.exists) {
      const existing = snap.data() || {};
      role = (existing.role as any) ?? null;
      profileImageUrl = (existing.profileImageUrl as any) ?? null;

      await userRef.set(
        {
          email,
          firstName: firstName || existing.firstName || null,
          lastName: lastName ?? existing.lastName ?? null,
          updatedAt: new Date(),
        },
        { merge: true }
      );
    } else {
      await userRef.set({
        email,
        firstName: firstName || null,
        lastName,
        role: null, // user will choose later
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Refresh after write to get the latest role if needed
    const latest = (await userRef.get()).data() || {};
    role = (latest.role as any) ?? role ?? null;
    profileImageUrl = (latest.profileImageUrl as any) ?? profileImageUrl ?? null;

    req.user = {
      id: uid,
      email,
      role,
      firstName: (latest.firstName as any) ?? firstName ?? null,
      lastName: (latest.lastName as any) ?? lastName ?? null,
      profileImageUrl,
    };

    next();
  } catch (error) {
    console.error("Firebase token verification failed:", error);
    return res.status(401).json({
      message: "Invalid or expired token",
      fieldErrors: {},
    });
  }
};

// -------------------------------------
// Middleware: requireAdmin
// -------------------------------------
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required", fieldErrors: {} });
  }
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required", fieldErrors: {} });
  }
  next();
};
