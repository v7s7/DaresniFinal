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
  User,
  Trash2,
  Shield,
  Eye
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  profile: {
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
  };
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
}

interface Student {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
}

interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = useState<"notifications" | "students" | "tutors" | "admins">("notifications");
  const [userToDelete, setUserToDelete] = useState<{ id: string; type: string; name: string } | null>(null);
  const [selectedTutor, setSelectedTutor] = useState<TutorProfile | null>(null);

  // Fetch notifications
  const { data: notifications = [], isLoading: notificationsLoading, refetch: refetchNotifications } = useQuery<Notification[]>({
    queryKey: ["/api/admin/notifications"],
    refetchInterval: 30000,
  });

  // Fetch students
  const { data: students = [], isLoading: studentsLoading } = useQuery<Student[]>({
    queryKey: ["/api/admin/students"],
    enabled: currentTab === "students",
  });

  // Fetch all tutors (verified and pending)
  const { data: allTutors = [], isLoading: tutorsLoading } = useQuery<TutorProfile[]>({
    queryKey: ["/api/admin/tutors"],
    enabled: currentTab === "tutors",
  });

  // Fetch admin users
  const { data: adminUsers = [], isLoading: adminsLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/admins"],
    enabled: currentTab === "admins",
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tutors"] });
      toast({
        title: "Tutor verified",
        description: "The tutor has been successfully verified and can now accept students.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to verify tutor. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete student
  const deleteStudentMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest(`/api/admin/students/${userId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/students"] });
      toast({
        title: "Student deleted",
        description: "The student account has been successfully deleted.",
      });
      setUserToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete student. Please try again.",
        variant: "destructive",
      });
      setUserToDelete(null);
    },
  });

  // Delete tutor
  const deleteTutorMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest(`/api/admin/tutors/${userId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tutors"] });
      toast({
        title: "Tutor deleted",
        description: "The tutor account has been successfully deleted.",
      });
      setUserToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete tutor. Please try again.",
        variant: "destructive",
      });
      setUserToDelete(null);
    },
  });

  // Delete admin user
  const deleteAdminMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest(`/api/admin/admins/${userId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admins"] });
      toast({
        title: "Admin deleted",
        description: "The admin user has been successfully deleted.",
      });
      setUserToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete admin user. Please try again.",
        variant: "destructive",
      });
      setUserToDelete(null);
    },
  });

  const handleDeleteUser = () => {
    if (!userToDelete) return;
    
    if (userToDelete.type === 'student') {
      deleteStudentMutation.mutate(userToDelete.id);
    } else if (userToDelete.type === 'tutor') {
      deleteTutorMutation.mutate(userToDelete.id);
    } else if (userToDelete.type === 'admin') {
      deleteAdminMutation.mutate(userToDelete.id);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const pendingTutorsCount = allTutors.filter(t => !t.profile.isVerified).length;

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
                <p className="text-sm font-medium text-muted-foreground">Students</p>
                <p className="text-2xl font-bold">{students.length}</p>
              </div>
              <BookOpen className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">All Tutors</p>
                <p className="text-2xl font-bold">{allTutors.length}</p>
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
                <p className="text-2xl font-bold">{pendingTutorsCount}</p>
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
      <div className="flex flex-wrap gap-2 mb-6">
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
          variant={currentTab === "students" ? "default" : "outline"}
          onClick={() => setCurrentTab("students")}
          className="flex items-center space-x-2"
          data-testid="tab-students"
        >
          <BookOpen className="h-4 w-4" />
          <span>Students</span>
          <Badge variant="secondary" className="ml-1">
            {students.length}
          </Badge>
        </Button>
        <Button
          variant={currentTab === "tutors" ? "default" : "outline"}
          onClick={() => setCurrentTab("tutors")}
          className="flex items-center space-x-2"
          data-testid="tab-tutors"
        >
          <GraduationCap className="h-4 w-4" />
          <span>All Tutors</span>
          {pendingTutorsCount > 0 && (
            <Badge variant="destructive" className="ml-1">
              {pendingTutorsCount} pending
            </Badge>
          )}
        </Button>
        <Button
          variant={currentTab === "admins" ? "default" : "outline"}
          onClick={() => setCurrentTab("admins")}
          className="flex items-center space-x-2"
          data-testid="tab-admins"
        >
          <Shield className="h-4 w-4" />
          <span>Admin Management</span>
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
                    data-testid={`notification-${notification.id}`}
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

      {/* Students Tab */}
      {currentTab === "students" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5" />
              <span>All Students</span>
            </CardTitle>
            <CardDescription>
              View and manage student accounts on the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {studentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9B1B30]"></div>
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>No students registered yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {students.map((student) => (
                  <div key={student.id} className="p-4 border rounded-lg flex items-center justify-between" data-testid={`student-${student.id}`}>
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold" data-testid={`student-name-${student.id}`}>
                          {student.firstName} {student.lastName}
                        </h3>
                        <p className="text-sm text-muted-foreground" data-testid={`student-email-${student.id}`}>{student.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Joined {new Date(student.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setUserToDelete({ 
                        id: student.id, 
                        type: 'student', 
                        name: `${student.firstName} ${student.lastName}` 
                      })}
                      data-testid={`button-delete-student-${student.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* All Tutors Tab */}
      {currentTab === "tutors" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <GraduationCap className="h-5 w-5" />
              <span>All Tutors</span>
            </CardTitle>
            <CardDescription>
              View all tutors (verified and pending), manage verification status, and delete accounts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tutorsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9B1B30]"></div>
              </div>
            ) : allTutors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>No tutors registered yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {allTutors.map((tutor) => (
                  <div key={tutor.profile.id} className="p-4 border rounded-lg" data-testid={`tutor-${tutor.profile.id}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-[#9B1B30] text-white flex items-center justify-center">
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold" data-testid={`tutor-name-${tutor.profile.id}`}>
                            {tutor.user?.firstName} {tutor.user?.lastName}
                          </h3>
                          <p className="text-sm text-muted-foreground" data-testid={`tutor-email-${tutor.profile.id}`}>{tutor.user?.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Joined {new Date(tutor.profile.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {tutor.profile.isVerified ? (
                          <Badge variant="default" className="bg-green-600">
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600 border-orange-600">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 text-sm">
                      <div>
                        <p className="font-medium">Hourly Rate</p>
                        <p className="text-muted-foreground">${tutor.profile.hourlyRate}/hour</p>
                      </div>
                      <div>
                        <p className="font-medium">Phone</p>
                        <p className="text-muted-foreground">{tutor.profile.phone}</p>
                      </div>
                      <div>
                        <p className="font-medium">Status</p>
                        <p className="text-muted-foreground">
                          {tutor.profile.isActive ? 'Active' : 'Inactive'}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedTutor(tutor)}
                        data-testid={`button-view-tutor-${tutor.profile.id}`}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                      {!tutor.profile.isVerified && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => verifyTutorMutation.mutate(tutor.profile.id)}
                          disabled={verifyTutorMutation.isPending}
                          data-testid={`button-verify-tutor-${tutor.profile.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Verify
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setUserToDelete({ 
                          id: tutor.user?.id || '', 
                          type: 'tutor', 
                          name: `${tutor.user?.firstName} ${tutor.user?.lastName}` 
                        })}
                        data-testid={`button-delete-tutor-${tutor.profile.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Admin Management Tab */}
      {currentTab === "admins" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Admin Management</span>
            </CardTitle>
            <CardDescription>
              View all admin accounts and manage admin access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {adminsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9B1B30]"></div>
              </div>
            ) : adminUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>No admin accounts found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {adminUsers.map((admin) => (
                  <div key={admin.id} className="p-4 border rounded-lg flex items-center justify-between" data-testid={`admin-${admin.id}`}>
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-purple-600 text-white flex items-center justify-center">
                        <Shield className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold" data-testid={`admin-name-${admin.id}`}>
                          {admin.firstName} {admin.lastName}
                        </h3>
                        <p className="text-sm text-muted-foreground" data-testid={`admin-email-${admin.id}`}>{admin.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Joined {new Date(admin.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setUserToDelete({ 
                        id: admin.id, 
                        type: 'admin', 
                        name: `${admin.firstName} ${admin.lastName}` 
                      })}
                      data-testid={`button-delete-admin-${admin.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-user">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {userToDelete?.type} account for{' '}
              <strong>{userToDelete?.name}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              Delete {userToDelete?.type}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tutor Details Dialog */}
      <Dialog open={!!selectedTutor} onOpenChange={() => setSelectedTutor(null)}>
        <DialogContent className="max-w-2xl" data-testid="dialog-tutor-details">
          <DialogHeader>
            <DialogTitle>Tutor Profile Details</DialogTitle>
            <DialogDescription>
              Complete information for {selectedTutor?.user?.firstName} {selectedTutor?.user?.lastName}
            </DialogDescription>
          </DialogHeader>
          {selectedTutor && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-medium">Name</p>
                  <p className="text-muted-foreground">
                    {selectedTutor.user?.firstName} {selectedTutor.user?.lastName}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-muted-foreground">{selectedTutor.user?.email}</p>
                </div>
                <div>
                  <p className="font-medium">Phone</p>
                  <p className="text-muted-foreground">{selectedTutor.profile.phone}</p>
                </div>
                <div>
                  <p className="font-medium">Hourly Rate</p>
                  <p className="text-muted-foreground">${selectedTutor.profile.hourlyRate}/hour</p>
                </div>
                <div>
                  <p className="font-medium">Education</p>
                  <p className="text-muted-foreground">{selectedTutor.profile.education}</p>
                </div>
                <div>
                  <p className="font-medium">Experience</p>
                  <p className="text-muted-foreground">{selectedTutor.profile.experience}</p>
                </div>
                <div>
                  <p className="font-medium">Verification Status</p>
                  <p className="text-muted-foreground">
                    {selectedTutor.profile.isVerified ? (
                      <Badge variant="default" className="bg-green-600">Verified</Badge>
                    ) : (
                      <Badge variant="outline" className="text-orange-600 border-orange-600">Pending</Badge>
                    )}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Account Status</p>
                  <p className="text-muted-foreground">
                    {selectedTutor.profile.isActive ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>
              <div>
                <p className="font-medium mb-2">Bio</p>
                <p className="text-muted-foreground">{selectedTutor.profile.bio}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
