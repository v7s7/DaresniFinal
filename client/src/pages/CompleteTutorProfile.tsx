import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/components/AuthProvider";
import { Phone, GraduationCap, Briefcase, DollarSign, FileText, Award } from "lucide-react";

interface Subject {
  id: string;
  name: string;
  category: string;
}

export default function CompleteTutorProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    phone: "",
    bio: "",
    hourlyRate: "",
    experience: "",
    education: "",
    certifications: "",
    subjects: [] as string[],
  });

  // Fetch subjects
  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
  });

  // Pre-fill form with user data
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        // You could pre-fill other fields from user profile if available
      }));
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("/api/tutors/profile", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutors/profile"] });
      
      setLocation("/");
      toast({
        title: "Profile completed!",
        description: "Your tutor profile has been submitted for review. You'll be notified once verified.",
      });
    },
    onError: (error) => {
      console.error("Failed to update profile:", error);
      toast({
        title: "Error",
        description: "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.phone || !formData.bio || !formData.hourlyRate || !formData.experience || !formData.education) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (formData.bio.length < 50) {
      toast({
        title: "Bio too short",
        description: "Please provide a detailed bio (at least 50 characters).",
        variant: "destructive",
      });
      return;
    }

    if (formData.subjects.length === 0) {
      toast({
        title: "No subjects selected",
        description: "Please select at least one subject you can teach.",
        variant: "destructive",
      });
      return;
    }

    updateProfileMutation.mutate(formData);
  };

  const handleSubjectChange = (subjectId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      subjects: checked 
        ? [...prev.subjects, subjectId]
        : prev.subjects.filter(id => id !== subjectId)
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white p-4">
      <div className="max-w-4xl mx-auto py-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-[#9B1B30]">
              Complete Your Tutor Profile
            </CardTitle>
            <CardDescription className="text-lg">
              Tell us about your teaching experience and expertise. This information helps students find the right tutor for their needs.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Contact Information</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Enter your phone number"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="pl-10"
                      data-testid="input-phone"
                    />
                  </div>
                </div>
              </div>

              {/* Teaching Information */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Teaching Background</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="education">Education Background *</Label>
                  <div className="relative">
                    <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="education"
                      type="text"
                      placeholder="e.g., Master's in Mathematics, University of XYZ"
                      value={formData.education}
                      onChange={(e) => setFormData(prev => ({ ...prev, education: e.target.value }))}
                      className="pl-10"
                      data-testid="input-education"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="experience">Teaching Experience *</Label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="experience"
                      type="text"
                      placeholder="e.g., 5 years teaching high school mathematics"
                      value={formData.experience}
                      onChange={(e) => setFormData(prev => ({ ...prev, experience: e.target.value }))}
                      className="pl-10"
                      data-testid="input-experience"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hourlyRate">Hourly Rate (USD) *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="hourlyRate"
                      type="number"
                      placeholder="25"
                      value={formData.hourlyRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, hourlyRate: e.target.value }))}
                      className="pl-10"
                      data-testid="input-hourlyRate"
                    />
                  </div>
                </div>
              </div>

              {/* Subjects */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Subjects I Can Teach *</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {subjects.map((subject) => (
                    <div key={subject.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={subject.id}
                        checked={formData.subjects.includes(subject.id)}
                        onCheckedChange={(checked) => handleSubjectChange(subject.id, checked as boolean)}
                        data-testid={`checkbox-subject-${subject.id}`}
                      />
                      <Label 
                        htmlFor={subject.id} 
                        className="text-sm cursor-pointer"
                      >
                        {subject.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">About Me</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="bio">Professional Bio * (minimum 50 characters)</Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea
                      id="bio"
                      placeholder="Tell students about your teaching philosophy, experience, and what makes you a great tutor. Be specific about your expertise and approach."
                      value={formData.bio}
                      onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                      className="min-h-[120px] pl-10"
                      data-testid="textarea-bio"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formData.bio.length}/50 characters minimum
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="certifications">Certifications & Awards (Optional)</Label>
                  <div className="relative">
                    <Award className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea
                      id="certifications"
                      placeholder="List any relevant certifications, licenses, awards, or additional qualifications..."
                      value={formData.certifications}
                      onChange={(e) => setFormData(prev => ({ ...prev, certifications: e.target.value }))}
                      className="min-h-[80px] pl-10"
                      data-testid="textarea-certifications"
                    />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Note:</strong> Your profile will be reviewed by our team for verification. 
                  Once approved, you'll be able to accept students and start teaching. 
                  This typically takes 1-2 business days.
                </p>
              </div>

              <Button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="w-full py-3 text-lg"
                data-testid="button-submit-profile"
              >
                {updateProfileMutation.isPending ? "Submitting for review..." : "Submit Profile for Review"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}