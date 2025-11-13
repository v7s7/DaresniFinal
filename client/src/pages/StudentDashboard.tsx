import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { TutorProfile, User, Subject } from "@shared/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { SessionCard } from "@/components/SessionCard";
import { ChatWindow } from "@/components/ChatWindow";

// Firestore helpers
import {
  getUser as getUserDoc,
  getTutorProfiles,
  getSubjects,
  getUserSessions,
} from "@/lib/firestore";

/* ------------------------------------------------------------ */
/* Helpers                                                      */
/* ------------------------------------------------------------ */

function useLocalFavorites(userId?: string) {
  const key = userId ? `favorites:${userId}` : undefined;
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      setFavorites(raw ? JSON.parse(raw) : []);
    } catch {
      setFavorites([]);
    }
  }, [key]);

  return favorites;
}

// Robust date normalizer (supports Date, Firestore Timestamp, ISO, millis, etc.)
function normalizeDate(raw: any): Date {
  try {
    if (!raw) return new Date();

    if (raw instanceof Date) {
      return isNaN(raw.getTime()) ? new Date() : raw;
    }

    if (typeof raw === "object" && typeof raw.toDate === "function") {
      const d = raw.toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d : new Date();
    }

    if (typeof raw === "object" && typeof raw._seconds === "number") {
      const d = new Date(raw._seconds * 1000);
      return isNaN(d.getTime()) ? new Date() : d;
    }

    if (typeof raw === "string" || typeof raw === "number") {
      const d = new Date(raw);
      return isNaN(d.getTime()) ? new Date() : d;
    }

    return new Date();
  } catch {
    return new Date();
  }
}

/* ------------------------------------------------------------ */
/* Types                                                        */
/* ------------------------------------------------------------ */

type BaseSession = {
  id: string;
  status: "pending" | "scheduled" | "in_progress" | "completed" | "cancelled";
  scheduledAt: any; // can be Timestamp | string | Date
  duration?: number;
  meetingLink?: string | null;
  notes?: string;
  priceCents?: number;
  subjectId: string;
  tutorId: string; // NOTE: this is the tutorProfileId in the new API
  studentId: string;
};

type TutorVM = TutorProfile & { user: User; subjects: Subject[] };

type SessionVM = BaseSession & {
  student: User;
  tutor: TutorProfile & { user: User };
  subject: Subject;
};

/* ------------------------------------------------------------ */
/* Component                                                    */
/* ------------------------------------------------------------ */

