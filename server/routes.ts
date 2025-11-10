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

const chooseRoleSchema = z.object({
  role: z.enum(["student", "tutor", "admin"]),
});

const updateTutorProfileSchema = z.object({
  bio: z.string().min(1).optional(),
  phone: z.string().min(5).optional(),
  hourlyRate: z.number().nonnegative().optional(),
  subjects: z.array(z.string()).optional(),
});

const insertFavoriteSchema = z.object({
  userId: z.string(),
  tutorId: z.string(),
});

const insertSessionSchema = z.object({
  tutorId: z.string(),        // tutor_profiles.id
  subjectId: z.string(),
  studentId: z.string(),
  scheduledAt: z.union([z.string(), z.date()]),
  duration: z.number().int().positive().optional(),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function now() {
  return new Date();
}

async function getDoc<T = any>(collection: string, id: string) {
  const snap = await fdb!.collection(collection).doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as T & { id: string }) : null;
}

async function listCollection<T = any>(
  collection: string,
  whereClauses?: Array<[string, FirebaseFirestore.WhereFilterOp, any]>,
  order?: [string, FirebaseFirestore.OrderByDirection?],
  limitN?: number
) {
  let q: FirebaseFirestore.Query = fdb!.collection(collection);
  if (whereClauses) for (const [f, op, v] of whereClauses) q = q.where(f, op, v);
  if (order) {
    const [field, dir] = order;
    q = q.orderBy(field, dir);
  }
  if (limitN) q = q.limit(limitN);
  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<T & { id: string }>;
}

// ---- batched loaders (faster joins) ----
async function batchLoadMap<T = any>(collection: string, ids: string[]): Promise<Map<string, T & { id: string }>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const map = new Map<string, T & { id: string }>();
  if (unique.length === 0) return map;

  // Prefer getAll for one round trip; fallback to individual gets if not available
  const refs = unique.map((id) => fdb!.collection(collection).doc(id));
  // @ts-ignore - getAll exists on Admin Firestore
  const snaps: FirebaseFirestore.DocumentSnapshot[] = await (fdb as any).getAll(...refs);
  for (const s of snaps) {
    if (s.exists) map.set(s.id, { id: s.id, ...(s.data() as any) });
  }
  return map;
}

