import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { insertSessionSchema, insertReviewSchema, insertMessageSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });


  // Subject routes
  app.get('/api/subjects', async (req, res) => {
    try {
      const subjects = await storage.getSubjects();
      res.json(subjects);
    } catch (error) {
      console.error("Error fetching subjects:", error);
      res.status(500).json({ message: "Failed to fetch subjects" });
    }
  });

  // Tutor routes
  app.get('/api/tutors', async (req, res) => {
    try {
      const tutors = await storage.getTutorProfiles();
      res.json(tutors);
    } catch (error) {
      console.error("Error fetching tutors:", error);
      res.status(500).json({ message: "Failed to fetch tutors" });
    }
  });

  app.get('/api/tutors/profile/:userId', isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      const profile = await storage.getTutorProfile(userId);
      if (!profile) {
        return res.status(404).json({ message: "Tutor profile not found" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Error fetching tutor profile:", error);
      res.status(500).json({ message: "Failed to fetch tutor profile" });
    }
  });

  app.post('/api/tutors/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const profileData = { ...req.body, userId };
      const profile = await storage.createTutorProfile(profileData);
      res.json(profile);
    } catch (error) {
      console.error("Error creating tutor profile:", error);
      res.status(500).json({ message: "Failed to create tutor profile" });
    }
  });

  app.put('/api/tutors/profile/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const profile = await storage.updateTutorProfile(id, req.body);
      res.json(profile);
    } catch (error) {
      console.error("Error updating tutor profile:", error);
      res.status(500).json({ message: "Failed to update tutor profile" });
    }
  });

  app.post('/api/tutors/:id/verify', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      await storage.verifyTutor(id);
      res.json({ message: "Tutor verified successfully" });
    } catch (error) {
      console.error("Error verifying tutor:", error);
      res.status(500).json({ message: "Failed to verify tutor" });
    }
  });

  // Session routes
  app.get('/api/sessions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const role = user.role === 'student' ? 'student' : 'tutor';
      const sessions = await storage.getSessions(userId, role);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.post('/api/sessions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const sessionData = insertSessionSchema.parse({ ...req.body, studentId: userId });
      const session = await storage.createSession(sessionData);
      res.json(session);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  app.put('/api/sessions/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const session = await storage.updateSession(id, req.body);
      res.json(session);
    } catch (error) {
      console.error("Error updating session:", error);
      res.status(500).json({ message: "Failed to update session" });
    }
  });

  // Review routes
  app.get('/api/reviews/:tutorId', async (req, res) => {
    try {
      const { tutorId } = req.params;
      const reviews = await storage.getReviews(tutorId);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  app.post('/api/reviews', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const reviewData = insertReviewSchema.parse({ ...req.body, studentId: userId });
      const review = await storage.createReview(reviewData);
      res.json(review);
    } catch (error) {
      console.error("Error creating review:", error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  // Message routes
  app.get('/api/messages/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub;
      const { userId } = req.params;
      const messages = await storage.getMessages(currentUserId, userId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const messageData = insertMessageSchema.parse({ ...req.body, senderId: userId });
      const message = await storage.createMessage(messageData);
      res.json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  app.put('/api/messages/read/:senderId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { senderId } = req.params;
      await storage.markMessagesAsRead(userId, senderId);
      res.json({ message: "Messages marked as read" });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ message: "Failed to mark messages as read" });
    }
  });

  // File upload routes
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req, res) => {
    const userId = (req.user as any)?.claims?.sub;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  });

  app.put("/api/files", isAuthenticated, async (req: any, res) => {
    if (!req.body.fileUrl) {
      return res.status(400).json({ error: "fileUrl is required" });
    }

    const userId = (req.user as any)?.claims?.sub;

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.fileUrl,
        {
          owner: userId,
          visibility: "private",
        },
      );

      const fileData = {
        userId,
        sessionId: req.body.sessionId,
        fileName: req.body.fileName,
        fileUrl: objectPath,
        fileType: req.body.fileType,
        fileSize: req.body.fileSize,
      };

      const file = await storage.createFile(fileData);

      res.status(200).json({
        objectPath: objectPath,
        file: file,
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get('/api/files/:sessionId', isAuthenticated, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const files = await storage.getFiles(sessionId);
      res.json(files);
    } catch (error) {
      console.error("Error fetching files:", error);
      res.status(500).json({ message: "Failed to fetch files" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
