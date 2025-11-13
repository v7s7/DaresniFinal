// client/src/App.tsx
import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";

import { queryClient } from "./lib/queryClient";
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
import CompleteTutorProfile from "@/pages/CompleteTutorProfile";
import AdminSetup from "@/pages/AdminSetup";
import MySessions from "@/pages/MySessions";
import ProfileSettings from "@/pages/ProfileSettings";
import PendingApproval from "@/pages/PendingApproval";
import NotificationsPage from "@/pages/NotificationsPage";
import Navbar from "@/components/Navbar";

/** Small helper to support legacy /dashboard -> / */
function DashboardAlias() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/", { replace: true });
  }, [navigate]);
  return null;
}

/** Narrow DTO so TS stops complaining when we probe fields */
type TutorProfileDTO =
  | {
      isVerified?: boolean;
      verificationStatus?: "pending" | "approved" | "rejected" | string;
      __approved?: boolean;
    }
  | null;

/**
 * AuthRouteGate:
 * Redirects only from entry/wrong pages.
 * It will NOT override user navigation to allowed pages (e.g., /tutors).
 */
function AuthRouteGate() {
  const { user, isLoading } = useAuth();
  const [location, navigate] = useLocation();

  // Load tutor profile only when role=tutor
  const { data: tutorProfile, isLoading: tpLoading } = useQuery<TutorProfileDTO>({
    queryKey: ["/api/tutors/profile"],
    enabled: !!user && user.role === "tutor",
    retry: false,
    staleTime: 0,
  });

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;

    const path = location;

    // Helpers
    const at = (p: string) => path === p;
    const inEntry = at("/") || at("/dashboard") || at("/complete-signup");
    const onTutorArea = path.startsWith("/tutor-");
    const onStudentArea = path.startsWith("/student-");
    const onBrowseOrPublic =
      path.startsWith("/tutors") ||
      at("/profile-settings") ||
      at("/my-sessions") ||
      at("/notifications") ||  // Allow notifications for all users
      at("/admin") ||
      at("/admin-setup") ||
      path.startsWith("/tutor-profile"); // compatibility

    // --- Student routing ---
    if (user.role === "student") {
      // If coming from entry/wrong pages, push to student dashboard
      if (
        inEntry ||
        at("/tutor-dashboard") ||
        at("/pending-approval") ||
        at("/complete-tutor-profile")
      ) {
        if (!at("/student-dashboard")) {
          navigate("/student-dashboard", { replace: true });
        }
        return;
      }
      // Otherwise allow navigation (e.g., /tutors, /profile-settings, /notifications, etc.)
      return;
    }

    // --- Tutor routing ---
    if (user.role === "tutor") {
      if (tpLoading) return;

      // No profile yet -> force to complete profile (except when already there)
      if (!tutorProfile) {
        if (!at("/complete-tutor-profile") && !at("/complete-signup")) {
          navigate("/complete-tutor-profile", { replace: true });
        }
        return;
      }

      const approved =
        tutorProfile?.isVerified === true ||
        tutorProfile?.verificationStatus === "approved" ||
        tutorProfile?.__approved === true;

      if (!approved) {
        // Pending tutors: block ONLY the tutor dashboard + entry pages
        if (at("/tutor-dashboard") || inEntry || onStudentArea) {
          if (!at("/pending-approval")) {
            navigate("/pending-approval", { replace: true });
          }
        }
        // Allow them to browse/public pages + notifications freely
        return;
      }

      // Approved tutor: from entry/wrong pages -> tutor dashboard
      if (
        inEntry ||
        at("/pending-approval") ||
        at("/complete-tutor-profile") ||
        onStudentArea
      ) {
        if (!at("/tutor-dashboard")) {
          navigate("/tutor-dashboard", { replace: true });
        }
        return;
      }

      // Otherwise allow navigation (e.g., /tutors, /profile-settings, /notifications, etc.)
      return;
    }
  }, [user, isLoading, tutorProfile, tpLoading, location, navigate]);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={150}>
        <AuthProvider>
          <Navbar />
          <AuthRouteGate />

          <Switch>
            <Route path="/" component={Landing} />
            <Route path="/dashboard" component={DashboardAlias} />

            {/* Public browsing */}
            <Route path="/tutors" component={TutorBrowse} />
            <Route path="/tutors/:id" component={TutorProfile} />

            {/* Onboarding */}
            <Route path="/complete-signup" component={CompleteSignup} />
            <Route path="/complete-tutor-profile" component={CompleteTutorProfile} />
            <Route path="/pending-approval" component={PendingApproval} />

            {/* Signed-in areas */}
            <Route path="/student-dashboard" component={StudentDashboard} />
            <Route path="/tutor-dashboard" component={TutorDashboard} />
            <Route path="/profile-settings" component={ProfileSettings} />
            <Route path="/my-sessions" component={MySessions} />
            <Route path="/notifications" component={NotificationsPage} />

            {/* Admin */}
            <Route path="/admin-setup" component={AdminSetup} />
            <Route path="/admin" component={AdminDashboard} />

            {/* 404 */}
            <Route component={NotFound} />
          </Switch>

          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
