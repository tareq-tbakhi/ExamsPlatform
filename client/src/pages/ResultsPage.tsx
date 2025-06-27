import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FileText, Users, Clock, Calendar, BarChart3, Trophy } from "lucide-react";
import ResultsView from "@/components/results-view";

export default function ResultsPage() {
  const { examId } = useParams();

  const { data: exam, isLoading: examLoading } = useQuery({
    queryKey: [`/api/exams/${examId}`],
  });

  const { data: submissions, isLoading: submissionsLoading } = useQuery({
    queryKey: [`/api/submissions/exam/${examId}`],
  });

  if (examLoading || submissionsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Exam Not Found</h2>
            <p className="text-gray-600 mb-4">The exam you're looking for doesn't exist or you don't have access to it.</p>
            <Button onClick={() => window.history.back()} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const averageScore = submissions && submissions.length > 0
    ? submissions.reduce((sum: number, sub: any) => sum + (sub.score || 0), 0) / submissions.length
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => window.history.back()} 
              variant="outline" 
              size="sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Results: {exam.title}</h1>
              <p className="text-gray-600">{exam.subject}</p>
            </div>
          </div>
        </div>

        {/* Exam Overview */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Questions</p>
                  <p className="text-xl font-bold text-gray-900">{exam.questionsCount || 0}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Submissions</p>
                  <p className="text-xl font-bold text-gray-900">{submissions?.length || 0}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                  <Clock className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Duration</p>
                  <p className="text-xl font-bold text-gray-900">{exam.duration} min</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Average Score</p>
                  <p className="text-xl font-bold text-gray-900">{averageScore.toFixed(1)}%</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Created</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {exam.createdAt ? formatDate(exam.createdAt) : 'Unknown'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Content */}
        <Card>
          <CardContent className="p-0">
            <Tabs defaultValue="submissions" className="w-full">
              <div className="border-b px-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="submissions">Submissions</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                  <TabsTrigger value="proctoring">Proctoring</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="submissions" className="p-6">
                <ResultsView selectedExam={exam} />
              </TabsContent>

              <TabsContent value="analytics" className="p-6">
                <div className="text-center py-12">
                  <BarChart3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Analytics Dashboard</h3>
                  <p className="text-gray-600">Detailed analytics and performance insights coming soon.</p>
                </div>
              </TabsContent>

              <TabsContent value="proctoring" className="p-6">
                <div className="text-center py-12">
                  <Trophy className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Proctoring Reports</h3>
                  <p className="text-gray-600">AI-powered proctoring analysis and violation reports.</p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}