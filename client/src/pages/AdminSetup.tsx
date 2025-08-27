import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Shield, UserCheck } from "lucide-react";

export default function AdminSetup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSetup, setIsSetup] = useState(false);

  const setupAdminMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/setup", {});
    },
    onSuccess: () => {
      setIsSetup(true);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Success!",
        description: "Admin access has been granted. Please refresh the page to see the admin dashboard.",
      });
      // Refresh the page to update the user role
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (user?.role === 'admin') {
    return (
      <div className="min-h-screen bg-background pt-16">
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-green-500" />
                Admin Access Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                You already have admin access! You can now manage tutors, verify applications, and oversee platform operations.
              </p>
              <Button 
                onClick={() => window.location.href = '/'}
                className="w-full"
                data-testid="button-go-to-dashboard"
              >
                Go to Admin Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isSetup) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-green-500" />
                Admin Setup Complete
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Admin access granted successfully! Please refresh the page to access the admin dashboard.
              </p>
              <Button 
                onClick={() => window.location.reload()}
                className="w-full"
                data-testid="button-refresh-page"
              >
                Refresh Page
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Admin Setup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                To access the admin dashboard and verify tutors, you need admin privileges. Click the button below to grant yourself admin access.
              </p>
              
              <div className="bg-muted p-4 rounded-md">
                <h4 className="font-semibold mb-2">Admin Features:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• View and verify pending tutor applications</li>
                  <li>• Manage all tutors and students</li>
                  <li>• Monitor platform sessions and activities</li>
                  <li>• Oversee subjects and platform content</li>
                </ul>
              </div>

              <Button 
                onClick={() => setupAdminMutation.mutate()}
                disabled={setupAdminMutation.isPending}
                className="w-full"
                data-testid="button-setup-admin"
              >
                {setupAdminMutation.isPending ? "Setting up..." : "Grant Admin Access"}
              </Button>
              
              {user && (
                <div className="text-xs text-muted-foreground text-center">
                  Current user: {user.email} ({user.role})
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}