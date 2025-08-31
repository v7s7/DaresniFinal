import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { requireUser, requireAdmin, type AuthUser } from "./firebase-admin";
import { db } from "./db";
import { 
  users, 
  subjects, 
  tutorProfiles, 
  tutorSubjects, 
  notifications,
  sessions_table,
  reviews,
  messages,
  chooseRoleSchema,
  updateTutorProfileSchema,
  insertNotificationSchema
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { sendToAdmins, createTutorRegistrationEmail } from "./email";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  app.get('/api/health', async (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
  });

  // === AUTH ROUTES ===
  
  // Get current user info
  app.get('/api/me', requireUser, async (req, res) => {
    try {
      const user = req.user!;
      
      // Check if user has tutor profile
      const [tutorProfile] = await db
        .select()
        .from(tutorProfiles)
        .where(eq(tutorProfiles.userId, user.id))
        .limit(1);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        hasTutorProfile: !!tutorProfile,
        tutorProfile: tutorProfile || undefined,
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
      res.status(500).json({ 
        message: 'Failed to fetch user data', 
        fieldErrors: {} 
      });
    }
  });

  // Choose user role (student/tutor)
  app.post('/api/auth/choose-role', requireUser, async (req, res) => {
    try {
      const { role } = chooseRoleSchema.parse(req.body);
      const user = req.user!;

      // Update user role
      await db
        .update(users)
        .set({ 
          role: role as 'student' | 'tutor',
          updatedAt: new Date() 
        })
        .where(eq(users.id, user.id));

      // If choosing tutor role and no profile exists, create minimal profile
      if (role === 'tutor') {
        const [existingProfile] = await db
          .select()
          .from(tutorProfiles)
          .where(eq(tutorProfiles.userId, user.id))
          .limit(1);

        if (!existingProfile) {
          await db
            .insert(tutorProfiles)
            .values({
              userId: user.id,
            });
        }
      }

      res.json({ ok: true, role });
    } catch (error) {
      console.error('Error choosing role:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          message: 'Invalid request data', 
          fieldErrors: error.flatten().fieldErrors 
        });
      } else {
        res.status(500).json({ 
          message: 'Failed to update role', 
          fieldErrors: {} 
        });
      }
    }
  });

  // === SUBJECTS ROUTES ===
  
  app.get('/api/subjects', async (req, res) => {
    try {
      const allSubjects = await db
        .select()
        .from(subjects)
        .orderBy(subjects.name);

      res.json(allSubjects);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      res.status(500).json({ 
        message: 'Failed to fetch subjects', 
        fieldErrors: {} 
      });
    }
  });

  // === TUTOR PROFILE ROUTES (SELF) ===
  
  // Get own tutor profile
  app.get('/api/tutors/profile', requireUser, async (req, res) => {
    try {
      const user = req.user!;

      const [profile] = await db
        .select({
          profile: tutorProfiles,
          user: users
        })
        .from(tutorProfiles)
        .leftJoin(users, eq(tutorProfiles.userId, users.id))
        .where(eq(tutorProfiles.userId, user.id))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ 
          message: 'Tutor profile not found', 
          fieldErrors: {} 
        });
      }

      // Get tutor subjects
      const profileSubjects = await db
        .select({
          tutorSubject: tutorSubjects,
          subject: subjects
        })
        .from(tutorSubjects)
        .leftJoin(subjects, eq(tutorSubjects.subjectId, subjects.id))
        .where(eq(tutorSubjects.tutorId, profile.profile.id));

      const response = {
        ...profile.profile,
        user: profile.user,
        subjects: profileSubjects
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching tutor profile:', error);
      res.status(500).json({ 
        message: 'Failed to fetch tutor profile', 
        fieldErrors: {} 
      });
    }
  });

  // Update own tutor profile
  app.put('/api/tutors/profile', requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const updateData = updateTutorProfileSchema.parse(req.body);
      const { subjects: subjectIds, ...profileData } = updateData as any;

      // Check if profile exists
      const [existingProfile] = await db
        .select()
        .from(tutorProfiles)
        .where(eq(tutorProfiles.userId, user.id))
        .limit(1);

      if (!existingProfile) {
        return res.status(404).json({ 
          message: 'Tutor profile not found', 
          fieldErrors: {} 
        });
      }

      const isFirstCompletion = !existingProfile.bio && !existingProfile.phone && !existingProfile.hourlyRate;

      // Update tutor profile
      const [updatedProfile] = await db
        .update(tutorProfiles)
        .set({
          ...profileData,
          updatedAt: new Date()
        })
        .where(eq(tutorProfiles.id, existingProfile.id))
        .returning();

      // Update subjects if provided
      if (subjectIds && Array.isArray(subjectIds)) {
        // Remove existing subjects
        await db
          .delete(tutorSubjects)
          .where(eq(tutorSubjects.tutorId, existingProfile.id));

        // Add new subjects
        if (subjectIds.length > 0) {
          await db
            .insert(tutorSubjects)
            .values(
              subjectIds.map((subjectId: string) => ({
                tutorId: existingProfile.id,
                subjectId,
              }))
            );
        }
      }

      // If this is the first completion, create notification and send email
      if (isFirstCompletion && (profileData.bio || profileData.phone || profileData.hourlyRate)) {
        const tutorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown';
        
        // Create notification
        await db
          .insert(notifications)
          .values({
            type: 'TUTOR_REGISTERED',
            title: 'New tutor registered',
            body: `${tutorName} (${user.email})`,
            data: { userId: user.id },
            audience: 'admin',
          });

        // Send email to admins
        try {
          const emailContent = createTutorRegistrationEmail(tutorName, user.email);
          await sendToAdmins(emailContent.subject, emailContent.html, emailContent.text);
        } catch (emailError) {
          console.error('Failed to send admin notification email:', emailError);
          // Don't fail the request if email fails
        }
      }

      // Return updated profile
      const response = await db
        .select({
          profile: tutorProfiles,
          user: users
        })
        .from(tutorProfiles)
        .leftJoin(users, eq(tutorProfiles.userId, users.id))
        .where(eq(tutorProfiles.id, existingProfile.id))
        .limit(1);

      res.json(response[0]);
    } catch (error) {
      console.error('Error updating tutor profile:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          message: 'Invalid request data', 
          fieldErrors: error.flatten().fieldErrors 
        });
      } else {
        res.status(500).json({ 
          message: 'Failed to update tutor profile', 
          fieldErrors: {} 
        });
      }
    }
  });

  // === ADMIN ROUTES ===
  
  // Get pending tutors for verification
  app.get('/api/admin/pending-tutors', requireUser, requireAdmin, async (req, res) => {
    try {
      const pendingTutors = await db
        .select({
          profile: tutorProfiles,
          user: users
        })
        .from(tutorProfiles)
        .leftJoin(users, eq(tutorProfiles.userId, users.id))
        .where(eq(tutorProfiles.isVerified, false));

      res.json(pendingTutors);
    } catch (error) {
      console.error('Error fetching pending tutors:', error);
      res.status(500).json({ 
        message: 'Failed to fetch pending tutors', 
        fieldErrors: {} 
      });
    }
  });
  
  // Verify tutor
  app.put('/api/tutors/:tutorId/verify', requireUser, requireAdmin, async (req, res) => {
    try {
      const { tutorId } = req.params;

      const [updatedProfile] = await db
        .update(tutorProfiles)
        .set({ 
          isVerified: true,
          updatedAt: new Date()
        })
        .where(eq(tutorProfiles.id, tutorId))
        .returning();

      if (!updatedProfile) {
        return res.status(404).json({ 
          message: 'Tutor profile not found', 
          fieldErrors: {} 
        });
      }

      res.json({ message: 'Tutor verified successfully' });
    } catch (error) {
      console.error('Error verifying tutor:', error);
      res.status(500).json({ 
        message: 'Failed to verify tutor', 
        fieldErrors: {} 
      });
    }
  });

  // Get admin notifications
  app.get('/api/admin/notifications', requireUser, requireAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const allNotifications = await db
        .select()
        .from(notifications)
        .where(eq(notifications.audience, 'admin'))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);

      res.json(allNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ 
        message: 'Failed to fetch notifications', 
        fieldErrors: {} 
      });
    }
  });

  // Mark notification as read
  app.post('/api/admin/notifications/:id/read', requireUser, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const [updatedNotification] = await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, id))
        .returning();

      if (!updatedNotification) {
        return res.status(404).json({ 
          message: 'Notification not found', 
          fieldErrors: {} 
        });
      }

      res.json({ message: 'Notification marked as read' });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ 
        message: 'Failed to mark notification as read', 
        fieldErrors: {} 
      });
    }
  });

  // === TUTORS LISTING ===
  
  app.get('/api/tutors', async (req, res) => {
    try {
      const tutors = await db
        .select({
          profile: tutorProfiles,
          user: users
        })
        .from(tutorProfiles)
        .leftJoin(users, eq(tutorProfiles.userId, users.id))
        .where(and(
          eq(tutorProfiles.isActive, true),
          eq(tutorProfiles.isVerified, true)
        ));

      res.json(tutors);
    } catch (error) {
      console.error('Error fetching tutors:', error);
      res.status(500).json({ 
        message: 'Failed to fetch tutors', 
        fieldErrors: {} 
      });
    }
  });

  // === SESSIONS ===
  
  app.get('/api/sessions', requireUser, async (req, res) => {
    try {
      // For now, return empty array - sessions will be implemented later
      res.json([]);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      res.status(500).json({ 
        message: 'Failed to fetch sessions', 
        fieldErrors: {} 
      });
    }
  });

  // === REVIEWS ===
  
  app.get('/api/reviews/:tutorId', async (req, res) => {
    try {
      // For now, return empty array - reviews will be implemented later
      res.json([]);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      res.status(500).json({ 
        message: 'Failed to fetch reviews', 
        fieldErrors: {} 
      });
    }
  });

  // === MESSAGES ===
  
  app.get('/api/messages/:userId', requireUser, async (req, res) => {
    try {
      // For now, return empty array - messages will be implemented later
      res.json([]);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ 
        message: 'Failed to fetch messages', 
        fieldErrors: {} 
      });
    }
  });

  // === SEED DATA ===
  
  // Initialize basic subjects if empty
  app.post('/api/admin/seed-subjects', requireUser, requireAdmin, async (req, res) => {
    try {
      const existingSubjects = await db.select().from(subjects).limit(1);
      
      if (existingSubjects.length === 0) {
        const basicSubjects = [
          { id: 'math', name: 'Mathematics', description: 'Math tutoring from basic arithmetic to advanced calculus', category: 'STEM' },
          { id: 'science', name: 'Science', description: 'Science tutoring including biology, chemistry, and physics', category: 'STEM' },
          { id: 'english', name: 'English', description: 'English language arts, writing, and literature', category: 'Language Arts' },
          { id: 'history', name: 'History', description: 'World history, US history, and social studies', category: 'Social Studies' },
          { id: 'computer-science', name: 'Computer Science', description: 'Programming, algorithms, and computer science concepts', category: 'STEM' },
        ];

        await db.insert(subjects).values(basicSubjects);
        res.json({ message: 'Basic subjects seeded successfully' });
      } else {
        res.json({ message: 'Subjects already exist' });
      }
    } catch (error) {
      console.error('Error seeding subjects:', error);
      res.status(500).json({ 
        message: 'Failed to seed subjects', 
        fieldErrors: {} 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}