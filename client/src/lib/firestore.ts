import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  increment,
  setDoc
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  User,
  Subject,
  TutorProfile,
  Session,
  Review,
  Message,
  FileUpload,
  CreateUser,
  UpdateUser,
  CreateSubject,
  UpdateSubject,
  CreateTutorProfile,
  UpdateTutorProfile,
  CreateSession,
  UpdateSession,
  CreateReview,
  CreateMessage,
  CreateFileUpload
} from "@shared/types";

// Helper function to convert Firestore timestamps to Date objects
const convertTimestamps = (data: any) => {
  const converted = { ...data };
  Object.keys(converted).forEach(key => {
    if (converted[key] instanceof Timestamp) {
      converted[key] = converted[key].toDate();
    }
  });
  return converted;
};

// User operations
export const createUser = async (userData: CreateUser): Promise<User> => {
  const userRef = doc(db, "users", userData.id);
  const now = new Date();
  const userWithTimestamps = {
    ...userData,
    createdAt: now,
    updatedAt: now,
  };
  
  await setDoc(userRef, userWithTimestamps);
  return userWithTimestamps;
};

export const getUser = async (userId: string): Promise<User | null> => {
  const userDoc = await getDoc(doc(db, "users", userId));
  if (!userDoc.exists()) return null;
  
  return convertTimestamps({ id: userDoc.id, ...userDoc.data() }) as User;
};

export const updateUser = async (userId: string, updates: UpdateUser): Promise<void> => {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    ...updates,
    updatedAt: new Date(),
  });
};

// Subject operations
export const createSubject = async (subjectData: CreateSubject): Promise<Subject> => {
  const docRef = await addDoc(collection(db, "subjects"), {
    ...subjectData,
    createdAt: new Date(),
  });
  
  return { id: docRef.id, ...subjectData, createdAt: new Date() };
};

export const getSubjects = async (): Promise<Subject[]> => {
  const querySnapshot = await getDocs(
    query(collection(db, "subjects"), orderBy("name"))
  );
  
  return querySnapshot.docs.map(doc => 
    convertTimestamps({ id: doc.id, ...doc.data() }) as Subject
  );
};

export const updateSubject = async (subjectId: string, updates: UpdateSubject): Promise<void> => {
  const subjectRef = doc(db, "subjects", subjectId);
  await updateDoc(subjectRef, updates);
};

export const deleteSubject = async (subjectId: string): Promise<void> => {
  await deleteDoc(doc(db, "subjects", subjectId));
};

// Tutor Profile operations
export const createTutorProfile = async (profileData: CreateTutorProfile): Promise<TutorProfile> => {
  const profileRef = doc(db, "tutorProfiles", profileData.userId);
  const now = new Date();
  const profileWithDefaults = {
    ...profileData,
    id: profileData.userId,
    rating: 0,
    totalReviews: 0,
    totalSessions: 0,
    createdAt: now,
    updatedAt: now,
  };
  
  await updateDoc(profileRef, profileWithDefaults);
  return profileWithDefaults;
};

export const getTutorProfile = async (userId: string): Promise<TutorProfile | null> => {
  const profileDoc = await getDoc(doc(db, "tutorProfiles", userId));
  if (!profileDoc.exists()) return null;
  
  return convertTimestamps({ id: profileDoc.id, ...profileDoc.data() }) as TutorProfile;
};

export const getTutorProfiles = async (): Promise<TutorProfile[]> => {
  const querySnapshot = await getDocs(
    query(collection(db, "tutorProfiles"), orderBy("rating", "desc"))
  );
  
  return querySnapshot.docs.map(doc => 
    convertTimestamps({ id: doc.id, ...doc.data() }) as TutorProfile
  );
};

export const updateTutorProfile = async (userId: string, updates: UpdateTutorProfile): Promise<void> => {
  const profileRef = doc(db, "tutorProfiles", userId);
  await updateDoc(profileRef, {
    ...updates,
    updatedAt: new Date(),
  });
};

