import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, BookOpen, Clock, User, Mail } from "lucide-react";

interface ExamInvitation {
  id: number;
  examId: number;
  studentEmail: string;
  studentName: string;
  registrationNumber: string;
  inviteStatus: string;
  inviteToken: string;
  exam: {
    title: string;
    subject: string;
    duration: number;
    instructions: string;
  };
}

export default function StudentExamAccess() {
  const [location, setLocation] = useLocation();
  const [inviteToken, setInviteToken] = useState<string>("");

  useEffect(() => {
    // Extract invite token from URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      setInviteToken(token);
    }
  }, []);

  const { data: invitation, isLoading, error } = useQuery({
    queryKey: ['/api/exam-invitation', inviteToken],
    enabled: !!inviteToken,
  });

  const handleStartExam = () => {
    if (invitation) {
      setLocation(`/exam/${invitation.examId}?token=${inviteToken}`);
    }
  };

  const handleSignIn = () => {
    // Redirect to Replit Auth with the current URL as return path
    window.location.href = `/api/login?returnTo=${encodeURIComponent(window.location.href)}`;
  };

  if (!inviteToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Exam Link</CardTitle>
            <CardDescription>
              The exam invitation link appears to be incomplete or invalid.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                Please check that you've used the complete invitation link provided in your email.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Verifying invitation...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation Not Found</CardTitle>
            <CardDescription>
              This exam invitation is invalid, expired, or has already been used.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                Please contact your instructor if you believe this is an error.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const exam = invitation.exam;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <BookOpen className="h-8 w-8 text-blue-600" />
            <div>
              <CardTitle className="text-2xl">{exam.title}</CardTitle>
              <CardDescription className="text-lg">{exam.subject}</CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Student Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2 flex items-center">
              <User className="h-4 w-4 mr-2" />
              Student Information
            </h3>
            <div className="space-y-1 text-sm">
              <p><strong>Name:</strong> {invitation.studentName || 'Not provided'}</p>
              <p><strong>Email:</strong> {invitation.studentEmail}</p>
              {invitation.registrationNumber && (
                <p><strong>Registration:</strong> {invitation.registrationNumber}</p>
              )}
            </div>
          </div>

          {/* Exam Information */}
          <div className="space-y-4">
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                Duration: {exam.duration} minutes
              </div>
            </div>
            
            {exam.instructions && (
              <div>
                <h3 className="font-semibold mb-2">Instructions</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{exam.instructions}</p>
              </div>
            )}
          </div>

          {/* Access Control */}
          <div className="border-t pt-4">
            <Alert className="mb-4">
              <Mail className="h-4 w-4" />
              <AlertDescription>
                To access this exam, you need to sign in with your Replit account. 
                After signing in, you'll be able to start the exam immediately.
              </AlertDescription>
            </Alert>

            <div className="flex space-x-3">
              <Button onClick={handleSignIn} className="flex-1">
                Sign In to Take Exam
              </Button>
              <Button 
                onClick={handleStartExam} 
                variant="outline"
                className="flex-1"
              >
                Continue as Guest
              </Button>
            </div>
          </div>

          <div className="text-xs text-gray-500 text-center">
            This invitation is valid for one-time use. Please complete the exam in one session.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}