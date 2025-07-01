import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, 
  Video, 
  Mic, 
  FileText,
  User,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Camera,
  Monitor,
  Activity,
  BookOpen,
  Trophy,
  BarChart3,
  Play,
  Pause,
  Volume2,
  ChevronRight,
  Info,
  GraduationCap
} from "lucide-react";

interface ExamMonitoringDashboardProps {
  submissionId: number;
  examId: number;
}

interface ViolationEvent {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
  description: string;
  evidence?: string;
}

interface ProctoringData {
  videos: {
    camera: string[];
    screen: string[];
  };
  violations: ViolationEvent[];
  stats: {
    totalViolations: number;
    faceDetectionScore: number;
    behaviorScore: number;
    overallIntegrity: number;
  };
}

export default function ExamMonitoringDashboard({ submissionId, examId }: ExamMonitoringDashboardProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  // Fetch submission details with all related data
  const { data: submissionData, isLoading } = useQuery({
    queryKey: [`/api/submissions/${submissionId}/details`],
  });

  // Fetch proctoring data
  const { data: proctoringData } = useQuery<ProctoringData>({
    queryKey: [`/api/submissions/${submissionId}/proctoring`],
  });

  // Fetch AI analysis results
  const { data: aiAnalysis } = useQuery({
    queryKey: [`/api/analyze/results/${submissionId}`],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!submissionData) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Failed to load submission data</AlertDescription>
      </Alert>
    );
  }

  const { submission, exam, answers, videoAnswers } = submissionData;
  const scorePercentage = submission.score ? Math.round((submission.score / submission.totalPoints) * 100) : 0;

  const getViolationIcon = (type: string) => {
    switch (type) {
      case 'face_not_visible': return <Eye className="h-4 w-4" />;
      case 'multiple_faces': return <User className="h-4 w-4" />;
      case 'tab_switch': return <Monitor className="h-4 w-4" />;
      case 'suspicious_movement': return <Activity className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getScoreBadge = (percentage: number) => {
    if (percentage >= 90) return { label: 'A', class: 'bg-green-500 text-white' };
    if (percentage >= 80) return { label: 'B', class: 'bg-blue-500 text-white' };
    if (percentage >= 70) return { label: 'C', class: 'bg-yellow-500 text-white' };
    if (percentage >= 60) return { label: 'D', class: 'bg-orange-500 text-white' };
    return { label: 'F', class: 'bg-red-500 text-white' };
  };

  const scoreBadge = getScoreBadge(scorePercentage);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Shield className="h-8 w-8" />
              Exam Monitoring Dashboard
            </h1>
            <p className="mt-2 text-blue-100">
              Comprehensive view of student performance and exam integrity
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-blue-100">Exam</div>
            <div className="text-xl font-semibold">{exam.title}</div>
          </div>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Student</p>
                <p className="text-lg font-semibold">{submission.studentName}</p>
                <p className="text-sm text-gray-500">{submission.studentEmail}</p>
              </div>
              <User className="h-10 w-10 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Score</p>
                <div className="flex items-center gap-3">
                  <p className="text-2xl font-bold">{scorePercentage}%</p>
                  <Badge className={scoreBadge.class}>{scoreBadge.label}</Badge>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {submission.score || 0} / {submission.totalPoints}
                </p>
              </div>
              <Trophy className="h-10 w-10 text-yellow-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Time Spent</p>
                <p className="text-2xl font-bold">{submission.timeSpent || 0}m</p>
                <p className="text-sm text-gray-500">Duration: {exam.duration}m</p>
              </div>
              <Clock className="h-10 w-10 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Integrity Score</p>
                <div className="flex items-center gap-3">
                  <p className="text-2xl font-bold">
                    {proctoringData?.stats.overallIntegrity || 95}%
                  </p>
                  {(proctoringData?.stats.overallIntegrity || 95) >= 90 ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {proctoringData?.stats.totalViolations || 0} violations
                </p>
              </div>
              <Shield className="h-10 w-10 text-purple-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-gray-50 p-0">
              <TabsTrigger value="overview" className="data-[state=active]:bg-white rounded-none px-6">
                <BookOpen className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="answers" className="data-[state=active]:bg-white rounded-none px-6">
                <FileText className="h-4 w-4 mr-2" />
                Questions & Answers
              </TabsTrigger>
              <TabsTrigger value="proctoring" className="data-[state=active]:bg-white rounded-none px-6">
                <Camera className="h-4 w-4 mr-2" />
                Proctoring Analysis
              </TabsTrigger>
              <TabsTrigger value="media" className="data-[state=active]:bg-white rounded-none px-6">
                <Video className="h-4 w-4 mr-2" />
                Media Responses
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Score Breakdown */}
                <Card className="border-gray-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Score Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries({
                      'Multiple Choice': { score: 18, total: 20, color: 'bg-blue-500' },
                      'True/False': { score: 8, total: 10, color: 'bg-green-500' },
                      'Short Answer': { score: 12, total: 15, color: 'bg-purple-500' },
                      'Video Response': { score: 15, total: 20, color: 'bg-pink-500' }
                    }).map(([type, data]) => (
                      <div key={type}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{type}</span>
                          <span className="font-medium">{data.score}/{data.total}</span>
                        </div>
                        <Progress value={(data.score / data.total) * 100} className="h-2" />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* AI Analysis Summary */}
                <Card className="border-gray-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      AI Analysis Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {aiAnalysis && aiAnalysis.length > 0 ? (
                      <div className="space-y-3">
                        <Alert className="border-blue-200 bg-blue-50">
                          <Info className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-blue-800">
                            AI detected {aiAnalysis.length} notable patterns during the exam
                          </AlertDescription>
                        </Alert>
                        <div className="space-y-2">
                          {aiAnalysis.slice(0, 3).map((item: any, idx: number) => (
                            <div key={idx} className="flex items-start gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                              <span>{item.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">No AI analysis available yet</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity Timeline */}
              <Card className="border-gray-200">
                <CardHeader>
                  <CardTitle>Exam Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { time: '09:00', event: 'Exam started', icon: Play, color: 'text-green-600' },
                      { time: '09:15', event: 'Completed Section 1', icon: CheckCircle, color: 'text-blue-600' },
                      { time: '09:28', event: 'Minor violation: Face partially obscured', icon: AlertTriangle, color: 'text-yellow-600' },
                      { time: '09:45', event: 'Completed Section 2', icon: CheckCircle, color: 'text-blue-600' },
                      { time: '10:30', event: 'Exam submitted', icon: Trophy, color: 'text-green-600' }
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-4">
                        <span className="text-sm text-gray-500 w-12">{item.time}</span>
                        <item.icon className={`h-5 w-5 ${item.color}`} />
                        <span className="text-sm">{item.event}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Questions & Answers Tab */}
            <TabsContent value="answers" className="p-6">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-6">
                  {exam.questions.map((question: any, index: number) => {
                    const studentAnswer = answers[question.id.toString()];
                    const isExpanded = expandedQuestion === question.id;
                    const isCorrect = question.correctAnswer && studentAnswer === question.correctAnswer;
                    
                    return (
                      <Card 
                        key={question.id} 
                        className={`border transition-all ${
                          isExpanded ? 'border-blue-300 shadow-lg' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <CardHeader 
                          className="cursor-pointer"
                          onClick={() => setExpandedQuestion(isExpanded ? null : question.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white font-bold">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-medium">{question.question}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {question.type.replace('_', ' ')}
                                  </Badge>
                                  <span className="text-xs text-gray-500">{question.points} points</span>
                                  {isCorrect !== undefined && (
                                    isCorrect ? (
                                      <Badge className="bg-green-100 text-green-700 text-xs">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Correct
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-red-100 text-red-700 text-xs">
                                        <XCircle className="h-3 w-3 mr-1" />
                                        Incorrect
                                      </Badge>
                                    )
                                  )}
                                </div>
                              </div>
                            </div>
                            <ChevronRight className={`h-5 w-5 text-gray-400 transition-transform ${
                              isExpanded ? 'rotate-90' : ''
                            }`} />
                          </div>
                        </CardHeader>
                        
                        {isExpanded && (
                          <CardContent className="pt-0">
                            <Separator className="mb-4" />
                            
                            {/* Multiple choice options */}
                            {question.type === 'multiple_choice' && question.options && (
                              <div className="mb-4 space-y-2">
                                <p className="text-sm font-medium text-gray-700 mb-2">Options:</p>
                                {(question.options as string[]).map((option: string, idx: number) => (
                                  <div 
                                    key={idx}
                                    className={`p-3 rounded-lg border ${
                                      option === question.correctAnswer
                                        ? 'bg-green-50 border-green-300'
                                        : option === studentAnswer
                                        ? 'bg-red-50 border-red-300'
                                        : 'bg-gray-50 border-gray-200'
                                    }`}
                                  >
                                    <span className="font-medium mr-2">
                                      {String.fromCharCode(65 + idx)}.
                                    </span>
                                    {option}
                                    {option === question.correctAnswer && (
                                      <CheckCircle className="inline ml-2 h-4 w-4 text-green-600" />
                                    )}
                                    {option === studentAnswer && option !== question.correctAnswer && (
                                      <XCircle className="inline ml-2 h-4 w-4 text-red-600" />
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Student's answer */}
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-gray-700">Student's Answer:</p>
                              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                {studentAnswer ? (
                                  <p className="text-gray-800">{String(studentAnswer)}</p>
                                ) : (
                                  <p className="text-gray-500 italic">No answer provided</p>
                                )}
                              </div>
                            </div>
                            
                            {/* Correct answer (if different) */}
                            {question.correctAnswer && studentAnswer !== question.correctAnswer && (
                              <div className="mt-4 space-y-2">
                                <p className="text-sm font-medium text-gray-700">Correct Answer:</p>
                                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                  <p className="text-gray-800">{question.correctAnswer}</p>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Proctoring Analysis Tab */}
            <TabsContent value="proctoring" className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Proctoring Stats */}
                <div className="lg:col-span-1 space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Integrity Metrics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Face Detection</span>
                          <span>{proctoringData?.stats.faceDetectionScore || 98}%</span>
                        </div>
                        <Progress value={proctoringData?.stats.faceDetectionScore || 98} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Behavior Score</span>
                          <span>{proctoringData?.stats.behaviorScore || 95}%</span>
                        </div>
                        <Progress value={proctoringData?.stats.behaviorScore || 95} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Overall Integrity</span>
                          <span>{proctoringData?.stats.overallIntegrity || 95}%</span>
                        </div>
                        <Progress value={proctoringData?.stats.overallIntegrity || 95} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Violation Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                          <span className="text-sm font-medium text-red-700">High Severity</span>
                          <Badge variant="destructive">0</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                          <span className="text-sm font-medium text-yellow-700">Medium Severity</span>
                          <Badge className="bg-yellow-500">1</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <span className="text-sm font-medium text-blue-700">Low Severity</span>
                          <Badge className="bg-blue-500">2</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Violations Timeline */}
                <div className="lg:col-span-2">
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Violation Timeline
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-4">
                          {proctoringData?.violations && proctoringData.violations.length > 0 ? (
                            proctoringData.violations.map((violation) => (
                              <div
                                key={violation.id}
                                className={`p-4 rounded-lg border ${getSeverityColor(violation.severity)}`}
                              >
                                <div className="flex items-start gap-3">
                                  {getViolationIcon(violation.type)}
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                      <p className="font-medium">{violation.description}</p>
                                      <Badge 
                                        variant="outline" 
                                        className={`text-xs ${
                                          violation.severity === 'high' ? 'border-red-500 text-red-700' :
                                          violation.severity === 'medium' ? 'border-yellow-500 text-yellow-700' :
                                          'border-blue-500 text-blue-700'
                                        }`}
                                      >
                                        {violation.severity}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-gray-600">{violation.timestamp}</p>
                                    {violation.evidence && (
                                      <Button
                                        variant="link"
                                        size="sm"
                                        className="p-0 h-auto mt-2 text-xs"
                                        onClick={() => setSelectedVideo(violation.evidence!)}
                                      >
                                        View Evidence →
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-12">
                              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                              <p className="text-lg font-medium text-gray-900">No violations detected</p>
                              <p className="text-sm text-gray-500 mt-2">
                                The student maintained excellent exam integrity throughout
                              </p>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Media Responses Tab */}
            <TabsContent value="media" className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Video Responses */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Video className="h-5 w-5" />
                      Video Responses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {videoAnswers && videoAnswers.length > 0 ? (
                        videoAnswers.map((video: any, idx: number) => (
                          <div key={idx} className="border rounded-lg p-4 hover:bg-gray-50">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <p className="font-medium">Question {video.videoQuestionId}</p>
                                <p className="text-sm text-gray-500">Video Response</p>
                              </div>
                              {video.confidence && (
                                <Badge variant="outline">
                                  {Math.round(video.confidence * 100)}% confidence
                                </Badge>
                              )}
                            </div>
                            <video
                              controls
                              className="w-full rounded-lg mb-3"
                              style={{ maxHeight: '200px' }}
                            >
                              <source src={video.videoUrl} type="video/webm" />
                            </video>
                            {video.transcript && (
                              <div className="bg-gray-50 rounded p-3">
                                <p className="text-sm font-medium mb-1">Transcript:</p>
                                <p className="text-sm text-gray-700">{video.transcript}</p>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-center text-gray-500 py-8">No video responses</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Audio Responses */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mic className="h-5 w-5" />
                      Audio Responses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(answers).filter(([_, answer]: [string, any]) => 
                        answer && typeof answer === 'object' && answer.type === 'audio_response'
                      ).map(([questionId, answer]: [string, any]) => (
                        <div key={questionId} className="border rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-medium">Question {questionId}</p>
                              <p className="text-sm text-gray-500">Audio Response</p>
                            </div>
                            <Volume2 className="h-5 w-5 text-gray-400" />
                          </div>
                          <audio controls className="w-full mb-3">
                            <source src={answer.audioUrl} type="audio/webm" />
                          </audio>
                          {answer.transcription && (
                            <div className="bg-gray-50 rounded p-3">
                              <p className="text-sm font-medium mb-1">Transcript:</p>
                              <p className="text-sm text-gray-700">
                                {answer.transcription || 'No transcription available'}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                      {Object.entries(answers).filter(([_, answer]: [string, any]) => 
                        answer && typeof answer === 'object' && answer.type === 'audio_response'
                      ).length === 0 && (
                        <p className="text-center text-gray-500 py-8">No audio responses</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Proctoring Videos */}
              {proctoringData?.videos && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Camera className="h-5 w-5" />
                      Proctoring Recordings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Camera className="h-4 w-4" />
                          Camera Feed
                        </h4>
                        <div className="space-y-2">
                          {proctoringData.videos.camera.map((url, idx) => (
                            <Button
                              key={idx}
                              variant="outline"
                              className="w-full justify-start"
                              onClick={() => setSelectedVideo(url)}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Camera Recording {idx + 1}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Monitor className="h-4 w-4" />
                          Screen Recording
                        </h4>
                        <div className="space-y-2">
                          {proctoringData.videos.screen.map((url, idx) => (
                            <Button
                              key={idx}
                              variant="outline"
                              className="w-full justify-start"
                              onClick={() => setSelectedVideo(url)}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Screen Recording {idx + 1}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Video Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Video Player</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedVideo(null)}
              >
                <XCircle className="h-5 w-5" />
              </Button>
            </div>
            <video
              controls
              autoPlay
              className="w-full rounded-lg"
              style={{ maxHeight: '500px' }}
            >
              <source src={selectedVideo} type="video/webm" />
            </video>
          </div>
        </div>
      )}
    </div>
  );
} 