import {
  users,
  subjects,
  tutorProfiles,
  tutorSubjects,
  sessions_table,
  reviews,
  messages,
  fileUploads,
  type User,
  type UpsertUser,
  type Subject,
  type TutorProfile,
  type Session,
  type Review,
  type Message,
  type FileUpload,
  type InsertSubject,
  type InsertTutorProfile,
  type InsertSession,
  type InsertReview,
  type InsertMessage,
  type InsertFileUpload,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, like, gte, lte, or } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (IMPORTANT: mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Subject operations
  getSubjects(): Promise<Subject[]>;
  createSubject(subject: InsertSubject): Promise<Subject>;
  
  // Tutor operations
  getTutorProfile(userId: string): Promise<TutorProfile | undefined>;
  getTutorProfiles(): Promise<Array<TutorProfile & { user: User, subjects: Subject[] }>>;
  createTutorProfile(profile: InsertTutorProfile): Promise<TutorProfile>;
  updateTutorProfile(id: string, profile: Partial<InsertTutorProfile>): Promise<TutorProfile>;
  verifyTutor(tutorId: string): Promise<void>;
  
  // Session operations
  getSessions(userId: string, role: 'student' | 'tutor'): Promise<Array<Session & { student: User, tutor: TutorProfile & { user: User }, subject: Subject }>>;
  getSession(id: string): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: string, session: Partial<InsertSession>): Promise<Session>;
  
  // Review operations
  getReviews(tutorId: string): Promise<Array<Review & { student: User }>>;
  createReview(review: InsertReview): Promise<Review>;
  
  // Message operations
  getMessages(userId1: string, userId2: string): Promise<Array<Message & { sender: User, receiver: User }>>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessagesAsRead(userId: string, senderId: string): Promise<void>;
  
  // File operations
  getFiles(sessionId: string): Promise<FileUpload[]>;
  createFile(file: InsertFileUpload): Promise<FileUpload>;
}

export class DatabaseStorage implements IStorage {
  // User operations (IMPORTANT: mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Subject operations
  async getSubjects(): Promise<Subject[]> {
    return await db.select().from(subjects).orderBy(asc(subjects.name));
  }

  async createSubject(subject: InsertSubject): Promise<Subject> {
    const [newSubject] = await db.insert(subjects).values(subject).returning();
    return newSubject;
  }

  // Tutor operations
  async getTutorProfile(userId: string): Promise<TutorProfile | undefined> {
    const [profile] = await db.select().from(tutorProfiles).where(eq(tutorProfiles.userId, userId));
    return profile;
  }

  async getTutorProfiles(): Promise<Array<TutorProfile & { user: User, subjects: Subject[] }>> {
    const tutors = await db
      .select({
        tutorProfile: tutorProfiles,
        user: users,
      })
      .from(tutorProfiles)
      .innerJoin(users, eq(tutorProfiles.userId, users.id))
      .where(and(eq(tutorProfiles.isVerified, true), eq(tutorProfiles.isActive, true)))
      .orderBy(desc(tutorProfiles.totalRating));

    const tutorsWithSubjects = await Promise.all(
      tutors.map(async (tutor) => {
        const subjectRelations = await db
          .select({ subject: subjects })
          .from(tutorSubjects)
          .innerJoin(subjects, eq(tutorSubjects.subjectId, subjects.id))
          .where(eq(tutorSubjects.tutorId, tutor.tutorProfile.id));

        return {
          ...tutor.tutorProfile,
          user: tutor.user,
          subjects: subjectRelations.map(r => r.subject),
        };
      })
    );

    return tutorsWithSubjects;
  }

  async createTutorProfile(profile: InsertTutorProfile): Promise<TutorProfile> {
    const [newProfile] = await db.insert(tutorProfiles).values(profile).returning();
    return newProfile;
  }

  async updateTutorProfile(id: string, profile: Partial<InsertTutorProfile>): Promise<TutorProfile> {
    const [updatedProfile] = await db
      .update(tutorProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(tutorProfiles.id, id))
      .returning();
    return updatedProfile;
  }

