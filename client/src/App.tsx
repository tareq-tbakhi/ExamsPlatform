import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { isSuperAdmin, isAdmin, isTeacherOrAbove } from "@/lib/authUtils";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Dashboard from "@/components/dashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import SuperAdminDashboard from "@/pages/SuperAdminDashboard";
import TakeExam from "@/pages/take-exam";
import StudentLogin from "@/pages/StudentLogin";
import StudentDashboard from "@/pages/StudentDashboard";
import AcceptInvitation from "@/pages/AcceptInvitation";
import AccessDenied from "@/pages/AccessDenied";
import StudentExamAccess from "@/pages/StudentExamAccess";
import ResultsPage from "@/pages/ResultsPage";
import VoiceQuestionDemo from "@/pages/voice-question-demo";
import GoogleTTSDemo from "@/pages/google-tts-demo";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Public routes - accessible without authentication */}
      <Route path="/accept-invitation" component={AcceptInvitation} />
      <Route path="/login" component={Login} />
      <Route path="/voice-demo" component={VoiceQuestionDemo} />
      <Route path="/google-tts-demo" component={GoogleTTSDemo} />
      
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          {/* Super Admin Routes */}
          {user && (user as any).role && isSuperAdmin((user as any).role) && (
            <Route path="/super-admin" component={SuperAdminDashboard} />
          )}
          
          {/* Admin Routes */}
          {user && (user as any).role && isAdmin((user as any).role) && (
            <Route path="/admin" component={AdminDashboard} />
          )}
          
          {/* Teacher/Admin Routes */}
          {user && (user as any).role && isTeacherOrAbove((user as any).role) && (
            <>
              <Route path="/" component={Dashboard} />

            </>
          )}
          
          {/* Student Routes */}
          <Route path="/take-exam/:examId" component={TakeExam} />
          
          {/* Default authenticated route */}
          <Route path="/" component={Dashboard} />
        </>
      )}
      
      {/* Student Portal Routes - Separate authentication system */}
      <Route path="/student/login" component={StudentLogin} />
      <Route path="/student/dashboard" component={StudentDashboard} />
      
      {/* Access Control Routes */}
      <Route path="/access-denied" component={AccessDenied} />
      
      {/* Student Exam Invitation Routes (public access) */}
      <Route path="/exam-invitation" component={StudentExamAccess} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
