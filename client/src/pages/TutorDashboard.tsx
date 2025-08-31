import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Session, TutorProfile, User, Subject, Review } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { SessionCard } from "@/components/SessionCard";
import { ChatWindow } from "@/components/ChatWindow";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const profileSchema = z.object({
  bio: z.string().min(10, "Bio must be at least 10 characters"),
  hourlyRate: z.string().min(1, "Hourly rate is required"),
  experience: z.string().min(5, "Experience must be at least 5 characters"),
  education: z.string().min(5, "Education must be at least 5 characters"),
});

export default function TutorDashboard() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showChat, setShowChat] = useState(false);
  const [chatUserId, setChatUserId] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      bio: "",
      hourlyRate: "",
      experience: "",
      education: "",
    },
  });

  useEffect(() => {
    if (!isLoading && !user) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [user, isLoading, toast]);

  const { data: sessions, isLoading: sessionsLoading } = useQuery<Array<Session & { student: User, tutor: TutorProfile & { user: User }, subject: Subject }>>({
    queryKey: ["/api", "sessions"],
    enabled: !!user,
    retry: false,
  });

  const { data: tutorProfile } = useQuery<TutorProfile>({
    queryKey: ["/api", "tutors", "profile", user?.id],
    enabled: !!user,
    retry: false,
  });

  const { data: reviews } = useQuery<Array<Review & { student: User }>>({
    queryKey: ["/api", "reviews", tutorProfile?.id],
    enabled: !!tutorProfile?.id,
  });

  const createProfileMutation = useMutation({
    mutationFn: async (data: z.infer<typeof profileSchema>) => {
      return await apiRequest("/api/tutors/profile", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutors/profile"] });
      setShowProfileModal(false);
      toast({
        title: "Success",
        description: "Profile created successfully! Awaiting admin verification.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: async ({ sessionId, status }: { sessionId: string; status: string }) => {
      return await apiRequest(`/api/sessions/${sessionId}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({
        title: "Success",
        description: "Session updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const upcomingSessions = Array.isArray(sessions) ? sessions.filter((session: any) => 
    new Date(session.scheduledAt) > new Date() && session.status === 'scheduled'
  ) : [];

  const completedSessions = Array.isArray(sessions) ? sessions.filter((session: any) => 
    session.status === 'completed'
  ) : [];

  const totalEarnings = completedSessions.reduce((sum: number, session: any) => 
    sum + parseFloat(session.price || '0'), 0
  );

  const averageRating = tutorProfile?.totalRating || '0';

  const handleStartChat = (userId: string) => {
    setChatUserId(userId);
    setShowChat(true);
  };

  const handleSessionAction = (sessionId: string, status: string) => {
    updateSessionMutation.mutate({ sessionId, status });
  };

  const onSubmitProfile = (data: z.infer<typeof profileSchema>) => {
    createProfileMutation.mutate(data);
  };

  // If no tutor profile exists, show profile creation
  if (!tutorProfile) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Create Your Tutor Profile</CardTitle>
                <p className="text-muted-foreground">
                  Complete your profile to start tutoring on TutorConnect
                </p>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmitProfile)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bio</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Tell students about yourself and your teaching experience..."
                              {...field}
                              data-testid="input-bio"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="hourlyRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hourly Rate ($)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="45"
                              {...field}
                              data-testid="input-hourly-rate"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="experience"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teaching Experience</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe your teaching experience and qualifications..."
                              {...field}
                              data-testid="input-experience"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="education"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Education</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="List your educational background..."
                              {...field}
                              data-testid="input-education"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={createProfileMutation.isPending}
                      data-testid="button-create-profile"
                    >
                      {createProfileMutation.isPending ? "Creating..." : "Create Profile"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // If profile exists but not verified
  if (!tutorProfile.isVerified) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <Card>
              <CardContent className="p-8">
                <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="fas fa-clock text-3xl text-yellow-600"></i>
                </div>
                <h2 className="text-2xl font-bold mb-4">Profile Under Review</h2>
                <p className="text-muted-foreground mb-6">
                  Your tutor profile is currently being reviewed by our team. 
                  You'll be notified once it's approved and you can start accepting students.
                </p>
                <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                  Pending Verification
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-dashboard-title">
            Welcome, {user.firstName || 'Tutor'}!
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your tutoring sessions and students
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Stats */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-2xl font-bold text-primary" data-testid="text-upcoming-sessions">
                    {upcomingSessions.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Upcoming Sessions</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-2xl font-bold text-primary" data-testid="text-completed-sessions">
                    {completedSessions.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Completed Sessions</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-2xl font-bold text-primary" data-testid="text-total-earnings">
                    ${totalEarnings.toFixed(2)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Earnings</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-2xl font-bold text-primary" data-testid="text-average-rating">
                    {parseFloat(averageRating).toFixed(1)}
                  </div>
                  <div className="text-sm text-muted-foreground">Average Rating</div>
                </CardContent>
              </Card>
            </div>

            {/* Upcoming Sessions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <i className="fas fa-calendar-alt mr-2 text-primary"></i>
                  Upcoming Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sessionsLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-20 bg-muted rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : upcomingSessions.length > 0 ? (
                  <div className="space-y-4">
                    {upcomingSessions.map((session: any) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        userRole="tutor"
                        onChat={() => handleStartChat(session.studentId)}
                        onAction={(action) => handleSessionAction(session.id, action)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <i className="fas fa-calendar-times text-4xl mb-4"></i>
                    <p>No upcoming sessions</p>
                    <p className="text-sm mt-2">Students will book sessions with you directly</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Reviews */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <i className="fas fa-star mr-2 text-primary"></i>
                  Recent Reviews
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reviews && reviews.length > 0 ? (
                  <div className="space-y-4">
                    {reviews.slice(0, 3).map((review: any) => (
                      <div key={review.id} className="border-b border-border pb-4 last:border-b-0">
                        <div className="flex items-start space-x-3">
                          <img
                            src={review.student.profileImageUrl || 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=50&h=50'}
                            alt={review.student.firstName}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-medium">{review.student.firstName} {review.student.lastName}</span>
                              <div className="flex text-yellow-400">
                                {[...Array(review.rating)].map((_, i) => (
                                  <i key={i} className="fas fa-star text-sm"></i>
                                ))}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">{review.comment}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(review.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <i className="fas fa-star-half-alt text-4xl mb-4"></i>
                    <p>No reviews yet</p>
                    <p className="text-sm mt-2">Complete sessions to receive reviews from students</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Profile Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Profile Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <img
                      src={'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100'}
                      alt={user.firstName || 'User'}
                      className="w-20 h-20 rounded-full object-cover mx-auto mb-3"
                    />
                    <h3 className="font-semibold">{user.firstName} {user.lastName}</h3>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      <i className="fas fa-check-circle mr-1"></i>
                      Verified
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Hourly Rate:</span>
                      <span className="font-medium">${tutorProfile.hourlyRate}/hr</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Reviews:</span>
                      <span className="font-medium">{tutorProfile.totalReviews}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Rating:</span>
                      <span className="font-medium">{parseFloat(averageRating).toFixed(1)}/5</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setShowProfileModal(true)}
                    data-testid="button-edit-profile"
                  >
                    <i className="fas fa-edit mr-2"></i>
                    Edit Profile
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    data-testid="button-manage-availability"
                  >
                    <i className="fas fa-calendar mr-2"></i>
                    Manage Availability
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    data-testid="button-view-earnings"
                  >
                    <i className="fas fa-chart-line mr-2"></i>
                    View Earnings
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* This Week's Schedule */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">This Week</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {upcomingSessions.slice(0, 5).map((session: any) => (
                    <div key={session.id} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <div className="flex-1">
                        <div className="font-medium">{session.subject.name}</div>
                        <div className="text-muted-foreground">
                          {new Date(session.scheduledAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  {upcomingSessions.length === 0 && (
                    <div className="text-center text-muted-foreground py-4">
                      <i className="fas fa-calendar-check text-2xl mb-2"></i>
                      <p className="text-sm">No sessions this week</p>
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
        <ChatWindow
          userId={chatUserId}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
}
