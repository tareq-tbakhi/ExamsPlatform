import { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Clock, User, BookOpen, Video, Mic, FileText, Camera, Monitor, Brain, Zap, Eye, AlertTriangle } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { Submission, ExamWithQuestions } from "@shared/schema";
// import { apiRequest } from '@/lib/utils';

interface SubmissionDetailsProps {
  submissionId: number;
}

interface SubmissionDetailsResponse {
  submission: Submission;
  exam: ExamWithQuestions;
  answers: Record<string, any>;
  videoAnswers: any[];
}

interface ProctoringDataResponse {
  videos: {
    camera: string[];
    screen: string[];
  };
  violations: any[];
  stats: {
    totalViolations: number;
    faceDetectionScore: number;
    behaviorScore: number;
    overallIntegrity: number;
  };
}

export default function SubmissionDetails({ submissionId }: SubmissionDetailsProps) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery<SubmissionDetailsResponse>({
    queryKey: [`/api/submissions/${submissionId}/details`],
    enabled: !!submissionId,
  });

  const { data: proctoringData } = useQuery<ProctoringDataResponse>({
    queryKey: [`/api/submissions/${submissionId}/proctoring`],
    enabled: !!submissionId,
  });

  const [isAIAnalysisOpen, setIsAIAnalysisOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Failed to load submission details</p>
      </div>
    );
  }

  const { submission, exam, answers, videoAnswers } = data;
  const scorePercentage = submission.score ? Math.round((submission.score / submission.totalPoints) * 100) : 0;
  
  // Debug logging to understand the data structure
  console.log('Submission details data:', { submission, exam, answers, videoAnswers, proctoringData });

  const getAnswerStatus = (questionId: number, correctAnswer?: string | null) => {
    const studentAnswer = answers[questionId.toString()];
    if (!studentAnswer) return null;
    
    if (correctAnswer && studentAnswer === correctAnswer) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    } else if (correctAnswer) {
      return <XCircle className="h-4 w-4 text-red-600" />;
    }
    return null; // For open-ended questions
  };

  const getGradeBadge = (percentage: number) => {
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
      badge: getGradeBadge(percentage)
    };
  };

  const formatStudentName = (studentName: string | null | undefined) => {
    if (!studentName || studentName.trim() === '') {
      return 'Unknown Student';
    }
    return studentName.trim();
  };

  const renderStudentAnswer = (question: any, studentAnswer: any, videoAnswers: any[], isCorrect: boolean): React.ReactNode => {
    if (question.type === 'video_response' || question.type === 'audio_response') {
      const answerData = studentAnswer;
      const videoAnswer = videoAnswers?.find(va => va.videoQuestionId === question.id);
      
      // Check if we have any video/audio response data
      const hasResponseData = (answerData && typeof answerData === 'object') || videoAnswer;
      
      // Construct media URL - check multiple possible locations
      let mediaUrl = null;
      
      if (question.type === 'audio_response') {
        // Handle audio responses
        if (answerData?.audioUrl) {
          mediaUrl = answerData.audioUrl;
        }
      } else {
        // Handle video responses
        if (videoAnswer?.videoUrl) {
          mediaUrl = videoAnswer.videoUrl;
        } else if (answerData?.videoUrl) {
          // If it's already a full URL, use it; otherwise construct it
          mediaUrl = answerData.videoUrl.startsWith('/') ? answerData.videoUrl : `/api/videos/answers/${answerData.videoUrl}`;
        } else if (answerData?.filename) {
          mediaUrl = `/api/videos/answers/${answerData.filename}`;
        }
      }
      
      const transcript = answerData?.transcription || answerData?.transcript || videoAnswer?.transcript || '';
      const confidence = answerData?.confidence || videoAnswer?.confidence;
      
      if (hasResponseData) {
        return (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 overflow-hidden">
            {/* Video/Audio Recording */}
            {mediaUrl && (
              <div className="p-4 bg-white/70 border-b border-blue-100">
                <div className="flex items-center gap-2 mb-3">
                  {question.type === 'video_response' ? (
                    <Video className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Mic className="h-5 w-5 text-blue-600" />
                  )}
                  <h4 className="font-medium text-gray-900">
                    {question.type === 'video_response' ? 'Video Recording' : 'Audio Recording'}
                  </h4>
                </div>
                {question.type === 'audio_response' ? (
                  <audio controls className="w-full">
                    <source src={mediaUrl} type="audio/webm" />
                    Your browser does not support the audio tag.
                  </audio>
                ) : (
                  <video controls className="w-full rounded-lg shadow-sm" style={{ maxHeight: '300px' }}>
                    <source src={mediaUrl} type="video/webm" />
                    Your browser does not support the video tag.
                  </video>
                )}
              </div>
            )}
            
            {/* Transcript Section */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-600" />
                  <h4 className="font-medium text-gray-900">Student's Answer</h4>
                </div>
                {confidence && (
                  <Badge 
                    variant="outline" 
                    className={`${
                      confidence > 0.8 ? 'border-green-500 text-green-700' : 
                      confidence > 0.6 ? 'border-yellow-500 text-yellow-700' : 
                      'border-red-500 text-red-700'
                    }`}
                  >
                    {Math.round(confidence * 100)}% confidence
                  </Badge>
                )}
              </div>
              
              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                {transcript && transcript.trim().length > 0 ? (
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-base">
                    {transcript}
                  </p>
                ) : (
                  <p className="text-gray-500 italic">No transcription available</p>
                )}
              </div>
            </div>
          </div>
        );
      } else {
        return (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 text-center">
            <div className="flex flex-col items-center gap-3">
              {question.type === 'video_response' ? (
                <Video className="h-8 w-8 text-gray-400" />
              ) : (
                <Mic className="h-8 w-8 text-gray-400" />
              )}
              <p className="text-gray-500">
                No {question.type === 'video_response' ? 'video' : 'audio'} response provided for this question
              </p>
            </div>
          </div>
        );
      }
    } else if (studentAnswer) {
      return (
        <div className={`p-4 rounded-lg text-sm border ${
          isCorrect 
            ? 'bg-green-50 text-green-800 border-green-200' 
            : question.correctAnswer 
            ? 'bg-red-50 text-red-800 border-red-200'
            : 'bg-gray-50 text-gray-700 border-gray-200'
        }`}>
          <strong>Student's Answer:</strong> {String(studentAnswer)}
        </div>
      );
    } else {
      return (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-center text-gray-500">
          No response provided for this question
        </div>
      );
    }
  };

  const handleAIAnalysis = (question: any) => {
    setSelectedQuestion(question);
    setIsAIAnalysisOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Submission Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Submission Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-gray-600">Student</p>
              <p className="font-medium">{formatStudentName(submission.studentName)}</p>
              {submission.studentEmail && (
                <p className="text-sm text-gray-500">{submission.studentEmail}</p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-600">Exam</p>
              <p className="font-medium">{exam.title}</p>
              <p className="text-sm text-gray-500">{exam.subject}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-600">Score</p>
              <div className="flex items-center space-x-2">
                <p className="font-medium text-lg">{formatScore(submission.score, submission.totalPoints).display}</p>
                {formatScore(submission.score, submission.totalPoints).badge}
              </div>
              <p className="text-sm text-gray-500">{formatScore(submission.score, submission.totalPoints).percentage}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-600">Time Spent</p>
              <div className="flex items-center space-x-1">
                <Clock className="h-4 w-4 text-gray-400" />
                <p className="font-medium">{submission.timeSpent || 0} minutes</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="questions" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="questions">Questions & Answers</TabsTrigger>
          <TabsTrigger value="camera">
            <Camera className="h-4 w-4 mr-2" />
            Camera Feed
          </TabsTrigger>
          <TabsTrigger value="screen">
            <Monitor className="h-4 w-4 mr-2" />
            Screen Recording
          </TabsTrigger>
        </TabsList>

        {/* Questions Tab */}
        <TabsContent value="questions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BookOpen className="h-5 w-5" />
                <span>Questions & Answers</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {exam.questions.map((question, index) => {
                const studentAnswer = answers[question.id.toString()];
                const isCorrect = question.correctAnswer && studentAnswer === question.correctAnswer;
                const isVideoQuestion = question.type === 'video_response' || question.type === 'audio_response';
                
                return (
                  <div key={question.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                          Question {index + 1}
                        </span>
                        <Badge variant="outline" className="capitalize">
                          {question.type.replace('_', ' ')}
                        </Badge>
                        <span className="text-sm text-gray-500">{question.points} points</span>
                      </div>
                      {!isVideoQuestion && getAnswerStatus(question.id, question.correctAnswer)}
                    </div>
                    
                    <div className="mb-4">
                      <div className="bg-blue-50 rounded-lg p-4 mb-4">
                        <p className="font-medium text-gray-900 text-lg">{String(question.question)}</p>
                      </div>
                      
                      {/* Show options for multiple choice */}
                      {question.type === "multiple_choice" && question.options && (
                        <div className="space-y-2 mb-4">
                          {(question.options as string[]).map((option, optIndex) => (
                            <div 
                              key={optIndex}
                              className={`p-3 rounded-lg text-sm transition-colors ${
                                option === question.correctAnswer
                                  ? 'bg-green-50 text-green-800 border border-green-200'
                                  : option === studentAnswer
                                  ? 'bg-red-50 text-red-800 border border-red-200'
                                  : 'bg-gray-50 text-gray-700 border border-gray-200'
                              }`}
                            >
                              <span className="font-bold mr-2">{String.fromCharCode(65 + optIndex)}.</span>
                              {String(option)}
                              {option === question.correctAnswer && (
                                <Badge className="ml-2 bg-green-600 text-white">Correct</Badge>
                              )}
                              {option === studentAnswer && option !== question.correctAnswer && (
                                <Badge className="ml-2 bg-red-600 text-white">Selected</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Separator className="my-4" />

                    {/* Student's Answer */}
                    {renderStudentAnswer(question, studentAnswer, videoAnswers, isCorrect || false)}

                    {/* Correct Answer for non-multiple choice */}
                    {question.correctAnswer && question.type !== "multiple_choice" && !isVideoQuestion && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Correct Answer:</p>
                        <div className="p-3 rounded-lg bg-green-50 text-green-800 text-sm border border-green-200">
                          {String(question.correctAnswer)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Camera Feed Tab */}
        <TabsContent value="camera">
          <div className="space-y-4">
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <CardTitle className="flex items-center space-x-2 text-xl">
                  <Camera className="h-6 w-6" />
                  <span>Camera Feed - Student Monitoring</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {proctoringData?.videos?.camera && proctoringData.videos.camera.length > 0 ? (
                  <div className="bg-black">
                    {proctoringData.videos.camera.map((videoUrl: string, idx: number) => (
                      <div key={idx} className="relative">
                        <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 z-10">
                          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                          Camera {idx + 1}
                        </div>
                        <video
                          controls
                          className="w-full"
                          style={{ maxHeight: '600px' }}
                          autoPlay={idx === 0}
                        >
                          <source src={videoUrl} type="video/webm" />
                          Your browser does not support the video tag.
                        </video>
                        {idx < proctoringData.videos.camera.length - 1 && (
                          <div className="h-px bg-gray-700"></div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-100 py-20">
                    <div className="text-center">
                      <Camera className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-xl font-medium text-gray-900 mb-2">No Camera Feed Available</p>
                      <p className="text-gray-600">
                        Camera monitoring was not active during this exam session
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Camera Stats */}
            {proctoringData?.videos?.camera && proctoringData.videos.camera.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recording Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{proctoringData.videos.camera.length}</p>
                      <p className="text-sm text-gray-600">Camera Segments</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{proctoringData.stats?.faceDetectionScore || 0}%</p>
                      <p className="text-sm text-gray-600">Face Detection</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">{proctoringData.stats?.behaviorScore || 0}%</p>
                      <p className="text-sm text-gray-600">Behavior Score</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-orange-600">{proctoringData.stats?.overallIntegrity || 0}%</p>
                      <p className="text-sm text-gray-600">Overall Integrity</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Screen Recording Tab */}
        <TabsContent value="screen">
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-600 to-teal-600 text-white">
              <CardTitle className="flex items-center space-x-2 text-xl">
                <Monitor className="h-6 w-6" />
                <span>Screen Recording - Activity Monitoring</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {proctoringData?.videos?.screen && proctoringData.videos.screen.length > 0 ? (
                <div className="bg-gray-900">
                  {proctoringData.videos.screen.map((videoUrl: string, idx: number) => (
                    <div key={idx} className="relative">
                      <div className="absolute top-4 left-4 bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 z-10">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        Screen Capture {idx + 1}
                      </div>
                      <video
                        controls
                        className="w-full"
                        style={{ maxHeight: '700px' }}
                      >
                        <source src={videoUrl} type="video/webm" />
                        Your browser does not support the video tag.
                      </video>
                      {idx < proctoringData.videos.screen.length - 1 && (
                        <div className="h-px bg-gray-700"></div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-100 py-20">
                  <div className="text-center">
                    <Monitor className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-xl font-medium text-gray-900 mb-2">No Screen Recording Available</p>
                    <p className="text-gray-600">
                      Screen capture was not active during this exam session
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* AI Analysis Dialog */}
      <Dialog open={isAIAnalysisOpen} onOpenChange={setIsAIAnalysisOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">AI Analysis</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>AI Analysis</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Add AI analysis components here */}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}