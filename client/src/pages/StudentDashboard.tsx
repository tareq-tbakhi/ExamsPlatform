import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  BookOpen, 
  Clock, 
  Calendar, 
  User, 
  LogOut, 
  FileText,
  Play,
  CheckCircle,
  AlertCircle
} from "lucide-react";

interface StudentSession {
  id: string;
  name: string;
  email: string;
  registrationNumber: string;
}

interface AssignedExam {
  id: number;
  title: string;
  subject: string;
  duration: number;
  questionsCount: number;
  status: string;
  invitationStatus: string;
  accessedAt?: string;
  completedAt?: string;
  score?: number;
}

export default function StudentDashboard() {
  const [studentSession, setStudentSession] = useState<StudentSession | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const session = localStorage.getItem("studentSession");
    if (session) {
      setStudentSession(JSON.parse(session));
    } else {
      setLocation("/student/login");
    }
  }, [setLocation]);

  const { data: assignedExams = [], isLoading } = useQuery<AssignedExam[]>({
    queryKey: ["/api/student/exams", studentSession?.email],
    enabled: !!studentSession?.email,
  });

  const handleLogout = () => {
    localStorage.removeItem("studentSession");
    setLocation("/student/login");
  };

  const handleTakeExam = (examId: number) => {
    window.open(`/take-exam/${examId}`, '_blank');
  };

  const getInvitationStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "accessed":
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Available</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getExamStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "accessed":
        return <Play className="h-5 w-5 text-blue-600" />;
      case "pending":
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      default:
        return <FileText className="h-5 w-5 text-gray-600" />;
    }
  };

  if (!studentSession) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-32 bg-gray-200 rounded-lg"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">ExamCraft Student Portal</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{studentSession.name}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {studentSession.registrationNumber}
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="text-red-600 hover:text-red-700"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">My Assigned Exams</h2>
          <p className="text-gray-600">
            Here are the exams that have been assigned to you. Click "Take Exam" to start.
          </p>
        </div>

        {assignedExams.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Exams Assigned
              </h3>
              <p className="text-gray-600">
                You don't have any exams assigned yet. Check back later or contact your instructor.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {assignedExams.map((exam) => (
              <Card key={exam.id} className="hover:shadow-lg transition-all duration-200">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getExamStatusIcon(exam.invitationStatus)}
                      <CardTitle className="text-lg">{exam.title}</CardTitle>
                    </div>
                    {getInvitationStatusBadge(exam.invitationStatus)}
                  </div>
                  <p className="text-sm text-gray-600">{exam.subject}</p>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600">{exam.duration} min</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600">{exam.questionsCount} questions</span>
                      </div>
                    </div>

                    {exam.accessedAt && (
                      <div className="text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Accessed: {new Date(exam.accessedAt).toLocaleDateString()}
                        </div>
                      </div>
                    )}

                    {exam.completedAt && exam.score !== undefined && (
                      <div className="p-2 bg-green-50 rounded-lg">
                        <div className="text-sm font-medium text-green-800">
                          Score: {exam.score}%
                        </div>
                        <div className="text-xs text-green-600">
                          Completed: {new Date(exam.completedAt).toLocaleDateString()}
                        </div>
                      </div>
                    )}

                    <div className="pt-2">
                      {exam.invitationStatus === "completed" ? (
                        <Button
                          variant="outline"
                          className="w-full text-green-600 border-green-200 hover:bg-green-50"
                          disabled
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Completed
                        </Button>
                      ) : (
                        <Button
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => handleTakeExam(exam.id)}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          {exam.invitationStatus === "accessed" ? "Continue Exam" : "Take Exam"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Instructions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">Important Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• Make sure you have a stable internet connection before starting an exam</p>
              <p>• You cannot pause an exam once started - complete it in one session</p>
              <p>• Your camera and microphone may be monitored during the exam</p>
              <p>• Do not refresh the page or navigate away during the exam</p>
              <p>• Contact your instructor if you experience technical difficulties</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}