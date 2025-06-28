import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// TypeScript declaration for global auto-save function
declare global {
  interface Window {
    videoRecorderAutoSave?: () => Promise<void>;
  }
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, 
  Clock, 
  Star, 
  HelpCircle, 
  ChevronLeft, 
  ChevronRight, 
  Flag,
  Send,
  CheckCircle,
  AlertCircle,
  Shield
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { uploadQueue } from "@/lib/upload-queue";
import ProctoringManager from "@/components/proctoring/proctoring-manager";
import ProctoringSetup from "@/components/proctoring/proctoring-setup";
import { VideoRecorder } from "@/components/video-recorder";
import type { ExamWithQuestions, Question } from "@shared/schema";

interface StudentExamProps {
  examId: number;
}

const studentInfoSchema = z.object({
  studentName: z.string().min(1, "Name is required"),
  studentEmail: z.string().email("Valid email is required").optional().or(z.literal("")),
});

type StudentInfo = z.infer<typeof studentInfoSchema>;

export default function StudentExam({ examId }: StudentExamProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [examStarted, setExamStarted] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [proctoringEnabled, setProctoringEnabled] = useState(false);
  const [proctoringSetupComplete, setProctoringSetupComplete] = useState(false);
  const [violations, setViolations] = useState<any[]>([]);
  const [submissionId, setSubmissionId] = useState<number | undefined>();
  const [proctoringSessionId, setProctoringSessionId] = useState<string | undefined>();
  const { toast } = useToast();

  const { data: exam, isLoading, error } = useQuery<ExamWithQuestions>({
    queryKey: [`/api/exams/${examId}`],
    enabled: !!examId,
  });

  const studentForm = useForm<StudentInfo>({
    resolver: zodResolver(studentInfoSchema),
    defaultValues: {
      studentName: "",
      studentEmail: "",
    },
  });

  // Create draft submission for video/audio recording
  const createDraftSubmissionMutation = useMutation({
    mutationFn: async (submissionData: any) => {
      const response = await apiRequest("POST", "/api/submissions", submissionData);
      return response.json();
    },
    onSuccess: (result) => {
      setSubmissionId(result.id);
      console.log(`Created draft submission with ID: ${result.id}`);
    },
    onError: (error) => {
      console.error("Failed to create draft submission:", error);
    },
  });

  const submitExamMutation = useMutation({
    mutationFn: async (submissionData: any) => {
      const response = await apiRequest("POST", "/api/submissions", submissionData);
      return response.json();
    },
    onSuccess: (result) => {
      setSubmissionResult(result);
      setSubmissionId(result.id);
      setExamSubmitted(true);
      
      // Update upload queue with submission ID for proper video association
      if (proctoringSessionId && result.id) {
        uploadQueue.updateSubmissionId(proctoringSessionId, result.id);
        console.log(`Updated video uploads for session ${proctoringSessionId} with submission ID ${result.id}`);
      }
      
      toast({
        title: "Exam Submitted!",
        description: "Your answers have been recorded successfully. All proctoring features have been disabled.",
      });
    },
    onError: (error) => {
      toast({
        title: "Submission Failed",
        description: "Failed to submit exam: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Handle proctoring violations
  const handleViolation = async (violation: any) => {
    setViolations(prev => [...prev, violation]);
    
    // Report violation to backend if submission exists
    if (submissionId) {
      try {
        await apiRequest("POST", "/api/proctoring/violation", {
          submissionId,
          type: violation.type,
          category: violation.category,
          description: violation.description,
          evidence: violation.evidence
        });
      } catch (error) {
        console.error("Failed to report violation:", error);
      }
    }

    // Handle critical violations
    if (violation.type === 'critical') {
      const criticalCount = violations.filter(v => v.type === 'critical').length;
      if (criticalCount >= 3) {
        toast({
          title: "Exam Terminated",
          description: "Too many critical violations detected. Your exam has been automatically submitted.",
          variant: "destructive"
        });
        handleSubmitExam();
      }
    }
  };

  // Timer effect
  useEffect(() => {
    if (examStarted && timeRemaining > 0 && !examSubmitted) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Auto-submit when time runs out
            handleSubmitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [examStarted, timeRemaining, examSubmitted]);

  const startExam = (studentData: StudentInfo) => {
    setStudentInfo(studentData);
    setTimeRemaining((exam?.duration || 60) * 60); // Convert minutes to seconds
    
    // Create draft submission for video/audio recording
    if (exam) {
      const draftSubmissionData = {
        examId: exam.id,
        studentName: studentData.studentName,
        studentEmail: studentData.studentEmail || undefined,
        answers: {},
        totalPoints: exam.totalPoints,
        timeSpent: 0,
        sessionId: proctoringSessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };
      createDraftSubmissionMutation.mutate(draftSubmissionData);
    }
    
    // Enable proctoring protection for all exams by default
    setProctoringEnabled(true);
  };

  const handleProctoringSetupComplete = () => {
    setProctoringSetupComplete(true);
    setExamStarted(true);
  };

  const handleSessionIdReady = (sessionId: string) => {
    setProctoringSessionId(sessionId);
    console.log(`Captured session ID: ${sessionId}`);
  };

  const handleAnswerChange = (questionId: number, answer: any) => {
    console.log(`Answer changed for question ${questionId}:`, answer);
    setAnswers(prev => {
      const newAnswers = {
        ...prev,
        [questionId]: answer
      };
      console.log('Updated answers state:', newAnswers);
      return newAnswers;
    });
  };

  const toggleFlag = (questionId: number) => {
    setFlaggedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const handleSubmitExam = () => {
    if (!exam || !studentInfo) return;

    const timeSpent = Math.round(((exam.duration * 60) - timeRemaining) / 60);
    
    const submissionData = {
      examId: exam.id,
      studentName: studentInfo.studentName,
      studentEmail: studentInfo.studentEmail || undefined,
      answers,
      totalPoints: exam.totalPoints,
      timeSpent,
      sessionId: proctoringSessionId,
    };

    console.log('Submitting exam with answers:', answers);
    console.log('Submission data:', submissionData);
    console.log('Total answers:', Object.keys(answers).length);

    submitExamMutation.mutate(submissionData);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    if (!exam) return 0;
    return Math.round((Object.keys(answers).length / exam.questions.length) * 100);
  };

  const currentQuestion = exam?.questions[currentQuestionIndex];

  // Show proctoring setup if enabled and not completed
  if (proctoringEnabled && !proctoringSetupComplete && !examStarted) {
    return (
      <ProctoringSetup 
        onSetupComplete={handleProctoringSetupComplete}
        examTitle={exam?.title || "Exam"}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading exam...</p>
        </div>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Exam Not Found</h1>
            <p className="text-gray-600">
              The exam you're looking for doesn't exist or is no longer available.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (exam.status !== "published") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Exam Not Available</h1>
            <p className="text-gray-600">
              This exam is not currently available for taking.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show submission result
  if (examSubmitted && submissionResult) {
    const percentage = Math.round((submissionResult.score / submissionResult.totalPoints) * 100);
    
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Exam Completed!</h1>
              <p className="text-gray-600 mb-6">Thank you for taking the exam.</p>
              
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Your Results</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Score</p>
                    <p className="text-2xl font-bold">{submissionResult.score}/{submissionResult.totalPoints}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Percentage</p>
                    <p className="text-2xl font-bold">{percentage}%</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Questions Answered</p>
                    <p className="text-lg font-semibold">{Object.keys(answers).length}/{exam.questions.length}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Time Spent</p>
                    <p className="text-lg font-semibold">{submissionResult.timeSpent} min</p>
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-gray-500">
                Your instructor will review your responses and provide detailed feedback.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show student info form before starting exam
  if (!examStarted) {
    return (
      <div className="min-h-screen bg-gray-50 pt-2 pb-8">
        <div className="max-w-2xl mx-auto px-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">
                {exam.title}
              </CardTitle>
              <div className="flex justify-center items-center space-x-6 text-sm text-gray-600">
                <span className="flex items-center">
                  <BookOpen className="h-4 w-4 mr-1" />
                  {exam.subject}
                </span>
                <span className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  {exam.duration} minutes
                </span>
                <span className="flex items-center">
                  <Star className="h-4 w-4 mr-1" />
                  {exam.totalPoints} points
                </span>
                <span className="flex items-center">
                  <HelpCircle className="h-4 w-4 mr-1" />
                  {exam.questions.length} questions
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {exam.instructions && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">Instructions:</h3>
                  <p className="text-sm text-gray-700">{exam.instructions}</p>
                </div>
              )}

              <Form {...studentForm}>
                <form onSubmit={studentForm.handleSubmit(startExam)} className="space-y-4">
                  <FormField
                    control={studentForm.control}
                    name="studentName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your full name" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={studentForm.control}
                    name="studentEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your email" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" size="lg">
                    Start Exam
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Main exam interface
  return (
    <div className="min-h-screen h-screen bg-gray-50 relative overflow-y-auto">
      {/* Proctoring Manager - AI Monitoring System */}
      {proctoringEnabled && examStarted && (
        <ProctoringManager
          isActive={examStarted && !examSubmitted}
          onViolation={handleViolation}
          examId={examId}
          submissionId={submissionId}
          onSessionIdReady={handleSessionIdReady}
        />
      )}
      
      {/* Main content - fullscreen optimized */}
      <div className="w-full h-full px-4 py-4 pt-16 relative z-10">
        <div className="max-w-4xl mx-auto h-full">
        {/* Compact Status (Optional - can be removed for more space) */}

        {/* Exam Header */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{exam.title}</h1>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span className="flex items-center">
                    <BookOpen className="h-4 w-4 mr-1" />
                    {exam.subject}
                  </span>
                  <span className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    {exam.duration} minutes
                  </span>
                  <span className="flex items-center">
                    <Star className="h-4 w-4 mr-1" />
                    {exam.totalPoints} points
                  </span>
                  <span className="flex items-center">
                    <HelpCircle className="h-4 w-4 mr-1" />
                    {exam.questions.length} questions
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${timeRemaining < 300 ? 'text-red-600' : 'text-orange-600'}`}>
                  {formatTime(timeRemaining)}
                </div>
                <div className="text-sm text-gray-600">Time Remaining</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progress Bar */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm text-gray-600">
                {Object.keys(answers).length} of {exam.questions.length} completed
              </span>
            </div>
            <Progress value={getProgressPercentage()} className="h-2" />
          </CardContent>
        </Card>

        {/* Question Card */}
        {currentQuestion && (
          <Card className="mb-6 border-2 border-gray-200 shadow-md">
            <CardContent className="p-8">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-4">
                  <Badge className="bg-blue-600 text-white px-3 py-1 text-sm">
                    Question {currentQuestionIndex + 1}
                  </Badge>
                  <span className="text-sm font-medium text-gray-600 capitalize bg-gray-100 px-3 py-1 rounded-full">
                    {currentQuestion.type.replace('_', ' ')}
                  </span>
                  <span className="text-sm font-medium text-green-600 bg-green-100 px-3 py-1 rounded-full">
                    {currentQuestion.points} points
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleFlag(currentQuestion.id)}
                  className={flaggedQuestions.has(currentQuestion.id) ? 'text-orange-600 hover:bg-orange-50' : 'text-gray-400 hover:bg-gray-50'}
                >
                  <Flag className="h-5 w-5" />
                </Button>
              </div>

              {/* Question Text - More Prominent */}
              <div className="mb-8 p-6 bg-blue-50 border-l-4 border-blue-500 rounded-lg">
                <h3 className="text-xl font-medium text-gray-900 leading-relaxed">
                  {currentQuestion.question}
                </h3>
              </div>

              {/* Answer Area */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">

                {/* Multiple Choice */}
                {currentQuestion.type === "multiple_choice" && currentQuestion.options && (
                  <RadioGroup
                    value={answers[currentQuestion.id] || ""}
                    onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                  >
                    <div className="space-y-3">
                      {(currentQuestion.options as string[]).map((option, index) => (
                        <div key={index} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                          <RadioGroupItem value={option} id={`option-${index}`} />
                          <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                )}

                {/* True/False */}
                {currentQuestion.type === "true_false" && (
                  <RadioGroup
                    value={answers[currentQuestion.id] || ""}
                    onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <RadioGroupItem value="True" id="true" />
                        <Label htmlFor="true" className="flex-1 cursor-pointer">True</Label>
                      </div>
                      <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <RadioGroupItem value="False" id="false" />
                        <Label htmlFor="false" className="flex-1 cursor-pointer">False</Label>
                      </div>
                    </div>
                  </RadioGroup>
                )}

                {/* Short Answer */}
                {currentQuestion.type === "short_answer" && (
                  <Input
                    value={answers[currentQuestion.id] || ""}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                    placeholder="Enter your answer..."
                    className="w-full"
                  />
                )}

                {/* Essay */}
                {currentQuestion.type === "essay" && (
                  <Textarea
                    value={answers[currentQuestion.id] || ""}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                    placeholder="Enter your essay response..."
                    rows={8}
                    className="w-full"
                  />
                )}

                {/* Video Response */}
                {currentQuestion.type === "video_response" && submissionId && (
                  <VideoRecorder
                    questionId={currentQuestion.id}
                    submissionId={submissionId}
                    questionType="video_response"
                    onRecordingComplete={(transcription, confidence) => {
                      handleAnswerChange(currentQuestion.id, {
                        transcription,
                        confidence,
                        type: 'video_response'
                      });
                    }}
                  />
                )}

                {/* Audio Response */}
                {currentQuestion.type === "audio_response" && submissionId && (
                  <VideoRecorder
                    questionId={currentQuestion.id}
                    submissionId={submissionId}
                    questionType="audio_response"
                    onRecordingComplete={(transcription, confidence) => {
                      handleAnswerChange(currentQuestion.id, {
                        transcription,
                        confidence,
                        type: 'audio_response'
                      });
                    }}
                  />
                )}
              </div>

              {/* Navigation and Actions */}
              <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="px-6 py-2"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>

                <Button
                  onClick={async () => {
                    const currentQuestion = exam.questions[currentQuestionIndex];
                    
                    // Auto-save video/audio recordings before moving to next question
                    if (currentQuestion.type === "video_response" || currentQuestion.type === "audio_response") {
                      if (window.videoRecorderAutoSave) {
                        await window.videoRecorderAutoSave();
                        console.log(`Auto-saved ${currentQuestion.type} for question ${currentQuestion.id}`);
                      }
                    }
                    
                    setCurrentQuestionIndex(Math.min(exam.questions.length - 1, currentQuestionIndex + 1));
                  }}
                  disabled={currentQuestionIndex === exam.questions.length - 1}
                  className="px-6 py-2"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Question Navigation */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h3 className="font-medium text-gray-900 mb-4">Question Navigation</h3>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-3 mb-4">
              {exam.questions.map((question, index) => (
                <Button
                  key={question.id}
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentQuestionIndex(index)}
                  className={`w-10 h-10 p-0 ${
                    index === currentQuestionIndex 
                      ? 'bg-primary text-white border-primary' 
                      : answers[question.id] 
                        ? 'bg-green-100 text-green-800 border-green-300'
                        : flaggedQuestions.has(question.id)
                          ? 'bg-orange-100 text-orange-800 border-orange-300'
                          : ''
                  }`}
                >
                  {index + 1}
                </Button>
              ))}
            </div>
            <div className="flex justify-center items-center space-x-6 text-xs text-gray-600">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
                <span>Answered</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-primary rounded"></div>
                <span>Current</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-orange-100 border border-orange-300 rounded"></div>
                <span>Flagged</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-white border border-gray-300 rounded"></div>
                <span>Not answered</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Section */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Ready to Submit?</h3>
                <p className="text-sm text-gray-600">
                  You have answered {Object.keys(answers).length} out of {exam.questions.length} questions.
                </p>
              </div>
              <Button
                onClick={() => {
                  if (window.confirm("Are you sure you want to submit your exam? This action cannot be undone.")) {
                    handleSubmitExam();
                  }
                }}
                disabled={submitExamMutation.isPending}
                className="bg-orange-500 hover:bg-orange-600"
              >
                <Send className="h-4 w-4 mr-2" />
                {submitExamMutation.isPending ? "Submitting..." : "Submit Exam"}
              </Button>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
