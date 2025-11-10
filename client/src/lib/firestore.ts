// client/src/lib/firestore.ts
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
  Timestamp,
  writeBatch,
  increment,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

import type {
  User,
  Subject,
  TutorProfile,
  SessionDoc,
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
  CreateFileUpload,
  SessionStatus,
} from "@shared/types";

/* =========================
 *    Timestamp utilities
 * =======================*/

const convertTimestamps = (data: any) => {
  const converted = { ...data };
  Object.keys(converted).forEach((key) => {
    const v = converted[key];
    if (v instanceof Timestamp) converted[key] = v.toDate();
  });
  return converted;
};

const toTs = (d: Date) => Timestamp.fromDate(d);

/* =========================
 *        USERS
 * =======================*/

export const createUser = async (userData: CreateUser): Promise<User> => {
  const userRef = doc(db, "users", userData.id);
  const now = serverTimestamp();

  const payload: Omit<User, "createdAt" | "updatedAt"> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    ...userData,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(userRef, payload);
  // Return a client-friendly object (without Firestore FieldValue)
  return { ...userData } as User;
};

export const getUser = async (userId: string): Promise<User | null> => {
  const userDoc = await getDoc(doc(db, "users", userId));
  if (!userDoc.exists()) return null;
  return convertTimestamps({ id: userDoc.id, ...userDoc.data() }) as User;
};

