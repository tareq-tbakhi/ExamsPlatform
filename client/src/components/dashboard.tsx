import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  GraduationCap,
  Shield,
  LogOut,
  User
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isSuperAdmin } from "@/lib/authUtils";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import ExamCreator from "@/components/exam-creator";
import ExamList from "@/components/exam-list";
import ResultsView from "@/components/results-view";
import type { ExamWithStats } from "@shared/schema";
import logoImage from "@assets/image_1751014034866.png";

import image from "@assets/image.png";

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
        title: t('messages.exam_published'),
        description: t('messages.exam_published_desc'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('messages.error_occurred'),
        variant: "destructive",
      });
    },
  });

  const handleShare = async (examId: number) => {
    const url = `${window.location.origin}/take-exam/${examId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: t('messages.link_copied'),
        description: t('messages.link_copied_desc'),
      });
    } catch (err) {
      toast({
        title: t('messages.share_link'),
        description: `${t('messages.copy_link_desc')} ${url}`,
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
        {publishExamMutation.isPending ? t('dashboard.publishing') : t('dashboard.publish_exam')}
      </Button>
      <Button 
        variant="outline" 
        size="sm" 
        className="w-full bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 border-blue-200 text-blue-700 hover:text-blue-800 font-semibold"
        onClick={() => handleShare(examId)}
      >
        <Share className="h-4 w-4 mr-2" />
        {t('dashboard.copy_link')}
      </Button>
    </div>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const { user } = useAuth();
  const { t } = useTranslation();

  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
  });

  const { data: exams = [], isLoading: examsLoading } = useQuery<ExamWithStats[]>({
    queryKey: ["/api/exams"],
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="flex dashboard-main-flex">
        {/* Enhanced Sidebar - Always Visible */}
        <div className="w-80 bg-white shadow-md min-h-screen relative border-r border-gray-200 sidebar">
          <div className="p-8 border-b from-purple-50 to-blue-50 bg-[#ffffff]">
            <div className="flex items-center gap-4 nav-item">
              <img 
                src={image} 
                alt="ExamCraft Logo" 
                className="h-10 w-auto"
              />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                {t('dashboard.title').split(' ')[0]} {t('dashboard.title').split(' ')[1]}
              </h1>
            </div>
            
          </div>
          
          <nav className="p-6 space-y-3">
            {[
              { id: "overview", label: t('navigation.dashboard'), icon: Home },
              { id: "create", label: t('navigation.create_exam'), icon: Plus },
              { id: "exams", label: t('navigation.my_exams'), icon: BookOpen },
              { id: "results", label: t('navigation.all_results'), icon: BarChart3 },
              { id: "analytics", label: t('navigation.analytics'), icon: TrendingUp },
              { id: "student", label: t('navigation.take_exam'), icon: GraduationCap },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl transition-all duration-200 text-left font-medium nav-item ${
                    activeTab === item.id
                      ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg scale-105"
                      : "text-gray-700 hover:bg-gray-100 hover:scale-102"
                  }`}
                >
                  <Icon className="h-6 w-6 flex-shrink-0" />
                  <span className="text-lg">{item.label}</span>
                </button>
              );
            })}
            
            {/* Super Admin Section */}
            {user && (user as any).role && isSuperAdmin((user as any).role) && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  className="w-full flex items-center gap-4 px-6 py-4 rounded-xl transition-all duration-200 text-left font-medium bg-gradient-to-r from-red-50 to-orange-50 hover:from-red-100 hover:to-orange-100 border-red-200 text-red-700 hover:text-red-800"
                  onClick={() => window.location.href = "/super-admin"}
                >
                  <Shield className="h-6 w-6 flex-shrink-0" />
                  <span className="text-lg">{t('navigation.user_management')}</span>
                </Button>
              </div>
            )}
            
            <div className="mt-8 pt-6 border-t border-gray-200">
              <Button 
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                onClick={() => setActiveTab("create")}
              >
                <Plus className="h-5 w-5 mr-3" />
                {t('dashboard.create_new_exam')}
              </Button>
            </div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8 main-content-area">
          <div className="max-w-7xl mx-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('dashboard.title')}</h1>
                  <p className="text-gray-600">{t('dashboard.subtitle')}</p>
                </div>
                
                <div className="flex items-center gap-4 top-actions">
                  <Button variant="outline" size="sm">
                    <Search className="h-4 w-4 mr-2" />
                    {t('common.search')}
                  </Button>
                  <Button variant="outline" size="sm">
                    <Bell className="h-4 w-4" />
                  </Button>
                  <LanguageSwitcher />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <p className="text-sm font-medium leading-none">
                              {user && (user as any).firstName} {user && (user as any).lastName}
                            </p>
                          </div>
                          <p className="text-xs leading-none text-muted-foreground">
                            {user && (user as any).email}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => window.location.href = '/api/logout'}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>{t('common.logout')}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <TabsList className="grid w-full grid-cols-6 bg-white shadow-sm rounded-xl p-1">
                <TabsTrigger value="overview" className="flex items-center gap-2 text-sm font-medium">
                  <Home className="h-4 w-4" />
                  {t('navigation.dashboard')}
                </TabsTrigger>
                <TabsTrigger value="create" className="flex items-center gap-2 text-sm font-medium">
                  <Plus className="h-4 w-4" />
                  {t('navigation.create_exam')}
                </TabsTrigger>
                <TabsTrigger value="exams" className="flex items-center gap-2 text-sm font-medium">
                  <BookOpen className="h-4 w-4" />
                  {t('navigation.my_exams')}
                </TabsTrigger>
                <TabsTrigger value="results" className="flex items-center gap-2 text-sm font-medium">
                  <BarChart3 className="h-4 w-4" />
                  {t('navigation.all_results')}
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-2 text-sm font-medium">
                  <TrendingUp className="h-4 w-4" />
                  {t('navigation.analytics')}
                </TabsTrigger>
                <TabsTrigger value="student" className="flex items-center gap-2 text-sm font-medium">
                  <GraduationCap className="h-4 w-4" />
                  {t('navigation.take_exam')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-8">
                {/* Enhanced Stats Cards - Inspired by Figma Design */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  <Card className="bg-white border-0 shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 hover:scale-105">
                    <CardContent className="p-8">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6">
                            <FileText className="h-8 w-8 text-white" />
                          </div>
                          <div className="text-4xl font-bold text-gray-900 mb-2">
                            {stats?.totalExams || 0}
                          </div>
                          <div className="text-gray-600 font-medium">{t('dashboard.total_exams')}</div>
                          <div className="text-sm text-green-500 mt-2 font-semibold">
                            +12% {t('dashboard.from_last_month')}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-0 shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 hover:scale-105">
                    <CardContent className="p-8">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mb-6">
                            <Users className="h-8 w-8 text-white" />
                          </div>
                          <div className="text-4xl font-bold text-gray-900 mb-2">
                            {stats?.totalSubmissions || 0}
                          </div>
                          <div className="text-gray-600 font-medium">{t('dashboard.total_submissions')}</div>
                          <div className="text-sm text-green-500 mt-2 font-semibold">
                            +8% {t('dashboard.from_last_week')}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-0 shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 hover:scale-105">
                    <CardContent className="p-8">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6">
                            <TrendingUp className="h-8 w-8 text-white" />
                          </div>
                          <div className="text-4xl font-bold text-gray-900 mb-2">
                            {stats?.averageScore ? Math.round(stats.averageScore) : 0}%
                          </div>
                          <div className="text-gray-600 font-medium">{t('dashboard.average_score')}</div>
                          <div className="text-sm text-blue-500 mt-2 font-semibold">
                            +5% {t('dashboard.improvement')}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-0 shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 hover:scale-105">
                    <CardContent className="p-8">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mb-6">
                            <Clock className="h-8 w-8 text-white" />
                          </div>
                          <div className="text-4xl font-bold text-gray-900 mb-2">
                            {getUpcomingExams().length}
                          </div>
                          <div className="text-gray-600 font-medium">{t('dashboard.upcoming_exams')}</div>
                          <div className="text-sm text-orange-500 mt-2 font-semibold">
                            {t('dashboard.next_7_days')}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Exams Section - Enhanced Cards */}
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900">{t('dashboard.recent_exams')}</h2>
                  </div>

                  {examsLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {[...Array(6)].map((_, i) => (
                        <Card key={i} className="bg-white border-0 shadow-lg rounded-2xl">
                          <CardContent className="p-6">
                            <div className="animate-pulse space-y-4">
                              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                              <div className="h-8 bg-gray-200 rounded w-full"></div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : exams.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {getRecentExams().map((exam) => (
                        <Card key={exam.id} className="bg-white border-0 shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 hover:scale-105 overflow-hidden">
                          <CardContent className="p-0">
                            <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2"></div>
                            <div className="p-6 space-y-4">
                              <div className="flex items-start justify-between">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                                  {exam.title.charAt(0)}
                                </div>
                                <Badge variant={exam.status === 'published' ? 'default' : 'secondary'} className="text-xs">
                                  {t(`dashboard.${exam.status}`)}
                                </Badge>
                              </div>
                              
                              <div>
                                <h3 className="font-bold text-lg text-gray-900 mb-2">{exam.title}</h3>
                                <p className="text-sm text-gray-600 mb-1">{exam.subject}</p>
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  <span>{exam.questionsCount} {t('dashboard.questions')}</span>
                                  <span>{exam.submissionsCount} {t('dashboard.submissions')}</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-xs text-gray-400">
                                <span>{t('dashboard.created')} {exam.createdAt ? formatDate(exam.createdAt.toString()) : 'No date'}</span>
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
                                      {t('dashboard.take_test')}
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
                                      {t('dashboard.view_results')}
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
                    <Card className="bg-white border-0 shadow-lg rounded-2xl">
                      <CardContent className="p-12 text-center">
                        <FileText className="h-16 w-16 text-gray-300 mx-auto mb-6" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-3">{t('dashboard.no_exams_title')}</h3>
                        <p className="text-gray-600 mb-6">{t('dashboard.no_exams_message')}</p>
                        <Button onClick={() => setActiveTab("create")}>
                          <Plus className="h-4 w-4 mr-2" />
                          {t('dashboard.create_new_exam')}
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="create" className="space-y-6">
                <ExamCreator />
              </TabsContent>

              <TabsContent value="exams" className="space-y-6">
                <ExamList onSelectExam={(examId, tab) => {
                  setSelectedExamId(examId);
                  setActiveTab(tab);
                }} />
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