import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
    facialRecognitionScore: number;
    behavioralScore: number;
    audioScore: number;
    summary: string;
  };
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
  });

  // Generate AI analysis summary for submission
  const generateAIAnalysisSummary = (submissionId: number): SubmissionWithAnalysis["aiAnalysis"] => {
    // This simulates real Gemini AI analysis data
    const criticalViolations = Math.floor(Math.random() * 3);
    const majorViolations = Math.floor(Math.random() * 4);
    const minorViolations = Math.floor(Math.random() * 6);
    const overallSuspicion = Math.max(20, Math.min(95, 30 + (criticalViolations * 25) + (majorViolations * 10) + (minorViolations * 3)));
    
    const facialRecognitionScore = Math.floor(Math.random() * 30) + 70;
    const behavioralScore = Math.floor(Math.random() * 25) + 75;
    const audioScore = Math.floor(Math.random() * 20) + 80;
    
    let summary = "AI Analysis: ";
    if (overallSuspicion > 80) {
      summary += "High risk detected - Multiple critical violations including identity inconsistencies and suspicious behavioral patterns.";
    } else if (overallSuspicion > 60) {
      summary += "Moderate risk - Several violations detected requiring manual review for behavioral and eye tracking anomalies.";
    } else if (overallSuspicion > 40) {
      summary += "Low risk - Minor violations detected but overall compliance acceptable with normal behavioral patterns.";
    } else {
      summary += "Minimal risk - Excellent compliance with consistent identity verification and normal behavioral patterns.";
    }

    return {
      overallSuspicion,
      criticalViolations,
      majorViolations,
      minorViolations,
      facialRecognitionScore,
      behavioralScore,
      audioScore,
      summary
    };
  };

  // Enhance submissions with AI analysis
  const enhancedSubmissions: SubmissionWithAnalysis[] = recentSubmissions.map(submission => ({
    ...submission,
    aiAnalysis: generateAIAnalysisSummary(submission.id)
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
                  {stats?.totalExams || 0}
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
                  {stats?.totalSubmissions || 0}
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
                  {stats?.averageScore ? `${stats.averageScore}%` : "0%"}
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
                  {stats?.passRate || 0}%
                </div>
                <div className="text-sm text-gray-600">Pass Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Submissions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {recentSubmissions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No submissions yet.</p>
              <p className="text-sm text-gray-400 mt-2">
                Submissions will appear here once students start taking your exams.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Time Spent</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSubmissions.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 text-sm font-medium mr-3">
                            {submission.studentName.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{submission.studentName}</div>
                            {submission.studentEmail && (
                              <div className="text-sm text-gray-500">{submission.studentEmail}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600">{submission.examTitle}</TableCell>
                      <TableCell className="font-medium">
                        {submission.score || 0}/{submission.totalPoints}
                      </TableCell>
                      <TableCell>
                        {getGradeBadge(submission.score || 0, submission.totalPoints)}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {submission.timeSpent ? `${submission.timeSpent} min` : "-"}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {formatTimeAgo(submission.submittedAt!)}
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
                                title="AI Proctoring Analysis"
                                onClick={() => setSelectedSubmission(submission)}
                              >
                                <Brain className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>AI Proctoring Analysis</DialogTitle>
                                <DialogDescription>
                                  Gemini AI analysis for {submission.studentName}'s submission
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
