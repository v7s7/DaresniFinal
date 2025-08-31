import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { GraduationCap, BookOpen, Users, CheckCircle } from "lucide-react";

export default function ChooseRole() {
  const [selectedRole, setSelectedRole] = useState<"student" | "tutor">("student");
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const chooseRoleMutation = useMutation({
    mutationFn: async (role: "student" | "tutor") => {
      return apiRequest("/api/auth/choose-role", {
        method: "POST",
        body: JSON.stringify({ role }),
      });
    },
    onSuccess: () => {
      // Invalidate user data to get fresh role
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      
      if (selectedRole === "tutor") {
        // Redirect to tutor profile completion
        setLocation("/tutor/complete-profile");
      } else {
        // Redirect to student dashboard
        setLocation("/");
      }
      
      toast({
        title: "Role selected!",
        description: selectedRole === "tutor" 
          ? "Please complete your tutor profile to get started."
          : "Welcome to Daresni! Start browsing tutors.",
      });
    },
    onError: (error) => {
      console.error("Failed to choose role:", error);
      toast({
        title: "Error",
        description: "Failed to set role. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleContinue = () => {
    chooseRoleMutation.mutate(selectedRole);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-[#9B1B30]">
            Welcome to Daresni!
          </CardTitle>
          <CardDescription className="text-lg">
            How would you like to use our platform?
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <RadioGroup
            value={selectedRole}
            onValueChange={(value) => setSelectedRole(value as "student" | "tutor")}
            className="space-y-4"
          >
            <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-slate-50 transition-colors">
              <RadioGroupItem value="student" id="student" />
              <Label htmlFor="student" className="flex-1 cursor-pointer">
                <div className="flex items-start space-x-3">
                  <BookOpen className="h-6 w-6 text-blue-600 mt-1" />
                  <div>
                    <h3 className="font-semibold text-lg">I'm a Student</h3>
                    <p className="text-muted-foreground">
                      I want to find qualified tutors to help me learn new subjects or improve my grades.
                    </p>
                    <div className="mt-2 flex items-center space-x-4 text-sm text-muted-foreground">
                      <span className="flex items-center space-x-1">
                        <CheckCircle className="h-4 w-4" />
                        <span>Browse verified tutors</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <CheckCircle className="h-4 w-4" />
                        <span>Schedule sessions</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <CheckCircle className="h-4 w-4" />
                        <span>Track progress</span>
                      </span>
                    </div>
                  </div>
                </div>
              </Label>
            </div>
            
            <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-slate-50 transition-colors">
              <RadioGroupItem value="tutor" id="tutor" />
              <Label htmlFor="tutor" className="flex-1 cursor-pointer">
                <div className="flex items-start space-x-3">
                  <GraduationCap className="h-6 w-6 text-[#9B1B30] mt-1" />
                  <div>
                    <h3 className="font-semibold text-lg">I'm a Tutor</h3>
                    <p className="text-muted-foreground">
                      I want to share my knowledge and help students achieve their learning goals.
                    </p>
                    <div className="mt-2 flex items-center space-x-4 text-sm text-muted-foreground">
                      <span className="flex items-center space-x-1">
                        <CheckCircle className="h-4 w-4" />
                        <span>Earn money teaching</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <CheckCircle className="h-4 w-4" />
                        <span>Flexible schedule</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <CheckCircle className="h-4 w-4" />
                        <span>Help students succeed</span>
                      </span>
                    </div>
                  </div>
                </div>
              </Label>
            </div>
          </RadioGroup>
          
          {selectedRole === "tutor" && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-start space-x-3">
                <Users className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900">Next steps for tutors:</p>
                  <p className="text-blue-700">
                    You'll complete your profile with teaching experience, subjects, and rates. 
                    After admin verification, you can start accepting students.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <Button
            onClick={handleContinue}
            disabled={chooseRoleMutation.isPending}
            className="w-full py-3 text-lg"
            data-testid="button-continue"
          >
            {chooseRoleMutation.isPending ? "Setting up your account..." : "Continue"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}