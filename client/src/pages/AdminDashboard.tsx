import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Bell, 
  CheckCircle, 
  Clock, 
  Users, 
  GraduationCap, 
  BookOpen,
  AlertCircle,
  RefreshCw,
  User
} from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: any;
  isRead: boolean;
  createdAt: string;
}

interface TutorProfile {
  id: string;
  userId: string;
  bio: string;
  phone: string;
  hourlyRate: number;
  experience: string;
  education: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = useState<"notifications" | "tutors">("notifications");

  // Fetch notifications
  const { data: notifications = [], isLoading: notificationsLoading, refetch: refetchNotifications } = useQuery<Notification[]>({
    queryKey: ["/api/admin/notifications"],
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Fetch pending tutors
  const { data: pendingTutors = [], isLoading: tutorsLoading } = useQuery<TutorProfile[]>({
    queryKey: ["/api/admin/pending-tutors"],
    enabled: currentTab === "tutors",
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest(`/api/admin/notifications/${notificationId}/read`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
    },
  });

  // Verify tutor
  const verifyTutorMutation = useMutation({
    mutationFn: async (tutorId: string) => {
      return apiRequest(`/api/tutors/${tutorId}/verify`, {
        method: "PUT",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-tutors"] });
      toast({
        title: "Tutor verified",
        description: "The tutor has been successfully verified and can now accept students.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to verify tutor. Please try again.",
        variant: "destructive",
      });
    },
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#9B1B30]">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Manage platform users, verify tutors, and monitor system activity.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">-</p>
              </div>
              <Users className="h-8 w-8 text-[#9B1B30]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Tutors</p>
                <p className="text-2xl font-bold">-</p>
              </div>
              <GraduationCap className="h-8 w-8 text-[#9B1B30]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Verification</p>
                <p className="text-2xl font-bold">{pendingTutors.length}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Unread Notifications</p>
                <p className="text-2xl font-bold">{unreadCount}</p>
              </div>
              <Bell className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6">
        <Button
          variant={currentTab === "notifications" ? "default" : "outline"}
          onClick={() => setCurrentTab("notifications")}
          className="flex items-center space-x-2"
          data-testid="tab-notifications"
        >
          <Bell className="h-4 w-4" />
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-1">
              {unreadCount}
            </Badge>
          )}
        </Button>
        <Button
          variant={currentTab === "tutors" ? "default" : "outline"}
          onClick={() => setCurrentTab("tutors")}
          className="flex items-center space-x-2"
          data-testid="tab-tutors"
        >
          <GraduationCap className="h-4 w-4" />
          <span>Tutor Verification</span>
          {pendingTutors.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {pendingTutors.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Notifications Tab */}
      {currentTab === "notifications" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Recent Notifications</span>
              </CardTitle>
              <CardDescription>
                System notifications and alerts requiring your attention.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchNotifications()}
              disabled={notificationsLoading}
              data-testid="button-refresh-notifications"
            >
              <RefreshCw className={`h-4 w-4 ${notificationsLoading ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {notificationsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9B1B30]"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-lg border ${
                      notification.isRead 
                        ? 'bg-background border-border' 
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <AlertCircle className="h-4 w-4 text-[#9B1B30]" />
                          <h4 className="font-medium">{notification.title}</h4>
                          {!notification.isRead && (
                            <Badge variant="destructive" className="text-xs">
                              New
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {notification.body}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {!notification.isRead && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => markAsReadMutation.mutate(notification.id)}
                          disabled={markAsReadMutation.isPending}
                          data-testid={`button-mark-read-${notification.id}`}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tutor Verification Tab */}
      {currentTab === "tutors" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <GraduationCap className="h-5 w-5" />
              <span>Pending Tutor Verification</span>
            </CardTitle>
            <CardDescription>
              Review and verify new tutor applications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tutorsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9B1B30]"></div>
              </div>
            ) : pendingTutors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p>No pending verifications</p>
                <p className="text-sm">All tutors are up to date!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {pendingTutors.map((tutor) => (
                  <div key={tutor.id} className="p-6 border rounded-lg">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-[#9B1B30] text-white flex items-center justify-center">
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold">
                            {tutor.user.firstName} {tutor.user.lastName}
                          </h3>
                          <p className="text-sm text-muted-foreground">{tutor.user.email}</p>
                        </div>
                      </div>
                      <Badge variant="outline">Pending Verification</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-medium">Education</p>
                        <p className="text-sm text-muted-foreground">{tutor.education}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Experience</p>
                        <p className="text-sm text-muted-foreground">{tutor.experience}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Hourly Rate</p>
                        <p className="text-sm text-muted-foreground">${tutor.hourlyRate}/hour</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Phone</p>
                        <p className="text-sm text-muted-foreground">{tutor.phone}</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm font-medium mb-2">Bio</p>
                      <p className="text-sm text-muted-foreground bg-slate-50 p-3 rounded">
                        {tutor.bio}
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Applied: {new Date(tutor.createdAt).toLocaleDateString()}
                      </p>
                      <Button
                        onClick={() => verifyTutorMutation.mutate(tutor.id)}
                        disabled={verifyTutorMutation.isPending}
                        data-testid={`button-verify-${tutor.id}`}
                      >
                        {verifyTutorMutation.isPending ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Verify Tutor
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}