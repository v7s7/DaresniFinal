import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session, TutorProfile, User, Subject } from "@shared/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { SessionCard } from "@/components/SessionCard";
import { ChatWindow } from "@/components/ChatWindow";

export default function StudentDashboard() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [showChat, setShowChat] = useState(false);
  const [chatUserId, setChatUserId] = useState<string | null>(null);

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

  const { data: tutors } = useQuery<Array<TutorProfile & { user: User, subjects: Subject[] }>>({
    queryKey: ["/api", "tutors"],
    enabled: !!user,
  });

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const upcomingSessions = sessions?.filter((session: any) => 
    new Date(session.scheduledAt) > new Date() && session.status === 'scheduled'
  ) || [];

  const recentSessions = sessions?.filter((session: any) => 
    session.status === 'completed'
  ).slice(0, 3) || [];

  const handleStartChat = (userId: string) => {
    setChatUserId(userId);
    setShowChat(true);
  };

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-dashboard-title">
            Welcome back, {user.firstName || 'Student'}!
          </h1>
          <p className="text-muted-foreground mt-2">
            Your learning journey continues here
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Stats */}
            <div className="grid md:grid-cols-3 gap-4">
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
                    {recentSessions.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Completed Sessions</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-2xl font-bold text-primary" data-testid="text-total-tutors">
                    {tutors?.length || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Available Tutors</div>
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
                        userRole="student"
                        onChat={() => handleStartChat(session.tutor.userId)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <i className="fas fa-calendar-times text-4xl mb-4"></i>
                    <p>No upcoming sessions</p>
                    <Button 
                      className="mt-4"
                      onClick={() => window.location.href = '/tutors'}
                      data-testid="button-browse-tutors"
                    >
                      Browse Tutors
                    </Button>
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
                    onClick={() => window.location.href = '/tutors'}
                    data-testid="button-find-tutors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <i className="fas fa-search text-primary"></i>
                      </div>
                      <div>
                        <div className="font-semibold">Find Tutors</div>
                        <div className="text-sm text-muted-foreground">Browse available tutors</div>
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
                        <i className="fas fa-upload text-primary"></i>
                      </div>
                      <div>
                        <div className="font-semibold">Upload Files</div>
                        <div className="text-sm text-muted-foreground">Share assignments & notes</div>
                      </div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Learning Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Learning Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Mathematics</span>
                      <span>78%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{width: '78%'}}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Science</span>
                      <span>65%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{width: '65%'}}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>English</span>
                      <span>85%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{width: '85%'}}></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentSessions.length > 0 ? (
                    recentSessions.map((session: any) => (
                      <div key={session.id} className="flex items-center space-x-3 text-sm">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <i className="fas fa-check text-primary text-xs"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {session.subject.name} with {session.tutor.user.firstName}
                          </div>
                          <div className="text-muted-foreground">
                            {new Date(session.scheduledAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-4">
                      <i className="fas fa-history text-2xl mb-2"></i>
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
                  {tutors?.slice(0, 3).map((tutor: any) => (
                    <div key={tutor.id} className="flex items-center space-x-3">
                      <img
                        src={tutor.user.profileImageUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=50&h=50'}
                        alt={tutor.user.firstName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {tutor.user.firstName} {tutor.user.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {tutor.subjects[0]?.name}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStartChat(tutor.userId)}
                        data-testid={`button-chat-${tutor.id}`}
                      >
                        <i className="fas fa-comment"></i>
                      </Button>
                    </div>
                  )) || (
                    <div className="text-center text-muted-foreground py-4">
                      <i className="fas fa-heart text-2xl mb-2"></i>
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
        <ChatWindow
          userId={chatUserId}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
}
