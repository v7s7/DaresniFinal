// Firebase Firestore Types for Tutoring Platform

export interface User {
  id: string; // Firebase Auth UID
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: 'student' | 'tutor' | 'admin';
  // Tutor-specific fields for enhanced sign-up
  phone?: string;
  education?: string;
  experience?: string;
  bio?: string;
  hourlyRate?: string;
  linkedinProfile?: string;
  certifications?: string;
  isVerified?: boolean;
  verificationStatus?: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface Subject {
  id: string;
  name: string;
  description: string;
  category: string;
  createdAt: Date;
}

export interface TutorProfile {
  id: string; // Same as user ID
  userId: string; // Reference to user
  bio: string;
  hourlyRate: number;
  subjects: string[]; // Array of subject IDs
  availability: {
    [key: string]: { // Day of week (monday, tuesday, etc.)
      startTime: string;
      endTime: string;
      isAvailable: boolean;
    };
  };
  verified: boolean;
  rating: number;
  totalReviews: number;
  totalSessions: number;
  profileImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  studentId: string;
  tutorId: string;
  subjectId: string;
  title: string;
  description: string;
  scheduledDate: Date;
  duration: number; // in minutes
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  meetingUrl: string | null;
  price: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Review {
  id: string;
  sessionId: string;
  studentId: string;
  tutorId: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  sessionId: string | null; // Optional, for session-specific messages
  content: string;
  fileUrl: string | null;
  read: boolean;
  createdAt: Date;
}

export interface FileUpload {
  id: string;
  uploaderId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  sessionId: string | null; // Optional, for session-specific files
  createdAt: Date;
}

// Form types for creating/updating records
export type CreateUser = Omit<User, 'createdAt' | 'updatedAt'> & {
  // Make tutor fields explicitly optional for creation
  phone?: string;
  education?: string;
  experience?: string;
  bio?: string;
  hourlyRate?: string;
  linkedinProfile?: string;
  certifications?: string;
  isVerified?: boolean;
  verificationStatus?: 'pending' | 'approved' | 'rejected';
};
export type UpdateUser = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>;

export type CreateSubject = Omit<Subject, 'id' | 'createdAt'>;
export type UpdateSubject = Partial<Omit<Subject, 'id' | 'createdAt'>>;

export type CreateTutorProfile = Omit<TutorProfile, 'id' | 'rating' | 'totalReviews' | 'totalSessions' | 'createdAt' | 'updatedAt'>;
export type UpdateTutorProfile = Partial<Omit<TutorProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>;

export type CreateSession = Omit<Session, 'id' | 'status' | 'createdAt' | 'updatedAt'>;
export type UpdateSession = Partial<Omit<Session, 'id' | 'createdAt' | 'updatedAt'>>;

export type CreateReview = Omit<Review, 'id' | 'createdAt'>;

export type CreateMessage = Omit<Message, 'id' | 'read' | 'createdAt'>;

export type CreateFileUpload = Omit<FileUpload, 'id' | 'createdAt'>;