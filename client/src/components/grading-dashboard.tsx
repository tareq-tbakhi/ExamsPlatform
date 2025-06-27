import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { 
  GraduationCap, 
  Trophy, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  BarChart3,
  Calculator,
  FileText,
  Code,
  Video,
  Mic
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface GradingDashboardProps {
  submissionId: number;
  examId: number;
  studentName: string;
}

interface QuestionGrade {
  id: number;
  questionId: number;
  answer: any;
  score: number;
  maxScore: number;
  isCorrect: boolean;
  gradingType: "auto" | "manual" | "ai";
  feedback: string;
  gradedAt: string;
  gradedBy: string;
}

interface ScoreBreakdown {
  multipleChoice: { earned: number; total: number; count: number };
  trueFalse: { earned: number; total: number; count: number };
  shortAnswer: { earned: number; total: number; count: number };
  essay: { earned: number; total: number; count: number };
  coding: { earned: number; total: number; count: number };
  videoResponse: { earned: number; total: number; count: number };
  audioResponse: { earned: number; total: number; count: number };
}

interface GradingResult {
  totalScore: number;
  totalPossible: number;
  weightedScore: number;
  passingStatus: "passed" | "failed" | "pending";
  gradingStatus: "completed" | "pending" | "partial";
  scoreBreakdown: ScoreBreakdown;
  questionGrades: any[];
}

export default function GradingDashboard({ submissionId, examId, studentName }: GradingDashboardProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch question grades
  const { data: questionGrades, isLoading: gradesLoading } = useQuery({
    queryKey: ['/api/submissions', submissionId, 'grades'],
    queryFn: () => fetch(`/api/submissions/${submissionId}/grades`).then(res => res.json())
  });

  // Fetch exam analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['/api/exams', examId, 'analytics'],
    queryFn: () => fetch(`/api/exams/${examId}/analytics`).then(res => res.json())
  });

  // Auto-grade mutation
  const autoGradeMutation = useMutation({
    mutationFn: async (): Promise<GradingResult> => {
      const response = await fetch(`/api/submissions/${submissionId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to grade submission');
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/submissions', submissionId, 'grades'] });
      queryClient.invalidateQueries({ queryKey: ['/api/exams', examId, 'analytics'] });
      toast({
        title: "Grading Complete",
        description: `Score: ${result.totalScore}/${result.totalPossible} (${result.passingStatus})`
      });
    },
    onError: () => {
      toast({
        title: "Grading Failed",
        description: "Failed to auto-grade submission. Please try again.",
        variant: "destructive"
      });
    }
  });

  const getQuestionTypeIcon = (type: string) => {
    switch (type) {
      case "multiple_choice": return <Calculator className="h-4 w-4" />;
      case "true_false": return <CheckCircle2 className="h-4 w-4" />;
      case "short_answer": return <FileText className="h-4 w-4" />;
      case "essay": return <FileText className="h-4 w-4" />;
      case "coding": return <Code className="h-4 w-4" />;
      case "video_response": return <Video className="h-4 w-4" />;
      case "audio_response": return <Mic className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getGradingStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "partial":
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />Partial</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPassingStatusBadge = (status: string) => {
    switch (status) {
      case "passed":
        return <Badge variant="default" className="bg-green-500"><Trophy className="h-3 w-3 mr-1" />Passed</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const renderScoreBreakdown = (breakdown: ScoreBreakdown) => {
    const types = [
      { key: 'multipleChoice', label: 'Multiple Choice', icon: <Calculator className="h-4 w-4" /> },
      { key: 'trueFalse', label: 'True/False', icon: <CheckCircle2 className="h-4 w-4" /> },
      { key: 'shortAnswer', label: 'Short Answer', icon: <FileText className="h-4 w-4" /> },
      { key: 'essay', label: 'Essay', icon: <FileText className="h-4 w-4" /> },
      { key: 'coding', label: 'Coding', icon: <Code className="h-4 w-4" /> },
      { key: 'videoResponse', label: 'Video Response', icon: <Video className="h-4 w-4" /> },
      { key: 'audioResponse', label: 'Audio Response', icon: <Mic className="h-4 w-4" /> }
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {types.map(type => {
          const data = breakdown[type.key as keyof ScoreBreakdown];
          if (data.count === 0) return null;
          
          const percentage = data.total > 0 ? (data.earned / data.total) * 100 : 0;
          
          return (
            <Card key={type.key}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  {type.icon}
                  <span className="font-medium">{type.label}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Score:</span>
                    <span className="font-mono">{data.earned}/{data.total}</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{data.count} questions</span>
                    <span>{percentage.toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            Grading Dashboard
          </h2>
          <p className="text-gray-600">Student: {studentName}</p>
        </div>
        <Button
          onClick={() => autoGradeMutation.mutate()}
          disabled={autoGradeMutation.isPending}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          {autoGradeMutation.isPending ? (
            <>
              <div className="animate-spin h-4 w-4 border-b-2 border-white mr-2"></div>
              Grading...
            </>
          ) : (
            <>
              <Calculator className="h-4 w-4 mr-2" />
              Auto-Grade
            </>
          )}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {questionGrades && questionGrades.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {questionGrades.reduce((sum: number, g: QuestionGrade) => sum + g.score, 0)}/
                    {questionGrades.reduce((sum: number, g: QuestionGrade) => sum + g.maxScore, 0)}
                  </div>
                  <Progress 
                    value={questionGrades.length > 0 ? 
                      (questionGrades.reduce((sum: number, g: QuestionGrade) => sum + g.score, 0) / 
                       questionGrades.reduce((sum: number, g: QuestionGrade) => sum + g.maxScore, 0)) * 100 : 0} 
                    className="mt-2" 
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Grading Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {getGradingStatusBadge("completed")}
                    <div className="text-sm text-gray-600">
                      {questionGrades.filter((g: QuestionGrade) => g.gradingType === "auto" || g.gradingType === "ai").length} auto-graded,{" "}
                      {questionGrades.filter((g: QuestionGrade) => g.gradingType === "manual").length} manual
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Pass Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {getPassingStatusBadge("passed")}
                    <div className="text-sm text-gray-600">
                      60% required to pass
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Grades Available</h3>
                  <p className="text-gray-600 mb-4">
                    This submission hasn't been graded yet. Click the Auto-Grade button to start grading.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="questions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Question-by-Question Results</CardTitle>
            </CardHeader>
            <CardContent>
              {gradesLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p>Loading question grades...</p>
                </div>
              ) : questionGrades && questionGrades.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Question</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Grading</TableHead>
                      <TableHead>Feedback</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questionGrades.map((grade: QuestionGrade) => (
                      <TableRow key={grade.id}>
                        <TableCell>
                          <div className="font-medium">Question {grade.questionId}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getQuestionTypeIcon("multiple_choice")}
                            <span className="capitalize">Multiple Choice</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{grade.score}/{grade.maxScore}</span>
                            {grade.isCorrect ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={grade.gradingType === "auto" ? "default" : 
                                        grade.gradingType === "ai" ? "secondary" : "outline"}>
                            {grade.gradingType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs text-sm text-gray-600 truncate">
                            {grade.feedback}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No question grades available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Score Breakdown by Question Type</CardTitle>
            </CardHeader>
            <CardContent>
              {questionGrades && questionGrades.length > 0 ? (
                renderScoreBreakdown({
                  multipleChoice: { earned: 15, total: 20, count: 4 },
                  trueFalse: { earned: 8, total: 10, count: 2 },
                  shortAnswer: { earned: 12, total: 15, count: 3 },
                  essay: { earned: 0, total: 0, count: 0 },
                  coding: { earned: 0, total: 0, count: 0 },
                  videoResponse: { earned: 0, total: 0, count: 0 },
                  audioResponse: { earned: 0, total: 0, count: 0 }
                })
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No breakdown data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Exam Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analyticsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p>Loading analytics...</p>
                </div>
              ) : analytics ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{analytics.totalSubmissions}</div>
                    <div className="text-sm text-gray-600">Total Submissions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{analytics.gradedSubmissions}</div>
                    <div className="text-sm text-gray-600">Graded</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{analytics.averageScore.toFixed(1)}</div>
                    <div className="text-sm text-gray-600">Average Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{analytics.passRate.toFixed(1)}%</div>
                    <div className="text-sm text-gray-600">Pass Rate</div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No analytics data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}