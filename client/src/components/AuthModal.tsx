import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Mail, Lock, User, X, Phone, GraduationCap, Briefcase, DollarSign, Globe } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const { toast } = useToast();
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Sign In Form State
  const [signInData, setSignInData] = useState({
    email: "",
    password: "",
  });
  
  // Sign Up Form State
  const [signUpData, setSignUpData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "student",
    // Tutor specific fields
    phone: "",
    education: "",
    experience: "",
    subjects: [],
    bio: "",
    hourlyRate: "",
    linkedinProfile: "",
    certifications: "",
  });

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      toast({
        title: "Welcome!",
        description: "You have been successfully signed in with Google.",
      });
      onClose();
    } catch (error: any) {
      console.error("Google sign in error:", error);
      let errorMessage = "Failed to sign in with Google. Please try again.";
      
      if (error.code === "auth/unauthorized-domain") {
        errorMessage = "This domain is not authorized for Google sign-in. Please contact support or try email sign-in.";
      } else if (error.code === "auth/popup-closed-by-user") {
        errorMessage = "Sign-in was cancelled. Please try again.";
      }
      
      toast({
        title: "Sign in failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInData.email || !signInData.password) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await signInWithEmail(signInData.email, signInData.password);
      toast({
        title: "Welcome back!",
        description: "You have been successfully signed in.",
      });
      onClose();
    } catch (error: any) {
      console.error("Email sign in error:", error);
      let errorMessage = "Invalid email or password.";
      
      if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email address.";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Incorrect password.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      }
      
      toast({
        title: "Sign in failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!signUpData.firstName || !signUpData.lastName || !signUpData.email || !signUpData.password) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Tutor-specific validation
    if (signUpData.role === "tutor") {
      if (!signUpData.phone || !signUpData.education || !signUpData.experience || !signUpData.bio || !signUpData.hourlyRate) {
        toast({
          title: "Missing tutor information",
          description: "Please fill in all tutor fields for verification.",
          variant: "destructive",
        });
        return;
      }
      
      if (signUpData.bio.length < 50) {
        toast({
          title: "Bio too short",
          description: "Please provide a detailed bio (at least 50 characters) for verification.",
          variant: "destructive",
        });
        return;
      }
    }

    if (signUpData.password !== signUpData.confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    if (signUpData.password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await signUpWithEmail(signUpData.email, signUpData.password, signUpData.firstName, signUpData.lastName, signUpData.role, signUpData);
      toast({
        title: signUpData.role === "tutor" ? "Tutor application submitted!" : "Welcome to TutorConnect!",
        description: signUpData.role === "tutor" 
          ? "Your tutor application has been submitted for review. You can sign in once approved."
          : "Your account has been created successfully.",
      });
      onClose();
    } catch (error: any) {
      console.error("Email sign up error:", error);
      let errorMessage = "Failed to create account. Please try again.";
      
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "An account with this email already exists.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password is too weak. Please choose a stronger password.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      }
      
      toast({
        title: "Sign up failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="modal-auth">
        <DialogHeader>
          <DialogTitle>Welcome to TutorConnect</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin" data-testid="tab-signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup" data-testid="tab-signup">Sign Up</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signin" className="space-y-4">
            <div className="text-center space-y-4">
              <Button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full"
                variant="outline"
                data-testid="button-google-signin"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="Enter your email"
                    value={signInData.email}
                    onChange={(e) => setSignInData(prev => ({ ...prev, email: e.target.value }))}
                    className="pl-10"
                    data-testid="input-signin-email"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signin-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={signInData.password}
                    onChange={(e) => setSignInData(prev => ({ ...prev, password: e.target.value }))}
                    className="pl-10 pr-10"
                    data-testid="input-signin-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full"
                data-testid="button-signin-submit"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="signup" className="space-y-4">
            <div className="text-center space-y-4">
              <Button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full"
                variant="outline"
                data-testid="button-google-signup"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleEmailSignUp} className="space-y-4">
              {/* Role Selection */}
              <div className="space-y-3">
                <Label>I want to join as:</Label>
                <RadioGroup
                  value={signUpData.role}
                  onValueChange={(value) => setSignUpData(prev => ({ ...prev, role: value }))}
                  className="flex space-x-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="student" id="role-student" data-testid="radio-student" />
                    <Label htmlFor="role-student" className="cursor-pointer">Student - Find a tutor</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="tutor" id="role-tutor" data-testid="radio-tutor" />
                    <Label htmlFor="role-tutor" className="cursor-pointer">Tutor - Teach students</Label>
                  </div>
                </RadioGroup>
              </div>
              
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-firstname">First Name *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-firstname"
                      type="text"
                      placeholder="First name"
                      value={signUpData.firstName}
                      onChange={(e) => setSignUpData(prev => ({ ...prev, firstName: e.target.value }))}
                      className="pl-10"
                      data-testid="input-signup-firstname"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-lastname">Last Name *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-lastname"
                      type="text"
                      placeholder="Last name"
                      value={signUpData.lastName}
                      onChange={(e) => setSignUpData(prev => ({ ...prev, lastName: e.target.value }))}
                      className="pl-10"
                      data-testid="input-signup-lastname"
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="Enter your email"
                    value={signUpData.email}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, email: e.target.value }))}
                    className="pl-10"
                    data-testid="input-signup-email"
                  />
                </div>
              </div>
              
              {/* Tutor-specific fields */}
              {signUpData.role === "tutor" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="signup-phone">Phone Number *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-phone"
                        type="tel"
                        placeholder="Enter your phone number"
                        value={signUpData.phone}
                        onChange={(e) => setSignUpData(prev => ({ ...prev, phone: e.target.value }))}
                        className="pl-10"
                        data-testid="input-signup-phone"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-education">Education Background *</Label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-education"
                        type="text"
                        placeholder="e.g., Master's in Mathematics, University of XYZ"
                        value={signUpData.education}
                        onChange={(e) => setSignUpData(prev => ({ ...prev, education: e.target.value }))}
                        className="pl-10"
                        data-testid="input-signup-education"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-experience">Teaching Experience *</Label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-experience"
                        type="text"
                        placeholder="e.g., 5 years teaching high school mathematics"
                        value={signUpData.experience}
                        onChange={(e) => setSignUpData(prev => ({ ...prev, experience: e.target.value }))}
                        className="pl-10"
                        data-testid="input-signup-experience"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-rate">Hourly Rate ($) *</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-rate"
                          type="number"
                          placeholder="25"
                          value={signUpData.hourlyRate}
                          onChange={(e) => setSignUpData(prev => ({ ...prev, hourlyRate: e.target.value }))}
                          className="pl-10"
                          data-testid="input-signup-rate"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="signup-linkedin">LinkedIn Profile (Optional)</Label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-linkedin"
                          type="url"
                          placeholder="linkedin.com/in/yourprofile"
                          value={signUpData.linkedinProfile}
                          onChange={(e) => setSignUpData(prev => ({ ...prev, linkedinProfile: e.target.value }))}
                          className="pl-10"
                          data-testid="input-signup-linkedin"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-bio">Professional Bio * (min 50 characters)</Label>
                    <Textarea
                      id="signup-bio"
                      placeholder="Tell us about yourself, your teaching philosophy, and what makes you a great tutor..."
                      value={signUpData.bio}
                      onChange={(e) => setSignUpData(prev => ({ ...prev, bio: e.target.value }))}
                      className="min-h-[100px]"
                      data-testid="input-signup-bio"
                    />
                    <p className="text-xs text-muted-foreground">{signUpData.bio.length}/50 characters minimum</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-certifications">Certifications (Optional)</Label>
                    <Textarea
                      id="signup-certifications"
                      placeholder="List any relevant certifications, licenses, or awards..."
                      value={signUpData.certifications}
                      onChange={(e) => setSignUpData(prev => ({ ...prev, certifications: e.target.value }))}
                      className="min-h-[60px]"
                      data-testid="input-signup-certifications"
                    />
                  </div>
                </>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
                    value={signUpData.password}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, password: e.target.value }))}
                    className="pl-10 pr-10"
                    data-testid="input-signup-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-confirm">Confirm Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-confirm"
                    type="password"
                    placeholder="Confirm your password"
                    value={signUpData.confirmPassword}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="pl-10"
                    data-testid="input-signup-confirm"
                  />
                </div>
              </div>
              
              {signUpData.role === "tutor" && (
                <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-700">
                  <p><strong>Note:</strong> Tutor applications require manual verification. You'll receive an email once your application is reviewed and approved.</p>
                </div>
              )}
              
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full"
                data-testid="button-signup-submit"
              >
                {isLoading ? "Creating account..." : signUpData.role === "tutor" ? "Submit Tutor Application" : "Create Account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}