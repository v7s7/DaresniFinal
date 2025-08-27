import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";

interface SessionCardProps {
  session: any;
  userRole: 'student' | 'tutor';
  onChat?: () => void;
  onAction?: (action: string) => void;
}

export function SessionCard({ session, userRole, onChat, onAction }: SessionCardProps) {
  const isUpcoming = new Date(session.scheduledAt) > new Date();
  const isToday = new Date(session.scheduledAt).toDateString() === new Date().toDateString();
  
  const otherUser = userRole === 'student' ? session.tutor.user : session.student;
  const displayName = userRole === 'student' 
    ? `${session.tutor.user.firstName} ${session.tutor.user.lastName}`
    : `${session.student.firstName} ${session.student.lastName}`;

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

  const canJoin = isToday && session.status === 'scheduled' && 
    Math.abs(new Date().getTime() - new Date(session.scheduledAt).getTime()) < 30 * 60 * 1000; // 30 minutes

  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={`session-card-${session.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1">
            {/* Subject Icon */}
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <i className={`fas ${
                session.subject.name.toLowerCase().includes('math') ? 'fa-calculator' :
                session.subject.name.toLowerCase().includes('science') ? 'fa-flask' :
                session.subject.name.toLowerCase().includes('english') ? 'fa-book' :
                session.subject.name.toLowerCase().includes('programming') ? 'fa-code' :
                'fa-graduation-cap'
              } text-primary`}></i>
            </div>

            {/* Session Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="font-semibold truncate" data-testid="text-session-title">
                  {session.subject.name} with {displayName}
                </h3>
                <Badge className={getStatusColor(session.status)}>
                  {session.status.replace('_', ' ')}
                </Badge>
              </div>
              
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <i className="fas fa-calendar text-xs"></i>
                  <span data-testid="text-session-date">
                    {format(new Date(session.scheduledAt), 'MMM dd, yyyy')}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <i className="fas fa-clock text-xs"></i>
                  <span data-testid="text-session-time">
                    {format(new Date(session.scheduledAt), 'HH:mm')}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <i className="fas fa-stopwatch text-xs"></i>
                  <span>{session.duration || 60} min</span>
                </div>
                {session.price && (
                  <div className="flex items-center space-x-1">
                    <i className="fas fa-dollar-sign text-xs"></i>
                    <span>${session.price}</span>
                  </div>
                )}
              </div>

              {session.notes && (
                <p className="text-sm text-muted-foreground mt-1 truncate">
                  <i className="fas fa-sticky-note text-xs mr-1"></i>
                  {session.notes}
                </p>
              )}
            </div>

            {/* Other User Avatar */}
            <Avatar className="w-10 h-10 flex-shrink-0">
              <AvatarImage 
                src={otherUser.profileImageUrl} 
                alt={otherUser.firstName}
              />
              <AvatarFallback>
                {otherUser.firstName?.[0]}{otherUser.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2 ml-4">
            {canJoin && (
              <Button 
                className="btn-primary"
                onClick={() => onAction?.('join')}
                data-testid="button-join-session"
              >
                <i className="fas fa-video mr-1"></i>
                Join
              </Button>
            )}

            {isUpcoming && session.status === 'scheduled' && !canJoin && (
              <>
                {userRole === 'tutor' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAction?.('start')}
                    data-testid="button-start-session"
                  >
                    <i className="fas fa-play mr-1"></i>
                    Start
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAction?.('reschedule')}
                  data-testid="button-reschedule"
                >
                  <i className="fas fa-calendar-alt mr-1"></i>
                  Reschedule
                </Button>
              </>
            )}

            {session.status === 'completed' && userRole === 'student' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAction?.('review')}
                data-testid="button-leave-review"
              >
                <i className="fas fa-star mr-1"></i>
                Review
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onChat}
              data-testid="button-chat"
            >
              <i className="fas fa-comment"></i>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction?.('details')}
              data-testid="button-details"
            >
              <i className="fas fa-info-circle"></i>
            </Button>
          </div>
        </div>

        {/* Meeting Link (for in-progress sessions) */}
        {session.status === 'in_progress' && session.meetingLink && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-800">
                <i className="fas fa-video mr-2"></i>
                Session is live
              </span>
              <Button 
                size="sm" 
                onClick={() => window.open(session.meetingLink, '_blank')}
                data-testid="button-join-meeting"
              >
                Join Meeting
              </Button>
            </div>
          </div>
        )}

        {/* Upcoming session reminder */}
        {isToday && isUpcoming && (
          <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-center space-x-2 text-sm text-yellow-800">
              <i className="fas fa-bell"></i>
              <span>Session starts today at {format(new Date(session.scheduledAt), 'HH:mm')}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
