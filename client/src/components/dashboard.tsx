import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Calendar, 
  Users, 
  FileText, 
  TrendingUp, 
  Clock,
  CheckCircle,
  Eye,
  Home,
  BookOpen,
  BarChart3,
  Settings,
  Search,
  Bell
} from "lucide-react";
import ExamCreator from "@/components/exam-creator";
import ResultsView from "@/components/results-view";
import type { ExamWithStats } from "@shared/schema";
import logoImage from "@assets/image_1751011948568.png";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [showCreateExam, setShowCreateExam] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);

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

  const sidebarItems = [
    { id: "overview", label: "Dashboard", icon: Home },
    { id: "exams", label: "All Exams", icon: BookOpen },
    { id: "upcoming", label: "Upcoming", icon: Calendar },
    { id: "results", label: "Analytics", icon: BarChart3 },
  ];

  if (showCreateExam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="flex">
          {/* Enhanced Sidebar - Always Visible */}
          <div className="w-80 bg-white shadow-xl min-h-screen relative border-r border-gray-200">
            <div className="p-8 border-b bg-gradient-to-r from-purple-50 to-blue-50">
              <div className="flex items-center gap-4">
                <img 
                  src={logoImage} 
                  alt="ExamCraft Logo" 
                  className="h-14 w-auto"
                />
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  ExamCraft
                </h1>
              </div>
              <p className="text-sm text-gray-600 mt-2 ml-18">AI-Powered Exam Platform</p>
            </div>
            <nav className="p-6">
              <Button 
                variant="ghost" 
                onClick={() => setShowCreateExam(false)}
                className="w-full justify-start mb-6 text-lg font-semibold py-4 px-6 rounded-xl hover:bg-gray-100"
              >
                <Home className="h-6 w-6 mr-4" />
                Back to Dashboard
              </Button>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-8">
            <div className="max-w-7xl mx-auto">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Exam</h1>
                <p className="text-gray-600">Design and configure your exam with AI assistance</p>
              </div>
              <ExamCreator />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="flex">
        {/* Enhanced Sidebar - Always Visible */}
        <div className="w-80 bg-white shadow-xl min-h-screen relative border-r border-gray-200">
          <div className="p-8 border-b bg-gradient-to-r from-purple-50 to-blue-50">
            <div className="flex items-center gap-4">
              <img 
                src={logoImage} 
                alt="ExamCraft Logo" 
                className="h-14 w-auto"
              />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                ExamCraft
              </h1>
            </div>
            <p className="text-sm text-gray-600 mt-2 ml-18">AI-Powered Exam Platform</p>
          </div>
          
          <nav className="p-6 space-y-3">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl transition-all text-left ${
                    activeTab === item.id
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg transform scale-105'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="font-semibold text-lg">{item.label}</span>
                </button>
              );
            })}
          </nav>
          
          <div className="absolute bottom-6 left-6 right-6">
            <Button
              onClick={() => setShowCreateExam(true)}
              className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-xl py-4 text-lg font-semibold rounded-xl"
            >
              <Plus className="h-5 w-5 mr-3" />
              Create New Exam
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {activeTab === "overview" && "Dashboard Overview"}
                  {activeTab === "exams" && "All Exams"}
                  {activeTab === "upcoming" && "Upcoming Exams"}
                  {activeTab === "results" && "Analytics & Results"}
                </h1>
                <p className="text-gray-600">
                  {activeTab === "overview" && "Welcome back! Here's your exam management overview"}
                  {activeTab === "exams" && "Manage and review all your created exams"}
                  {activeTab === "upcoming" && "Keep track of your scheduled exams"}
                  {activeTab === "results" && "Analyze performance and view detailed results"}
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm">
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
                <Button variant="outline" size="sm">
                  <Bell className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Content based on active tab */}
            {activeTab === "overview" && (
              <div className="space-y-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-3xl font-bold mb-1">
                            {stats?.totalExams || 0}
                          </div>
                          <div className="text-blue-100">Total Exams</div>
                        </div>
                        <FileText className="h-8 w-8 text-blue-200" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-lg">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-3xl font-bold mb-1">
                            {stats?.totalSubmissions || 0}
                          </div>
                          <div className="text-green-100">Submissions</div>
                        </div>
                        <Users className="h-8 w-8 text-green-200" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-lg">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-3xl font-bold mb-1">
                            {stats?.averageScore ? `${stats.averageScore.toFixed(1)}%` : '0%'}
                          </div>
                          <div className="text-purple-100">Average Score</div>
                        </div>
                        <TrendingUp className="h-8 w-8 text-purple-200" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-lg">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-3xl font-bold mb-1">
                            {stats?.passRate ? `${stats.passRate.toFixed(1)}%` : '0%'}
                          </div>
                          <div className="text-orange-100">Pass Rate</div>
                        </div>
                        <CheckCircle className="h-8 w-8 text-orange-200" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Recent Exams */}
                  <Card className="shadow-lg border-0">
                    <CardHeader>
                      <CardTitle className="text-xl">Recent Exams</CardTitle>
                      <CardDescription>Your latest created exams</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {examsLoading ? (
                        <div className="space-y-4">
                          {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                          ))}
                        </div>
                      ) : getRecentExams().length > 0 ? (
                        <div className="space-y-4">
                          {getRecentExams().map((exam) => (
                            <div key={exam.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                              <div className="flex-1">
                                <div className="font-semibold text-gray-900">{exam.title}</div>
                                <div className="text-sm text-gray-600">{exam.subject}</div>
                                <div className="text-xs text-gray-400 mt-1">
                                  Created {exam.createdAt ? formatDate(exam.createdAt.toString()) : 'No date'}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
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
                          <p className="mb-4">No exams created yet</p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setShowCreateExam(true)}
                          >
                            Create your first exam
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Upcoming Exams */}
                  <Card className="shadow-lg border-0">
                    <CardHeader>
                      <CardTitle className="text-xl">Upcoming Exams</CardTitle>
                      <CardDescription>Scheduled exams by date</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {getUpcomingExams().length > 0 ? (
                        <div className="space-y-4">
                          {getUpcomingExams().map((exam) => (
                            <div key={exam.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                                  <Calendar className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                  <div className="font-semibold text-gray-900">{exam.title}</div>
                                  <div className="text-sm text-gray-600">{exam.subject}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium text-gray-900">
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
                          <p className="mb-4">No upcoming exams scheduled</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === "exams" && (
              <div className="space-y-6">
                {examsLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                      <Card key={i} className="shadow-lg border-0">
                        <CardContent className="pt-6">
                          <div className="h-32 bg-gray-100 rounded animate-pulse" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : exams.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {exams.map((exam) => (
                      <Card key={exam.id} className="hover:shadow-xl transition-shadow border-0 shadow-lg bg-white">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg text-gray-900">{exam.title}</CardTitle>
                              <CardDescription className="text-gray-600">{exam.subject}</CardDescription>
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
                                onClick={() => {
                                  setSelectedExamId(exam.id);
                                  setActiveTab("results");
                                }}
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
              </div>
            )}

            {activeTab === "upcoming" && (
              <div className="space-y-6">
                {getUpcomingExams().length > 0 ? (
                  <div className="space-y-4">
                    {getUpcomingExams().map((exam) => (
                      <Card key={exam.id} className="shadow-lg border-0">
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                                <Calendar className="h-6 w-6 text-white" />
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
              </div>
            )}

            {activeTab === "results" && (
              <ResultsView selectedExamId={selectedExamId} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}