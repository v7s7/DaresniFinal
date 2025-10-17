import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, Video, BookOpen } from "lucide-react";
import { format } from "date-fns";

export default function MySessions() {
  const { user } = useAuth();
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['/api/sessions'],
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSubjectIcon = (subjectName: string) => {
    const name = subjectName?.toLowerCase() || '';
    if (name.includes('math')) return 'fa-calculator';
    if (name.includes('science')) return 'fa-flask';
    if (name.includes('english')) return 'fa-book';
    if (name.includes('programming') || name.includes('computer')) return 'fa-code';
    if (name.includes('history')) return 'fa-landmark';
    if (name.includes('art')) return 'fa-palette';
    return 'fa-graduation-cap';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 mt-16">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  const sessionsArray = (sessions as any[]) || [];
  
  const upcomingSessions = sessionsArray.filter((s: any) => 
    s.status === 'scheduled' && new Date(s.scheduledAt) > new Date()
  );
  
  const pastSessions = sessionsArray.filter((s: any) => 
    s.status === 'completed' || (s.status === 'scheduled' && new Date(s.scheduledAt) <= new Date())
  );

  const cancelledSessions = sessionsArray.filter((s: any) => s.status === 'cancelled');

  return (
    <div className="container mx-auto px-4 py-8 mt-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="title-my-sessions">My Sessions</h1>
        <p className="text-muted-foreground">
          View and manage your tutoring sessions
        </p>
      </div>

      {/* Upcoming Sessions */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          Upcoming Sessions
          <Badge variant="secondary">{upcomingSessions.length}</Badge>
        </h2>
        {upcomingSessions.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground" data-testid="text-no-upcoming">
                No upcoming sessions scheduled
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {upcomingSessions.map((session: any) => (
              <Card key={session.id} className="hover:shadow-md transition-shadow" data-testid={`session-card-${session.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <i className={`fas ${getSubjectIcon(session.subject?.name)} text-primary text-xl`}></i>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg" data-testid={`text-session-subject-${session.id}`}>
                            {session.subject?.name}
                          </h3>
                          <Badge className={getStatusColor(session.status)}>
                            {session.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span data-testid={`text-session-participant-${session.id}`}>
                              {user?.role === 'student' 
                                ? `Tutor: ${session.tutor?.user?.firstName} ${session.tutor?.user?.lastName}`
                                : `Student: ${session.student?.firstName} ${session.student?.lastName}`
                              }
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span data-testid={`text-session-time-${session.id}`}>
                              {format(new Date(session.scheduledAt), 'PPP • p')} • {session.duration || 60} min
                            </span>
                          </div>

                          {session.price && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <i className="fas fa-dollar-sign"></i>
                              <span>${(parseFloat(session.price) || 0).toFixed(2)}</span>
                            </div>
                          )}
                        </div>

                        {session.notes && (
                          <p className="mt-3 text-sm text-muted-foreground italic">
                            "{session.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {session.meetingLink && (
                        <Button size="sm" asChild data-testid={`button-join-${session.id}`}>
                          <a href={session.meetingLink} target="_blank" rel="noopener noreferrer">
                            <Video className="h-4 w-4 mr-2" />
                            Join
                          </a>
                        </Button>
                      )}
                      <Button variant="outline" size="sm" data-testid={`button-details-${session.id}`}>
                        Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Past Sessions */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Past Sessions
          <Badge variant="secondary">{pastSessions.length}</Badge>
        </h2>
        {pastSessions.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground" data-testid="text-no-past">
                No past sessions
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pastSessions.slice(0, 5).map((session: any) => (
              <Card key={session.id} className="opacity-75" data-testid={`past-session-card-${session.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                        <i className={`fas ${getSubjectIcon(session.subject?.name)} text-muted-foreground`}></i>
                      </div>
                      
                      <div>
                        <h4 className="font-medium">{session.subject?.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(session.scheduledAt), 'PP')}
                        </p>
                      </div>
                    </div>
                    
                    <Badge variant="outline" className={getStatusColor(session.status)}>
                      {session.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Cancelled Sessions */}
      {cancelledSessions.length > 0 && (
        <div>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <i className="fas fa-ban"></i>
            Cancelled Sessions
            <Badge variant="secondary">{cancelledSessions.length}</Badge>
          </h2>
          <div className="space-y-4">
            {cancelledSessions.slice(0, 3).map((session: any) => (
              <Card key={session.id} className="opacity-60" data-testid={`cancelled-session-card-${session.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                        <i className={`fas ${getSubjectIcon(session.subject?.name)} text-muted-foreground`}></i>
                      </div>
                      
                      <div>
                        <h4 className="font-medium">{session.subject?.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(session.scheduledAt), 'PP')}
                        </p>
                      </div>
                    </div>
                    
                    <Badge variant="outline" className="bg-red-100 text-red-800">
                      Cancelled
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
