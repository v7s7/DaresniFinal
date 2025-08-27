import type { Express } from "express";
import { createServer, type Server } from "http";

export async function registerRoutes(app: Express): Promise<Server> {
  // Note: Using Firebase for authentication, no server-side auth needed
  
  // Simple health check - Firebase handles auth on frontend
  app.get('/api/health', async (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
  });

  // Mock subjects for now - replace with Firebase calls if needed
  app.get('/api/subjects', async (req, res) => {
    const mockSubjects = [
      { id: '1', name: 'Mathematics', description: 'Math tutoring', createdAt: new Date() },
      { id: '2', name: 'Science', description: 'Science tutoring', createdAt: new Date() },
      { id: '3', name: 'English', description: 'English tutoring', createdAt: new Date() },
      { id: '4', name: 'History', description: 'History tutoring', createdAt: new Date() },
      { id: '5', name: 'Computer Science', description: 'Programming and CS', createdAt: new Date() }
    ];
    res.json(mockSubjects);
  });

  // Mock tutors for now - Firebase handles this on frontend
  app.get('/api/tutors', async (req, res) => {
    res.json([]);
  });

  // Mock tutor profile endpoint
  app.get('/api/tutors/profile/:userId', async (req, res) => {
    res.json(null);
  });

  // Mock tutor profile creation
  app.post('/api/tutors/profile', async (req, res) => {
    res.json({ message: 'Profile created successfully' });
  });

  // Mock tutor verification
  app.put('/api/tutors/:tutorId/verify', async (req, res) => {
    res.json({ message: 'Tutor verified successfully' });
  });

  // Mock sessions endpoint
  app.get('/api/sessions', async (req, res) => {
    res.json([]);
  });

  // Mock session creation
  app.post('/api/sessions', async (req, res) => {
    res.json({ message: 'Session created successfully' });
  });

  // Mock session update
  app.put('/api/sessions/:sessionId', async (req, res) => {
    res.json({ message: 'Session updated successfully' });
  });

  // Mock reviews endpoint
  app.get('/api/reviews/:tutorId', async (req, res) => {
    res.json([]);
  });

  // Mock review creation
  app.post('/api/reviews', async (req, res) => {
    res.json({ message: 'Review created successfully' });
  });

  // Mock messages endpoint
  app.get('/api/messages/:userId', async (req, res) => {
    res.json([]);
  });

  // Mock message creation
  app.post('/api/messages', async (req, res) => {
    res.json({ message: 'Message sent successfully' });
  });

  // Mock mark messages as read
  app.post('/api/messages/:userId/mark-read', async (req, res) => {
    res.json({ message: 'Messages marked as read' });
  });

  // Mock files endpoint
  app.get('/api/files/:sessionId', async (req, res) => {
    res.json([]);
  });

  // Mock file upload
  app.post('/api/files', async (req, res) => {
    res.json({ message: 'File uploaded successfully' });
  });

  // Mock object endpoint
  app.get('/objects/:objectPath(*)', async (req, res) => {
    res.status(404).json({ message: 'Object storage not configured' });
  });

  // Mock upload URL endpoint
  app.post('/api/objects/upload', async (req, res) => {
    res.json({ uploadURL: 'mock-upload-url' });
  });

  // Mock banner image endpoint
  app.put('/api/banner-images', async (req, res) => {
    res.json({ objectPath: 'mock-object-path' });
  });

  const httpServer = createServer(app);
  return httpServer;
}