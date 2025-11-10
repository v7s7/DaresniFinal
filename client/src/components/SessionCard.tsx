import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";

interface SessionCardProps {
  session: any;
  userRole: "student" | "tutor";
  onChat?: () => void;
  onAction?: (action: string) => void;
}

export function SessionCard({ session, userRole, onChat, onAction }: SessionCardProps) {
  // --- Normalize date field (prefer scheduledDate; fallback to scheduledAt) ---
  const scheduled = new Date(session.scheduledDate ?? session.scheduledAt);

  // --- Normalize status to underscore variant for coloring logic ---
  // Accepts "in-progress" or "in_progress" and normalizes to "in_progress"
  const rawStatus: string = typeof session.status === "string" ? session.status : "scheduled";
  const status = rawStatus.replace("-", "_");

  const isUpcoming = scheduled > new Date();
  const isToday = scheduled.toDateString() === new Date().toDateString();

  const otherUser = userRole === "student" ? session.tutor.user : session.student;
  const displayName =
    userRole === "student"
      ? `${session.tutor.user.firstName} ${session.tutor.user.lastName}`
      : `${session.student.firstName} ${session.student.lastName}`;

  const getStatusColor = (s: string) => {
    switch (s) {
      case "scheduled":
        return "bg-blue-100 text-blue-800";
      case "in_progress":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-gray-100 text-gray-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Allow "Join" if within ±30 minutes of scheduled time today
  const canJoin =
    isToday &&
    status === "scheduled" &&
    Math.abs(Date.now() - scheduled.getTime()) < 30 * 60 * 1000;

  // Price can be string or number depending on creator; display nicely
  const priceValue =
    session.price !== undefined && session.price !== null
      ? Number(session.price)
      : undefined;

  const subjectName = session.subject?.name ?? "Session";

  const subjectIcon = (() => {
    const name = (subjectName || "").toLowerCase();
    if (name.includes("math")) return "fa-calculator";
    if (name.includes("science")) return "fa-flask";
    if (name.includes("english")) return "fa-book";
    if (name.includes("programming") || name.includes("computer")) return "fa-code";
    if (name.includes("history")) return "fa-landmark";
    if (name.includes("art")) return "fa-palette";
    return "fa-graduation-cap";
  })();

  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={`session-card-${session.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1">
            {/* Subject Icon */}
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <i className={`fas ${subjectIcon} text-primary`} />
            </div>

            {/* Session Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="font-semibold truncate" data-testid="text-session-title">
                  {subjectName} with {displayName}
                </h3>
                <Badge className={getStatusColor(status)}>
                  {status.replace("_", " ")}
                </Badge>
              </div>

              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <i className="fas fa-calendar text-xs" />
                  <span data-testid="text-session-date">
                    {format(scheduled, "MMM dd, yyyy")}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <i className="fas fa-clock text-xs" />
                  <span data-testid="text-session-time">
                    {format(scheduled, "HH:mm")}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <i className="fas fa-stopwatch text-xs" />
                  <span>{session.duration || 60} min</span>
                </div>
                {priceValue !== undefined && !Number.isNaN(priceValue) && (
                  <div className="flex items-center space-x-1">
                    <i className="fas fa-dollar-sign text-xs" />
                    <span>${priceValue.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {session.notes && (
                <p className="text-sm text-muted-foreground mt-1 truncate">
                  <i className="fas fa-sticky-note text-xs mr-1" />
                  {session.notes}
                </p>
              )}
            </div>

            {/* Other User Avatar */}
            <Avatar className="w-10 h-10 flex-shrink-0">
              <AvatarImage src={otherUser.profileImageUrl} alt={otherUser.firstName} />
              <AvatarFallback>
                {otherUser.firstName?.[0]}
                {otherUser.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2 ml-4">
            {canJoin && (
              <Button
                className="btn-primary"
                onClick={() => onAction?.("join")}
                data-testid="button-join-session"
              >
                <i className="fas fa-video mr-1" />
                Join
              </Button>
            )}

            {isUpcoming && status === "scheduled" && !canJoin && (
              <>
                {userRole === "tutor" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAction?.("start")}
                    data-testid="button-start-session"
                  >
                    <i className="fas fa-play mr-1" />
                    Start
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAction?.("reschedule")}
                  data-testid="button-reschedule"
                >
                  <i className="fas fa-calendar-alt mr-1" />
                  Reschedule
                </Button>
              </>
            )}

            {status === "completed" && userRole === "student" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAction?.("review")}
                data-testid="button-leave-review"
              >
                <i className="fas fa-star mr-1" />
                Review
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onChat}
              data-testid="button-chat"
            >
              <i className="fas fa-comment" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction?.("details")}
              data-testid="button-details"
            >
              <i className="fas fa-info-circle" />
            </Button>
          </div>
        </div>

        {/* In-progress quick join */}
        {status === "in_progress" && session.meetingLink && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-800">
                <i className="fas fa-video mr-2" />
                Session is live
              </span>
              <Button
                size="sm"
                onClick={() => window.open(session.meetingLink, "_blank")}
                data-testid="button-join-meeting"
              >
                Join Meeting
              </Button>
            </div>
          </div>
        )}

        {/* Upcoming reminder */}
        {isToday && isUpcoming && (
          <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-center space-x-2 text-sm text-yellow-800">
              <i className="fas fa-bell" />
              <span>
                Session starts today at {format(scheduled, "HH:mm")}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
