import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Session, TutorProfile, User, Subject } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";

export default function AdminDashboard() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'admin')) {
      toast({
        title: "Unauthorized",
        description: "You don't have admin access. Redirecting...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [user, isLoading, toast]);

  const { data: tutors, isLoading: tutorsLoading } = useQuery<Array<TutorProfile & { user: User, subjects: Subject[] }>>({
    queryKey: ["/api", "tutors"],
    enabled: !!user && user.role === 'admin',
    retry: false,
  });

  const { data: sessions } = useQuery<Array<Session & { student: User, tutor: TutorProfile & { user: User }, subject: Subject }>>({
    queryKey: ["/api", "sessions"],
    enabled: !!user && user.role === 'admin',
  });

  const { data: subjects } = useQuery<Subject[]>({
    queryKey: ["/api", "subjects"],
    enabled: !!user && user.role === 'admin',
  });

  const verifyTutorMutation = useMutation({
    mutationFn: async (tutorId: string) => {
      return await apiRequest("POST", `/api/tutors/${tutorId}/verify`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutors"] });
      toast({
        title: "Success",
        description: "Tutor verified successfully",
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

  if (isLoading || !user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const pendingTutors = tutors?.filter((tutor: any) => !tutor.isVerified) || [];
  const verifiedTutors = tutors?.filter((tutor: any) => tutor.isVerified) || [];
  const totalSessions = sessions?.length || 0;
  const completedSessions = sessions?.filter((s: any) => s.status === 'completed').length || 0;

  const handleVerifyTutor = (tutorId: string) => {
    verifyTutorMutation.mutate(tutorId);
  };

  const filteredTutors = tutors?.filter((tutor: any) =>
    tutor.user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tutor.user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tutor.user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-admin-dashboard-title">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage tutors, students, and platform operations
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-primary" data-testid="text-total-tutors">
                {tutors?.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Total Tutors</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-primary" data-testid="text-pending-tutors">
                {pendingTutors.length}
              </div>
              <div className="text-sm text-muted-foreground">Pending Verification</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-primary" data-testid="text-total-sessions">
                {totalSessions}
              </div>
              <div className="text-sm text-muted-foreground">Total Sessions</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-primary" data-testid="text-completed-sessions">
                {completedSessions}
              </div>
              <div className="text-sm text-muted-foreground">Completed Sessions</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="tutors" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tutors" data-testid="tab-tutors">Tutors</TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending">Pending ({pendingTutors.length})</TabsTrigger>
            <TabsTrigger value="sessions" data-testid="tab-sessions">Sessions</TabsTrigger>
            <TabsTrigger value="subjects" data-testid="tab-subjects">Subjects</TabsTrigger>
          </TabsList>

          {/* Tutors Tab */}
          <TabsContent value="tutors">
            <Card>
              <CardHeader>
                <CardTitle>All Tutors</CardTitle>
                <div className="flex items-center space-x-4">
                  <Input
                    placeholder="Search tutors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                    data-testid="input-search-tutors"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {tutorsLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-16 bg-muted rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tutor</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTutors.map((tutor: any) => (
                        <TableRow key={tutor.id} data-testid={`row-tutor-${tutor.id}`}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <img
                                src={tutor.user.profileImageUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=50&h=50'}
                                alt={tutor.user.firstName}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                              <div>
                                <div className="font-medium">{tutor.user.firstName} {tutor.user.lastName}</div>
                                <div className="text-sm text-muted-foreground">
                                  {tutor.subjects.map((s: any) => s.name).join(', ')}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{tutor.user.email}</TableCell>
                          <TableCell>${tutor.hourlyRate}/hr</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <span>{parseFloat(tutor.totalRating || '0').toFixed(1)}</span>
                              <i className="fas fa-star text-yellow-400 text-sm"></i>
                              <span className="text-sm text-muted-foreground">({tutor.totalReviews})</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={tutor.isVerified ? "default" : "secondary"}>
                              {tutor.isVerified ? "Verified" : "Pending"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedUser(tutor);
                                  setShowUserModal(true);
                                }}
                                data-testid={`button-view-tutor-${tutor.id}`}
                              >
                                View
                              </Button>
                              {!tutor.isVerified && (
                                <Button
                                  size="sm"
                                  onClick={() => handleVerifyTutor(tutor.id)}
                                  disabled={verifyTutorMutation.isPending}
                                  data-testid={`button-verify-tutor-${tutor.id}`}
                                >
                                  Verify
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pending Tutors Tab */}
          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Pending Tutor Verifications</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingTutors.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <i className="fas fa-check-circle text-4xl mb-4"></i>
                    <p>No pending verifications</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingTutors.map((tutor: any) => (
                      <Card key={tutor.id} className="p-4" data-testid={`card-pending-tutor-${tutor.id}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <img
                              src={tutor.user.profileImageUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=60&h=60'}
                              alt={tutor.user.firstName}
                              className="w-15 h-15 rounded-full object-cover"
                            />
                            <div>
                              <h3 className="font-semibold">{tutor.user.firstName} {tutor.user.lastName}</h3>
                              <p className="text-sm text-muted-foreground">{tutor.user.email}</p>
                              <p className="text-sm">{tutor.bio?.substring(0, 100)}...</p>
                              <div className="flex items-center space-x-2 mt-2">
                                <Badge variant="outline">${tutor.hourlyRate}/hr</Badge>
                                <Badge variant="outline">{tutor.subjects.length} subjects</Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedUser(tutor);
                                setShowUserModal(true);
                              }}
                              data-testid={`button-review-tutor-${tutor.id}`}
                            >
                              Review
                            </Button>
                            <Button
                              onClick={() => handleVerifyTutor(tutor.id)}
                              disabled={verifyTutorMutation.isPending}
                              data-testid={`button-approve-tutor-${tutor.id}`}
                            >
                              Approve
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions">
            <Card>
              <CardHeader>
                <CardTitle>Recent Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                {sessions && sessions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Tutor</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.slice(0, 10).map((session: any) => (
                        <TableRow key={session.id}>
                          <TableCell>
                            {session.student.firstName} {session.student.lastName}
                          </TableCell>
                          <TableCell>
                            {session.tutor.user.firstName} {session.tutor.user.lastName}
                          </TableCell>
                          <TableCell>{session.subject.name}</TableCell>
                          <TableCell>
                            {new Date(session.scheduledAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              session.status === 'completed' ? 'default' :
                              session.status === 'scheduled' ? 'secondary' :
                              session.status === 'cancelled' ? 'destructive' : 'outline'
                            }>
                              {session.status}
                            </Badge>
                          </TableCell>
                          <TableCell>${session.price}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <i className="fas fa-calendar-times text-4xl mb-4"></i>
                    <p>No sessions found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subjects Tab */}
          <TabsContent value="subjects">
            <Card>
              <CardHeader>
                <CardTitle>Available Subjects</CardTitle>
              </CardHeader>
              <CardContent>
                {subjects && subjects.length > 0 ? (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {subjects.map((subject: any) => (
                      <Card key={subject.id} className="p-4">
                        <h3 className="font-semibold">{subject.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {subject.description}
                        </p>
                        {subject.category && (
                          <Badge variant="outline" className="mt-2">
                            {subject.category}
                          </Badge>
                        )}
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <i className="fas fa-book text-4xl mb-4"></i>
                    <p>No subjects found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* User Detail Modal */}
      <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tutor Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <img
                  src={selectedUser.user.profileImageUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100'}
                  alt={selectedUser.user.firstName}
                  className="w-20 h-20 rounded-full object-cover"
                />
                <div>
                  <h3 className="text-xl font-semibold">
                    {selectedUser.user.firstName} {selectedUser.user.lastName}
                  </h3>
                  <p className="text-muted-foreground">{selectedUser.user.email}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge variant={selectedUser.isVerified ? "default" : "secondary"}>
                      {selectedUser.isVerified ? "Verified" : "Pending"}
                    </Badge>
                    <Badge variant="outline">${selectedUser.hourlyRate}/hr</Badge>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">Bio</h4>
                  <p className="text-sm text-muted-foreground">{selectedUser.bio}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Experience</h4>
                  <p className="text-sm text-muted-foreground">{selectedUser.experience}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Education</h4>
                  <p className="text-sm text-muted-foreground">{selectedUser.education}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Subjects</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.subjects.map((subject: any) => (
                      <Badge key={subject.id} variant="outline">
                        {subject.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {!selectedUser.isVerified && (
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowUserModal(false)}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      handleVerifyTutor(selectedUser.id);
                      setShowUserModal(false);
                    }}
                    disabled={verifyTutorMutation.isPending}
                  >
                    Approve Tutor
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
