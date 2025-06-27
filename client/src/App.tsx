import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { isSuperAdmin, isAdmin, isTeacherOrAbove } from "@/lib/authUtils";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Dashboard from "@/components/dashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import SuperAdminDashboard from "@/pages/SuperAdminDashboard";
import TakeExam from "@/pages/take-exam";
import StudentLogin from "@/pages/StudentLogin";
import StudentDashboard from "@/pages/StudentDashboard";
import AcceptInvitation from "@/pages/AcceptInvitation";

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
      
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          {/* Super Admin Routes */}
          {user && user.role && isSuperAdmin(user.role) && (
            <Route path="/super-admin" component={SuperAdminDashboard} />
          )}
          
          {/* Admin Routes */}
          {user && user.role && isAdmin(user.role) && (
            <Route path="/admin" component={AdminDashboard} />
          )}
          
          {/* Teacher/Admin Routes */}
          {user && user.role && isTeacherOrAbove(user.role) && (
            <Route path="/" component={Dashboard} />
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
