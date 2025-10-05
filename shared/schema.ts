import { sql } from 'drizzle-orm';
import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User roles
export const userRoleEnum = pgEnum('user_role', ['student', 'tutor', 'admin']);

// User storage table - keeping existing structure but updated for Firebase UID
export const users = pgTable("users", {
  id: varchar("id").primaryKey(), // Firebase UID - keeping varchar type
  email: varchar("email").unique().notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: userRoleEnum("role").default('student'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Subjects table
export const subjects = pgTable("subjects", {
  id: varchar("id").primaryKey(), // Use string IDs like 'math', 'science'
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  category: varchar("category", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tutor profiles
export const tutorProfiles = pgTable("tutor_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  bio: text("bio"),
  phone: varchar("phone"),
  hourlyRate: integer("hourly_rate"), // Store as integer cents
  experience: text("experience"),
  education: text("education"),
  certifications: text("certifications").array(),
  availability: jsonb("availability"), // Store weekly schedule
  isVerified: boolean("is_verified").default(false),
  isActive: boolean("is_active").default(true),
  totalRating: decimal("total_rating", { precision: 3, scale: 2 }).default('0'),
  totalReviews: integer("total_reviews").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tutor subjects junction table
export const tutorSubjects = pgTable("tutor_subjects", {
  tutorId: varchar("tutor_id").notNull().references(() => tutorProfiles.id, { onDelete: 'cascade' }),
  subjectId: varchar("subject_id").notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  proficiencyLevel: varchar("proficiency_level", { length: 20 }), // beginner, intermediate, advanced, expert
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  pk: sql`PRIMARY KEY (${table.tutorId}, ${table.subjectId})`
}));

// Session status enum
export const sessionStatusEnum = pgEnum('session_status', ['scheduled', 'in_progress', 'completed', 'cancelled']);

// Tutoring sessions
export const sessions_table = pgTable("tutoring_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  tutorId: varchar("tutor_id").notNull().references(() => tutorProfiles.id, { onDelete: 'cascade' }),
  subjectId: varchar("subject_id").notNull().references(() => subjects.id),
  scheduledAt: timestamp("scheduled_at").notNull(),
  duration: integer("duration").default(60), // minutes
  status: sessionStatusEnum("status").default('scheduled'),
  meetingLink: varchar("meeting_link"),
  notes: text("notes"),
  price: decimal("price", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reviews and ratings
export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => sessions_table.id, { onDelete: 'cascade' }),
  studentId: varchar("student_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  tutorId: varchar("tutor_id").notNull().references(() => tutorProfiles.id, { onDelete: 'cascade' }),
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Messages for chat
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  receiverId: varchar("receiver_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notification types and audiences
export const notificationTypeEnum = pgEnum('notification_type', ['TUTOR_REGISTERED', 'MISC']);
export const notificationAudienceEnum = pgEnum('notification_audience', ['admin', 'user']);

// Notifications table
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  data: jsonb("data"),
  isRead: boolean("is_read").default(false),
  audience: notificationAudienceEnum("audience").default('admin'),
  createdAt: timestamp("created_at").defaultNow(),
});

// File uploads
export const fileUploads = pgTable("file_uploads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionId: varchar("session_id").references(() => sessions_table.id, { onDelete: 'cascade' }),
  fileName: varchar("file_name").notNull(),
  fileUrl: varchar("file_url").notNull(),
  fileType: varchar("file_type"),
  fileSize: integer("file_size"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  tutorProfile: one(tutorProfiles, {
    fields: [users.id],
    references: [tutorProfiles.userId],
  }),
  studentSessions: many(sessions_table, { relationName: 'studentSessions' }),
  sentMessages: many(messages, { relationName: 'sentMessages' }),
  receivedMessages: many(messages, { relationName: 'receivedMessages' }),
  fileUploads: many(fileUploads),
  reviews: many(reviews),
}));

export const tutorProfilesRelations = relations(tutorProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [tutorProfiles.userId],
    references: [users.id],
  }),
  subjects: many(tutorSubjects),
  sessions: many(sessions_table),
  reviews: many(reviews),
}));

export const subjectsRelations = relations(subjects, ({ many }) => ({
  tutors: many(tutorSubjects),
  sessions: many(sessions_table),
}));

export const tutorSubjectsRelations = relations(tutorSubjects, ({ one }) => ({
  tutor: one(tutorProfiles, {
    fields: [tutorSubjects.tutorId],
    references: [tutorProfiles.id],
  }),
  subject: one(subjects, {
    fields: [tutorSubjects.subjectId],
    references: [subjects.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  // No direct relations needed for now
}));

export const sessionsRelations = relations(sessions_table, ({ one, many }) => ({
  student: one(users, {
    fields: [sessions_table.studentId],
    references: [users.id],
    relationName: 'studentSessions',
  }),
  tutor: one(tutorProfiles, {
    fields: [sessions_table.tutorId],
    references: [tutorProfiles.id],
  }),
  subject: one(subjects, {
    fields: [sessions_table.subjectId],
    references: [subjects.id],
  }),
  review: one(reviews),
  files: many(fileUploads),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  session: one(sessions_table, {
    fields: [reviews.sessionId],
    references: [sessions_table.id],
  }),
  student: one(users, {
    fields: [reviews.studentId],
    references: [users.id],
  }),
  tutor: one(tutorProfiles, {
    fields: [reviews.tutorId],
    references: [tutorProfiles.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: 'sentMessages',
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
    relationName: 'receivedMessages',
  }),
}));

export const fileUploadsRelations = relations(fileUploads, ({ one }) => ({
  user: one(users, {
    fields: [fileUploads.userId],
    references: [users.id],
  }),
  session: one(sessions_table, {
    fields: [fileUploads.sessionId],
    references: [sessions_table.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  role: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  type: true,
  title: true,
  body: true,
  data: true,
  audience: true,
});

export const insertSubjectSchema = createInsertSchema(subjects).pick({
  name: true,
  description: true,
  category: true,
});

export const insertTutorProfileSchema = createInsertSchema(tutorProfiles).pick({
  userId: true,
  bio: true,
  phone: true,
  hourlyRate: true,
  experience: true,
  education: true,
  certifications: true,
  availability: true,
});

// Tutor profile update schema (no userId since it's set on creation)
export const updateTutorProfileSchema = createInsertSchema(tutorProfiles).pick({
  bio: true,
  phone: true,
  hourlyRate: true,
  experience: true,
  education: true,
  certifications: true,
  availability: true,
}).partial();

// Choose role schema
export const chooseRoleSchema = z.object({
  role: z.enum(['student', 'tutor', 'admin']),
});

export const insertSessionSchema = createInsertSchema(sessions_table).pick({
  studentId: true,
  tutorId: true,
  subjectId: true,
  scheduledAt: true,
  duration: true,
  notes: true,
  price: true,
});

export const insertReviewSchema = createInsertSchema(reviews).pick({
  sessionId: true,
  studentId: true,
  tutorId: true,
  rating: true,
  comment: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  senderId: true,
  receiverId: true,
  content: true,
});

export const insertFileUploadSchema = createInsertSchema(fileUploads).pick({
  userId: true,
  sessionId: true,
  fileName: true,
  fileUrl: true,
  fileType: true,
  fileSize: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type TutorProfile = typeof tutorProfiles.$inferSelect;
export type TutorSubject = typeof tutorSubjects.$inferSelect;
export type Session = typeof sessions_table.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type FileUpload = typeof fileUploads.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type InsertTutorProfile = z.infer<typeof insertTutorProfileSchema>;
export type UpdateTutorProfile = z.infer<typeof updateTutorProfileSchema>;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertFileUpload = z.infer<typeof insertFileUploadSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type ChooseRole = z.infer<typeof chooseRoleSchema>;

// Extended types for API responses
export type TutorProfileWithSubjects = TutorProfile & {
  subjects: (TutorSubject & { subject: Subject })[];
  user: User;
};

export type UserWithProfile = User & {
  tutorProfile?: TutorProfile;
};

export type MeResponse = {
  user: User;
  hasTutorProfile: boolean;
  tutorProfile?: TutorProfile;
};