export const updateUser = async (
  userId: string,
  updates: UpdateUser
): Promise<void> => {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

/* =========================
 *       SUBJECTS
 * =======================*/

export const createSubject = async (
  subjectData: CreateSubject
): Promise<Subject> => {
  const now = serverTimestamp();
  const docRef = await addDoc(collection(db, "subjects"), {
    ...subjectData,
    createdAt: now,
  });
  return { id: docRef.id, ...subjectData } as Subject;
};

export const getSubjects = async (): Promise<Subject[]> => {
  const snap = await getDocs(query(collection(db, "subjects"), orderBy("name")));
  return snap.docs.map((d) =>
    convertTimestamps({ id: d.id, ...d.data() })
  ) as Subject[];
};

export const updateSubject = async (
  subjectId: string,
  updates: UpdateSubject
): Promise<void> => {
  const subjectRef = doc(db, "subjects", subjectId);
  await updateDoc(subjectRef, updates as any);
};

export const deleteSubject = async (subjectId: string): Promise<void> => {
  await deleteDoc(doc(db, "subjects", subjectId));
};

/* =========================
 *     TUTOR PROFILES
 * =======================*/

export const createTutorProfile = async (
  profileData: CreateTutorProfile
): Promise<TutorProfile> => {
  // Use userId as the tutor profile document id
  const profileId = profileData.id ?? profileData.userId;
  const profileRef = doc(db, "tutorProfiles", profileId);

  const now = serverTimestamp();

  // Payload for Firestore write (FieldValue timestamps are OK for Firestore)
  const writePayload: Omit<TutorProfile, "createdAt" | "updatedAt"> & {
    id: string;
    rating: number;
    totalReviews: number;
    totalSessions: number;
    createdAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    ...profileData,
    id: profileId,
    rating: 0,
    totalReviews: 0,
    totalSessions: 0,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(profileRef, writePayload);

  // Read back to get real Date values for createdAt/updatedAt
  const saved = await getDoc(profileRef);
  return convertTimestamps({ id: saved.id, ...saved.data() }) as TutorProfile;
};

export const getTutorProfile = async (
  profileId: string
): Promise<TutorProfile | null> => {
  const profileDoc = await getDoc(doc(db, "tutorProfiles", profileId));
  if (!profileDoc.exists()) return null;
  return convertTimestamps({ id: profileDoc.id, ...profileDoc.data() }) as TutorProfile;
};

export const getTutorProfiles = async (): Promise<TutorProfile[]> => {
  const snap = await getDocs(
    query(collection(db, "tutorProfiles"), orderBy("rating", "desc"))
  );
  return snap.docs.map((d) =>
    convertTimestamps({ id: d.id, ...d.data() })
  ) as TutorProfile[];
};

export const updateTutorProfile = async (
  profileId: string,
  updates: UpdateTutorProfile
): Promise<void> => {
  const profileRef = doc(db, "tutorProfiles", profileId);
  await updateDoc(profileRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

/* =========================
 *        SESSIONS
 * =======================*/

/**
 * Checks for an overlapping session for a tutor.
 * Overlap rule: (existing.start < newEnd) && (newStart < existingEnd)
 */
export async function hasTutorConflict(
  tutorId: string,
  start: Date,
  durationMin: number
): Promise<boolean> {
  const end = new Date(start.getTime() + durationMin * 60_000);

  const q = query(
    collection(db, "sessions"),
    where("tutorId", "==", tutorId),
    where("status", "in", ["scheduled", "in_progress"] as SessionStatus[]),
    orderBy("scheduledAt", "desc")
  );

  const snap = await getDocs(q);
  for (const d of snap.docs) {
    const s = d.data() as any;
    const sStart: Date = (s.scheduledAt as Timestamp).toDate();
    const sDur: number = s.duration ?? 60;
    const sEnd = new Date(sStart.getTime() + sDur * 60_000);
    if (sStart < end && start < sEnd) return true;
  }
  return false;
}

export const createSession = async (
  input: CreateSession
): Promise<SessionDoc> => {
  const duration = input.duration ?? 60;

  const session: Omit<
    SessionDoc,
    "id" | "createdAt" | "updatedAt" | "status"
  > & {
    status: SessionStatus;
  } = {
    studentId: input.studentId,
    tutorId: input.tutorId,
    subjectId: input.subjectId,
    scheduledAt: input.scheduledAt,
    duration,
    status: input.status ?? "scheduled",
    meetingLink: input.meetingLink ?? null,
    notes: input.notes ?? "",
    priceCents: input.priceCents,
  };

  const conflict = await hasTutorConflict(
    session.tutorId,
    session.scheduledAt,
    session.duration
  );
  if (conflict) {
    throw new Error("Time slot is already booked for this tutor.");
  }

  const now = serverTimestamp();
  const docRef = await addDoc(collection(db, "sessions"), {
    ...session,
    scheduledAt: toTs(session.scheduledAt),
    createdAt: now,
    updatedAt: now,
  });

  return { id: docRef.id, ...session } as SessionDoc;
};

export const getSession = async (
  sessionId: string
): Promise<SessionDoc | null> => {
  const sessionDoc = await getDoc(doc(db, "sessions", sessionId));
  if (!sessionDoc.exists()) return null;
  const data = convertTimestamps({ id: sessionDoc.id, ...sessionDoc.data() }) as any;
  return {
    ...data,
    scheduledAt: (data.scheduledAt as Date) ?? new Date(),
  } as SessionDoc;
};

export const getUserSessions = async (
  userId: string,
  role: "student" | "tutor"
): Promise<SessionDoc[]> => {
  const field = role === "student" ? "studentId" : "tutorId";
  const snap = await getDocs(
    query(
      collection(db, "sessions"),
      where(field, "==", userId),
      orderBy("scheduledAt", "desc")
    )
  );
  const out: SessionDoc[] = [];
  snap.forEach((d) => {
    const s = convertTimestamps({ id: d.id, ...d.data() }) as any;
    out.push({
      ...s,
      scheduledAt: s.scheduledAt as Date,
    } as SessionDoc);
  });
  return out;
};

export const updateSession = async (
  sessionId: string,
  updates: UpdateSession
): Promise<void> => {
  const sessionRef = doc(db, "sessions", sessionId);
  const patch: any = { ...updates, updatedAt: serverTimestamp() };
  if (updates.scheduledAt instanceof Date) {
    patch.scheduledAt = toTs(updates.scheduledAt);
  }
  await updateDoc(sessionRef, patch);
};

export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus
) {
  const ref = doc(db, "sessions", sessionId);
  await updateDoc(ref, { status, updatedAt: serverTimestamp() });
}

/* =========================
 *         REVIEWS
 * =======================*/

export const createReview = async (reviewData: CreateReview): Promise<Review> => {
  const batch = writeBatch(db);

  const reviewRef = doc(collection(db, "reviews"));
  const reviewPayload = {
    ...reviewData,
    createdAt: serverTimestamp(),
  };
  batch.set(reviewRef, reviewPayload);

  const tutorRef = doc(db, "tutorProfiles", reviewData.tutorId);
  batch.update(tutorRef, {
    totalReviews: increment(1),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  return { id: reviewRef.id, ...reviewData } as Review;
};

export const getTutorReviews = async (tutorId: string): Promise<Review[]> => {
  const snap = await getDocs(
    query(
      collection(db, "reviews"),
      where("tutorId", "==", tutorId),
      orderBy("createdAt", "desc")
    )
  );
  return snap.docs.map((d) =>
    convertTimestamps({ id: d.id, ...d.data() })
  ) as Review[];
};

/* =========================
 *         MESSAGES
 * =======================*/

export const createMessage = async (
  messageData: CreateMessage
): Promise<Message> => {
  const payload = {
    ...messageData,
    read: false,
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, "messages"), payload);
  return { id: docRef.id, ...messageData, read: false } as Message;
};

/**
 * Firestore limitation: a single query cannot use `in` on two fields,
 * and OR across two equality pairs is awkward. We do two queries and merge.
 */
export const getConversationMessages = async (
  userA: string,
  userB: string
): Promise<Message[]> => {
  const q1 = query(
    collection(db, "messages"),
    where("senderId", "==", userA),
    where("receiverId", "==", userB),
    orderBy("createdAt", "asc")
  );
  const q2 = query(
    collection(db, "messages"),
    where("senderId", "==", userB),
    where("receiverId", "==", userA),
    orderBy("createdAt", "asc")
  );

  const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  const rows = [...s1.docs, ...s2.docs].map((d) =>
    convertTimestamps({ id: d.id, ...d.data() })
  ) as Message[];

  rows.sort((a: any, b: any) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return at - bt;
  });

  return rows;
};

export const markMessageAsRead = async (messageId: string): Promise<void> => {
  const messageRef = doc(db, "messages", messageId);
  await updateDoc(messageRef, { read: true });
};

/* =========================
 *       FILE UPLOADS
 * =======================*/

export const createFileUpload = async (
  fileData: CreateFileUpload
): Promise<FileUpload> => {
  const payload = {
    ...fileData,
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, "fileUploads"), payload);
  return { id: docRef.id, ...fileData } as FileUpload;
};

export const getSessionFiles = async (
  sessionId: string
): Promise<FileUpload[]> => {
  const snap = await getDocs(
    query(
      collection(db, "fileUploads"),
      where("sessionId", "==", sessionId),
      orderBy("createdAt", "desc")
    )
  );
  return snap.docs.map((d) =>
    convertTimestamps({ id: d.id, ...d.data() })
  ) as FileUpload[];
};
