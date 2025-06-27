import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Eye,
  Home,
  BookOpen,
  BarChart3,
  Settings,
  Search,
  Bell,
  Send,
  Share,
  ClipboardCheck,
  GraduationCap
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ExamCreator from "@/components/exam-creator";
import ExamList from "@/components/exam-list";
import ResultsView from "@/components/results-view";
import type { ExamWithStats } from "@shared/schema";
import logoImage from "@assets/image_1751011948568.png";

// Publish Exam Button Component
function PublishExamButton({ examId }: { examId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const publishExamMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("PATCH", `/api/exams/${id}`, {
        status: "published"
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams"] });
      queryClient.invalidateQueries({ queryKey: [`/api/exams/creator/1`] });
      toast({
        title: "Exam Published!",
        description: "Your exam is now live and students can take it.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to publish exam",
        variant: "destructive",
      });
    },
  });

  const handleShare = async (examId: number) => {
    const url = `${window.location.origin}/take-exam/${examId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link Copied!",
        description: "Exam link has been copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Share Link",
        description: `Copy this link: ${url}`,
      });
    }
  };

  return (
    <div className="space-y-2">
      <Button 
        variant="outline" 
        size="sm" 
        className="w-full bg-gradient-to-r from-orange-50 to-red-50 hover:from-orange-100 hover:to-red-100 border-orange-200 text-orange-700 hover:text-orange-800 font-semibold"
        onClick={() => publishExamMutation.mutate(examId)}
        disabled={publishExamMutation.isPending}
      >
        <Send className="h-4 w-4 mr-2" />
        {publishExamMutation.isPending ? "Publishing..." : "Publish Exam"}
      </Button>
      <Button 
        variant="outline" 
        size="sm" 
        className="w-full bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 border-blue-200 text-blue-700 hover:text-blue-800 font-semibold"
        onClick={() => handleShare(examId)}
      >
        <Share className="h-4 w-4 mr-2" />
        Copy Link
      </Button>
    </div>
  );
}

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

            {/* Tabbed Interface */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-6 bg-white shadow-sm rounded-xl p-2">
                <TabsTrigger value="overview" className="flex items-center gap-2 text-sm font-medium">
                  <Home className="h-4 w-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="create" className="flex items-center gap-2 text-sm font-medium">
                  <Plus className="h-4 w-4" />
                  Create Exam
                </TabsTrigger>
                <TabsTrigger value="exams" className="flex items-center gap-2 text-sm font-medium">
                  <BookOpen className="h-4 w-4" />
                  My Exams
                </TabsTrigger>
                <TabsTrigger value="results" className="flex items-center gap-2 text-sm font-medium">
                  <BarChart3 className="h-4 w-4" />
                  All Results
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-2 text-sm font-medium">
                  <TrendingUp className="h-4 w-4" />
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="student" className="flex items-center gap-2 text-sm font-medium">
                  <GraduationCap className="h-4 w-4" />
                  Take Exam
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-8">
                {/* Dashboard Overview Content */}
              <div className="space-y-8">
                {/* Enhanced Stats Cards - Inspired by Figma Design */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  <Card className="bg-white border-0 shadow-xl rounded-2xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
                    <CardContent className="p-8">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6">
                            <FileText className="h-8 w-8 text-white" />
                          </div>
                          <div className="text-4xl font-bold text-gray-900 mb-2">
                            {stats?.totalExams || 0}
                          </div>
                          <div className="text-gray-600 font-medium">Total Exams</div>
                          <div className="text-sm text-green-500 mt-2 font-semibold">
                            +12% from last month
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-0 shadow-xl rounded-2xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
                    <CardContent className="p-8">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mb-6">
                            <Users className="h-8 w-8 text-white" />
                          </div>
                          <div className="text-4xl font-bold text-gray-900 mb-2">
                            {stats?.totalSubmissions || 0}
                          </div>
                          <div className="text-gray-600 font-medium">Total Submissions</div>
                          <div className="text-sm text-green-500 mt-2 font-semibold">
                            +8% from last week
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-0 shadow-xl rounded-2xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
                    <CardContent className="p-8">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6">
                            <TrendingUp className="h-8 w-8 text-white" />
                          </div>
                          <div className="text-4xl font-bold text-gray-900 mb-2">
                            {stats?.averageScore ? `${stats.averageScore.toFixed(1)}%` : '0%'}
                          </div>
                          <div className="text-gray-600 font-medium">Average Score</div>
                          <div className="text-sm text-blue-500 mt-2 font-semibold">
                            +2.3% improvement
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-0 shadow-xl rounded-2xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
                    <CardContent className="p-8">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mb-6">
                            <CheckCircle className="h-8 w-8 text-white" />
                          </div>
                          <div className="text-4xl font-bold text-gray-900 mb-2">
                            {stats?.passRate ? `${stats.passRate.toFixed(1)}%` : '85%'}
                          </div>
                          <div className="text-gray-600 font-medium">Pass Rate</div>
                          <div className="text-sm text-green-500 mt-2 font-semibold">
                            Above target 80%
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Recent Exams - Enhanced Design */}
                  <Card className="shadow-xl border-0 rounded-2xl bg-white hover:shadow-2xl transition-all duration-300">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                          <Clock className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-xl text-gray-900">Recent Exams</CardTitle>
                          <CardDescription className="text-gray-500">Your latest created exams</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {examsLoading ? (
                        <div className="space-y-4">
                          {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                          ))}
                        </div>
                      ) : getRecentExams().length > 0 ? (
                        <div className="space-y-3">
                          {getRecentExams().map((exam) => (
                            <div key={exam.id} className="flex items-center justify-between p-5 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl hover:from-blue-50 hover:to-purple-50 transition-all duration-300 border border-gray-200 hover:border-blue-200 hover:shadow-md">
                              <div className="flex items-center gap-4 flex-1">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                                  {exam.title.charAt(0)}
                                </div>
                                <div className="flex-1">
                                  <div className="font-semibold text-gray-900 text-lg">{exam.title}</div>
                                  <div className="text-sm text-gray-600 mt-1">{exam.subject}</div>
                                  <div className="text-xs text-gray-400 mt-1">
                                    Created {exam.createdAt ? formatDate(exam.createdAt.toString()) : 'No date'}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <Badge variant={exam.status === 'published' ? 'default' : 'secondary'} className="mb-1">
                                    {exam.status}
                                  </Badge>
                                  <div className="text-sm text-gray-500">
                                    {exam.submissionsCount} submissions
                                  </div>
                                </div>
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

                  {/* Upcoming Exams - Enhanced Design */}
                  <Card className="shadow-xl border-0 rounded-2xl bg-white hover:shadow-2xl transition-all duration-300">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-500 rounded-xl flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-xl text-gray-900">Upcoming Exams</CardTitle>
                          <CardDescription className="text-gray-500">Scheduled exams by date</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {getUpcomingExams().length > 0 ? (
                        <div className="space-y-3">
                          {getUpcomingExams().map((exam) => (
                            <div key={exam.id} className="flex items-center justify-between p-5 bg-gradient-to-r from-green-50 to-teal-50 rounded-xl hover:from-green-100 hover:to-teal-100 transition-all duration-300 border border-green-200 hover:border-green-300 hover:shadow-md">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-teal-500 rounded-xl flex items-center justify-center">
                                  <Calendar className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                  <div className="font-semibold text-gray-900 text-lg">{exam.title}</div>
                                  <div className="text-sm text-gray-600 mt-1">{exam.subject}</div>
                                  <div className="text-xs text-gray-400 mt-1">
                                    {exam.questionsCount} questions • {exam.submissionsCount} submissions
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium text-gray-900 mb-2">
                                  {exam.createdAt ? formatDate(exam.createdAt.toString()) : 'No date'}
                                </div>
                                <Badge variant="outline" className="text-xs bg-white">
                                  {exam.status}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {exams.map((exam) => (
                      <Card key={exam.id} className="hover:shadow-2xl transition-all duration-300 border-0 shadow-xl bg-white rounded-2xl hover:scale-105">
                        <CardHeader className="pb-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg">
                                {exam.title.charAt(0)}
                              </div>
                              <div className="flex-1">
                                <CardTitle className="text-xl text-gray-900 mb-1">{exam.title}</CardTitle>
                                <CardDescription className="text-gray-600">{exam.subject}</CardDescription>
                              </div>
                            </div>
                            <Badge variant={exam.status === 'published' ? 'default' : 'secondary'} className="ml-2">
                              {exam.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-4">
                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-3 text-center">
                                <div className="text-lg font-bold text-blue-700">{exam.questionsCount}</div>
                                <div className="text-xs text-blue-600">Questions</div>
                              </div>
                              <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-3 text-center">
                                <div className="text-lg font-bold text-green-700">{exam.submissionsCount}</div>
                                <div className="text-xs text-green-600">Submissions</div>
                              </div>
                            </div>
                            
                            {/* Average Score with Progress Bar */}
                            {exam.averageScore !== undefined && (
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">Average Score</span>
                                  <span className="font-semibold text-gray-900">{exam.averageScore.toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-300" 
                                    style={{ width: `${exam.averageScore}%` }}
                                  ></div>
                                </div>
                              </div>
                            )}
                            
                            {/* Created Date */}
                            <div className="text-xs text-gray-400 text-center pt-2">
                              Created {exam.createdAt ? formatDate(exam.createdAt.toString()) : 'No date'}
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="space-y-2">
                              {exam.status === 'published' ? (
                                <div className="space-y-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 border-green-200 text-green-700 hover:text-green-800 font-semibold"
                                    onClick={() => window.open(`/take-exam/${exam.id}`, '_blank')}
                                  >
                                    <BookOpen className="h-4 w-4 mr-2" />
                                    Take Test
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 border-purple-200 text-purple-700 hover:text-purple-800 font-semibold"
                                    onClick={() => {
                                      setSelectedExamId(exam.id);
                                      setActiveTab("results");
                                    }}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Results
                                  </Button>
                                </div>
                              ) : (
                                <PublishExamButton examId={exam.id} />
                              )}
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
              </TabsContent>

              <TabsContent value="create" className="space-y-6">
                <ExamCreator />
              </TabsContent>

              <TabsContent value="exams" className="space-y-6">
                <ExamList />
              </TabsContent>

              <TabsContent value="results" className="space-y-6">
                <ResultsView selectedExamId={selectedExamId} />
              </TabsContent>

              <TabsContent value="analytics" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Advanced Analytics</CardTitle>
                    <CardDescription>
                      Detailed performance insights and trends analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">
                      Advanced analytics features coming soon...
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="student" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Take an Exam</CardTitle>
                    <CardDescription>
                      Enter an exam code or click on a shared exam link to begin taking an exam
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-700">
                        <strong>For testing:</strong> Go to "My Exams" tab, create and publish an exam, 
                        then use the "Take Test" button to test your exam.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}