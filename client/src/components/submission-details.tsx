import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, Clock, User, BookOpen, FileText } from "lucide-react";
import type { Submission, ExamWithQuestions } from "@shared/schema";

interface SubmissionDetailsProps {
  submissionId: number;
}

interface SubmissionDetailsResponse {
  submission: Submission;
  exam: ExamWithQuestions;
  answers: Record<string, any>;
  videoAnswers: any[];
  proctoringVideos: {
    filename: string;
    url: string;
    type: string;
    uploadedAt: string;
  }[];
}

export default function SubmissionDetails({ submissionId }: SubmissionDetailsProps) {
  const { data, isLoading, error } = useQuery<SubmissionDetailsResponse>({
    queryKey: [`/api/submissions/${submissionId}/details`],
    enabled: !!submissionId,
  });

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

  const { submission, exam, answers, proctoringVideos, videoAnswers } = data;
  const scorePercentage = submission.score ? Math.round((submission.score / submission.totalPoints) * 100) : 0;

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
              <p className="font-medium">{submission.studentName}</p>
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
                <p className="font-medium text-lg">{submission.score || 0}/{submission.totalPoints}</p>
                {getGradeBadge(scorePercentage)}
              </div>
              <p className="text-sm text-gray-500">{scorePercentage}%</p>
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

      {/* Questions and Answers */}
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
            
            return (
              <div key={question.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm font-medium">
                      Q{index + 1}
                    </span>
                    <Badge variant="outline">{question.type.replace('_', ' ')}</Badge>
                    <span className="text-sm text-gray-500">{question.points} points</span>
                  </div>
                  {getAnswerStatus(question.id, question.correctAnswer)}
                </div>
                
                <div className="mb-3">
                  <p className="font-medium text-gray-900 mb-2">{question.question}</p>
                  
                  {/* Show options for multiple choice */}
                  {question.type === "multiple_choice" && question.options && (
                    <div className="space-y-1 mb-3">
                      {(question.options as string[]).map((option, optIndex) => (
                        <div 
                          key={optIndex}
                          className={`p-2 rounded text-sm ${
                            option === question.correctAnswer
                              ? 'bg-green-50 text-green-800 border border-green-200'
                              : option === studentAnswer
                              ? 'bg-red-50 text-red-800 border border-red-200'
                              : 'bg-gray-50 text-gray-700'
                          }`}
                        >
                          {String.fromCharCode(65 + optIndex)}. {option}
                          {option === question.correctAnswer && (
                            <span className="ml-2 text-xs font-medium">(Correct)</span>
                          )}
                          {option === studentAnswer && option !== question.correctAnswer && (
                            <span className="ml-2 text-xs font-medium">(Student's Answer)</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator className="my-3" />

                {/* Student's Answer */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Student's Answer:</p>
                  {question.type === 'video_response' ? (
                    // Handle video response questions
                    (() => {
                      const videoAnswer = videoAnswers?.find(va => va.videoQuestionId === question.id);
                      return videoAnswer ? (
                        <div className="p-3 rounded bg-blue-50 text-blue-800 border border-blue-200">
                          <div className="mb-3">
                            <video controls className="w-full max-h-40 rounded">
                              <source src={videoAnswer.videoUrl} type="video/webm" />
                              Your browser does not support the video tag.
                            </video>
                          </div>
                          {videoAnswer.transcript && (
                            <div className="text-sm">
                              <strong>Transcription:</strong> {videoAnswer.transcript}
                            </div>
                          )}
                          {videoAnswer.score && (
                            <div className="text-sm mt-2">
                              <strong>Score:</strong> {videoAnswer.score}%
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 rounded bg-gray-50 text-gray-500 text-sm border border-gray-200">
                          No video response provided
                        </div>
                      );
                    })()
                  ) : studentAnswer ? (
                    <div className={`p-3 rounded text-sm ${
                      isCorrect 
                        ? 'bg-green-50 text-green-800 border border-green-200' 
                        : question.correctAnswer 
                        ? 'bg-red-50 text-red-800 border border-red-200'
                        : 'bg-gray-50 text-gray-700 border border-gray-200'
                    }`}>
                      {String(studentAnswer)}
                    </div>
                  ) : (
                    <div className="p-3 rounded bg-gray-50 text-gray-500 text-sm border border-gray-200">
                      No answer provided
                    </div>
                  )}
                </div>

                {/* Correct Answer for non-multiple choice */}
                {question.correctAnswer && question.type !== "multiple_choice" && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">Correct Answer:</p>
                    <div className="p-3 rounded bg-green-50 text-green-800 text-sm border border-green-200">
                      {question.correctAnswer}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>



      {/* Video Question Answers */}
      {videoAnswers && videoAnswers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Video Question Responses ({videoAnswers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {videoAnswers.map((answer, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Question {answer.questionId}</h4>
                    <Badge variant="outline">
                      Score: {answer.score || 'Pending'}
                    </Badge>
                  </div>
                  {answer.videoUrl && (
                    <div className="mb-3">
                      <video controls className="w-full max-h-40 rounded">
                        <source src={answer.videoUrl} type="video/webm" />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  )}
                  {answer.transcript && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Transcription:</p>
                      <div className="p-3 bg-gray-50 rounded text-sm">
                        {answer.transcript}
                      </div>
                      {answer.confidence && (
                        <p className="text-xs text-gray-500 mt-1">
                          Confidence: {Math.round(answer.confidence * 100)}%
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}