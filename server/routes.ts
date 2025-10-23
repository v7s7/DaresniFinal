import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import multer from "multer";
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
  favorites,
  chooseRoleSchema,
  updateTutorProfileSchema,
  insertNotificationSchema,
  insertFavoriteSchema
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

  // Serve uploaded files
  const uploadsDir = path.join(process.cwd(), 'uploads');
  app.use('/uploads', (req, res, next) => {
    const filePath = path.join(uploadsDir, req.path);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).send('File not found');
    }
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
          profileImageUrl: user.profileImageUrl,
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

  // Update user profile
  app.put('/api/user/profile', requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const updateSchema = z.object({
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        profileImageUrl: z.string().url().optional().or(z.literal("")).nullable(),
      });

      const updateData = updateSchema.parse(req.body);
      
      // Remove empty profileImageUrl if present
      if (updateData.profileImageUrl === "") {
        delete updateData.profileImageUrl;
      }

      // Update user profile
      const [updatedUser] = await db
        .update(users)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id))
        .returning();

      res.json({ 
        message: 'Profile updated successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          profileImageUrl: updatedUser.profileImageUrl,
          role: updatedUser.role,
        }
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          message: 'Invalid request data', 
          fieldErrors: error.flatten().fieldErrors 
        });
      } else {
        res.status(500).json({ 
          message: 'Failed to update profile', 
          fieldErrors: {} 
        });
      }
    }
  });

  // Configure multer for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    },
  });

  // Upload profile picture
  app.post('/api/upload', requireUser, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const user = req.user!;
      const file = req.file;
      
      // Generate unique filename
      const fileExt = path.extname(file.originalname);
      const fileName = `profile-${user.id}-${Date.now()}${fileExt}`;
      
      // Use local uploads directory
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const filePath = path.join(uploadsDir, fileName);

      // Ensure directory exists
      await fs.promises.mkdir(uploadsDir, { recursive: true });

      // Save file to uploads directory
      await fs.promises.writeFile(filePath, file.buffer);

      // Generate URL for the uploaded file
      const fileUrl = `/uploads/${fileName}`;

      res.json({ 
        url: fileUrl,
        message: 'File uploaded successfully' 
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ 
        message: 'Failed to upload file',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Choose user role (student/tutor)
  app.post('/api/auth/choose-role', requireUser, async (req, res) => {
    try {
      const { role } = chooseRoleSchema.parse(req.body);
      const user = req.user!;

      // Prevent users from choosing admin role (admin role can only be set directly in database)
      if (role === 'admin') {
        return res.status(403).json({ 
          message: 'Admin role cannot be self-assigned', 
          fieldErrors: {} 
        });
      }

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

  // Create tutor profile (first time)
  app.post('/api/tutors/profile', requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const profileData = updateTutorProfileSchema.parse(req.body);
      const { subjects: subjectIds, ...tutorData } = profileData as any;

      // Check if profile already exists
      const [existingProfile] = await db
        .select()
        .from(tutorProfiles)
        .where(eq(tutorProfiles.userId, user.id))
        .limit(1);

      let profile;
      if (existingProfile) {
        // Update existing profile if it exists
        [profile] = await db
          .update(tutorProfiles)
          .set({
            ...tutorData,
            updatedAt: new Date()
          })
          .where(eq(tutorProfiles.id, existingProfile.id))
          .returning();
      } else {
        // Create new profile
        [profile] = await db
          .insert(tutorProfiles)
          .values({
            userId: user.id,
            ...tutorData
          })
          .returning();
      }

      // Handle subjects
      if (subjectIds && Array.isArray(subjectIds)) {
        // Remove existing subjects
        await db
          .delete(tutorSubjects)
          .where(eq(tutorSubjects.tutorId, profile.id));

        // Add new subjects
        if (subjectIds.length > 0) {
          await db
            .insert(tutorSubjects)
            .values(
              subjectIds.map((subjectId: string) => ({
                tutorId: profile.id,
                subjectId,
              }))
            );
        }
      }

      // Create notification and send email for new tutor registration
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

      // Return created profile with user data
      const response = await db
        .select({
          profile: tutorProfiles,
          user: users
        })
        .from(tutorProfiles)
        .leftJoin(users, eq(tutorProfiles.userId, users.id))
        .where(eq(tutorProfiles.id, profile.id))
        .limit(1);

      res.json(response[0]);
    } catch (error) {
      console.error('Error creating tutor profile:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          message: 'Invalid request data', 
          fieldErrors: error.flatten().fieldErrors 
        });
      } else {
        res.status(500).json({ 
          message: 'Failed to create tutor profile', 
          fieldErrors: {} 
        });
      }
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
  
  // Get all admin users
  app.get('/api/admin/admins', requireUser, requireAdmin, async (req, res) => {
    try {
      const adminUsers = await db
        .select()
        .from(users)
        .where(eq(users.role, 'admin'))
        .orderBy(users.createdAt);

      res.json(adminUsers);
    } catch (error) {
      console.error('Error fetching admin users:', error);
      res.status(500).json({ 
        message: 'Failed to fetch admin users', 
        fieldErrors: {} 
      });
    }
  });

  // Delete admin user
  app.delete('/api/admin/admins/:userId', requireUser, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const currentUser = req.user!;

      // Prevent admin from deleting themselves
      if (userId === currentUser.id) {
        return res.status(400).json({ 
          message: 'You cannot delete your own admin account', 
          fieldErrors: {} 
        });
      }

      // Check if user is admin
      const [userToDelete] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!userToDelete) {
        return res.status(404).json({ 
          message: 'User not found', 
          fieldErrors: {} 
        });
      }

      if (userToDelete.role !== 'admin') {
        return res.status(400).json({ 
          message: 'User is not an admin', 
          fieldErrors: {} 
        });
      }

      // Delete the user (cascade will handle related data)
      await db
        .delete(users)
        .where(eq(users.id, userId));

      res.json({ message: 'Admin user deleted successfully' });
    } catch (error) {
      console.error('Error deleting admin user:', error);
      res.status(500).json({ 
        message: 'Failed to delete admin user', 
        fieldErrors: {} 
      });
    }
  });
  
  // Get all students
  app.get('/api/admin/students', requireUser, requireAdmin, async (req, res) => {
    try {
      const students = await db
        .select()
        .from(users)
        .where(eq(users.role, 'student'))
        .orderBy(users.createdAt);

      res.json(students);
    } catch (error) {
      console.error('Error fetching students:', error);
      res.status(500).json({ 
        message: 'Failed to fetch students', 
        fieldErrors: {} 
      });
    }
  });

  // Get all tutors (both verified and pending)
  app.get('/api/admin/tutors', requireUser, requireAdmin, async (req, res) => {
    try {
      const allTutors = await db
        .select({
          profile: tutorProfiles,
          user: users
        })
        .from(tutorProfiles)
        .leftJoin(users, eq(tutorProfiles.userId, users.id))
        .orderBy(tutorProfiles.createdAt);

      res.json(allTutors);
    } catch (error) {
      console.error('Error fetching tutors:', error);
      res.status(500).json({ 
        message: 'Failed to fetch tutors', 
        fieldErrors: {} 
      });
    }
  });

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

  // Delete student
  app.delete('/api/admin/students/:userId', requireUser, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;

      const [userToDelete] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!userToDelete) {
        return res.status(404).json({ 
          message: 'User not found', 
          fieldErrors: {} 
        });
      }

      if (userToDelete.role !== 'student') {
        return res.status(400).json({ 
          message: 'User is not a student', 
          fieldErrors: {} 
        });
      }

      await db
        .delete(users)
        .where(eq(users.id, userId));

      res.json({ message: 'Student deleted successfully' });
    } catch (error) {
      console.error('Error deleting student:', error);
      res.status(500).json({ 
        message: 'Failed to delete student', 
        fieldErrors: {} 
      });
    }
  });

  // Delete tutor
  app.delete('/api/admin/tutors/:userId', requireUser, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;

      const [userToDelete] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!userToDelete) {
        return res.status(404).json({ 
          message: 'User not found', 
          fieldErrors: {} 
        });
      }

      if (userToDelete.role !== 'tutor') {
        return res.status(400).json({ 
          message: 'User is not a tutor', 
          fieldErrors: {} 
        });
      }

      await db
        .delete(users)
        .where(eq(users.id, userId));

      res.json({ message: 'Tutor deleted successfully' });
    } catch (error) {
      console.error('Error deleting tutor:', error);
      res.status(500).json({ 
        message: 'Failed to delete tutor', 
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

      // Get subjects for each tutor
      const tutorsWithSubjects = await Promise.all(
        tutors.map(async (tutorData) => {
          const tutorSubjectsData = await db
            .select({
              tutorSubject: tutorSubjects,
              subject: subjects
            })
            .from(tutorSubjects)
            .leftJoin(subjects, eq(tutorSubjects.subjectId, subjects.id))
            .where(eq(tutorSubjects.tutorId, tutorData.profile.id));

          return {
            ...tutorData.profile,
            user: tutorData.user,
            subjects: tutorSubjectsData.map(ts => ts.subject).filter(s => s !== null)
          };
        })
      );

      res.json(tutorsWithSubjects);
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
      const user = req.user!;
      let sessionsData;

      if (user.role === 'student') {
        // Fetch sessions where user is the student
        sessionsData = await db
          .select({
            session: sessions_table,
            tutor: tutorProfiles,
            tutorUser: users,
            subject: subjects
          })
          .from(sessions_table)
          .leftJoin(tutorProfiles, eq(sessions_table.tutorId, tutorProfiles.id))
          .leftJoin(users, eq(tutorProfiles.userId, users.id))
          .leftJoin(subjects, eq(sessions_table.subjectId, subjects.id))
          .where(eq(sessions_table.studentId, user.id))
          .orderBy(desc(sessions_table.scheduledAt));
      } else if (user.role === 'tutor') {
        // Find tutor profile first
        const [tutorProfile] = await db
          .select()
          .from(tutorProfiles)
          .where(eq(tutorProfiles.userId, user.id))
          .limit(1);

        if (!tutorProfile) {
          return res.json([]);
        }

        // Fetch sessions where user is the tutor
        sessionsData = await db
          .select({
            session: sessions_table,
            student: users,
            subject: subjects
          })
          .from(sessions_table)
          .leftJoin(users, eq(sessions_table.studentId, users.id))
          .leftJoin(subjects, eq(sessions_table.subjectId, subjects.id))
          .where(eq(sessions_table.tutorId, tutorProfile.id))
          .orderBy(desc(sessions_table.scheduledAt));
      } else {
        // Admins see all sessions - need to fetch tutor and student separately
        const allSessions = await db
          .select({
            session: sessions_table,
            tutor: tutorProfiles,
            subject: subjects
          })
          .from(sessions_table)
          .leftJoin(tutorProfiles, eq(sessions_table.tutorId, tutorProfiles.id))
          .leftJoin(subjects, eq(sessions_table.subjectId, subjects.id))
          .orderBy(desc(sessions_table.scheduledAt));

        // Fetch tutor users and students separately
        sessionsData = await Promise.all(
          allSessions.map(async (item) => {
            const [tutorUser] = item.tutor 
              ? await db.select().from(users).where(eq(users.id, item.tutor.userId)).limit(1)
              : [null];
            
            const [student] = await db
              .select()
              .from(users)
              .where(eq(users.id, item.session.studentId))
              .limit(1);

            return {
              session: item.session,
              tutor: item.tutor,
              tutorUser,
              student,
              subject: item.subject
            };
          })
        );
      }

      // Format the response based on user role
      const formattedSessions = sessionsData.map((data: any) => {
        if (user.role === 'student') {
          return {
            ...data.session,
            tutor: {
              ...data.tutor,
              user: data.tutorUser
            },
            subject: data.subject
          };
        } else if (user.role === 'tutor') {
          return {
            ...data.session,
            student: data.student,
            subject: data.subject
          };
        } else {
          return {
            ...data.session,
            tutor: {
              ...data.tutor,
              user: data.tutorUser
            },
            student: data.student,
            subject: data.subject
          };
        }
      });

      res.json(formattedSessions);
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

  // === FAVORITES ===
  
  // Get user's favorite tutors
  app.get('/api/favorites', requireUser, async (req, res) => {
    try {
      const user = req.user!;
      
      const userFavorites = await db
        .select()
        .from(favorites)
        .where(eq(favorites.userId, user.id));
      
      res.json(userFavorites.map(f => f.tutorId));
    } catch (error) {
      console.error('Error fetching favorites:', error);
      res.status(500).json({ 
        message: 'Failed to fetch favorites', 
        fieldErrors: {} 
      });
    }
  });

  // Add tutor to favorites
  app.post('/api/favorites', requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const validatedData = insertFavoriteSchema.parse({
        userId: user.id,
        tutorId: req.body.tutorId,
      });

      // Check if already favorited
      const existing = await db
        .select()
        .from(favorites)
        .where(
          and(
            eq(favorites.userId, user.id),
            eq(favorites.tutorId, validatedData.tutorId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return res.status(400).json({ 
          message: 'Tutor already in favorites',
          fieldErrors: {} 
        });
      }

      await db.insert(favorites).values(validatedData);
      res.json({ message: 'Tutor added to favorites' });
    } catch (error) {
      console.error('Error adding favorite:', error);
      res.status(500).json({ 
        message: 'Failed to add favorite', 
        fieldErrors: {} 
      });
    }
  });

  // Remove tutor from favorites
  app.delete('/api/favorites/:tutorId', requireUser, async (req, res) => {
    try {
      const user = req.user!;
      const { tutorId } = req.params;

      await db
        .delete(favorites)
        .where(
          and(
            eq(favorites.userId, user.id),
            eq(favorites.tutorId, tutorId)
          )
        );

      res.json({ message: 'Tutor removed from favorites' });
    } catch (error) {
      console.error('Error removing favorite:', error);
      res.status(500).json({ 
        message: 'Failed to remove favorite', 
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