export default function StudentDashboard() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [showChat, setShowChat] = useState(false);
  const [chatUserId, setChatUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      toast({
        title: "Unauthorized",
        description: "Please sign in to view your dashboard.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [user, isLoading, toast, navigate]);

  /* ---------------------- Subjects ---------------------- */

  const { data: subjectsData } = useQuery<Subject[]>({
    queryKey: ["subjects"],
    queryFn: () => getSubjects(),
  });

  const subjects: Subject[] = subjectsData ?? [];

  const subjectMap = useMemo(
    () => new Map(subjects.map((s) => [s.id, s] as const)),
    [subjects],
  );

  /* ---------------------- Tutors (for favorites sidebar) ---------------------- */

  const { data: tutorsData } = useQuery<TutorVM[]>({
    queryKey: ["tutors", subjects.map((s) => s.id).join("|")],
    queryFn: async () => {
      const base = await getTutorProfiles();
      return Promise.all(
        base.map(async (tp) => {
          const u = (await getUserDoc(tp.userId)) as User;
          const sDocs = (tp.subjects ?? []).map(
            (sid) =>
              subjectMap.get(sid) ?? {
                id: sid,
                name: sid,
                description: "",
                category: "",
                createdAt: new Date(),
              },
          );
          return { ...tp, user: u, subjects: sDocs as Subject[] } as TutorVM;
        }),
      );
    },
  });

  const tutors: TutorVM[] = tutorsData ?? [];

  /* ---------------------- Current user's favorites (local) ---------------------- */

  const favorites = useLocalFavorites(user?.id);

  /* ---------------------- Student Sessions ---------------------- */

  const {
    data: sessionsData,
    isLoading: sessionsLoading,
  } = useQuery<SessionVM[]>({
    queryKey: ["studentSessions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as SessionVM[];

      const [rawSessions, tutorProfiles] = await Promise.all([
        getUserSessions(user.id, "student") as Promise<BaseSession[]>,
        getTutorProfiles(),
      ]);

      const tutorProfileById = new Map<string, TutorProfile>();
      const tutorProfileByUserId = new Map<string, TutorProfile>();

      for (const tp of tutorProfiles) {
        tutorProfileById.set(tp.id, tp);
        tutorProfileByUserId.set(tp.userId, tp);
      }

      const userCache = new Map<string, User>();

      const getUserCached = async (uid: string): Promise<User> => {
        if (userCache.has(uid)) return userCache.get(uid)!;
        const u = (await getUserDoc(uid)) as User;
        userCache.set(uid, u);
        return u;
      };

      return Promise.all(
        rawSessions.map(async (s) => {
          const subject =
            subjectMap.get(s.subjectId) ??
            ({
              id: s.subjectId,
              name: s.subjectId,
              description: "",
              category: "",
              createdAt: new Date(),
            } as Subject);

          // New sessions: tutorId is tutorProfileId
          let tutorProfile =
            tutorProfileById.get(s.tutorId) ||
            tutorProfileByUserId.get(s.tutorId); // legacy fallback

          const tutorUserId = tutorProfile?.userId ?? s.tutorId;

          const [tutorUser, studentUser] = await Promise.all([
            getUserCached(tutorUserId),
            getUserCached(s.studentId),
          ]);

          const tutor: TutorProfile & { user: User } = {
            ...(tutorProfile ??
              ({
                id: s.tutorId,
                userId: tutorUserId,
                bio: "",
                hourlyRate: 0,
                subjects: [],
                availability: {},
                isVerified: false,
                rating: 0,
                totalReviews: 0,
                totalSessions: 0,
                profileImageUrl: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              } as TutorProfile)),
            user: tutorUser,
          };

          return {
            ...s,
            subject,
            tutor,
            student: studentUser,
          } as SessionVM;
        }),
      );
    },
  });

  const sessions: SessionVM[] = sessionsData ?? [];

  const pendingSessions: SessionVM[] = useMemo(
    () =>
      sessions.filter(
        (s) =>
          s.status === "pending" && normalizeDate(s.scheduledAt) > new Date(),
      ),
    [sessions],
  );

  const upcomingSessions: SessionVM[] = useMemo(
    () =>
      sessions.filter(
        (s) =>
          s.status === "scheduled" && normalizeDate(s.scheduledAt) > new Date(),
      ),
    [sessions],
  );

  const completedSessions: SessionVM[] = useMemo(
    () => sessions.filter((s) => s.status === "completed"),
    [sessions],
  );

  const recentSessions: SessionVM[] = useMemo(
    () => completedSessions.slice(0, 3),
    [completedSessions],
  );

  const favoriteTutors = useMemo<TutorVM[]>(() => {
    if (!Array.isArray(tutors) || !Array.isArray(favorites)) return [];
    return tutors.filter((t) => favorites.includes(t.id)).slice(0, 3);
  }, [tutors, favorites]);

  const handleStartChat = (userId: string) => {
    setChatUserId(userId);
    setShowChat(true);
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1
            className="text-3xl font-bold text-foreground"
            data-testid="text-dashboard-title"
          >
            Welcome back, {user.firstName || "Student"}!
          </h1>
          <p className="text-muted-foreground mt-2">
            Your learning journey continues here
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Stats */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6 text-center">
                  <div
                    className="text-2xl font-bold text-primary"
                    data-testid="text-pending-sessions"
                  >
                    {pendingSessions.length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Pending Requests
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <div
                    className="text-2xl font-bold text-primary"
                    data-testid="text-upcoming-sessions"
                  >
                    {upcomingSessions.length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Upcoming Sessions
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <div
                    className="text-2xl font-bold text-primary"
                    data-testid="text-completed-sessions"
                  >
                    {completedSessions.length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Completed Sessions
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <div
                    className="text-2xl font-bold text-primary"
                    data-testid="text-total-tutors"
                  >
                    {tutors.length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Available Tutors
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Upcoming Sessions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <i className="fas fa-calendar-alt mr-2 text-primary" />
                  Upcoming Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sessionsLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-20 bg-muted rounded" />
                      </div>
                    ))}
                  </div>
                ) : upcomingSessions.length > 0 ? (
                  <div className="space-y-4">
                    {upcomingSessions.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        userRole="student"
                        onChat={() => handleStartChat(session.tutor.user.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <i className="fas fa-calendar-times text-4xl mb-4" />
                    <p>No upcoming sessions</p>
                    <Button
                      className="mt-4"
                      onClick={() => navigate("/tutors")}
                      data-testid="button-browse-tutors"
                    >
                      Browse Tutors
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <i className="fas fa-hourglass-half mr-2 text-primary" />
                  Pending Requests
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sessionsLoading ? (
                  <div className="space-y-4">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-20 bg-muted rounded" />
                      </div>
                    ))}
                  </div>
                ) : pendingSessions.length > 0 ? (
                  <div className="space-y-4">
                    {pendingSessions.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        userRole="student"
                        onChat={() => handleStartChat(session.tutor.user.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <i className="fas fa-inbox text-4xl mb-4" />
                    <p>No pending requests</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    className="h-20 text-left justify-start"
                    onClick={() => navigate("/tutors")}
                    data-testid="button-find-tutors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <i className="fas fa-search text-primary" />
                      </div>
                      <div>
                        <div className="font-semibold">Find Tutors</div>
                        <div className="text-sm text-muted-foreground">
                          Browse available tutors
                        </div>
                      </div>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 text-left justify-start"
                    data-testid="button-upload-files"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-accent/50 rounded-full flex items-center justify-center">
                        <i className="fas fa-upload text-primary" />
                      </div>
                      <div>
                        <div className="font-semibold">Upload Files</div>
                        <div className="text-sm text-muted-foreground">
                          Share assignments & notes
                        </div>
                      </div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentSessions.length > 0 ? (
                    recentSessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center space-x-3 text-sm"
                      >
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <i className="fas fa-check text-primary text-xs" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {session.subject.name} with{" "}
                            {session.tutor.user.firstName}
                          </div>
                          <div className="text-muted-foreground">
                            {normalizeDate(
                              session.scheduledAt,
                            ).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-4">
                      <i className="fas fa-history text-2xl mb-2" />
                      <p className="text-sm">No recent activity</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Favorite Tutors */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Favorite Tutors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {favoriteTutors.length > 0 ? (
                    favoriteTutors.map((tutor) => (
                      <div key={tutor.id} className="flex items-center space-x-3">
                        <img
                          src={
                            tutor.user.profileImageUrl ||
                            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=50&h=50"
                          }
                          alt={tutor.user.firstName}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {tutor.user.firstName} {tutor.user.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {tutor.subjects && tutor.subjects[0]?.name}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartChat(tutor.user.id)}
                          data-testid={`button-chat-${tutor.id}`}
                        >
                          <i className="fas fa-comment" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-4">
                      <i className="fas fa-heart text-2xl mb-2" />
                      <p className="text-sm">No favorite tutors yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Chat Window */}
      {showChat && chatUserId && (
        <ChatWindow userId={chatUserId} onClose={() => setShowChat(false)} />
      )}
    </div>
  );
}
