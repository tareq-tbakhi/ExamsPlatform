import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Calendar, 
  Users, 
  FileText, 
  TrendingUp, 
  Clock,
  CheckCircle,
  AlertCircle,
  Eye
} from "lucide-react";
import ExamCreator from "@/components/exam-creator";
import ResultsView from "@/components/results-view";
import type { ExamWithStats } from "@shared/schema";
import logoImage from "@assets/image_1751011948568.png";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [showCreateExam, setShowCreateExam] = useState(false);

  // Mock user ID - in real app this would come from authentication
  const userId = 1;

  const { data: stats = {} as any } = useQuery({
    queryKey: ["/api/stats"],
  });

  const { data: exams = [], isLoading: examsLoading } = useQuery<ExamWithStats[]>({
    queryKey: [`/api/exams/creator/${userId}`],
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No date';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getUpcomingExams = () => {
    const now = new Date();
    return exams
      .filter(exam => exam.status === 'published' && exam.createdAt && new Date(exam.createdAt) > now)
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
      })
      .slice(0, 5);
  };

  const getRecentExams = () => {
    return exams
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 8);
  };

  if (showCreateExam) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src={logoImage} 
              alt="ExamCraft Logo" 
              className="h-12 w-auto"
            />
            <h1 className="text-3xl font-bold text-blue-700">Create New Exam</h1>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowCreateExam(false)}
          >
            Back to Dashboard
          </Button>
        </div>
        <ExamCreator />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img 
            src={logoImage} 
            alt="ExamCraft Logo" 
            className="h-16 w-auto"
          />
          <div>
            <h1 className="text-3xl font-bold text-blue-700">ExamCraft</h1>
            <p className="text-gray-600">AI-Powered Exam Management Dashboard</p>
          </div>
        </div>
        <Button onClick={() => setShowCreateExam(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Exam
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="exams">All Exams</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <FileText className="h-8 w-8 text-primary" />
                  </div>
                  <div className="ml-4">
                    <div className="text-2xl font-bold text-gray-900">
                      {stats?.totalExams || 0}
                    </div>
                    <div className="text-sm text-gray-500">Total Exams</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Users className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <div className="text-2xl font-bold text-gray-900">
                      {stats?.totalSubmissions || 0}
                    </div>
                    <div className="text-sm text-gray-500">Total Submissions</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <TrendingUp className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <div className="text-2xl font-bold text-gray-900">
                      {stats?.averageScore ? `${stats.averageScore.toFixed(1)}%` : '0%'}
                    </div>
                    <div className="text-sm text-gray-500">Average Score</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-8 w-8 text-emerald-600" />
                  </div>
                  <div className="ml-4">
                    <div className="text-2xl font-bold text-gray-900">
                      {stats?.passRate ? `${stats.passRate.toFixed(1)}%` : '0%'}
                    </div>
                    <div className="text-sm text-gray-500">Pass Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Exams */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Exams</CardTitle>
                <CardDescription>Your latest created exams</CardDescription>
              </CardHeader>
              <CardContent>
                {examsLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
                    ))}
                  </div>
                ) : getRecentExams().length > 0 ? (
                  <div className="space-y-3">
                    {getRecentExams().map((exam) => (
                      <div key={exam.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{exam.title}</div>
                          <div className="text-sm text-gray-500">{exam.subject}</div>
                          <div className="text-xs text-gray-400">
                            Created {exam.createdAt ? formatDate(exam.createdAt.toString()) : 'No date'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={exam.status === 'published' ? 'default' : 'secondary'}>
                            {exam.status}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {exam.submissionsCount} submissions
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No exams created yet</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => setShowCreateExam(true)}
                    >
                      Create your first exam
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upcoming Exams */}
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Exams</CardTitle>
                <CardDescription>Scheduled exams by date</CardDescription>
              </CardHeader>
              <CardContent>
                {getUpcomingExams().length > 0 ? (
                  <div className="space-y-3">
                    {getUpcomingExams().map((exam) => (
                      <div key={exam.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Calendar className="h-4 w-4 text-blue-600" />
                          <div>
                            <div className="font-medium">{exam.title}</div>
                            <div className="text-sm text-gray-500">{exam.subject}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {exam.createdAt ? formatDate(exam.createdAt.toString()) : 'No date'}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {exam.questionsCount} questions
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No upcoming exams scheduled</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="exams" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">All Exams</h2>
            <Button onClick={() => setShowCreateExam(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Exam
            </Button>
          </div>

          {examsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <div className="h-32 bg-gray-100 rounded animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : exams.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {exams.map((exam) => (
                <Card key={exam.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{exam.title}</CardTitle>
                        <CardDescription>{exam.subject}</CardDescription>
                      </div>
                      <Badge variant={exam.status === 'published' ? 'default' : 'secondary'}>
                        {exam.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Questions:</span>
                        <span className="font-medium">{exam.questionsCount}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Submissions:</span>
                        <span className="font-medium">{exam.submissionsCount}</span>
                      </div>
                      {exam.averageScore !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Average Score:</span>
                          <span className="font-medium">{exam.averageScore.toFixed(1)}%</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Created:</span>
                        <span className="font-medium">{exam.createdAt ? formatDate(exam.createdAt.toString()) : 'No date'}</span>
                      </div>
                      <div className="pt-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={() => setActiveTab("results")}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Results
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No exams created yet</h3>
              <p className="text-gray-500 mb-4">Get started by creating your first exam</p>
              <Button onClick={() => setShowCreateExam(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Exam
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Upcoming Exams</h2>
            <Badge variant="outline">
              {getUpcomingExams().length} scheduled
            </Badge>
          </div>

          {getUpcomingExams().length > 0 ? (
            <div className="space-y-4">
              {getUpcomingExams().map((exam) => (
                <Card key={exam.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Calendar className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{exam.title}</h3>
                          <p className="text-gray-600">{exam.subject}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span>{exam.questionsCount} questions</span>
                            <span>•</span>
                            <span>Created {exam.createdAt ? formatDate(exam.createdAt.toString()) : 'No date'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={exam.status === 'published' ? 'default' : 'secondary'}>
                          {exam.status}
                        </Badge>
                        <div className="mt-2">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Clock className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No upcoming exams</h3>
              <p className="text-gray-500 mb-4">Schedule exams to see them here</p>
              <Button onClick={() => setShowCreateExam(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Exam
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="results">
          <ResultsView />
        </TabsContent>
      </Tabs>
    </div>
  );
}