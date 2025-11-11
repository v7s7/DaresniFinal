// client/src/pages/TutorProfile.tsx
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { useAuth } from "@/components/AuthProvider";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/** ======= Minimal local types ======= */
type UserLite = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  role?: string | null;
};

type SubjectLite = { id: string; name: string };

type TutorProfileLite = {
  id: string;           // tutor_profiles.id
  userId: string;       // users.id
  bio?: string | null;
  education?: string | null;
  experience?: string | null;
  hourlyRate?: number | null;
  isVerified?: boolean;
  user: UserLite;
  subjects: SubjectLite[];
};

type ReviewLite = {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string | Date;
  student: UserLite;
};

type Slot = { start: string; end: string; available: boolean; at: string };

/** ======= Helpers ======= */
function fmtYMD(d: Date) {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function TutorProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  /** Tutors (public, verified+active) */
  const { data: tutors } = useQuery<Array<TutorProfileLite>>({
    queryKey: ["/api/tutors"],
    queryFn: async () => {
      const res = await apiRequest("/api/tutors");
      if (!res.ok) throw new Error("Failed to load tutors");
      return res.json();
    },
    staleTime: 30_000,
  });

  /** Global subjects (safe fallback if listing didn't include per-tutor subjects) */
  const { data: allSubjects } = useQuery<Array<SubjectLite>>({
    queryKey: ["/api/subjects"],
    queryFn: async () => {
      const res = await apiRequest("/api/subjects");
      if (!res.ok) throw new Error("Failed to load subjects");
      return res.json();
    },
    staleTime: 60_000,
  });

  /** Reviews (for rating) */
  const { data: reviews } = useQuery<Array<ReviewLite>>({
    queryKey: ["/api/reviews", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiRequest(`/api/reviews/${id}`);
      if (!res.ok) throw new Error("Failed to load reviews");
      return res.json();
    },
  });

  const tutor = useMemo(() => tutors?.find((t) => t.id === id), [tutors, id]);

  /** ---------- Self-redirect for tutors viewing their own public page ---------- */
  useEffect(() => {
    if (user?.role === "tutor" && tutor && tutor.userId === user.id) {
      navigate("/"); // Router maps "/" to TutorDashboard for tutors
    }
  }, [user, tutor, navigate]);

  const ratingAvg =
    reviews && reviews.length
      ? reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviews.length
      : 0;
  const totalReviews = reviews?.length ?? 0;

  /** Daily availability (with bookings removed) */
  const dateKey = selectedDate ? fmtYMD(selectedDate) : "";
  const { data: availability, isFetching: availLoading } = useQuery<{ slots: Slot[] }>({
    queryKey: ["availability", id, dateKey],
    enabled: !!id && !!dateKey,
    queryFn: async () => {
      const res = await apiRequest(`/api/tutors/${id}/availability?date=${dateKey}`);
      if (!res.ok) throw new Error("Failed to load availability");
      return res.json();
    },
  });

  /** Booking */
  const createSession = useMutation({
    mutationFn: async (payload: {
      tutorId: string;
      subjectId: string;
      scheduledAt: string; // ISO
      duration: number;
      priceCents: number;
      notes?: string;
    }) => {
      const res = await apiRequest("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || err?.error || "Failed to book session");
      }
      return res.json();
    },
    onSuccess: async () => {
      toast({ title: "Booked!", description: "Your session has been scheduled." });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["availability", id, dateKey] }),
      ]);
      setSelectedSlot(null);
    },
    onError: (e: any) => {
      toast({ title: "Couldn’t book", description: e.message, variant: "destructive" });
    },
  });

  const handleBookSelected = () => {
    if (!user) {
      window.location.href = "/";
      return;
    }
    if (!tutor) return;
    if (!selectedDate || !selectedSlot) {
      toast({ title: "Pick a time", description: "Select an available time slot.", variant: "destructive" });
      return;
    }
    if (!selectedSlot.available) {
      toast({ title: "Unavailable", description: "Please choose an available slot.", variant: "destructive" });
      return;
    }

    // Prefer tutor's own subjects, fallback to global list (keeps demo functional)
    const firstSubjectId = tutor.subjects?.[0]?.id || allSubjects?.[0]?.id;
    if (!firstSubjectId) {
      toast({
        title: "Missing subject",
        description: "No subjects are configured for this tutor.",
        variant: "destructive",
      });
      return;
    }

    const duration = 60; // minutes
    const priceCents = Math.round(Number(tutor.hourlyRate || 0) * 100 * (duration / 60));

    createSession.mutate({
      tutorId: tutor.id,
      subjectId: firstSubjectId,
      scheduledAt: selectedSlot.at,
      duration,
      priceCents,
    });
  };

  if (!tutor) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <div className="container mx-auto px-4 py-8">
          <Card className="text-center py-12">
            <CardContent>
              <div className="space-y-4">
                <i className="fas fa-user-slash text-4xl text-muted-foreground"></i>
                <h3 className="text-xl font-semibold">Tutor not found</h3>
                <p className="text-muted-foreground">
                  The tutor you're looking for doesn't exist or may have been removed.
                </p>
                <Button onClick={() => (window.location.href = "/tutors")}>Browse Tutors</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // If this is the tutor's own profile, the effect above will redirect. Render nothing.
  if (user?.role === "tutor" && tutor.userId === user.id) return null;

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main */}
          <div className="lg:col-span-2 space-y-8">
            <Card>
              <CardContent className="p-8">
                <div className="flex items-start space-x-6">
                  <Avatar className="w-24 h-24">
                    <AvatarImage
                      src={tutor.user.profileImageUrl || undefined}
                      alt={tutor.user.firstName || "Tutor"}
                    />
                    <AvatarFallback className="text-2xl">
                      {tutor.user.firstName?.[0]}
                      {tutor.user.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h1 className="text-3xl font-bold text-foreground" data-testid="text-tutor-name">
                          {tutor.user.firstName} {tutor.user.lastName}
                        </h1>
                        <p className="text-muted-foreground text-lg">
                          {tutor.subjects?.length
                            ? tutor.subjects.map((s) => s.name).join(" • ")
                            : "General Tutoring"}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-primary" data-testid="text-hourly-rate">
                          ${tutor.hourlyRate ?? 0}/hr
                        </div>
                        {tutor.isVerified && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            <i className="fas fa-check-circle mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-6 mb-6">
                      <div className="flex items-center space-x-2">
                        <div className="flex text-yellow-400">
                          {[...Array(5)].map((_, i) => (
                            <i
                              key={i}
                              className={`fas fa-star ${i < Math.floor(ratingAvg) ? "" : "text-gray-300"}`}
                            />
                          ))}
                        </div>
                        <span className="font-medium" data-testid="text-rating">
                          {ratingAvg.toFixed(1)}
                        </span>
                        <span className="text-muted-foreground">({totalReviews} reviews)</span>
                      </div>
                    </div>

                    <div className="flex space-x-4">
                      <Button
                        size="lg"
                        className="btn-primary px-8"
                        onClick={handleBookSelected}
                        data-testid="button-book-session"
                      >
                        <i className="fas fa-calendar-plus mr-2" />
                        Book Selected Time
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="about" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="about">About</TabsTrigger>
                <TabsTrigger value="experience">Experience</TabsTrigger>
                <TabsTrigger value="reviews">Reviews ({totalReviews})</TabsTrigger>
                <TabsTrigger value="availability">Availability</TabsTrigger>
              </TabsList>

              <TabsContent value="about">
                <Card>
                  <CardHeader>
                    <CardTitle>About {tutor.user.firstName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-semibold mb-2">Bio</h4>
                        <p className="text-muted-foreground leading-relaxed">{tutor.bio || "—"}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-3">Subjects</h4>
                        <div className="flex flex-wrap gap-2">
                          {(tutor.subjects?.length ? tutor.subjects : allSubjects || [])
                            .slice(0, 6)
                            .map((subject) => (
                              <Badge key={subject.id} variant="outline" className="bg-primary/10 text-primary">
                                {subject.name}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="experience">
                <Card>
                  <CardHeader>
                    <CardTitle>Experience & Qualifications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-semibold mb-2">Teaching Experience</h4>
                        <p className="text-muted-foreground leading-relaxed">{tutor.experience || "—"}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Education</h4>
                        <p className="text-muted-foreground leading-relaxed">{tutor.education || "—"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reviews">
                <Card>
                  <CardHeader>
                    <CardTitle>Student Reviews</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Reviews list rendered from /api/reviews/:id */}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="availability">
                <Card>
                  <CardHeader>
                    <CardTitle>Schedule a Session</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold mb-4">Select Date</h4>
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(d) => {
                            setSelectedDate(d);
                            setSelectedSlot(null);
                          }}
                          className="rounded-md border"
                          disabled={(d) => !!d && d < new Date(new Date().toDateString())}
                        />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-4">Available Times</h4>

                        {availLoading ? (
                          <div className="text-sm text-muted-foreground">Loading availability…</div>
                        ) : !availability || availability.slots.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No availability for the selected day.</div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {availability.slots.map((slot) => {
                              const label = slot.start; // HH:mm
                              const disabled = !slot.available;
                              const active = selectedSlot?.at === slot.at;
                              return (
                                <Button
                                  key={slot.at}
                                  variant={active ? "default" : "outline"}
                                  className={`justify-center ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                                  disabled={disabled}
                                  onClick={() => setSelectedSlot(slot)}
                                  data-testid={`button-time-${label.replace(/[^a-zA-Z0-9]/g, "-")}`}
                                >
                                  {label}
                                </Button>
                              );
                            })}
                          </div>
                        )}

                        <Button
                          className="w-full mt-6 btn-primary"
                          onClick={handleBookSelected}
                          disabled={!selectedSlot || createSession.isPending}
                          data-testid="button-book-selected-time"
                        >
                          {createSession.isPending ? "Booking…" : "Book Selected Time"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact {tutor.user.firstName}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button className="w-full btn-primary" onClick={handleBookSelected} data-testid="button-book-now">
                    <i className="fas fa-calendar-plus mr-2" />
                    Book Now
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Similar Tutors</CardTitle>
              </CardHeader>
              <CardContent>{/* optional */}</CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
