// server/routes.ts
import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import multer from "multer";
import { requireUser, requireAdmin, type AuthUser, fdb } from "./firebase-admin";
import { z } from "zod";
import { sendToAdmins, createTutorRegistrationEmail } from "./email";

// ------------------------------
// Local zod schemas (replacing @shared/schema)
// ------------------------------
const chooseRoleSchema = z.object({
  role: z.enum(["student", "tutor", "admin"]),
});

const updateTutorProfileSchema = z.object({
  bio: z.string().min(1).optional(),
  phone: z.string().min(5).optional(),
  hourlyRate: z.number().nonnegative().optional(),
  subjects: z.array(z.string()).optional(), // array of subject IDs
});

const insertFavoriteSchema = z.object({
  userId: z.string(),
  tutorId: z.string(),
});

const insertSessionSchema = z.object({
  tutorId: z.string(),
  subjectId: z.string(),
  studentId: z.string(),
  scheduledAt: z.union([z.string(), z.date()]),
  duration: z.number().int().positive().optional(),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------------------
// Helpers
// ------------------------------
function now() {
  return new Date();
}

async function getDoc<T = any>(collection: string, id: string) {
  const snap = await fdb!.collection(collection).doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as T & { id: string }) : null;
}

async function listCollection<T = any>(collection: string, whereClauses?: Array<[string, FirebaseFirestore.WhereFilterOp, any]>, order?: [string, FirebaseFirestore.OrderByDirection?], limitN?: number) {
  let q: FirebaseFirestore.Query = fdb!.collection(collection);
  if (whereClauses) {
    for (const [f, op, v] of whereClauses) q = q.where(f, op, v);
  }
  if (order) {
    const [field, dir] = order;
    q = q.orderBy(field, dir);
  }
  if (limitN) q = q.limit(limitN);
  const snap = await q.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Array<T & { id: string }>;
}

async function upsertUserFromReqUser(user: AuthUser) {
  const ref = fdb!.collection("users").doc(user.id);
  await ref.set(
    {
      email: user.email,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      profileImageUrl: user.profileImageUrl ?? null,
      role: user.role ?? null,
      updatedAt: now(),
    },
    { merge: true }
  );
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve the Firebase initialization page
  app.get("/initialize-firebase.html", (req, res) => {
    const initFilePath = path.join(__dirname, "../initialize-firebase.html");
    if (fs.existsSync(initFilePath)) {
      res.sendFile(initFilePath);
    } else {
      res.status(404).send("Initialization file not found");
    }
  });

  // Health check
  app.get("/api/health", async (req, res) => {
    res.json({ status: "ok", message: "Server is running" });
  });

  // Platform statistics (public - for landing page)
  app.get("/api/stats", async (req, res) => {
    try {
      // Firestore aggregate counts
      const tutorsAgg = await fdb!.collection("tutor_profiles")
        .where("isVerified", "==", true)
        .where("isActive", "==", true)
        .count()
        .get();

      const studentsAgg = await fdb!.collection("users")
        .where("role", "==", "student")
        .count()
        .get();

      const completedAgg = await fdb!.collection("tutoring_sessions")
        .where("status", "==", "completed")
        .count()
        .get();

      res.json({
        tutors: tutorsAgg.data().count || 0,
        students: studentsAgg.data().count || 0,
        sessions: completedAgg.data().count || 0,
      });
    } catch (error) {
      console.error("Error fetching platform stats:", error);
      res.status(500).json({
        message: "Failed to fetch platform statistics",
        fieldErrors: {},
      });
    }
  });

  // Serve uploaded files (local disk)
  const uploadsDir = path.join(process.cwd(), "uploads");
  app.use("/uploads", (req, res) => {
    const filePath = path.join(uploadsDir, req.path);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).send("File not found");
    }
  });

  // === AUTH ROUTES ===

  // Get current user info
  app.get("/api/me", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      await upsertUserFromReqUser(user);

      // Check if user has tutor profile
      const tutorSnap = await fdb!
        .collection("tutor_profiles")
        .where("userId", "==", user.id)
        .limit(1)
        .get();
      const tutorProfile = tutorSnap.empty ? null : { id: tutorSnap.docs[0].id, ...tutorSnap.docs[0].data() };

      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName ?? null,
          lastName: user.lastName ?? null,
          profileImageUrl: user.profileImageUrl ?? null,
          role: user.role ?? null,
        },
        hasTutorProfile: !!tutorProfile,
        tutorProfile: tutorProfile || undefined,
      });
    } catch (error) {
      console.error("Error fetching user data:", error);
      res.status(500).json({
        message: "Failed to fetch user data",
        fieldErrors: {},
      });
    }
  });

  // Update user profile
  app.put("/api/user/profile", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const updateSchema = z.object({
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        profileImageUrl: z.string().optional().or(z.literal("")).nullable(),
      });

      const updateData = updateSchema.parse(req.body);

      // Remove empty profileImageUrl if present
      if (updateData.profileImageUrl === "") {
        delete updateData.profileImageUrl;
      }

      const ref = fdb!.collection("users").doc(user.id);
      await ref.set(
        {
          ...updateData,
          updatedAt: now(),
        },
        { merge: true }
      );

      const snap = await ref.get();
      const updatedUser = { id: snap.id, ...snap.data() } as any;

      res.json({
        message: "Profile updated successfully",
        user: {
          id: updatedUser.id,
          email: updatedUser.email ?? user.email,
          firstName: updatedUser.firstName ?? null,
          lastName: updatedUser.lastName ?? null,
          profileImageUrl: updatedUser.profileImageUrl ?? null,
          role: updatedUser.role ?? null,
        },
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          message: "Invalid request data",
          fieldErrors: error.flatten().fieldErrors,
        });
      } else {
        res.status(500).json({
          message: "Failed to update profile",
          fieldErrors: {},
        });
      }
    }
  });

  // Configure multer for file uploads (to local disk)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("Only image files are allowed"));
      }
    },
  });

  // Upload profile picture (local disk)
  app.post("/api/upload", requireUser, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const user = req.user!;
      const file = req.file;

      // Generate unique filename
      const fileExt = path.extname(file.originalname);
      const fileName = `profile-${user.id}-${Date.now()}${fileExt}`;

      // Ensure directory exists
      await fs.promises.mkdir(uploadsDir, { recursive: true });

      // Save file to uploads directory
      const filePath = path.join(uploadsDir, fileName);
      await fs.promises.writeFile(filePath, file.buffer);

      // Generate URL for the uploaded file
      const fileUrl = `/uploads/${fileName}`;

      res.json({
        url: fileUrl,
        message: "File uploaded successfully",
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({
        message: "Failed to upload file",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Choose user role (student/tutor)
  app.post("/api/auth/choose-role", requireUser, async (req, res) => {
    try {
      const { role } = chooseRoleSchema.parse(req.body);
      const user = req.user!;

      // Prevent users from choosing admin role
      if (role === "admin") {
        return res.status(403).json({
          message: "Admin role cannot be self-assigned",
          fieldErrors: {},
        });
      }

      // Update user role
      const userRef = fdb!.collection("users").doc(user.id);
      await userRef.set({ role, updatedAt: now() }, { merge: true });

      // If choosing tutor role and no profile exists, create minimal profile
      if (role === "tutor") {
        const profileSnap = await fdb!
          .collection("tutor_profiles")
          .where("userId", "==", user.id)
          .limit(1)
          .get();

        if (profileSnap.empty) {
          await fdb!.collection("tutor_profiles").add({
            userId: user.id,
            isVerified: false,
            isActive: false,
            createdAt: now(),
            updatedAt: now(),
          });
        }
      }

      res.json({ ok: true, role });
    } catch (error) {
      console.error("Error choosing role:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          message: "Invalid request data",
          fieldErrors: error.flatten().fieldErrors,
        });
      } else {
        res.status(500).json({
          message: "Failed to update role",
          fieldErrors: {},
        });
      }
    }
  });

  // === SUBJECTS ROUTES ===

// === SUBJECTS (FIRESTORE) ===

// List all subjects (public)
app.get("/api/subjects", async (_req, res) => {
  try {
    if (!fdb) return res.status(500).json({ message: "Firestore not initialized" });

    const snap = await fdb.collection("subjects").orderBy("name").get();
    const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    res.json(all);
  } catch (err) {
    console.error("Error fetching subjects:", err);
    res.status(500).json({ message: "Failed to fetch subjects", fieldErrors: {} });
  }
});

// Seed basic subjects (admin only)
app.post("/api/admin/seed-subjects", requireUser, requireAdmin, async (_req, res) => {
  try {
    if (!fdb) return res.status(500).json({ message: "Firestore not initialized" });

    const basic = [
      { id: "math", name: "Mathematics", description: "Math tutoring from basic arithmetic to advanced calculus", category: "STEM" },
      { id: "science", name: "Science", description: "Biology, chemistry, and physics", category: "STEM" },
      { id: "english", name: "English", description: "Language arts, writing, and literature", category: "Language Arts" },
      { id: "history", name: "History", description: "World history, social studies", category: "Social Studies" },
      { id: "computer-science", name: "Computer Science", description: "Programming and CS concepts", category: "STEM" }
    ];

    const batch = fdb.batch();
    for (const s of basic) {
      const ref = fdb.collection("subjects").doc(s.id);
      batch.set(ref, {
        name: s.name,
        description: s.description,
        category: s.category,
        createdAt: new Date(),
        updatedAt: new Date()
      }, { merge: true });
    }
    await batch.commit();

    res.json({ message: "Basic subjects seeded successfully" });
  } catch (err) {
    console.error("Error seeding subjects:", err);
    res.status(500).json({ message: "Failed to seed subjects", fieldErrors: {} });
  }
});

  // === TUTOR PROFILE ROUTES (SELF) ===

  // Get own tutor profile
  app.get("/api/tutors/profile", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const profSnap = await fdb!
        .collection("tutor_profiles")
        .where("userId", "==", user.id)
        .limit(1)
        .get();

      if (profSnap.empty) {
        return res.status(404).json({
          message: "Tutor profile not found",
          fieldErrors: {},
        });
      }

      const profile = { id: profSnap.docs[0].id, ...profSnap.docs[0].data() } as any;

      // Load joined user
      const joinedUser = await getDoc<any>("users", profile.userId);

      // Load tutor subjects
      const tsSnap = await fdb!
        .collection("tutor_subjects")
        .where("tutorId", "==", profile.id)
        .get();

      const subjectIds = tsSnap.docs.map(d => d.get("subjectId"));
      let subjects: any[] = [];

      if (subjectIds.length) {
        const promises = subjectIds.map((sid: string) => fdb!.collection("subjects").doc(sid).get());
        const subjectDocs = await Promise.all(promises);
        subjects = subjectDocs.filter(s => s.exists).map(s => ({ id: s.id, ...s.data() }));
      }

      const response = {
        ...profile,
        user: joinedUser,
        subjects,
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching tutor profile:", error);
      res.status(500).json({
        message: "Failed to fetch tutor profile",
        fieldErrors: {},
      });
    }
  });

  // Create tutor profile (first time) OR update if exists
  app.post("/api/tutors/profile", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const profileData = updateTutorProfileSchema.parse(req.body);
      const { subjects: subjectIds, ...tutorData } = profileData as any;

      // Check if profile already exists
      const profSnap = await fdb!
        .collection("tutor_profiles")
        .where("userId", "==", user.id)
        .limit(1)
        .get();

      let profileId: string;
      if (!profSnap.empty) {
        // Update existing profile
        const ref = profSnap.docs[0].ref;
        profileId = ref.id;
        await ref.set(
          { ...tutorData, updatedAt: now() },
          { merge: true }
        );
      } else {
        // Create new
        const added = await fdb!.collection("tutor_profiles").add({
          userId: user.id,
          isVerified: false,
          isActive: false,
          createdAt: now(),
          updatedAt: now(),
          ...tutorData,
        });
        profileId = added.id;
      }

      // Update subjects mapping (via collection 'tutor_subjects')
      if (Array.isArray(subjectIds)) {
        // delete existing
        const existing = await fdb!
          .collection("tutor_subjects")
          .where("tutorId", "==", profileId)
          .get();
        const batch = fdb!.batch();
        existing.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();

        // add new
        if (subjectIds.length > 0) {
          const batch2 = fdb!.batch();
          subjectIds.forEach((sid: string) => {
            const ref = fdb!.collection("tutor_subjects").doc(`${profileId}_${sid}`);
            batch2.set(ref, { tutorId: profileId, subjectId: sid });
          });
          await batch2.commit();
        }
      }

      // Notification + email
      const tutorName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown";

      await fdb!.collection("notifications").add({
        type: "TUTOR_REGISTERED",
        title: "New tutor registered",
        body: `${tutorName} (${user.email})`,
        data: { userId: user.id },
        audience: "admin",
        isRead: false,
        createdAt: now(),
      });

      try {
        const emailContent = createTutorRegistrationEmail(tutorName, user.email);
        await sendToAdmins(emailContent.subject, emailContent.html, emailContent.text);
      } catch (emailError) {
        console.error("Failed to send admin notification email:", emailError);
      }

      // Return created/updated profile with user
      const finalProfile = await getDoc<any>("tutor_profiles", profileId);
      const joinedUser = await getDoc<any>("users", finalProfile!.userId);

      // Attach subjects
      const tsSnap = await fdb!
        .collection("tutor_subjects")
        .where("tutorId", "==", profileId)
        .get();
      const sids = tsSnap.docs.map(d => d.get("subjectId"));
      let subjects: any[] = [];
      if (sids.length) {
        const docs = await Promise.all(sids.map((sid: string) => fdb!.collection("subjects").doc(sid).get()));
        subjects = docs.filter(d => d.exists).map(d => ({ id: d.id, ...d.data() }));
      }

      res.json({
        profile: finalProfile,
        user: joinedUser,
        subjects,
      });
    } catch (error) {
      console.error("Error creating tutor profile:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          message: "Invalid request data",
          fieldErrors: error.flatten().fieldErrors,
        });
      } else {
        res.status(500).json({
          message: "Failed to create tutor profile",
          fieldErrors: {},
        });
      }
    }
  });

  // Update own tutor profile
  app.put("/api/tutors/profile", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const updateData = updateTutorProfileSchema.parse(req.body);
      const { subjects: subjectIds, ...profileData } = updateData as any;

      // Find profile
      const profSnap = await fdb!
        .collection("tutor_profiles")
        .where("userId", "==", user.id)
        .limit(1)
        .get();

      if (profSnap.empty) {
        return res.status(404).json({
          message: "Tutor profile not found",
          fieldErrors: {},
        });
      }

      const ref = profSnap.docs[0].ref;
      const existingProfile = { id: ref.id, ...profSnap.docs[0].data() } as any;

      const isFirstCompletion =
        !existingProfile.bio && !existingProfile.phone && !existingProfile.hourlyRate;

      // Update profile
      await ref.set({ ...profileData, updatedAt: now() }, { merge: true });

      // Update subjects if provided
      if (Array.isArray(subjectIds)) {
        const existing = await fdb!
          .collection("tutor_subjects")
          .where("tutorId", "==", ref.id)
          .get();
        const batch = fdb!.batch();
        existing.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();

        if (subjectIds.length > 0) {
          const batch2 = fdb!.batch();
          subjectIds.forEach((sid: string) => {
            const dref = fdb!.collection("tutor_subjects").doc(`${ref.id}_${sid}`);
            batch2.set(dref, { tutorId: ref.id, subjectId: sid });
          });
          await batch2.commit();
        }
      }

      // First completion notification
      if (isFirstCompletion && (profileData.bio || profileData.phone || profileData.hourlyRate)) {
        const tutorName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown";
        await fdb!.collection("notifications").add({
          type: "TUTOR_REGISTERED",
          title: "New tutor registered",
          body: `${tutorName} (${user.email})`,
          data: { userId: user.id },
          audience: "admin",
          isRead: false,
          createdAt: now(),
        });

        try {
          const emailContent = createTutorRegistrationEmail(tutorName, user.email);
          await sendToAdmins(emailContent.subject, emailContent.html, emailContent.text);
        } catch (emailError) {
          console.error("Failed to send admin notification email:", emailError);
        }
      }

      // Return updated profile
      const updatedProfile = await ref.get();
      const joinedUser = await getDoc<any>("users", user.id);

      const tsSnap = await fdb!
        .collection("tutor_subjects")
        .where("tutorId", "==", ref.id)
        .get();
      const sids = tsSnap.docs.map(d => d.get("subjectId"));
      let subjects: any[] = [];
      if (sids.length) {
        const docs = await Promise.all(sids.map((sid: string) => fdb!.collection("subjects").doc(sid).get()));
        subjects = docs.filter(d => d.exists).map(d => ({ id: d.id, ...d.data() }));
      }

      res.json({
        profile: { id: ref.id, ...updatedProfile.data() },
        user: joinedUser,
        subjects,
      });
    } catch (error) {
      console.error("Error updating tutor profile:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          message: "Invalid request data",
          fieldErrors: error.flatten().fieldErrors,
        });
      } else {
        res.status(500).json({
          message: "Failed to update tutor profile",
          fieldErrors: {},
        });
      }
    }
  });

  // === ADMIN ROUTES ===

  // Get all admin users
  app.get("/api/admin/admins", requireUser, requireAdmin, async (req, res) => {
    try {
      const snap = await fdb!.collection("users").where("role", "==", "admin").get();
      const adminUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json(adminUsers);
    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({
        message: "Failed to fetch admin users",
        fieldErrors: {},
      });
    }
  });

  // Delete admin user
  app.delete("/api/admin/admins/:userId", requireUser, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const currentUser = req.user!;

      if (userId === currentUser.id) {
        return res.status(400).json({
          message: "You cannot delete your own admin account",
          fieldErrors: {},
        });
      }

      const target = await getDoc<any>("users", userId);
      if (!target) {
        return res.status(404).json({ message: "User not found", fieldErrors: {} });
      }
      if (target.role !== "admin") {
        return res.status(400).json({ message: "User is not an admin", fieldErrors: {} });
      }

      await fdb!.collection("users").doc(userId).delete();
      res.json({ message: "Admin user deleted successfully" });
    } catch (error) {
      console.error("Error deleting admin user:", error);
      res.status(500).json({
        message: "Failed to delete admin user",
        fieldErrors: {},
      });
    }
  });

  // Get all students
  app.get("/api/admin/students", requireUser, requireAdmin, async (req, res) => {
    try {
      const snap = await fdb!.collection("users").where("role", "==", "student").get();
      const students = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json(students);
    } catch (error) {
      console.error("Error fetching students:", error);
      res.status(500).json({
        message: "Failed to fetch students",
        fieldErrors: {},
      });
    }
  });

  // Get all tutors (both verified and pending)
  app.get("/api/admin/tutors", requireUser, requireAdmin, async (req, res) => {
    try {
      const profs = await listCollection<any>("tutor_profiles");
      const results = await Promise.all(
        profs.map(async (p) => ({
          profile: p,
          user: await getDoc<any>("users", p.userId),
        }))
      );
      res.json(results);
    } catch (error) {
      console.error("Error fetching tutors:", error);
      res.status(500).json({
        message: "Failed to fetch tutors",
        fieldErrors: {},
      });
    }
  });

  // Get pending tutors for verification
  app.get("/api/admin/pending-tutors", requireUser, requireAdmin, async (req, res) => {
    try {
      const profs = await listCollection<any>("tutor_profiles", [["isVerified", "==", false]]);
      const results = await Promise.all(
        profs.map(async (p) => ({
          profile: p,
          user: await getDoc<any>("users", p.userId),
        }))
      );
      res.json(results);
    } catch (error) {
      console.error("Error fetching pending tutors:", error);
      res.status(500).json({
        message: "Failed to fetch pending tutors",
        fieldErrors: {},
      });
    }
  });

  // Delete student
  app.delete("/api/admin/students/:userId", requireUser, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const target = await getDoc<any>("users", userId);
      if (!target) return res.status(404).json({ message: "User not found", fieldErrors: {} });
      if (target.role !== "student") return res.status(400).json({ message: "User is not a student", fieldErrors: {} });
      await fdb!.collection("users").doc(userId).delete();
      res.json({ message: "Student deleted successfully" });
    } catch (error) {
      console.error("Error deleting student:", error);
      res.status(500).json({
        message: "Failed to delete student",
        fieldErrors: {},
      });
    }
  });

  // Delete tutor
  app.delete("/api/admin/tutors/:userId", requireUser, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const target = await getDoc<any>("users", userId);
      if (!target) return res.status(404).json({ message: "User not found", fieldErrors: {} });
      if (target.role !== "tutor") return res.status(400).json({ message: "User is not a tutor", fieldErrors: {} });
      await fdb!.collection("users").doc(userId).delete();
      res.json({ message: "Tutor deleted successfully" });
    } catch (error) {
      console.error("Error deleting tutor:", error);
      res.status(500).json({
        message: "Failed to delete tutor",
        fieldErrors: {},
      });
    }
  });

  // Verify tutor
  app.put("/api/tutors/:tutorId/verify", requireUser, requireAdmin, async (req, res) => {
    try {
      const { tutorId } = req.params;
      const ref = fdb!.collection("tutor_profiles").doc(tutorId);
      const snap = await ref.get();
      if (!snap.exists) {
        return res.status(404).json({ message: "Tutor profile not found", fieldErrors: {} });
      }
      await ref.set({ isVerified: true, isActive: true, updatedAt: now() }, { merge: true });
      res.json({ message: "Tutor verified successfully" });
    } catch (error) {
      console.error("Error verifying tutor:", error);
      res.status(500).json({
        message: "Failed to verify tutor",
        fieldErrors: {},
      });
    }
  });

  // Get admin notifications (simple page/limit using offset)
  app.get("/api/admin/notifications", requireUser, requireAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      let q = fdb!.collection("notifications")
        .where("audience", "==", "admin")
        .orderBy("createdAt", "desc")
        .offset(offset)
        .limit(limit);

      const snap = await q.get();
      const allNotifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json(allNotifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({
        message: "Failed to fetch notifications",
        fieldErrors: {},
      });
    }
  });

  // Mark notification as read
  app.post("/api/admin/notifications/:id/read", requireUser, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const ref = fdb!.collection("notifications").doc(id);
      const snap = await ref.get();
      if (!snap.exists) {
        return res.status(404).json({ message: "Notification not found", fieldErrors: {} });
      }
      await ref.set({ isRead: true }, { merge: true });
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({
        message: "Failed to mark notification as read",
        fieldErrors: {},
      });
    }
  });

  // === TUTORS LISTING ===

  app.get("/api/tutors", async (req, res) => {
    try {
      const profs = await listCollection<any>(
        "tutor_profiles",
        [
          ["isActive", "==", true],
          ["isVerified", "==", true],
        ]
      );

      const tutorsWithSubjects = await Promise.all(
        profs.map(async (p) => {
          const user = await getDoc<any>("users", p.userId);

          // subjects
          const tsSnap = await fdb!
            .collection("tutor_subjects")
            .where("tutorId", "==", p.id)
            .get();
          const sids = tsSnap.docs.map(d => d.get("subjectId"));
          let subjects: any[] = [];
          if (sids.length) {
            const docs = await Promise.all(sids.map((sid: string) => fdb!.collection("subjects").doc(sid).get()));
            subjects = docs.filter(d => d.exists).map(d => ({ id: d.id, ...d.data() }));
          }

          return {
            ...p,
            user,
            subjects,
          };
        })
      );

      res.json(tutorsWithSubjects);
    } catch (error) {
      console.error("Error fetching tutors:", error);
      res.status(500).json({
        message: "Failed to fetch tutors",
        fieldErrors: {},
      });
    }
  });

  // === SESSIONS ===

  app.get("/api/sessions", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      let sessionsData: any[] = [];

      if (user.role === "student") {
        // sessions where user is the student
        const snap = await fdb!
          .collection("tutoring_sessions")
          .where("studentId", "==", user.id)
          .orderBy("scheduledAt", "desc")
          .get();

        const raw = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        sessionsData = await Promise.all(
          raw.map(async (s) => {
            const tutorProfile = await getDoc<any>("tutor_profiles", s.tutorId);
            const tutorUser = tutorProfile ? await getDoc<any>("users", tutorProfile.userId) : null;
            const subject = await getDoc<any>("subjects", s.subjectId);
            return {
              session: s,
              tutor: tutorProfile,
              tutorUser,
              subject,
            };
          })
        );
      } else if (user.role === "tutor") {
        // find tutor profile
        const profSnap = await fdb!
          .collection("tutor_profiles")
          .where("userId", "==", user.id)
          .limit(1)
          .get();
        if (profSnap.empty) {
          return res.json([]);
        }
        const tProfile = { id: profSnap.docs[0].id, ...profSnap.docs[0].data() } as any;

        // sessions where user is the tutor
        const snap = await fdb!
          .collection("tutoring_sessions")
          .where("tutorId", "==", tProfile.id)
          .orderBy("scheduledAt", "desc")
          .get();

        const raw = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        sessionsData = await Promise.all(
          raw.map(async (s) => {
            const student = await getDoc<any>("users", s.studentId);
            const subject = await getDoc<any>("subjects", s.subjectId);
            return { session: s, student, subject };
          })
        );
      } else {
        // admin: see all sessions
        const snap = await fdb!
          .collection("tutoring_sessions")
          .orderBy("scheduledAt", "desc")
          .get();

        const raw = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        sessionsData = await Promise.all(
          raw.map(async (s) => {
            const tutorProfile = await getDoc<any>("tutor_profiles", s.tutorId);
            const tutorUser = tutorProfile ? await getDoc<any>("users", tutorProfile.userId) : null;
            const student = await getDoc<any>("users", s.studentId);
            const subject = await getDoc<any>("subjects", s.subjectId);
            return {
              session: s,
              tutor: tutorProfile,
              tutorUser,
              student,
              subject,
            };
          })
        );
      }

      // Format response by role
      const formatted = sessionsData.map((data: any) => {
        if (user.role === "student") {
          return {
            ...data.session,
            tutor: { ...data.tutor, user: data.tutorUser },
            subject: data.subject,
          };
        } else if (user.role === "tutor") {
          return {
            ...data.session,
            student: data.student,
            subject: data.subject,
          };
        } else {
          return {
            ...data.session,
            tutor: { ...data.tutor, user: data.tutorUser },
            student: data.student,
            subject: data.subject,
          };
        }
      });

      res.json(formatted);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({
        message: "Failed to fetch sessions",
        fieldErrors: {},
      });
    }
  });

  // Create a new session (booking)
  app.post("/api/sessions", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      if (user.role !== "student") {
        return res.status(403).json({
          message: "Only students can book sessions",
          fieldErrors: {},
        });
      }

      const body = insertSessionSchema.parse({
        ...req.body,
        studentId: user.id,
        status: "scheduled",
      });

      const doc = await fdb!.collection("tutoring_sessions").add({
        ...body,
        // normalize scheduledAt to Date
        scheduledAt: body.scheduledAt instanceof Date ? body.scheduledAt : new Date(body.scheduledAt),
        createdAt: now(),
        updatedAt: now(),
      });

      const snap = await doc.get();
      res.json({ id: snap.id, ...snap.data() });
    } catch (error) {
      console.error("Error creating session:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          fieldErrors: error.flatten().fieldErrors,
        });
      }
      res.status(500).json({
        message: "Failed to create session",
        fieldErrors: {},
      });
    }
  });

  // Update session status
  app.put("/api/sessions/:id", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const sessionId = req.params.id;
      const { status } = req.body;

      const validStatuses = ["scheduled", "in_progress", "completed", "cancelled"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          message: "Invalid session status",
          fieldErrors: {},
        });
      }

      const ref = fdb!.collection("tutoring_sessions").doc(sessionId);
      const snap = await ref.get();
      if (!snap.exists) {
        return res.status(404).json({
          message: "Session not found",
          fieldErrors: {},
        });
      }
      const session = { id: snap.id, ...snap.data() } as any;

      // Authorization
      if (user.role === "student" && session.studentId !== user.id) {
        return res.status(403).json({
          message: "Not authorized to update this session",
          fieldErrors: {},
        });
      }

      if (user.role === "tutor") {
        const profSnap = await fdb!
          .collection("tutor_profiles")
          .where("userId", "==", user.id)
          .limit(1)
          .get();
        const tutorProfile = profSnap.empty ? null : { id: profSnap.docs[0].id, ...profSnap.docs[0].data() } as any;
        if (!tutorProfile || session.tutorId !== tutorProfile.id) {
          return res.status(403).json({
            message: "Not authorized to update this session",
            fieldErrors: {},
          });
        }
      }

      await ref.set({ status, updatedAt: now() }, { merge: true });

      const updated = await ref.get();
      res.json({ id: updated.id, ...updated.data() });
    } catch (error) {
      console.error("Error updating session:", error);
      res.status(500).json({
        message: "Failed to update session",
        fieldErrors: {},
      });
    }
  });

  // === REVIEWS ===

  app.get("/api/reviews/:tutorId", async (req, res) => {
    try {
      const { tutorId } = req.params;
      const snap = await fdb!
        .collection("reviews")
        .where("tutorId", "==", tutorId)
        .orderBy("createdAt", "desc")
        .get();

      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const formatted = await Promise.all(
        raw.map(async (r) => {
          const student = await getDoc<any>("users", r.studentId);
          return { ...r, student };
        })
      );

      res.json(formatted);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({
        message: "Failed to fetch reviews",
        fieldErrors: {},
      });
    }
  });

  // === MESSAGES ===

  app.get("/api/messages/:userId", requireUser, async (req, res) => {
    try {
      // Placeholder - not implemented yet
      res.json([]);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({
        message: "Failed to fetch messages",
        fieldErrors: {},
      });
    }
  });

  // === FAVORITES ===

  // Get user's favorite tutors
  app.get("/api/favorites", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const snap = await fdb!
        .collection("favorites")
        .where("userId", "==", user.id)
        .get();

      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      res.json(list.map(f => f.tutorId));
    } catch (error) {
      console.error("Error fetching favorites:", error);
      res.status(500).json({
        message: "Failed to fetch favorites",
        fieldErrors: {},
      });
    }
  });

  // Add tutor to favorites
  app.post("/api/favorites", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const validated = insertFavoriteSchema.parse({
        userId: user.id,
        tutorId: req.body.tutorId,
      });

      const existing = await fdb!
        .collection("favorites")
        .where("userId", "==", user.id)
        .where("tutorId", "==", validated.tutorId)
        .limit(1)
        .get();

      if (!existing.empty) {
        return res.status(400).json({
          message: "Tutor already in favorites",
          fieldErrors: {},
        });
      }

      const favId = `${user.id}_${validated.tutorId}`;
      await fdb!.collection("favorites").doc(favId).set({
        userId: user.id,
        tutorId: validated.tutorId,
        createdAt: now(),
      });

      res.json({ message: "Tutor added to favorites" });
    } catch (error) {
      console.error("Error adding favorite:", error);
      res.status(500).json({
        message: "Failed to add favorite",
        fieldErrors: {},
      });
    }
  });

  // Remove tutor from favorites
  app.delete("/api/favorites/:tutorId", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const { tutorId } = req.params;

      // Try by deterministic id
      const id = `${user.id}_${tutorId}`;
      const ref = fdb!.collection("favorites").doc(id);
      const snap = await ref.get();

      if (snap.exists) {
        await ref.delete();
      } else {
        // fallback: query and delete
        const existing = await fdb!
          .collection("favorites")
          .where("userId", "==", user.id)
          .where("tutorId", "==", tutorId)
          .get();
        const batch = fdb!.batch();
        existing.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      res.json({ message: "Tutor removed from favorites" });
    } catch (error) {
      console.error("Error removing favorite:", error);
      res.status(500).json({
        message: "Failed to remove favorite",
        fieldErrors: {},
      });
    }
  });

  // === SEED DATA ===

  // Initialize basic subjects if empty
  app.post("/api/admin/seed-subjects", requireUser, requireAdmin, async (req, res) => {
    try {
      const existing = await fdb!.collection("subjects").limit(1).get();

      if (existing.empty) {
        const basic = [
          { id: "math", name: "Mathematics", description: "Math tutoring from basic arithmetic to advanced calculus", category: "STEM" },
          { id: "science", name: "Science", description: "Science tutoring including biology, chemistry, and physics", category: "STEM" },
          { id: "english", name: "English", description: "English language arts, writing, and literature", category: "Language Arts" },
          { id: "history", name: "History", description: "World history, US history, and social studies", category: "Social Studies" },
          { id: "computer-science", name: "Computer Science", description: "Programming, algorithms, and computer science concepts", category: "STEM" },
        ];

        const batch = fdb!.batch();
        basic.forEach(s => {
          const ref = fdb!.collection("subjects").doc(s.id);
          batch.set(ref, { name: s.name, description: s.description, category: s.category, createdAt: now() });
        });
        await batch.commit();

        res.json({ message: "Basic subjects seeded successfully" });
      } else {
        res.json({ message: "Subjects already exist" });
      }
    } catch (error) {
      console.error("Error seeding subjects:", error);
      res.status(500).json({
        message: "Failed to seed subjects",
        fieldErrors: {},
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