// Session operations
export const createSession = async (sessionData: CreateSession): Promise<Session> => {
  const now = new Date();
  const sessionWithDefaults = {
    ...sessionData,
    status: 'scheduled' as const,
    createdAt: now,
    updatedAt: now,
  };
  
  const docRef = await addDoc(collection(db, "sessions"), sessionWithDefaults);
  return { id: docRef.id, ...sessionWithDefaults };
};

export const getSession = async (sessionId: string): Promise<Session | null> => {
  const sessionDoc = await getDoc(doc(db, "sessions", sessionId));
  if (!sessionDoc.exists()) return null;
  
  return convertTimestamps({ id: sessionDoc.id, ...sessionDoc.data() }) as Session;
};

export const getUserSessions = async (userId: string, role: 'student' | 'tutor'): Promise<Session[]> => {
  const field = role === 'student' ? 'studentId' : 'tutorId';
  const querySnapshot = await getDocs(
    query(
      collection(db, "sessions"),
      where(field, "==", userId),
      orderBy("scheduledDate", "desc")
    )
  );
  
  return querySnapshot.docs.map(doc => 
    convertTimestamps({ id: doc.id, ...doc.data() }) as Session
  );
};

export const updateSession = async (sessionId: string, updates: UpdateSession): Promise<void> => {
  const sessionRef = doc(db, "sessions", sessionId);
  await updateDoc(sessionRef, {
    ...updates,
    updatedAt: new Date(),
  });
};

// Review operations
export const createReview = async (reviewData: CreateReview): Promise<Review> => {
  const batch = writeBatch(db);
  
  // Add the review
  const reviewRef = doc(collection(db, "reviews"));
  const reviewWithTimestamp = {
    ...reviewData,
    createdAt: new Date(),
  };
  batch.set(reviewRef, reviewWithTimestamp);
  
  // Update tutor profile stats
  const tutorRef = doc(db, "tutorProfiles", reviewData.tutorId);
  batch.update(tutorRef, {
    totalReviews: increment(1),
    // Note: Rating calculation would need to be done separately
    updatedAt: new Date(),
  });
  
  await batch.commit();
  return { id: reviewRef.id, ...reviewWithTimestamp };
};

export const getTutorReviews = async (tutorId: string): Promise<Review[]> => {
  const querySnapshot = await getDocs(
    query(
      collection(db, "reviews"),
      where("tutorId", "==", tutorId),
      orderBy("createdAt", "desc")
    )
  );
  
  return querySnapshot.docs.map(doc => 
    convertTimestamps({ id: doc.id, ...doc.data() }) as Review
  );
};

// Message operations
export const createMessage = async (messageData: CreateMessage): Promise<Message> => {
  const messageWithDefaults = {
    ...messageData,
    read: false,
    createdAt: new Date(),
  };
  
  const docRef = await addDoc(collection(db, "messages"), messageWithDefaults);
  return { id: docRef.id, ...messageWithDefaults };
};

export const getConversationMessages = async (userId1: string, userId2: string): Promise<Message[]> => {
  const querySnapshot = await getDocs(
    query(
      collection(db, "messages"),
      where("senderId", "in", [userId1, userId2]),
      where("receiverId", "in", [userId1, userId2]),
      orderBy("createdAt", "asc")
    )
  );
  
  return querySnapshot.docs.map(doc => 
    convertTimestamps({ id: doc.id, ...doc.data() }) as Message
  );
};

export const markMessageAsRead = async (messageId: string): Promise<void> => {
  const messageRef = doc(db, "messages", messageId);
  await updateDoc(messageRef, { read: true });
};

// File Upload operations
export const createFileUpload = async (fileData: CreateFileUpload): Promise<FileUpload> => {
  const fileWithTimestamp = {
    ...fileData,
    createdAt: new Date(),
  };
  
  const docRef = await addDoc(collection(db, "fileUploads"), fileWithTimestamp);
  return { id: docRef.id, ...fileWithTimestamp };
};

export const getSessionFiles = async (sessionId: string): Promise<FileUpload[]> => {
  const querySnapshot = await getDocs(
    query(
      collection(db, "fileUploads"),
      where("sessionId", "==", sessionId),
      orderBy("createdAt", "desc")
    )
  );
  
  return querySnapshot.docs.map(doc => 
    convertTimestamps({ id: doc.id, ...doc.data() }) as FileUpload
  );
};