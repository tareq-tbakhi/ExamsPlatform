import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Users, TrendingUp, Medal, Eye, Brain, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Shield, Zap, FileText, ArrowUpDown } from "lucide-react";
import ExamMonitoringDashboard from "./exam-monitoring-dashboard";
import SubmissionDetails from "@/components/submission-details";
import GradingDashboard from "@/components/grading-dashboard";
import ComprehensiveAnalysisReport from "@/components/comprehensive-analysis-report";
import QuestionsAnswersTableSimple from "@/components/questions-answers-table-simple";
import { useAuth } from "@/hooks/useAuth";
import type { SubmissionWithExam, ExamWithStats } from "@shared/schema";

interface SubmissionWithAnalysis extends SubmissionWithExam {
  aiAnalysis?: {
    overallSuspicion: number;
    criticalViolations: number;
    majorViolations: number;
    minorViolations: number;
    screenActivityScore: number;
    behavioralScore: number;
    audioScore: number;
    summary: string;
  } | null;
}

interface ResultsViewProps {
  selectedExamId?: number | null;
}

export default function ResultsView({ selectedExamId }: ResultsViewProps) {
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithExam | null>(null);
  const [expandedExams, setExpandedExams] = useState<Set<number>>(new Set());
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState<string>('newest');
  
  const { user } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = (user as any)?.id;

  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
  });

  const { data: exams = [], isLoading: examsLoading } = useQuery<ExamWithStats[]>({
    queryKey: ["/api/exams"],
    enabled: !!userId,
  });

  const { data: recentSubmissions = [], isLoading: submissionsLoading } = useQuery<SubmissionWithExam[]>({
    queryKey: ["/api/submissions/recent"],
    refetchInterval: 30000, // Refetch every 30 seconds instead of 2 seconds
    staleTime: 10000, // Consider data fresh for 10 seconds
    gcTime: 300000, // Cache for 5 minutes
  });

  // Fetch real AI analysis data for all submissions
  const submissionAnalysisQueries = useQuery({
    queryKey: ['/api/analyze/all-results'],
    queryFn: async () => {
      const analysisMap = new Map();
      
      // Fetch analysis for each submission
      for (const submission of recentSubmissions) {
        try {
          const response = await fetch(`/api/analyze/results/${submission.id}`);
          const analysis = await response.json();
          
          if (analysis.length > 0) {
            // Use the most recent analysis
            const latestAnalysis = analysis[0];
            
            // Count violations by severity - need to fetch violations for this analysis
            const violationsResponse = await fetch(`/api/violations/${submission.id}`);
            const violations = await violationsResponse.json();
            
            const criticalViolations = violations.filter((v: any) => v.type === 'critical').length;
            const majorViolations = violations.filter((v: any) => v.type === 'major').length;
            const minorViolations = violations.filter((v: any) => v.type === 'minor').length;
            
            analysisMap.set(submission.id, {
              overallSuspicion: latestAnalysis.overallSuspicion, // Already stored as 0-100 range
              criticalViolations,
              majorViolations,
              minorViolations,
              screenActivityScore: 85, // Default values for now
              behavioralScore: 85,
              audioScore: 80,
              summary: latestAnalysis.summary
            });
          }
        } catch (error) {
          console.error(`Failed to fetch analysis for submission ${submission.id}:`, error);
        }
      }
      
      return analysisMap;
    },
    enabled: recentSubmissions.length > 0
  });

  // Comprehensive AI Analysis Mutation
  const comprehensiveAnalysisMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      return await apiRequest("POST", "/api/analyze/comprehensive", { submissionId });
    },
    onSuccess: (result, submissionId) => {
      toast({
        title: t('ai.analysis_complete'),
        description: t('ai.comprehensive_analysis_done'),
      });
      
      // Remove from loading set
      setAiAnalysisLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(submissionId);
        return newSet;
      });
      
      // Refresh analysis data
      queryClient.invalidateQueries({ queryKey: ['/api/analyze/all-results'] });
      queryClient.invalidateQueries({ queryKey: [`/api/analyze/comprehensive/${submissionId}`] });
    },
    onError: (error: any, submissionId) => {
      toast({
        title: t('common.error'),
        description: t('ai.analysis_failed') + ": " + (error.message || 'Unknown error'),
        variant: "destructive",
      });
      
      // Remove from loading set
      setAiAnalysisLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(submissionId);
        return newSet;
      });
    },
  });

  // Function to trigger comprehensive AI analysis
  const triggerComprehensiveAnalysis = (submissionId: number) => {
    setAiAnalysisLoading(prev => new Set(prev).add(submissionId));
    comprehensiveAnalysisMutation.mutate(submissionId);
  };

  // Get AI analysis summary for submission from stored data
  const getAIAnalysisSummary = (submissionId: number) => {
    return submissionAnalysisQueries.data?.get(submissionId) || undefined;
  };

  // Generate short summary text for table display
  const getShortSummary = (analysis: any) => {
    if (!analysis) return "";
    
    const riskLevel = analysis.overallSuspicion > 70 ? t('proctoring.high_risk') : 
                     analysis.overallSuspicion > 40 ? t('proctoring.moderate_risk') : t('proctoring.low_risk');
    
    const violationText = analysis.criticalViolations > 0 ? t('proctoring.critical_violations') :
                         analysis.majorViolations > 0 ? t('proctoring.violations_detected') : 
                         t('proctoring.compliance_acceptable');
                         
    return `${riskLevel} - ${violationText} ${t('proctoring.with')} ${Math.round(analysis.overallSuspicion / 100)}% ${t('proctoring.suspicion_level')}.`;
  };

  // Enhance submissions with AI analysis
  const enhancedSubmissions: SubmissionWithAnalysis[] = recentSubmissions.map(submission => ({
    ...submission,
    aiAnalysis: getAIAnalysisSummary(submission.id)
  }));

  // Sort submissions function
  const sortSubmissions = (submissions: SubmissionWithAnalysis[]) => {
    return [...submissions].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.submittedAt!).getTime() - new Date(a.submittedAt!).getTime();
        case 'oldest':
          return new Date(a.submittedAt!).getTime() - new Date(b.submittedAt!).getTime();
        case 'highest_score':
          // Put null scores at the end
          if (a.score === null || a.score === undefined) return 1;
          if (b.score === null || b.score === undefined) return -1;
          return b.score - a.score;
        case 'lowest_score':
          // Put null scores at the end
          if (a.score === null || a.score === undefined) return 1;
          if (b.score === null || b.score === undefined) return -1;
          return a.score - b.score;
        case 'student_name':
          return (a.studentName || 'Unknown').localeCompare(b.studentName || 'Unknown');
        case 'student_name_desc':
          return (b.studentName || 'Unknown').localeCompare(a.studentName || 'Unknown');
        default:
          return 0;
      }
    });
  };

  // Group submissions by exam
  const examSubmissions = exams.map(exam => ({
    ...exam,
    submissions: sortSubmissions(enhancedSubmissions.filter(sub => sub.examId === exam.id))
  }));

  // Filter for specific exam if selectedExamId is provided
  const filteredExamSubmissions = selectedExamId 
    ? examSubmissions.filter(exam => exam.id === selectedExamId)
    : examSubmissions;

  // Get selected exam details for header
  const selectedExam = selectedExamId ? exams.find(exam => exam.id === selectedExamId) : null;

  const toggleExamExpansion = (examId: number) => {
    const newExpanded = new Set(expandedExams);
    if (newExpanded.has(examId)) {
      newExpanded.delete(examId);
    } else {
      newExpanded.add(examId);
    }
    setExpandedExams(newExpanded);
  };

  const getSuspicionBadge = (suspicion: number) => {
    if (suspicion > 80) {
      return <Badge className="bg-red-100 text-red-800">{t('proctoring.high_risk')}</Badge>;
    } else if (suspicion > 60) {
      return <Badge className="bg-orange-100 text-orange-800">{t('proctoring.moderate_risk')}</Badge>;
    } else if (suspicion > 40) {
      return <Badge className="bg-yellow-100 text-yellow-800">{t('proctoring.low_risk')}</Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-800">{t('proctoring.minimal_risk')}</Badge>;
    }
  };

  const getGradeBadge = (score: number, totalPoints: number) => {
    const percentage = (score / totalPoints) * 100;
    
    if (percentage >= 90) {
      return <Badge className="bg-green-100 text-green-800">A</Badge>;
    } else if (percentage >= 80) {
      return <Badge className="bg-blue-100 text-blue-800">B</Badge>;
    } else if (percentage >= 70) {
      return <Badge className="bg-yellow-100 text-yellow-800">C</Badge>;
    } else if (percentage >= 60) {
      return <Badge className="bg-orange-100 text-orange-800">D</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800">F</Badge>;
    }
  };

  const formatScore = (score: number | null | undefined, totalPoints: number) => {
    if (score === null || score === undefined) {
      return {
        display: "N/A",
        percentage: "Pending",
        badge: <Badge className="bg-gray-100 text-gray-800">Pending</Badge>
      };
    }
    
    const percentage = Math.round((score / totalPoints) * 100);
    return {
      display: `${score}/${totalPoints}`,
      percentage: `${percentage}%`,
      badge: getGradeBadge(score, totalPoints)
    };
  };

  const formatStudentName = (studentName: string | null | undefined) => {
    if (!studentName || studentName.trim() === '') {
      return 'Unknown Student';
    }
    return studentName.trim();
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} ${t('common.minutes_ago')}`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} ${hours > 1 ? t('common.hours_ago') : t('common.hour_ago')}`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} ${days > 1 ? t('common.days_ago') : t('common.day_ago')}`;
    }
  };

  if (examsLoading || submissionsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-16 bg-gray-100 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 results-container">
      {/* Header for specific exam results */}
      {selectedExam && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {t('results.results_for')}: {selectedExam.title}
              </h2>
              <p className="text-gray-600">
                {t('exam.subject')}: {selectedExam.subject} • {selectedExam.questionsCount} {t('dashboard.questions')} • {filteredExamSubmissions[0]?.submissions.length || 0} {t('dashboard.submissions')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-sm">
                {t(`dashboard.${selectedExam.status}`)}
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 stats-cards">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClipboardList className="h-8 w-8 text-primary" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">
                  {selectedExam ? 1 : exams.length}
                </div>
                <div className="text-sm text-gray-600">{selectedExam ? t('results.selected_exam') : t('dashboard.total_exams')}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-8 w-8 text-green-500" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">
                  {selectedExam ? filteredExamSubmissions[0]?.submissions.length || 0 : recentSubmissions.length}
                </div>
                <div className="text-sm text-gray-600">{selectedExam ? t('results.exam_submissions') : t('dashboard.total_submissions')}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-8 w-8 text-orange-500" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">
                  {recentSubmissions.length > 0 
                    ? `${Math.round(recentSubmissions.reduce((sum, sub) => sum + ((sub.score || 0) / sub.totalPoints * 100), 0) / recentSubmissions.length)}%`
                    : "0%"
                  }
                </div>
                <div className="text-sm text-gray-600">{t('dashboard.average_score')}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Medal className="h-8 w-8 text-yellow-500" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">
                  {recentSubmissions.length > 0 
                    ? `${Math.round(recentSubmissions.filter(sub => (sub.score || 0) / sub.totalPoints >= 0.6).length / recentSubmissions.length * 100)}%`
                    : "0%"
                  }
                </div>
                <div className="text-sm text-gray-600">{t('results.pass_rate')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Exams with Student Results and AI Analysis */}
      <div className="space-y-4">
        {examSubmissions.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <p className="text-gray-500">{t('results.no_exams_found')}</p>
                <p className="text-sm text-gray-400 mt-2">
                  {t('results.create_first_exam')}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredExamSubmissions.map((exam) => (
            <Card key={exam.id}>
              <Collapsible 
                open={expandedExams.has(exam.id)} 
                onOpenChange={() => toggleExamExpansion(exam.id)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {expandedExams.has(exam.id) ? (
                          <ChevronDown className="h-5 w-5 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-500" />
                        )}
                        <div>
                          <CardTitle className="text-lg">{exam.title}</CardTitle>
                          <div className="text-sm text-gray-500 mt-1">
                            {exam.subject} • {exam.submissions.length} {exam.submissions.length !== 1 ? t('results.students') : t('results.student')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <Badge variant={exam.status === 'published' ? 'default' : 'secondary'}>
                          {exam.status}
                        </Badge>
                        {exam.submissions.length > 0 && (
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              {(() => {
                                const gradedSubmissions = exam.submissions.filter(sub => sub.score !== null && sub.score !== undefined);
                                if (gradedSubmissions.length === 0) {
                                  return `${t('results.avg')}: Pending`;
                                }
                                const avgPercentage = Math.round(
                                  gradedSubmissions.reduce((sum, sub) => sum + ((sub.score! / sub.totalPoints) * 100), 0) / gradedSubmissions.length
                                );
                                return `${t('results.avg')}: ${avgPercentage}% (${gradedSubmissions.length}/${exam.submissions.length} graded)`;
                              })()}
                            </div>
                            <div className="text-xs text-gray-500">
                              {exam.submissions.filter(sub => sub.aiAnalysis && sub.aiAnalysis.overallSuspicion > 60).length} {t('proctoring.high_risk')}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent>
                    {exam.submissions.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">{t('results.no_submissions')}</p>
                      </div>
                    ) : (
                      <div>
                        {/* Sorting Controls */}
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-semibold">{t('submission.submissions')}</h3>
                          <div className="flex items-center gap-2">
                            <ArrowUpDown className="h-4 w-4 text-gray-500" />
                            <Select value={sortBy} onValueChange={setSortBy}>
                              <SelectTrigger className="w-48">
                                <SelectValue placeholder={t('submission.sort_by')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="newest">{t('submission.sort_newest_first')}</SelectItem>
                                <SelectItem value="oldest">{t('submission.sort_oldest_first')}</SelectItem>
                                <SelectItem value="highest_score">{t('submission.sort_highest_score')}</SelectItem>
                                <SelectItem value="lowest_score">{t('submission.sort_lowest_score')}</SelectItem>
                                <SelectItem value="student_name">{t('submission.sort_student_name')}</SelectItem>
                                <SelectItem value="student_name_desc">{t('submission.sort_student_name_desc')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t('student.name')}</TableHead>
                              <TableHead>{t('student.score')}</TableHead>
                              <TableHead>{t('results.grade')}</TableHead>
                              <TableHead>{t('results.ai_risk_level')}</TableHead>
                              <TableHead>{t('results.analysis_summary')}</TableHead>
                              <TableHead>{t('common.actions')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {exam.submissions.map((submission) => (
                              <TableRow key={submission.id}>
                                <TableCell>
                                  <div className="flex items-center">
                                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 text-sm font-medium mr-3">
                                      {submission.studentName.split(' ').map(n => n[0]).join('').toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="font-medium text-gray-900">{formatStudentName(submission.studentName)}</div>
                                      <div className="text-sm text-gray-500">
                                        {formatTimeAgo(submission.submittedAt!)}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {formatScore(submission.score, submission.totalPoints).display}
                                  <div className="text-xs text-gray-500">
                                    {formatScore(submission.score, submission.totalPoints).percentage}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {formatScore(submission.score, submission.totalPoints).badge}
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    {submission.aiAnalysis ? (
                                      <>
                                        {getSuspicionBadge(submission.aiAnalysis.overallSuspicion)}
                                        <div className="text-xs text-gray-500">
                                          {Math.round(submission.aiAnalysis.overallSuspicion / 100)}% {t('proctoring.suspicion')}
                                        </div>
                                      </>
                                    ) : (
                                      <div className="text-xs text-gray-400">{t('results.no_analysis')}</div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="max-w-md">
                                  <div className="space-y-2">
                                    {submission.aiAnalysis ? (
                                      <>
                                        <p className="text-sm text-gray-800 font-medium leading-relaxed">
                                          {getShortSummary(submission.aiAnalysis)}
                                        </p>
                                        <div className="flex flex-wrap gap-2 text-xs">
                                          {submission.aiAnalysis.criticalViolations > 0 && (
                                            <Badge variant="destructive" className="text-xs">
                                              {submission.aiAnalysis.criticalViolations} {t('proctoring.critical')}
                                            </Badge>
                                          )}
                                          {submission.aiAnalysis.majorViolations > 0 && (
                                            <Badge variant="secondary" className="text-xs">
                                              {submission.aiAnalysis.majorViolations} {t('proctoring.major')}
                                            </Badge>
                                          )}
                                          <span className="text-gray-500">
                                            {t('proctoring.screen')}: {submission.aiAnalysis.screenActivityScore}%
                                          </span>
                                          <span className="text-gray-500">
                                            {t('proctoring.behavior')}: {submission.aiAnalysis.behavioralScore}%
                                          </span>
                                        </div>
                                      </>
                                    ) : (
                                      <p className="text-sm text-gray-400">{t('results.run_ai_analysis')}</p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          title={t('results.comprehensive_monitoring')}
                                          onClick={() => setSelectedSubmission(submission)}
                                          className="flex items-center gap-1"
                                        >
                                          <Shield className="h-4 w-4" />
                                          <span className="hidden lg:inline">{t('results.monitor')}</span>
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="max-w-7xl w-[95vw] max-h-[90vh] overflow-y-auto">
                                        <DialogHeader>
                                          <DialogTitle className="flex items-center gap-2">
                                            <Shield className="h-5 w-5" />
                                            {t('results.comprehensive_monitoring')} - {formatStudentName(submission.studentName)}
                                          </DialogTitle>
                                          <DialogDescription>
                                            {t('results.comprehensive_view')} {formatStudentName(submission.studentName)} {t('results.exam_performance')}
                                          </DialogDescription>
                                        </DialogHeader>
                                        {selectedSubmission && (
                                          <ExamMonitoringDashboard 
                                            submissionId={selectedSubmission.id}
                                            examId={selectedSubmission.examId}
                                            tabMode="full"
                                          />
                                        )}
                                      </DialogContent>
                                    </Dialog>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
