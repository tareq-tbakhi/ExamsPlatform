import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible";
import { ClipboardList, Users, TrendingUp, Medal, Eye, Brain, ChevronDown, ChevronRight, AlertTriangle, CheckCircle } from "lucide-react";
import AIAnalysisDashboard from "@/components/ai-analysis-dashboard";
import SubmissionDetails from "@/components/submission-details";
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

export default function ResultsView() {
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithExam | null>(null);
  const [expandedExams, setExpandedExams] = useState<Set<number>>(new Set());
  
  // Mock user ID - in real app this would come from authentication
  const userId = 1;

  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
  });

  const { data: exams = [], isLoading: examsLoading } = useQuery<ExamWithStats[]>({
    queryKey: [`/api/exams/creator/${userId}`],
  });

  const { data: recentSubmissions = [], isLoading: submissionsLoading } = useQuery<SubmissionWithExam[]>({
    queryKey: ["/api/submissions/recent"],
    refetchInterval: 2000, // Refetch every 2 seconds to show latest submissions
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache the data (TanStack Query v5 uses gcTime instead of cacheTime)
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

  // Get AI analysis summary for submission from stored data
  const getAIAnalysisSummary = (submissionId: number) => {
    return submissionAnalysisQueries.data?.get(submissionId) || undefined;
  };

  // Enhance submissions with AI analysis
  const enhancedSubmissions: SubmissionWithAnalysis[] = recentSubmissions.map(submission => ({
    ...submission,
    aiAnalysis: getAIAnalysisSummary(submission.id)
  }));

  // Group submissions by exam
  const examSubmissions = exams.map(exam => ({
    ...exam,
    submissions: enhancedSubmissions.filter(sub => sub.examId === exam.id)
  }));

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
      return <Badge className="bg-red-100 text-red-800">High Risk</Badge>;
    } else if (suspicion > 60) {
      return <Badge className="bg-orange-100 text-orange-800">Moderate Risk</Badge>;
    } else if (suspicion > 40) {
      return <Badge className="bg-yellow-100 text-yellow-800">Low Risk</Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-800">Minimal Risk</Badge>;
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

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minutes ago`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} day${days > 1 ? 's' : ''} ago`;
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
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClipboardList className="h-8 w-8 text-primary" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">
                  {exams.length}
                </div>
                <div className="text-sm text-gray-600">Total Exams</div>
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
                  {recentSubmissions.length}
                </div>
                <div className="text-sm text-gray-600">Total Submissions</div>
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
                <div className="text-sm text-gray-600">Average Score</div>
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
                <div className="text-sm text-gray-600">Pass Rate</div>
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
                <p className="text-gray-500">No exams found.</p>
                <p className="text-sm text-gray-400 mt-2">
                  Create your first exam to see results here.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          examSubmissions.map((exam) => (
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
                            {exam.subject} • {exam.submissions.length} student{exam.submissions.length !== 1 ? 's' : ''}
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
                              Avg: {Math.round(exam.submissions.reduce((sum, sub) => sum + ((sub.score || 0) / sub.totalPoints * 100), 0) / exam.submissions.length)}%
                            </div>
                            <div className="text-xs text-gray-500">
                              {exam.submissions.filter(sub => sub.aiAnalysis && sub.aiAnalysis.overallSuspicion > 60).length} high-risk
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
                        <p className="text-gray-500">No submissions yet for this exam.</p>
                      </div>
                    ) : (
                      <div>
                        {/* AI Analysis Summary Section */}
                        {exam.submissions.some(sub => sub.aiAnalysis) && (
                          <div className="mb-6">
                            <h3 className="text-lg font-semibold mb-3">AI Analysis Summary</h3>
                            <div className="space-y-3">
                              {exam.submissions.filter(sub => sub.aiAnalysis).map((submission) => (
                                <Card key={`summary-${submission.id}`} className="bg-blue-50 border-blue-200">
                                  <CardContent className="pt-4">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          <span className="font-medium text-blue-900">{submission.studentName}</span>
                                          <Badge variant={
                                            submission.aiAnalysis!.overallSuspicion > 70 ? "destructive" :
                                            submission.aiAnalysis!.overallSuspicion > 40 ? "secondary" : "default"
                                          }>
                                            {submission.aiAnalysis!.overallSuspicion}% Risk
                                          </Badge>
                                        </div>
                                        <p className="text-sm text-gray-700 leading-relaxed">
                                          {submission.aiAnalysis!.summary}
                                        </p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Submissions Table */}
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student</TableHead>
                              <TableHead>Score</TableHead>
                              <TableHead>Grade</TableHead>
                              <TableHead>AI Risk Level</TableHead>
                              <TableHead>Analysis Summary</TableHead>
                              <TableHead>Actions</TableHead>
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
                                      <div className="font-medium text-gray-900">{submission.studentName}</div>
                                      <div className="text-sm text-gray-500">
                                        {formatTimeAgo(submission.submittedAt!)}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {submission.score || 0}/{submission.totalPoints}
                                  <div className="text-xs text-gray-500">
                                    {Math.round((submission.score || 0) / submission.totalPoints * 100)}%
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {getGradeBadge(submission.score || 0, submission.totalPoints)}
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    {submission.aiAnalysis ? (
                                      <>
                                        {getSuspicionBadge(submission.aiAnalysis.overallSuspicion)}
                                        <div className="text-xs text-gray-500">
                                          {submission.aiAnalysis.overallSuspicion}% suspicion
                                        </div>
                                      </>
                                    ) : (
                                      <div className="text-xs text-gray-400">No analysis</div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="max-w-md">
                                  <div className="space-y-2">
                                    {submission.aiAnalysis ? (
                                      <>
                                        <p className="text-sm text-gray-800 font-medium leading-relaxed">
                                          {submission.aiAnalysis.summary}
                                        </p>
                                        <div className="flex flex-wrap gap-2 text-xs">
                                          {submission.aiAnalysis.criticalViolations > 0 && (
                                            <Badge variant="destructive" className="text-xs">
                                              {submission.aiAnalysis.criticalViolations} Critical
                                            </Badge>
                                          )}
                                          {submission.aiAnalysis.majorViolations > 0 && (
                                            <Badge variant="secondary" className="text-xs">
                                              {submission.aiAnalysis.majorViolations} Major
                                            </Badge>
                                          )}
                                          <span className="text-gray-500">
                                            Screen: {submission.aiAnalysis.screenActivityScore}%
                                          </span>
                                          <span className="text-gray-500">
                                            Behavior: {submission.aiAnalysis.behavioralScore}%
                                          </span>
                                        </div>
                                      </>
                                    ) : (
                                      <p className="text-sm text-gray-400">Run Enhanced AI Analysis</p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          title="View Details"
                                          onClick={() => setSelectedSubmission(submission)}
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                        <DialogHeader>
                                          <DialogTitle>Submission Details</DialogTitle>
                                          <DialogDescription>
                                            Detailed answers for {submission.studentName}'s submission
                                          </DialogDescription>
                                        </DialogHeader>
                                        {selectedSubmission && (
                                          <SubmissionDetails submissionId={selectedSubmission.id} />
                                        )}
                                      </DialogContent>
                                    </Dialog>
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          title="Full AI Analysis"
                                          onClick={() => setSelectedSubmission(submission)}
                                        >
                                          <Brain className="h-4 w-4" />
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                                        <DialogHeader>
                                          <DialogTitle>Complete AI Proctoring Analysis</DialogTitle>
                                          <DialogDescription>
                                            Full Gemini AI analysis for {submission.studentName}'s submission
                                          </DialogDescription>
                                        </DialogHeader>
                                        {selectedSubmission && (
                                          <AIAnalysisDashboard 
                                            submissionId={selectedSubmission.id}
                                            examTitle={selectedSubmission.examTitle}
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
