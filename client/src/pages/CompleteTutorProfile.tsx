// client/src/pages/CompleteTutorProfile.tsx
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

// NEW: Load subjects from Firestore instead of API
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

interface Subject {
  id: string;
  name: string;
  category?: string;
  description?: string;
}

interface TutorProfileShape {
  id: string;
  isVerified?: boolean;
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

  // 1) If tutor profile exists, route accordingly
  const { data: existingProfile, isLoading: profileLoading } = useQuery<TutorProfileShape>({
    queryKey: ["/api/tutors/profile"],
    queryFn: async () => {
      const res = await apiRequest("/api/tutors/profile");
      if (res.status === 404) return null as unknown as TutorProfileShape;
      if (!res.ok) throw new Error("Failed to load tutor profile");
      return res.json();
    },
    staleTime: 5000,
  });

  useEffect(() => {
    if (!profileLoading) {
      if (existingProfile && existingProfile.id) {
        if (existingProfile.isVerified) {
          setLocation("/"); // TutorDashboard via router
        } else {
          setLocation("/pending-approval");
        }
      }
    }
  }, [existingProfile, profileLoading, setLocation]);

  // 2) Subjects — from Firestore
  const {
    data: subjects = [],
    isLoading: subjectsLoading,
    error: subjectsError,
  } = useQuery<Subject[]>({
    queryKey: ["firestore", "subjects"],
    staleTime: 60_000,
    queryFn: async () => {
      const q = query(collection(db, "subjects"), orderBy("name", "asc"));
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name ?? "",
          category: data.category ?? "",
          description: data.description ?? "",
        } as Subject;
      });
    },
  });

  // 3) Submit (set role + create/overwrite profile)
  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      // Ensure role=tutor (safe if already tutor)
      await apiRequest("/api/auth/choose-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "tutor" }),
      });

      const payload = {
        phone: formData.phone.trim(),
        bio: formData.bio.trim(),
        hourlyRate: Number(formData.hourlyRate) || 0,
        experience: formData.experience.trim(),
        education: formData.education.trim(),
        certifications: formData.certifications
          ? formData.certifications.split(",").map((c) => c.trim()).filter(Boolean)
          : [],
        subjects: formData.subjects,
        // initial verification status
        isVerified: false,
        isActive: false,
        verificationStatus: "pending",
      };

      const res = await apiRequest("/api/tutors/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error || e?.message || "Failed to save profile");
      }
      return res.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/me"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/tutors/profile"] }),
      ]);
      toast({
        title: "Profile submitted",
        description: "Your profile is under review. We'll notify you when approved.",
      });
      setLocation("/pending-approval");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: String(error?.message || "Failed to save profile"),
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
    if (formData.bio.trim().length < 50) {
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

    updateProfileMutation.mutate();
  };

  const handleSubjectChange = (subjectId: string, checked: boolean | "indeterminate") => {
    const isChecked = checked === true;
    setFormData((prev) => ({
      ...prev,
      subjects: isChecked ? [...prev.subjects, subjectId] : prev.subjects.filter((id) => id !== subjectId),
    }));
  };

  if (profileLoading || subjectsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary" />
      </div>
    );
  }

  if (subjectsError) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">
        Failed to load subjects from Firestore.
      </div>
    );
  }

  // If profile exists, the effect above will redirect. Render nothing.
  if (existingProfile && existingProfile.id) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white p-4">
      <div className="max-w-4xl mx-auto py-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-[#9B1B30]">Complete Your Tutor Profile</CardTitle>
            <CardDescription className="text-lg">
              Tell us about your teaching experience and expertise. This helps students find you.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
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
                      placeholder="Enter your phone number"
                      value={formData.phone}
                      onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                      className="pl-10"
                      data-testid="input-phone"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Teaching Background */}
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
                      onChange={(e) => setFormData((p) => ({ ...p, education: e.target.value }))}
                      className="pl-10"
                      data-testid="input-education"
                      required
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
                      onChange={(e) => setFormData((p) => ({ ...p, experience: e.target.value }))}
                      className="pl-10"
                      data-testid="input-experience"
                      required
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
                      onChange={(e) => setFormData((p) => ({ ...p, hourlyRate: e.target.value }))}
                      className="pl-10"
                      data-testid="input-hourlyRate"
                      min={1}
                      max={500}
                      step="1"
                      required
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
                        onCheckedChange={(checked) => handleSubjectChange(subject.id, checked)}
                        data-testid={`checkbox-subject-${subject.id}`}
                      />
                      <Label htmlFor={subject.id} className="text-sm cursor-pointer">
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
                      placeholder="Share your teaching philosophy, experience, expertise, and approach."
                      value={formData.bio}
                      onChange={(e) => setFormData((p) => ({ ...p, bio: e.target.value }))}
                      className="min-h-[120px] pl-10"
                      data-testid="textarea-bio"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{formData.bio.length}/50 characters minimum</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="certifications">Certifications & Awards (Optional)</Label>
                  <div className="relative">
                    <Award className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea
                      id="certifications"
                      placeholder="Comma-separated list (e.g., TEFL, PMP, Award XYZ)"
                      value={formData.certifications}
                      onChange={(e) => setFormData((p) => ({ ...p, certifications: e.target.value }))}
                      className="min-h-[80px] pl-10"
                      data-testid="textarea-certifications"
                    />
                  </div>
                </div>
              </div>

              {/* Review notice */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Note:</strong> Your profile will be reviewed. Once approved, you’ll be redirected to your
                  dashboard automatically.
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