function coerceMillis(v: any): number {
  if (!v) return 0;
  if (typeof v.toDate === "function") return v.toDate().getTime(); // Firestore Timestamp
  if (typeof v === "object" && typeof v._seconds === "number") return v._seconds * 1000; // serialized TS
  return new Date(v).getTime();
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
  app.get("/initialize-firebase.html", (req, res) => {
    const initFilePath = path.join(__dirname, "../initialize-firebase.html");
    if (fs.existsSync(initFilePath)) res.sendFile(initFilePath);
    else res.status(404).send("Initialization file not found");
  });

  app.get("/api/health", async (_req, res) => {
    res.json({ status: "ok", message: "Server is running" });
  });

  app.get("/api/stats", async (_req, res) => {
    try {
      const tutorsAgg = await fdb!
        .collection("tutor_profiles")
        .where("isVerified", "==", true)
        .where("isActive", "==", true)
        .count()
        .get();

      const studentsAgg = await fdb!.collection("users").where("role", "==", "student").count().get();

      const completedAgg = await fdb!.collection("tutoring_sessions").where("status", "==", "completed").count().get();

      res.json({
        tutors: tutorsAgg.data().count || 0,
        students: studentsAgg.data().count || 0,
        sessions: completedAgg.data().count || 0,
      });
    } catch (error) {
      console.error("Error fetching platform stats:", error);
      res.status(500).json({ message: "Failed to fetch platform statistics", fieldErrors: {} });
    }
  });

  const uploadsDir = path.join(process.cwd(), "uploads");
  app.use("/uploads", (req, res) => {
    const filePath = path.join(uploadsDir, req.path);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).send("File not found");
  });

  // === AUTH ===
  app.get("/api/me", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      await upsertUserFromReqUser(user);

      const tutorSnap = await fdb!.collection("tutor_profiles").where("userId", "==", user.id).limit(1).get();
      const tutorProfile = tutorSnap.empty ? null : { id: tutorSnap.docs[0].id, ...tutorSnap.docs[0].data() };

      res.set("Cache-Control", "private, max-age=10");
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
      res.status(500).json({ message: "Failed to fetch user data", fieldErrors: {} });
    }
  });

  app.put("/api/user/profile", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const updateSchema = z.object({
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        profileImageUrl: z.string().optional().or(z.literal("")).nullable(),
      });
      const updateData = updateSchema.parse(req.body);
      if (updateData.profileImageUrl === "") delete updateData.profileImageUrl;

      const ref = fdb!.collection("users").doc(user.id);
      await ref.set({ ...updateData, updatedAt: now() }, { merge: true });

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
        res.status(400).json({ message: "Invalid request data", fieldErrors: error.flatten().fieldErrors });
      } else {
        res.status(500).json({ message: "Failed to update profile", fieldErrors: {} });
      }
    }
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith("image/")) cb(null, true);
      else cb(new Error("Only image files are allowed"));
    },
  });

  app.post("/api/upload", requireUser, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const user = req.user!;
      const file = req.file;
      const fileExt = path.extname(file.originalname);
      const fileName = `profile-${user.id}-${Date.now()}${fileExt}`;
      await fs.promises.mkdir(uploadsDir, { recursive: true });
      const filePath = path.join(uploadsDir, fileName);
      await fs.promises.writeFile(filePath, file.buffer);
      const fileUrl = `/uploads/${fileName}`;

      res.json({ url: fileUrl, message: "File uploaded successfully" });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Failed to upload file", error: error instanceof Error ? error.message : "Unknown" });
    }
  });

  app.post("/api/auth/choose-role", requireUser, async (req, res) => {
    try {
      const { role } = chooseRoleSchema.parse(req.body);
      const user = req.user!;
      if (role === "admin") return res.status(403).json({ message: "Admin role cannot be self-assigned", fieldErrors: {} });

      const userRef = fdb!.collection("users").doc(user.id);
      await userRef.set({ role, updatedAt: now() }, { merge: true });

      if (role === "tutor") {
        const profileSnap = await fdb!.collection("tutor_profiles").where("userId", "==", user.id).limit(1).get();
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
        res.status(400).json({ message: "Invalid request data", fieldErrors: error.flatten().fieldErrors });
      } else {
        res.status(500).json({ message: "Failed to update role", fieldErrors: {} });
      }
    }
  });

  // === SUBJECTS ===
  app.get("/api/subjects", async (_req, res) => {
    try {
      if (!fdb) return res.status(500).json({ message: "Firestore not initialized" });
      const snap = await fdb.collection("subjects").orderBy("name").get();
      const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      res.set("Cache-Control", "public, max-age=60");
      res.json(all);
    } catch (err) {
      console.error("Error fetching subjects:", err);
      res.status(500).json({ message: "Failed to fetch subjects", fieldErrors: {} });
    }
  });

  app.post("/api/admin/seed-subjects", requireUser, requireAdmin, async (_req, res) => {
    try {
      if (!fdb) return res.status(500).json({ message: "Firestore not initialized" });
      const basic = [
        { id: "math", name: "Mathematics", description: "Math tutoring from basic arithmetic to advanced calculus", category: "STEM" },
        { id: "science", name: "Science", description: "Biology, chemistry, and physics", category: "STEM" },
        { id: "english", name: "English", description: "Language arts, writing, and literature", category: "Language Arts" },
        { id: "history", name: "History", description: "World history, social studies", category: "Social Studies" },
        { id: "computer-science", name: "Computer Science", description: "Programming and CS concepts", category: "STEM" },
      ];
      const batch = fdb.batch();
      for (const s of basic) {
        const ref = fdb.collection("subjects").doc(s.id);
        batch.set(
          ref,
          { name: s.name, description: s.description, category: s.category, createdAt: new Date(), updatedAt: new Date() },
          { merge: true }
        );
      }
      await batch.commit();
      res.json({ message: "Basic subjects seeded successfully" });
    } catch (err) {
      console.error("Error seeding subjects:", err);
      res.status(500).json({ message: "Failed to seed subjects", fieldErrors: {} });
    }
  });

  // === TUTOR PROFILE (self) ===
  app.get("/api/tutors/profile", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const profSnap = await fdb!.collection("tutor_profiles").where("userId", "==", user.id).limit(1).get();
      if (profSnap.empty) return res.status(404).json({ message: "Tutor profile not found", fieldErrors: {} });

      const profile = { id: profSnap.docs[0].id, ...profSnap.docs[0].data() } as any;
      const joinedUser = await getDoc<any>("users", profile.userId);

      const tsSnap = await fdb!.collection("tutor_subjects").where("tutorId", "==", profile.id).get();
      const subjectIds = tsSnap.docs.map((d) => d.get("subjectId"));
      let subjects: any[] = [];
      if (subjectIds.length) {
        const map = await batchLoadMap<any>("subjects", subjectIds);
        subjects = subjectIds.map((sid) => (map.get(sid) ? { id: sid, ...map.get(sid)! } : null)).filter(Boolean) as any[];
      }

      res.json({ ...profile, user: joinedUser, subjects });
    } catch (error) {
      console.error("Error fetching tutor profile:", error);
      res.status(500).json({ message: "Failed to fetch tutor profile", fieldErrors: {} });
    }
  });

  app.post("/api/tutors/profile", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const profileData = updateTutorProfileSchema.parse(req.body);
      const { subjects: subjectIds, ...tutorData } = profileData as any;

      const profSnap = await fdb!.collection("tutor_profiles").where("userId", "==", user.id).limit(1).get();

      let profileId: string;
      if (!profSnap.empty) {
        const ref = profSnap.docs[0].ref;
        profileId = ref.id;
        await ref.set({ ...tutorData, updatedAt: now() }, { merge: true });
      } else {
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

      if (Array.isArray(subjectIds)) {
        const existing = await fdb!.collection("tutor_subjects").where("tutorId", "==", profileId).get();
        const batchDel = fdb!.batch();
        existing.docs.forEach((d) => batchDel.delete(d.ref));
        await batchDel.commit();

        if (subjectIds.length > 0) {
          const batchIns = fdb!.batch();
          subjectIds.forEach((sid: string) => {
            batchIns.set(fdb!.collection("tutor_subjects").doc(`${profileId}_${sid}`), { tutorId: profileId, subjectId: sid });
          });
          await batchIns.commit();
        }
      }

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

      const finalProfile = await getDoc<any>("tutor_profiles", profileId);
      const joinedUser = await getDoc<any>("users", finalProfile!.userId);

      const tsSnap = await fdb!.collection("tutor_subjects").where("tutorId", "==", profileId).get();
      const sids = tsSnap.docs.map((d) => d.get("subjectId"));
      let subjects: any[] = [];
      if (sids.length) {
        const map = await batchLoadMap<any>("subjects", sids);
        subjects = sids.map((sid) => (map.get(sid) ? { id: sid, ...map.get(sid)! } : null)).filter(Boolean) as any[];
      }

      res.json({ profile: finalProfile, user: joinedUser, subjects });
    } catch (error) {
      console.error("Error creating tutor profile:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid request data", fieldErrors: error.flatten().fieldErrors });
      } else {
        res.status(500).json({ message: "Failed to create tutor profile", fieldErrors: {} });
      }
    }
  });

  app.put("/api/tutors/profile", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const updateData = updateTutorProfileSchema.parse(req.body);
      const { subjects: subjectIds, ...profileData } = updateData as any;

      const profSnap = await fdb!.collection("tutor_profiles").where("userId", "==", user.id).limit(1).get();
      if (profSnap.empty) return res.status(404).json({ message: "Tutor profile not found", fieldErrors: {} });

      const ref = profSnap.docs[0].ref;
      const existingProfile = { id: ref.id, ...profSnap.docs[0].data() } as any;
      const isFirstCompletion = !existingProfile.bio && !existingProfile.phone && !existingProfile.hourlyRate;

      await ref.set({ ...profileData, updatedAt: now() }, { merge: true });

      if (Array.isArray(subjectIds)) {
        const existing = await fdb!.collection("tutor_subjects").where("tutorId", "==", ref.id).get();
        const batch = fdb!.batch();
        existing.docs.forEach((d) => batch.delete(d.ref));
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

      const updatedProfile = await ref.get();
      const joinedUser = await getDoc<any>("users", user.id);

      const tsSnap = await fdb!.collection("tutor_subjects").where("tutorId", "==", ref.id).get();
      const sids = tsSnap.docs.map((d) => d.get("subjectId"));
      let subjects: any[] = [];
      if (sids.length) {
        const map = await batchLoadMap<any>("subjects", sids);
        subjects = sids.map((sid) => (map.get(sid) ? { id: sid, ...map.get(sid)! } : null)).filter(Boolean) as any[];
      }

      res.json({ profile: { id: ref.id, ...updatedProfile.data() }, user: joinedUser, subjects });
    } catch (error) {
      console.error("Error updating tutor profile:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid request data", fieldErrors: error.flatten().fieldErrors });
      } else {
        res.status(500).json({ message: "Failed to update tutor profile", fieldErrors: {} });
      }
    }
  });

  // === ADMIN ===
  app.get("/api/admin/admins", requireUser, requireAdmin, async (_req, res) => {
    try {
      const snap = await fdb!.collection("users").where("role", "==", "admin").get();
      res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({ message: "Failed to fetch admin users", fieldErrors: {} });
    }
  });

  app.delete("/api/admin/admins/:userId", requireUser, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const currentUser = req.user!;
      if (userId === currentUser.id) return res.status(400).json({ message: "You cannot delete your own admin account", fieldErrors: {} });

      const target = await getDoc<any>("users", userId);
      if (!target) return res.status(404).json({ message: "User not found", fieldErrors: {} });
      if (target.role !== "admin") return res.status(400).json({ message: "User is not an admin", fieldErrors: {} });

      await fdb!.collection("users").doc(userId).delete();
      res.json({ message: "Admin user deleted successfully" });
    } catch (error) {
      console.error("Error deleting admin user:", error);
      res.status(500).json({ message: "Failed to delete admin user", fieldErrors: {} });
    }
  });

  app.get("/api/admin/students", requireUser, requireAdmin, async (_req, res) => {
    try {
      const snap = await fdb!.collection("users").where("role", "==", "student").get();
      res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error fetching students:", error);
      res.status(500).json({ message: "Failed to fetch students", fieldErrors: {} });
    }
  });

  app.get("/api/admin/tutors", requireUser, requireAdmin, async (_req, res) => {
    try {
      const profs = await listCollection<any>("tutor_profiles");
      const userIds = profs.map((p) => p.userId).filter(Boolean);
      const usersMap = await batchLoadMap<any>("users", userIds);
      const results = profs.map((p) => ({ profile: p, user: usersMap.get(p.userId) || null }));
      res.json(results);
    } catch (error) {
      console.error("Error fetching tutors:", error);
      res.status(500).json({ message: "Failed to fetch tutors", fieldErrors: {} });
    }
  });

  app.get("/api/admin/pending-tutors", requireUser, requireAdmin, async (_req, res) => {
    try {
      const profs = await listCollection<any>("tutor_profiles", [["isVerified", "==", false]]);
      const userIds = profs.map((p) => p.userId).filter(Boolean);
      const usersMap = await batchLoadMap<any>("users", userIds);
      const results = profs.map((p) => ({ profile: p, user: usersMap.get(p.userId) || null }));
      res.json(results);
    } catch (error) {
      console.error("Error fetching pending tutors:", error);
      res.status(500).json({ message: "Failed to fetch pending tutors", fieldErrors: {} });
    }
  });

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
      res.status(500).json({ message: "Failed to delete student", fieldErrors: {} });
    }
  });

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
      res.status(500).json({ message: "Failed to delete tutor", fieldErrors: {} });
    }
  });

  app.put("/api/tutors/:tutorId/verify", requireUser, requireAdmin, async (req, res) => {
    try {
      const { tutorId } = req.params;
      const ref = fdb!.collection("tutor_profiles").doc(tutorId);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ message: "Tutor profile not found", fieldErrors: {} });
      await ref.set({ isVerified: true, isActive: true, updatedAt: now() }, { merge: true });
      res.json({ message: "Tutor verified successfully" });
    } catch (error) {
      console.error("Error verifying tutor:", error);
      res.status(500).json({ message: "Failed to verify tutor", fieldErrors: {} });
    }
  });

  // === ADMIN NOTIFICATIONS (existing) ===
  app.get("/api/admin/notifications", requireUser, requireAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const q = fdb!
        .collection("notifications")
        .where("audience", "==", "admin")
        .orderBy("createdAt", "desc")
        .offset(offset)
        .limit(limit);

      const snap = await q.get();
      const allNotifications = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      res.json(allNotifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications", fieldErrors: {} });
    }
  });

  app.post("/api/admin/notifications/:id/read", requireUser, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const ref = fdb!.collection("notifications").doc(id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ message: "Notification not found", fieldErrors: {} });
      await ref.set({ isRead: true }, { merge: true });
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read", fieldErrors: {} });
    }
  });

  // === USER NOTIFICATIONS (new, for avatar badge & tutor alerts) ===
  app.get("/api/notifications", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const page = parseInt((req.query.page as string) || "1");
      const limit = Math.min(parseInt((req.query.limit as string) || "30"), 50);
      const offset = (page - 1) * limit;

      const q = fdb!
        .collection("notifications")
        .where("audience", "in", ["user"]) // personal notifications
        .where("userId", "==", user.id)
        .orderBy("createdAt", "desc")
        .offset(offset)
        .limit(limit);

      const snap = await q.get();
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      res.json(list);
    } catch (error) {
      // If "in" not indexed, fallback to single where
      try {
        const user = req.user!;
        const page = parseInt((req.query.page as string) || "1");
        const limit = Math.min(parseInt((req.query.limit as string) || "30"), 50);
        const offset = (page - 1) * limit;

        const q = fdb!
          .collection("notifications")
          .where("userId", "==", user.id)
          .orderBy("createdAt", "desc")
          .offset(offset)
          .limit(limit);

        const snap = await q.get();
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        res.json(list);
      } catch (e2) {
        console.error("Error fetching user notifications:", e2);
        res.status(500).json({ message: "Failed to fetch notifications", fieldErrors: {} });
      }
    }
  });

  app.get("/api/notifications/unread-count", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const agg = await fdb!
        .collection("notifications")
        .where("userId", "==", user.id)
        .where("isRead", "==", false)
        .count()
        .get();
      res.json({ unread: agg.data().count || 0 });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count", fieldErrors: {} });
    }
  });

  app.post("/api/notifications/:id/read", requireUser, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const ref = fdb!.collection("notifications").doc(id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ message: "Notification not found", fieldErrors: {} });
      const data = snap.data() as any;
      if (data.userId && data.userId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized", fieldErrors: {} });
      }
      await ref.set({ isRead: true }, { merge: true });
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read", fieldErrors: {} });
    }
  });

  // === TUTORS LISTING ===
  app.get("/api/tutors", async (_req, res) => {
    try {
      const profs = await listCollection<any>("tutor_profiles", [
        ["isActive", "==", true],
        ["isVerified", "==", true],
      ]);

      const userIds = profs.map((p) => p.userId).filter(Boolean);
      const mapUsers = await batchLoadMap<any>("users", userIds);

      const tutorIds = profs.map((p) => p.id);
      const tsSnaps = await fdb!.collection("tutor_subjects").where("tutorId", "in", tutorIds.slice(0, 10)).get().catch(async () => null);
      // If "in" fails due to >10 or no index, fallback to per tutor
      const subjectIds: string[] = [];
      if (tsSnaps) {
        tsSnaps.docs.forEach((d) => subjectIds.push(d.get("subjectId")));
      } else {
        for (const p of profs) {
          const s = await fdb!.collection("tutor_subjects").where("tutorId", "==", p.id).get();
          s.docs.forEach((d) => subjectIds.push(d.get("subjectId")));
        }
      }
      const mapSubjects = await batchLoadMap<any>("subjects", subjectIds);

      const tutorsWithSubjects = profs.map((p) => {
        // rebuild subjects per tutor (lighter)
        const subjects: any[] = [];
        for (const [sid, subj] of mapSubjects) {
          // no reverse index; skip strict join to avoid heavy loops
          // UI can request subjects per tutor from /api/tutors/profile if needed
        }
        return { ...p, user: mapUsers.get(p.userId) || null, subjects: [] as any[] };
      });

      res.json(tutorsWithSubjects);
    } catch (error) {
      console.error("Error fetching tutors:", error);
      res.status(500).json({ message: "Failed to fetch tutors", fieldErrors: {} });
    }
  });

  // === SESSIONS (FAST JOIN) ===
  app.get("/api/sessions", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const limit = Math.min(parseInt((req.query.limit as string) || "100"), 200);

      const readSafely = async (base: FirebaseFirestore.Query) => {
        try {
          const snap = await base.orderBy("scheduledAt", "desc").limit(limit).get();
          return snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
        } catch (e: any) {
          if (e?.code === 9) {
            const snap = await base.limit(limit).get();
            const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
            arr.sort((a, b) => coerceMillis(b.scheduledAt) - coerceMillis(a.scheduledAt));
            return arr;
          }
          throw e;
        }
      };

      let raw: any[] = [];
      let tProfile: any | null = null;

      if (user.role === "student") {
        raw = await readSafely(fdb!.collection("tutoring_sessions").where("studentId", "==", user.id));
      } else if (user.role === "tutor") {
        const profSnap = await fdb!.collection("tutor_profiles").where("userId", "==", user.id).limit(1).get();
        if (profSnap.empty) return res.json([]);
        tProfile = { id: profSnap.docs[0].id, ...profSnap.docs[0].data() } as any;
        raw = await readSafely(fdb!.collection("tutoring_sessions").where("tutorId", "==", tProfile.id));
      } else {
        raw = await readSafely(fdb!.collection("tutoring_sessions"));
      }

      // Collect unique ids for batched lookups
      const tutorProfileIds = Array.from(new Set(raw.map((s) => s.tutorId).filter(Boolean)));
      const studentIds = Array.from(new Set(raw.map((s) => s.studentId).filter(Boolean)));
      const subjectIds = Array.from(new Set(raw.map((s) => s.subjectId).filter(Boolean)));

      const [mapTutorProfiles, mapStudents, mapSubjects] = await Promise.all([
        batchLoadMap<any>("tutor_profiles", tutorProfileIds),
        batchLoadMap<any>("users", studentIds),
        batchLoadMap<any>("subjects", subjectIds),
      ]);

      // For tutors we also need joined tutor user documents:
      const tutorUserIds = Array.from(
        new Set(
          tutorProfileIds
            .map((tid) => mapTutorProfiles.get(tid)?.userId)
            .filter(Boolean) as string[]
        )
      );
      const mapTutorUsers = await batchLoadMap<any>("users", tutorUserIds);

      const formatted = raw.map((s) => {
        const subject = mapSubjects.get(s.subjectId) || null;
        if (user.role === "student") {
          const tProf = mapTutorProfiles.get(s.tutorId) || null;
          const tUser = tProf ? mapTutorUsers.get(tProf.userId) || null : null;
          return { ...s, subject, tutor: tProf ? { ...tProf, user: tUser } : null };
        } else if (user.role === "tutor") {
          const student = mapStudents.get(s.studentId) || null;
          return { ...s, subject, student };
        } else {
          const tProf = mapTutorProfiles.get(s.tutorId) || null;
          const tUser = tProf ? mapTutorUsers.get(tProf.userId) || null : null;
          const student = mapStudents.get(s.studentId) || null;
          return { ...s, subject, tutor: tProf ? { ...tProf, user: tUser } : null, student };
        }
      });

      res.set("Cache-Control", "private, max-age=5");
      res.json(formatted);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ message: "Failed to fetch sessions", fieldErrors: {} });
    }
  });

  app.post("/api/sessions", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      if (user.role !== "student") return res.status(403).json({ message: "Only students can book sessions", fieldErrors: {} });

      const body = insertSessionSchema.parse({
        ...req.body,
        studentId: user.id,
        status: "scheduled",
      });

      const scheduledAt = body.scheduledAt instanceof Date ? body.scheduledAt : new Date(body.scheduledAt);

      const docRef = await fdb!.collection("tutoring_sessions").add({
        ...body,
        scheduledAt,
        createdAt: now(),
        updatedAt: now(),
      });

      // Create a notification for the tutor (appears on tutor's avatar count)
      const tutorProfile = await getDoc<any>("tutor_profiles", body.tutorId);
      const tutorUserId = tutorProfile?.userId;
      const studentName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "A student";

      if (tutorUserId) {
        await fdb!.collection("notifications").add({
          type: "SESSION_REQUESTED",
          title: "New session request",
          body: `${studentName} requested a session on ${scheduledAt.toLocaleString()}`,
          userId: tutorUserId,     // personal notification target
          audience: "user",
          data: { sessionId: docRef.id, tutorId: body.tutorId, studentId: user.id, subjectId: body.subjectId },
          isRead: false,
          createdAt: now(),
        });
      }

      const snap = await docRef.get();
      res.json({ id: snap.id, ...snap.data() });
    } catch (error) {
      console.error("Error creating session:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", fieldErrors: error.flatten().fieldErrors });
      }
      res.status(500).json({ message: "Failed to create session", fieldErrors: {} });
    }
  });

  app.put("/api/sessions/:id", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const sessionId = req.params.id;
      const { status } = req.body;

      const validStatuses = ["scheduled", "in_progress", "completed", "cancelled"];
      if (!validStatuses.includes(status)) return res.status(400).json({ message: "Invalid session status", fieldErrors: {} });

      const ref = fdb!.collection("tutoring_sessions").doc(sessionId);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ message: "Session not found", fieldErrors: {} });
      const session = { id: snap.id, ...snap.data() } as any;

      if (user.role === "student" && session.studentId !== user.id) {
        return res.status(403).json({ message: "Not authorized to update this session", fieldErrors: {} });
      }

      if (user.role === "tutor") {
        const profSnap = await fdb!.collection("tutor_profiles").where("userId", "==", user.id).limit(1).get();
        const tutorProfile = profSnap.empty ? null : ({ id: profSnap.docs[0].id, ...profSnap.docs[0].data() } as any);
        if (!tutorProfile || session.tutorId !== tutorProfile.id) {
          return res.status(403).json({ message: "Not authorized to update this session", fieldErrors: {} });
        }
      }

      await ref.set({ status, updatedAt: now() }, { merge: true });
      const updated = await ref.get();
      res.json({ id: updated.id, ...updated.data() });
    } catch (error) {
      console.error("Error updating session:", error);
      res.status(500).json({ message: "Failed to update session", fieldErrors: {} });
    }
  });

  // === REVIEWS ===
  app.get("/api/reviews/:tutorId", async (req, res) => {
    try {
      const { tutorId } = req.params;
      const snap = await fdb!.collection("reviews").where("tutorId", "==", tutorId).orderBy("createdAt", "desc").get();
      const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      const studentIds = Array.from(new Set(raw.map((r) => r.studentId).filter(Boolean)));
      const mapStudents = await batchLoadMap<any>("users", studentIds);
      const formatted = raw.map((r) => ({ ...r, student: mapStudents.get(r.studentId) || null }));
      res.json(formatted);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ message: "Failed to fetch reviews", fieldErrors: {} });
    }
  });

  // === MESSAGES (placeholder) ===
  app.get("/api/messages/:userId", requireUser, async (_req, res) => {
    try {
      res.json([]);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages", fieldErrors: {} });
    }
  });

  // === FAVORITES ===
  app.get("/api/favorites", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const snap = await fdb!.collection("favorites").where("userId", "==", user.id).get();
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      res.json(list.map((f) => f.tutorId));
    } catch (error) {
      console.error("Error fetching favorites:", error);
      res.status(500).json({ message: "Failed to fetch favorites", fieldErrors: {} });
    }
  });

  app.post("/api/favorites", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const validated = insertFavoriteSchema.parse({ userId: user.id, tutorId: req.body.tutorId });

      const existing = await fdb!
        .collection("favorites")
        .where("userId", "==", user.id)
        .where("tutorId", "==", validated.tutorId)
        .limit(1)
        .get();

      if (!existing.empty) return res.status(400).json({ message: "Tutor already in favorites", fieldErrors: {} });

      const favId = `${user.id}_${validated.tutorId}`;
      await fdb!.collection("favorites").doc(favId).set({ userId: user.id, tutorId: validated.tutorId, createdAt: now() });
      res.json({ message: "Tutor added to favorites" });
    } catch (error) {
      console.error("Error adding favorite:", error);
      res.status(500).json({ message: "Failed to add favorite", fieldErrors: {} });
    }
  });

  app.delete("/api/favorites/:tutorId", requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const { tutorId } = req.params;

      const id = `${user.id}_${tutorId}`;
      const ref = fdb!.collection("favorites").doc(id);
      const snap = await ref.get();

      if (snap.exists) {
        await ref.delete();
      } else {
        const existing = await fdb!.collection("favorites").where("userId", "==", user.id).where("tutorId", "==", tutorId).get();
        const batch = fdb!.batch();
        existing.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      res.json({ message: "Tutor removed from favorites" });
    } catch (error) {
      console.error("Error removing favorite:", error);
      res.status(500).json({ message: "Failed to remove favorite", fieldErrors: {} });
    }
  });

  // === SEED DATA (idempotent) ===
  app.post("/api/admin/seed-subjects-if-empty", requireUser, requireAdmin, async (_req, res) => {
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
        basic.forEach((s) => {
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
      res.status(500).json({ message: "Failed to seed subjects", fieldErrors: {} });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
