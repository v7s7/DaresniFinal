import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { BookOpen, GraduationCap, CheckCircle, Phone, DollarSign, Award, FileText, User } from "lucide-react";
import type { Subject } from "@shared/schema";

export default function CompleteSignup() {
  const { user, refreshUserData } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedRole, setSelectedRole] = useState<"student" | "tutor" | "admin" | "">("");
  const [formData, setFormData] = useState({
    // Student fields (minimal)
    studentData: {},
    
    // Tutor fields (extensive)
    tutorData: {
      phone: "",
      bio: "",
      hourlyRate: "",
      experience: "",
      education: "",
      certifications: "",
      subjects: [] as string[],
    }
  });

  // Fetch subjects for tutor role
  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
  });

  // Unified signup mutation
  const completeSignupMutation = useMutation({
    mutationFn: async (data: { role: "student" | "tutor" | "admin"; profileData?: any }) => {
      // First, set the role
      await apiRequest("/api/auth/choose-role", {
        method: "POST",
        body: JSON.stringify({ role: data.role }),
      });

      // If tutor, also create the complete profile
      if (data.role === "tutor" && data.profileData) {
        return await apiRequest("/api/tutors/profile", {
          method: "POST",
          body: JSON.stringify(data.profileData),
        });
      }

      return { success: true };
    },
    onSuccess: async () => {
      // Refresh user data directly from auth context
      await refreshUserData();
      // Small delay to ensure auth context updates
      setTimeout(() => {
        setLocation("/");
      }, 300);
      
      toast({
        title: "Welcome to Daresni!",
        description: selectedRole === "tutor" 
          ? "Your tutor profile has been submitted for review. You'll be notified once verified."
          : selectedRole === "admin"
          ? "You now have admin access. You can manage tutors and monitor the platform."
          : "Start browsing tutors and book your first session!",
      });
    },
    onError: (error) => {
      console.error("Failed to complete signup:", error);
      toast({
        title: "Error",
        description: "Failed to complete signup. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedRole) {
      toast({
        title: "Please select a role",
        description: "Choose whether you want to be a student or tutor.",
        variant: "destructive",
      });
      return;
    }

    if (selectedRole === "tutor") {
      // Validate tutor fields
      const tutorData = formData.tutorData;
      if (!tutorData.phone || !tutorData.bio || !tutorData.hourlyRate || !tutorData.experience || !tutorData.education) {
        toast({
          title: "Missing information",
          description: "Please fill in all required fields.",
          variant: "destructive",
        });
        return;
      }

      if (tutorData.bio.length < 50) {
        toast({
          title: "Bio too short",
          description: "Please provide a detailed bio (at least 50 characters).",
          variant: "destructive",
        });
        return;
      }

      if (tutorData.subjects.length === 0) {
        toast({
          title: "No subjects selected",
          description: "Please select at least one subject you can teach.",
          variant: "destructive",
        });
        return;
      }

      // Convert data types for validation
      const processedTutorData = {
        ...tutorData,
        hourlyRate: parseFloat(tutorData.hourlyRate) || 0,
        certifications: tutorData.certifications ? tutorData.certifications.split(',').map(c => c.trim()).filter(c => c) : []
      };
      
      completeSignupMutation.mutate({ 
        role: selectedRole, 
        profileData: processedTutorData 
      });
    } else {
      // Student or Admin signup (just role selection)
      completeSignupMutation.mutate({ role: selectedRole });
    }
  };

  const handleSubjectChange = (subjectId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      tutorData: {
        ...prev.tutorData,
        subjects: checked 
          ? [...prev.tutorData.subjects, subjectId]
          : prev.tutorData.subjects.filter(id => id !== subjectId)
      }
    }));
  };

  const updateTutorField = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      tutorData: {
        ...prev.tutorData,
        [field]: value
      }
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white p-4">
      <div className="max-w-4xl mx-auto py-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-[#9B1B30]">
              Complete Your Daresni Profile
            </CardTitle>
            <CardDescription className="text-lg">
              Tell us about yourself to get started on our platform
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Role Selection */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">How would you like to use Daresni?</h3>
                
                <RadioGroup
                  value={selectedRole}
                  onValueChange={(value) => setSelectedRole(value as "student" | "tutor" | "admin")}
                  className="space-y-4"
                >
                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                    <RadioGroupItem value="student" id="student" data-testid="radio-student" />
                    <Label htmlFor="student" className="flex-1 cursor-pointer">
                      <div className="flex items-start space-x-3">
                        <BookOpen className="h-6 w-6 text-blue-600 mt-1" />
                        <div>
                          <h4 className="font-semibold text-lg">I'm a Student</h4>
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
                    <RadioGroupItem value="tutor" id="tutor" data-testid="radio-tutor" />
                    <Label htmlFor="tutor" className="flex-1 cursor-pointer">
                      <div className="flex items-start space-x-3">
                        <GraduationCap className="h-6 w-6 text-[#9B1B30] mt-1" />
                        <div>
                          <h4 className="font-semibold text-lg">I'm a Tutor</h4>
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
                              <span>Build reputation</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                    <RadioGroupItem value="admin" id="admin" data-testid="radio-admin" />
                    <Label htmlFor="admin" className="flex-1 cursor-pointer">
                      <div className="flex items-start space-x-3">
                        <User className="h-6 w-6 text-purple-600 mt-1" />
                        <div>
                          <h4 className="font-semibold text-lg">I'm an Admin</h4>
                          <p className="text-muted-foreground">
                            I want to manage the platform, verify tutors, and monitor system activity.
                          </p>
                          <div className="mt-2 flex items-center space-x-4 text-sm text-muted-foreground">
                            <span className="flex items-center space-x-1">
                              <CheckCircle className="h-4 w-4" />
                              <span>Verify tutors</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <CheckCircle className="h-4 w-4" />
                              <span>Monitor platform</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <CheckCircle className="h-4 w-4" />
                              <span>Manage users</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Tutor-specific fields (shown only when tutor is selected) */}
              {selectedRole === "tutor" && (
                <>
                  {/* Contact Information */}
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Contact Information</h3>
                    
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number *</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="+1 (555) 123-4567"
                          value={formData.tutorData.phone}
                          onChange={(e) => updateTutorField("phone", e.target.value)}
                          className="pl-10"
                          data-testid="input-phone"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Teaching Information */}
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Teaching Information</h3>
                    
                    <div className="space-y-2">
                      <Label htmlFor="bio">Tell us about yourself *</Label>
                      <Textarea
                        id="bio"
                        placeholder="Describe your teaching experience, approach, and what makes you a great tutor..."
                        value={formData.tutorData.bio}
                        onChange={(e) => updateTutorField("bio", e.target.value)}
                        className="min-h-32"
                        data-testid="textarea-bio"
                        required
                      />
                      <p className="text-sm text-muted-foreground">
                        {formData.tutorData.bio.length}/50 characters minimum
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="hourlyRate">Hourly Rate (USD) *</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="hourlyRate"
                          type="number"
                          placeholder="25"
                          value={formData.tutorData.hourlyRate}
                          onChange={(e) => updateTutorField("hourlyRate", e.target.value)}
                          className="pl-10"
                          data-testid="input-hourly-rate"
                          min="1"
                          max="500"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Experience & Education */}
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Background</h3>
                    
                    <div className="space-y-2">
                      <Label htmlFor="experience">Teaching Experience *</Label>
                      <div className="relative">
                        <Award className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Textarea
                          id="experience"
                          placeholder="Describe your teaching experience, years of tutoring, previous roles..."
                          value={formData.tutorData.experience}
                          onChange={(e) => updateTutorField("experience", e.target.value)}
                          className="pl-10 min-h-24"
                          data-testid="textarea-experience"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="education">Education Background *</Label>
                      <div className="relative">
                        <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Textarea
                          id="education"
                          placeholder="Your degree, university, relevant coursework..."
                          value={formData.tutorData.education}
                          onChange={(e) => updateTutorField("education", e.target.value)}
                          className="pl-10 min-h-24"
                          data-testid="textarea-education"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="certifications">Certifications (Optional)</Label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Textarea
                          id="certifications"
                          placeholder="Teaching certifications, professional credentials, awards..."
                          value={formData.tutorData.certifications}
                          onChange={(e) => updateTutorField("certifications", e.target.value)}
                          className="pl-10 min-h-20"
                          data-testid="textarea-certifications"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Subject Selection */}
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Subjects You Can Teach *</h3>
                    <p className="text-muted-foreground">Select all subjects you're qualified to teach</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {subjects.map((subject) => (
                        <div key={subject.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                          <Checkbox
                            id={subject.id}
                            checked={formData.tutorData.subjects.includes(subject.id)}
                            onCheckedChange={(checked) => handleSubjectChange(subject.id, !!checked)}
                            data-testid={`checkbox-subject-${subject.id}`}
                          />
                          <Label htmlFor={subject.id} className="flex-1 cursor-pointer">
                            <div className="font-medium">{subject.name}</div>
                            <div className="text-sm text-muted-foreground">{subject.description}</div>
                            <Badge variant="secondary" className="mt-1 text-xs">
                              {subject.category}
                            </Badge>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Submit Button */}
              <div className="pt-6">
                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full bg-[#9B1B30] hover:bg-[#7a1625]"
                  disabled={!selectedRole || completeSignupMutation.isPending}
                  data-testid="button-complete-signup"
                >
                  {completeSignupMutation.isPending ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Setting up your account...</span>
                    </div>
                  ) : selectedRole === "tutor" ? (
                    "Complete Tutor Profile"
                  ) : selectedRole === "admin" ? (
                    "Create Admin Account"
                  ) : selectedRole === "student" ? (
                    "Start Learning"
                  ) : (
                    "Continue"
                  )}
                </Button>
                
                {selectedRole === "tutor" && (
                  <p className="text-center text-sm text-muted-foreground mt-3">
                    Your profile will be reviewed by our administrators before you can start tutoring.
                  </p>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}