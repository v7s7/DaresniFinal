import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import StudentDashboard from "@/pages/StudentDashboard";
import TutorDashboard from "@/pages/TutorDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import TutorBrowse from "@/pages/TutorBrowse";
import TutorProfile from "@/pages/TutorProfile";
import CompleteSignup from "@/pages/CompleteSignup";
import AdminSetup from "@/pages/AdminSetup";
import Navbar from "@/components/Navbar";

function Router() {
  const { firebaseUser, user, isLoading } = useAuth();
  const isAuthenticated = !!firebaseUser;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {isAuthenticated && <Navbar />}
      <Switch>
        {!isAuthenticated ? (
          <Route path="/" component={Landing} />
        ) : !user ? (
          // User is authenticated but not in database yet - redirect to unified signup
          <Route path="/" component={CompleteSignup} />
        ) : user && !user.role ? (
          // User exists but hasn't chosen role - show unified signup on any route
          <Route path="*" component={CompleteSignup} />
        ) : (
          <>
            {/* Unified signup route */}
            <Route path="/complete-signup" component={CompleteSignup} />
            
            {/* Main dashboard routes */}
            <Route path="/" component={() => {
              if (user?.role === 'admin') return <AdminDashboard />;
              if (user?.role === 'tutor') return <TutorDashboard />;
              return <StudentDashboard />;
            }} />
            <Route path="/tutors" component={TutorBrowse} />
            <Route path="/tutor/:id" component={TutorProfile} />
            <Route path="/profile" component={() => {
              if (user?.role === 'tutor') return <TutorDashboard />;
              return <StudentDashboard />;
            }} />
            <Route path="/sessions" component={() => {
              if (user?.role === 'tutor') return <TutorDashboard />;
              return <StudentDashboard />;
            }} />
            <Route path="/messages" component={() => {
              if (user?.role === 'tutor') return <TutorDashboard />;
              return <StudentDashboard />;
            }} />
          </>
        )}
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