  async verifyTutor(tutorId: string): Promise<void> {
    await db
      .update(tutorProfiles)
      .set({ isVerified: true, updatedAt: new Date() })
      .where(eq(tutorProfiles.id, tutorId));
  }

  // Session operations
  async getSessions(userId: string, role: 'student' | 'tutor'): Promise<Array<Session & { student: User, tutor: TutorProfile & { user: User }, subject: Subject }>> {
    const condition = role === 'student' 
      ? eq(sessions_table.studentId, userId)
      : eq(sessions_table.tutorId, userId);

    const sessions = await db
      .select({
        session: sessions_table,
        student: users,
        tutorProfile: tutorProfiles,
        tutorUser: users,
        subject: subjects,
      })
      .from(sessions_table)
      .innerJoin(users, eq(sessions_table.studentId, users.id))
      .innerJoin(tutorProfiles, eq(sessions_table.tutorId, tutorProfiles.id))
      .innerJoin(subjects, eq(sessions_table.subjectId, subjects.id))
      .where(condition)
      .orderBy(desc(sessions_table.scheduledAt));

    return sessions.map(s => ({
      ...s.session,
      student: s.student,
      tutor: {
        ...s.tutorProfile,
        user: s.tutorUser,
      },
      subject: s.subject,
    }));
  }

  async getSession(id: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions_table).where(eq(sessions_table.id, id));
    return session;
  }

  async createSession(session: InsertSession): Promise<Session> {
    const [newSession] = await db.insert(sessions_table).values(session).returning();
    return newSession;
  }

  async updateSession(id: string, session: Partial<InsertSession>): Promise<Session> {
    const [updatedSession] = await db
      .update(sessions_table)
      .set({ ...session, updatedAt: new Date() })
      .where(eq(sessions_table.id, id))
      .returning();
    return updatedSession;
  }

  // Review operations
  async getReviews(tutorId: string): Promise<Array<Review & { student: User }>> {
    const reviewsWithStudents = await db
      .select({
        review: reviews,
        student: users,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.studentId, users.id))
      .where(eq(reviews.tutorId, tutorId))
      .orderBy(desc(reviews.createdAt));

    return reviewsWithStudents.map(r => ({
      ...r.review,
      student: r.student,
    }));
  }

  async createReview(review: InsertReview): Promise<Review> {
    const [newReview] = await db.insert(reviews).values(review).returning();
    
    // Update tutor's average rating
    const tutorReviews = await db.select().from(reviews).where(eq(reviews.tutorId, review.tutorId));
    const avgRating = tutorReviews.reduce((sum, r) => sum + r.rating, 0) / tutorReviews.length;
    
    await db
      .update(tutorProfiles)
      .set({ 
        totalRating: avgRating.toString(),
        totalReviews: tutorReviews.length,
        updatedAt: new Date()
      })
      .where(eq(tutorProfiles.id, review.tutorId));

    return newReview;
  }

  // Message operations
  async getMessages(userId1: string, userId2: string): Promise<Array<Message & { sender: User, receiver: User }>> {
    const messagesWithUsers = await db
      .select({
        message: messages,
        sender: users,
        receiver: users,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(
        or(
          and(eq(messages.senderId, userId1), eq(messages.receiverId, userId2)),
          and(eq(messages.senderId, userId2), eq(messages.receiverId, userId1))
        )
      )
      .orderBy(asc(messages.createdAt));

    return messagesWithUsers.map(m => ({
      ...m.message,
      sender: m.sender,
      receiver: m.receiver,
    }));
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    return newMessage;
  }

  async markMessagesAsRead(userId: string, senderId: string): Promise<void> {
    await db
      .update(messages)
      .set({ isRead: true })
      .where(and(eq(messages.receiverId, userId), eq(messages.senderId, senderId)));
  }

  // File operations
  async getFiles(sessionId: string): Promise<FileUpload[]> {
    return await db.select().from(fileUploads).where(eq(fileUploads.sessionId, sessionId));
  }

  async createFile(file: InsertFileUpload): Promise<FileUpload> {
    const [newFile] = await db.insert(fileUploads).values(file).returning();
    return newFile;
  }
}

export const storage = new DatabaseStorage();
