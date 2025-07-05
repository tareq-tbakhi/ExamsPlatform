import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from 'react-i18next';

// TypeScript declaration for global auto-save function
declare global {
  interface Window {
    videoRecorderAutoSave?: () => Promise<void>;
    proctoringSessionId?: string;
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Shield,
  Video,
  Mic,
  Eye,
  FileText,
  User,
  Calendar,
  Target,
  Zap,
  Save,
  ArrowRight,
  ArrowLeft,
  Home,
  List,
  PenTool,
  X,
  Edit,
  AlertTriangle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { uploadQueue } from "@/lib/upload-queue";
import ProctoringManager from "@/components/proctoring/proctoring-manager";
import ProctoringSetup from "@/components/proctoring/proctoring-setup";
import { VideoRecorder } from "@/components/video-recorder";
import AudioQuestion from "@/components/proctoring/audio-question";
import type { ExamWithQuestions, Question } from "@shared/schema";

interface StudentExamProps {
  examId: number;
}

const studentInfoSchema = z.object({
  studentName: z.string().min(1, "Student name is required"),
  studentEmail: z.string().email("Valid email is required").optional(),
  studentId: z.string().optional(),
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
  const [proctoringSessionId, setProctoringSessionId] = useState<string>("");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saving' | 'saved' | 'error' | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { t } = useTranslation();
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

  const submitExamMutation = useMutation({
    mutationFn: async (submissionData: any) => {
      const response = await apiRequest("POST", "/api/submissions", submissionData);
      return response.json();
    },
    onSuccess: (data) => {
      setSubmissionResult(data);
      setExamSubmitted(true);
      setSubmissionId(data.id);
      setShowReviewModal(false);
      
      // uploadQueue.clear();
      
      toast({
        title: t('student.exam_submitted'),
        description: t('student.exam_submitted_successfully'),
        variant: "default",
      });
    },
    onError: (error) => {
      console.error("Submission failed:", error);
      toast({
        title: t('common.error'),
        description: t('student.submission_failed'),
        variant: "destructive",
      });
    },
  });

  const handleViolation = async (violation: any) => {
    setViolations(prev => [...prev, violation]);
    
    // Show warning toast
    toast({
      title: t('student.violation_detected'),
      description: violation.message,
      variant: "destructive",
    });
  };

  // Auto-save functionality
  useEffect(() => {
    if (!examStarted || examSubmitted) return;

    const autoSaveInterval = setInterval(() => {
      if (Object.keys(answers).length > 0) {
        setAutoSaveStatus('saving');
        // Simulate auto-save (in real implementation, this would save to localStorage or send to server)
        setTimeout(() => {
          setAutoSaveStatus('saved');
          setTimeout(() => setAutoSaveStatus(null), 2000);
        }, 500);
      }
    }, 30000); // Auto-save every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [examStarted, examSubmitted, answers]);

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
    // Make session ID available globally for video recorder
    window.proctoringSessionId = sessionId;
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
    
    // Trigger auto-save status
    setAutoSaveStatus('saving');
    setTimeout(() => {
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus(null), 2000);
    }, 500);
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

  const handleSubmitClick = () => {
    setShowReviewModal(true);
  };

  const handleSubmitExam = async () => {
    if (!exam || !studentInfo) return;

    // Auto-save any pending video/audio recordings before submitting
    const videoQuestions = exam.questions.filter(q => 
      q.type === "video_response" || q.type === "audio_response"
    );
    
    if (videoQuestions.length > 0 && window.videoRecorderAutoSave) {
      console.log("Auto-saving video/audio recordings before submission...");
      await window.videoRecorderAutoSave();
    }

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
    console.log('Session ID for proctoring videos:', proctoringSessionId);

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

  // Helper function to render question type badge
  const renderQuestionTypeBadge = (type: string) => {
    if (type === 'video_response') {
      return (
        <div className="text-sm font-medium capitalize px-3 py-1 rounded-full inline-flex items-center gap-2 bg-purple-100 text-purple-700 border border-purple-200">
          <Video className="h-4 w-4" />
          <span>{t('student.video_response')}</span>
        </div>
      );
    } else if (type === 'audio_response') {
      return (
        <div className="text-sm font-medium capitalize px-3 py-1 rounded-full inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 border border-indigo-200">
          <Mic className="h-4 w-4" />
          <span>{t('student.audio_response')}</span>
        </div>
      );
    } else if (type === 'multiple_choice') {
      return (
        <div className="text-sm font-medium capitalize px-3 py-1 rounded-full inline-flex items-center gap-2 bg-blue-100 text-blue-700 border border-blue-200">
          <List className="h-4 w-4" />
          <span>{t('student.multiple_choice')}</span>
        </div>
      );
    } else if (type === 'essay') {
      return (
        <div className="text-sm font-medium capitalize px-3 py-1 rounded-full inline-flex items-center gap-2 bg-green-100 text-green-700 border border-green-200">
          <PenTool className="h-4 w-4" />
          <span>{t('student.essay')}</span>
        </div>
      );
    } else {
      return (
        <div className="text-sm font-medium capitalize px-3 py-1 rounded-full inline-flex items-center gap-2 bg-gray-100 text-gray-600 border border-gray-200">
          <FileText className="h-4 w-4" />
          <span>{type.replace('_', ' ')}</span>
        </div>
      );
    }
  };

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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-6"></div>
          <p className="text-lg font-medium text-gray-700">{t('student.loading_exam')}</p>
          <p className="text-sm text-gray-500 mt-2">Please wait while we prepare your exam...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-rose-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('common.error')}</h1>
          <p className="text-gray-600 mb-6">{t('student.failed_to_load_exam')}</p>
          <Button onClick={() => window.location.reload()} className="bg-red-600 hover:bg-red-700">
            {t('common.try_again')}
          </Button>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <HelpCircle className="h-16 w-16 text-gray-400 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('student.exam_not_found')}</h1>
          <p className="text-gray-600">{t('student.exam_not_available')}</p>
        </div>
      </div>
    );
  }

  // Show submission result
  if (examSubmitted && submissionResult) {
    const percentage = Math.round((submissionResult.score / submissionResult.totalPoints) * 100);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <Card className="border-0 shadow-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white text-center py-12">
              <div className="flex flex-col items-center">
                <CheckCircle className="h-24 w-24 text-white mb-6 animate-pulse" />
                <h1 className="text-4xl font-bold mb-2">{t('student.exam_completed')}</h1>
                <p className="text-green-100 text-lg">{t('student.thank_you')}</p>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="bg-gradient-to-r from-gray-50 to-white rounded-2xl p-8 mb-8 border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">{t('student.your_results')}</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="bg-blue-100 rounded-full p-4 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                      <Target className="h-8 w-8 text-blue-600" />
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{t('student.score')}</p>
                    <p className="text-2xl font-bold text-gray-900">{submissionResult.score}/{submissionResult.totalPoints}</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-green-100 rounded-full p-4 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                      <Star className="h-8 w-8 text-green-600" />
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{t('student.percentage')}</p>
                    <p className="text-2xl font-bold text-gray-900">{percentage}%</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-purple-100 rounded-full p-4 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                      <CheckCircle className="h-8 w-8 text-purple-600" />
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{t('student.questions_answered')}</p>
                    <p className="text-2xl font-bold text-gray-900">{Object.keys(answers).length}/{exam.questions.length}</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-orange-100 rounded-full p-4 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                      <Clock className="h-8 w-8 text-orange-600" />
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{t('student.time_spent')}</p>
                    <p className="text-2xl font-bold text-gray-900">{submissionResult.timeSpent} min</p>
                  </div>
                </div>
              </div>
              
              <div className="text-center">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
                  <Shield className="h-12 w-12 text-blue-600 mx-auto mb-3" />
                  <p className="text-blue-800 font-medium">
                    {t('student.instructor_feedback')}
                  </p>
                </div>
                
                <Button 
                  onClick={() => window.location.href = '/'}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 rounded-xl font-semibold"
                >
                  <Home className="h-5 w-5 mr-2" />
                  Return to Dashboard
                </Button>
              </div>
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
              <div className="flex justify-center items-center space-x-6 text-sm text-gray-600 exam-header">
                <span className="flex items-center">
                  <BookOpen className="h-4 w-4 mr-1" />
                  {exam.subject}
                </span>
                <span className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  {exam.duration} {t('student.minutes')}
                </span>
                <span className="flex items-center">
                  <Star className="h-4 w-4 mr-1" />
                  {exam.totalPoints} {t('exam.points')}
                </span>
                <span className="flex items-center">
                  <HelpCircle className="h-4 w-4 mr-1" />
                  {exam.questions.length} {t('exam.questions')}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {exam.instructions && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg exam-instructions">
                  <h3 className="font-medium text-gray-900 mb-2">{t('exam.instructions')}:</h3>
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
                        <FormLabel>{t('student.name')} *</FormLabel>
                        <FormControl>
                          <Input placeholder={t('student.enter_name')} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={studentForm.control}
                    name="studentEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('student.email')} ({t('common.optional')})</FormLabel>
                        <FormControl>
                          <Input placeholder={t('student.enter_email')} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" size="lg">
                    {t('student.start_button')}
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
    <div className="h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden">
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
      
      {/* Auto-save indicator */}
      {autoSaveStatus && (
        <div className="fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg p-3 border border-gray-200">
          <div className="flex items-center text-sm">
            <Save className="h-4 w-4 mr-2 text-blue-600" />
            <span className={autoSaveStatus === 'saving' ? 'text-blue-600' : autoSaveStatus === 'saved' ? 'text-green-600' : 'text-red-600'}>
              {autoSaveStatus === 'saving' ? 'Saving...' : 
               autoSaveStatus === 'saved' ? 'Saved' : 
               'Error'}
            </span>
          </div>
        </div>
      )}

      {/* Main Layout - Flex container for full screen */}
      <div className="flex h-full">
        {/* Main Content Area - Takes remaining space */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Exam Header - Fixed at top */}
          <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-4 flex-shrink-0">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold text-gray-900 mb-1">{exam.title}</h1>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span className="flex items-center">
                    <BookOpen className="h-4 w-4 mr-1" />
                    {exam.subject}
                  </span>
                  <span className="flex items-center">
                    <HelpCircle className="h-4 w-4 mr-1" />
                    {exam.questions.length} {t('exam.questions')}
                  </span>
                  <span className="flex items-center">
                    <Star className="h-4 w-4 mr-1" />
                    {exam.totalPoints} {t('exam.points')}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${timeRemaining < 300 ? 'text-red-600' : 'text-orange-600'}`}>
                  {formatTime(timeRemaining)}
                </div>
                <div className="text-sm text-gray-600">{t('exam.time_remaining')}</div>
              </div>
            </div>
          </div>

          {/* Progress Bar - Fixed below header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">{t('common.progress')}</span>
              <span className="text-sm text-gray-600">
                {Object.keys(answers).length}/{exam.questions.length} {t('exam.answered')}
              </span>
            </div>
            <Progress value={getProgressPercentage()} className="h-2" />
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-4xl mx-auto">
              {/* Question Card */}
              {currentQuestion && (
                <Card className="mb-6 border-2 border-gray-200 shadow-md">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center space-x-4">
                        <Badge className="bg-blue-600 text-white px-3 py-1 text-sm">
                          {t('exam.question')} {currentQuestionIndex + 1}
                        </Badge>
                        {renderQuestionTypeBadge(currentQuestion.type)}
                        <span className="text-sm font-medium text-green-600 bg-green-100 px-3 py-1 rounded-full">
                          {currentQuestion.points} {t('exam.points')}
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

                    {/* Question Text */}
                    {currentQuestion.type !== "audio_response" && (
                      <div className="mb-8 p-6 bg-blue-50 border-l-4 border-blue-500 rounded-lg">
                        <h3 className="text-xl font-medium text-gray-900 leading-relaxed">
                          {String(currentQuestion.question || '')}
                        </h3>
                      </div>
                    )}

                    {/* Answer Area */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                      {/* Multiple Choice */}
                      {currentQuestion.type === "multiple_choice" && currentQuestion.options && (
                        <RadioGroup
                          value={answers[currentQuestion.id] || ""}
                          onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                        >
                          <div className="space-y-3">
                            {(currentQuestion.options as string[]).map((option, index) => (
                              <div key={index} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                                <RadioGroupItem value={String(option)} id={`option-${index}`} />
                                <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                                  {String(option)}
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
                              <Label htmlFor="true" className="flex-1 cursor-pointer">{t('common.true')}</Label>
                            </div>
                            <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                              <RadioGroupItem value="False" id="false" />
                              <Label htmlFor="false" className="flex-1 cursor-pointer">{t('common.false')}</Label>
                            </div>
                          </div>
                        </RadioGroup>
                      )}

                      {/* Short Answer */}
                      {currentQuestion.type === "short_answer" && (
                        <Input
                          value={answers[currentQuestion.id] || ""}
                          onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                          placeholder={t('exam.enter_answer')}
                          className="w-full"
                        />
                      )}

                      {/* Essay */}
                      {currentQuestion.type === "essay" && (
                        <Textarea
                          value={answers[currentQuestion.id] || ""}
                          onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                          placeholder={t('exam.enter_essay_response')}
                          rows={8}
                          className="w-full"
                        />
                      )}

                      {/* Video Response */}
                      {currentQuestion.type === "video_response" && (
                        <VideoRecorder
                          questionId={currentQuestion.id}
                          submissionId={submissionId || 0}
                          questionType="video_response"
                          onRecordingComplete={(transcription, confidence, videoUrl) => {
                            handleAnswerChange(currentQuestion.id, {
                              transcription,
                              confidence,
                              type: 'video_response',
                              videoUrl
                            });
                          }}
                        />
                      )}

                      {/* Audio Response */}
                      {currentQuestion.type === "audio_response" && (
                        <AudioQuestion
                          questionId={currentQuestion.id}
                          questionText={currentQuestion.question}
                          questionNumber={currentQuestionIndex + 1}
                          duration={180}
                          sessionId={proctoringSessionId}
                          onAnswerSave={(transcript, audioUrl) => {
                            handleAnswerChange(currentQuestion.id, {
                              transcription: transcript,
                              type: 'audio_response',
                              audioUrl
                            });
                          }}
                          savedAnswer={
                            answers[currentQuestion.id] ? {
                              transcript: answers[currentQuestion.id].transcription || "",
                              audioUrl: answers[currentQuestion.id].audioUrl
                            } : undefined
                          }
                        />
                      )}
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                        disabled={currentQuestionIndex === 0}
                        className="px-6 py-2"
                      >
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        {t('student.previous_question')}
                      </Button>

                      <Button
                        onClick={async () => {
                          if (currentQuestionIndex === exam.questions.length - 1) {
                            handleSubmitClick();
                          } else {
                            const currentQuestion = exam.questions[currentQuestionIndex];
                            
                            // Auto-save video/audio recordings before moving to next question
                            if (currentQuestion.type === "video_response" || currentQuestion.type === "audio_response") {
                              if (window.videoRecorderAutoSave) {
                                await window.videoRecorderAutoSave();
                                console.log(`Auto-saved ${currentQuestion.type} for question ${currentQuestion.id}`);
                              }
                            }
                            
                            setCurrentQuestionIndex(Math.min(exam.questions.length - 1, currentQuestionIndex + 1));
                          }
                        }}
                        className={currentQuestionIndex === exam.questions.length - 1 ? "px-6 py-2 bg-green-600 hover:bg-green-700" : "px-6 py-2"}
                      >
                        {currentQuestionIndex === exam.questions.length - 1 ? (
                          <>
                            Review & Submit
                            <CheckCircle className="h-4 w-4 ml-2" />
                          </>
                        ) : (
                          <>
                            {t('student.next_question')}
                            <ChevronRight className="h-4 w-4 ml-2" />
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Question Navigation Grid */}
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <h3 className="font-medium text-gray-900 mb-4">{t('student.navigation')}</h3>
                  <div className="grid grid-cols-8 sm:grid-cols-12 lg:grid-cols-15 gap-2 mb-4">
                    {exam.questions.map((question, index) => (
                      <Button
                        key={question.id}
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentQuestionIndex(index)}
                        className={`w-8 h-8 p-0 text-xs ${
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
                  <div className="flex justify-center items-center space-x-4 text-xs text-gray-600">
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
                      <span>{t('exam.answered')}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-primary rounded"></div>
                      <span>{t('exam.current')}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-orange-100 border border-orange-300 rounded"></div>
                      <span>{t('exam.flagged')}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-white border border-gray-300 rounded"></div>
                      <span>{t('exam.not_answered')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Mobile Sidebar Toggle Button */}
        <Button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="md:hidden mobile-sidebar-toggle bg-blue-600 hover:bg-blue-700 text-white"
          size="lg"
        >
          <Eye className="h-5 w-5" />
        </Button>

        {/* Fixed Sidebar - Submit Section */}
        <div className={`w-80 bg-white border-l border-gray-200 shadow-lg flex flex-col 
          md:relative md:transform-none md:transition-none
          ${isMobileSidebarOpen ? 'exam-sidebar open' : 'exam-sidebar'}
        `}>
          {/* Sidebar Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 flex-shrink-0">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold mb-1">Ready to Submit?</h3>
                <p className="text-blue-100 text-sm">Review your progress</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="md:hidden text-white hover:bg-white/20 p-2"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 p-4 overflow-y-auto exam-sidebar-content">
            {/* Progress Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-4 border border-blue-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Progress</span>
                <Badge className="bg-blue-600 text-white">
                  {Object.keys(answers).length}/{exam.questions.length}
                </Badge>
              </div>
              <Progress value={getProgressPercentage()} className="h-2 mb-2" />
              <div className="text-xs text-gray-600">
                {Object.keys(answers).length} answered, {exam.questions.length - Object.keys(answers).length} remaining
              </div>
            </div>

            {/* Quick Stats */}
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                  <span className="text-sm font-medium text-green-800">Answered</span>
                </div>
                <span className="text-sm font-bold text-green-800">{Object.keys(answers).length}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center">
                  <Flag className="h-4 w-4 text-orange-600 mr-2" />
                  <span className="text-sm font-medium text-orange-800">Flagged</span>
                </div>
                <span className="text-sm font-bold text-orange-800">{flaggedQuestions.size}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center">
                  <HelpCircle className="h-4 w-4 text-gray-600 mr-2" />
                  <span className="text-sm font-medium text-gray-800">Remaining</span>
                </div>
                <span className="text-sm font-bold text-gray-800">{exam.questions.length - Object.keys(answers).length}</span>
              </div>
            </div>

            {/* Warnings */}
            {Object.keys(answers).length < exam.questions.length && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <div className="flex items-center mb-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                  <span className="text-sm font-medium text-yellow-800">Incomplete</span>
                </div>
                <p className="text-xs text-yellow-700">
                  You have {exam.questions.length - Object.keys(answers).length} unanswered questions
                </p>
              </div>
            )}

            {flaggedQuestions.size > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                <div className="flex items-center mb-2">
                  <Flag className="h-4 w-4 text-orange-600 mr-2" />
                  <span className="text-sm font-medium text-orange-800">Review Flagged</span>
                </div>
                <p className="text-xs text-orange-700">
                  You have {flaggedQuestions.size} flagged questions to review
                </p>
              </div>
            )}
          </div>

          {/* Sidebar Footer - Submit Buttons */}
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="space-y-3">
              <Button
                onClick={handleSubmitClick}
                variant="outline"
                className="w-full py-3 px-4 border-2 border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold rounded-lg"
              >
                <Eye className="h-4 w-4 mr-2" />
                Review All Answers
              </Button>
              
              <Button
                onClick={handleSubmitClick}
                className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-lg shadow-lg"
              >
                <Send className="h-4 w-4 mr-2" />
                Submit Exam
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Review Modal - Full Screen Mobile Responsive */}
      {showReviewModal && (
        <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
          <DialogContent className="w-full h-full max-w-none max-h-none m-0 p-0 rounded-none sm:w-[95vw] sm:h-[95vh] sm:max-w-[95vw] sm:max-h-[95vh] sm:rounded-lg sm:m-auto">
            {/* Header */}
            <DialogHeader className="bg-gradient-to-r from-slate-600 to-gray-600 text-white p-4 sm:p-6">
              <div className="flex justify-between items-center">
                <div>
                  <DialogTitle className="text-xl sm:text-2xl font-bold">Review Your Answers</DialogTitle>
                  <p className="text-slate-200 text-sm sm:text-base mt-1">
                    Please review all your answers before submitting
                  </p>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <div className="text-right">
                    <div className="text-xs sm:text-sm text-slate-200">Time Remaining</div>
                    <div className={`text-lg sm:text-xl font-bold ${timeRemaining < 300 ? 'text-red-300' : 'text-white'}`}>
                      {formatTime(timeRemaining)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowReviewModal(false)}
                    className="text-white hover:bg-white/20 p-1 sm:p-2"
                  >
                    <X className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </div>
              </div>
            </DialogHeader>

            {/* Scrollable Content */}
            <ScrollArea className="flex-1 p-4 sm:p-6 max-h-[calc(100vh-200px)] sm:max-h-[calc(95vh-200px)]">
              {/* Progress Overview */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg sm:rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 border border-blue-200">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 sm:mb-4">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-0">Exam Progress</h2>
                  <Badge className="bg-blue-600 text-white px-3 py-1 text-xs sm:text-sm w-fit">
                    {Object.keys(answers).length} of {exam.questions.length} answered
                  </Badge>
                </div>
                <Progress value={getProgressPercentage()} className="h-2 sm:h-3 mb-2" />
                <div className="flex justify-between text-xs sm:text-sm text-gray-600">
                  <span>Answered: {Object.keys(answers).length}</span>
                  <span>Remaining: {exam.questions.length - Object.keys(answers).length}</span>
                </div>
              </div>

              {/* Questions Review - Compact for Mobile */}
              <div className="space-y-3 sm:space-y-4 pb-4">
                {exam.questions.map((question, index) => {
                  const hasAnswer = answers[question.id];
                  const isFlagged = flaggedQuestions.has(question.id);
                  
                  return (
                    <Card 
                      key={question.id} 
                      className={`border-2 ${
                        hasAnswer ? 'border-green-200 bg-green-50' : 
                        isFlagged ? 'border-orange-200 bg-orange-50' : 
                        'border-red-200 bg-red-50'
                      }`}
                    >
                      <CardContent className="p-3 sm:p-4">
                        {/* Question Header */}
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3">
                          <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-0">
                            <Badge className="bg-gray-600 text-white px-2 py-1 text-xs">
                              Q{index + 1}
                            </Badge>
                            {renderQuestionTypeBadge(question.type)}
                            <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">
                              {question.points}pts
                            </span>
                            {isFlagged && (
                              <Badge className="bg-orange-100 text-orange-800 border border-orange-300 text-xs">
                                <Flag className="h-3 w-3 mr-1" />
                                Flagged
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCurrentQuestionIndex(index);
                              setShowReviewModal(false);
                            }}
                            className="text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-2"
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        </div>
                        
                        {/* Question Text - Truncated for Mobile */}
                        <div className="mb-3 p-2 sm:p-3 bg-white rounded border border-gray-200">
                          <h3 className="text-sm sm:text-base font-medium text-gray-900 leading-relaxed line-clamp-2 sm:line-clamp-none">
                            {String(question.question || '')}
                          </h3>
                        </div>
                        
                        {/* Answer Display - Compact */}
                        <div className="bg-white rounded p-2 sm:p-3 border border-gray-200">
                          {hasAnswer ? (
                            <div>
                              <div className="flex items-center mb-1 sm:mb-2">
                                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                                <span className="text-xs sm:text-sm font-medium text-green-800">Your Answer:</span>
                              </div>
                              <div className="text-gray-900 text-sm">
                                {question.type === 'multiple_choice' || question.type === 'true_false' ? (
                                  <span className="font-medium">{String(answers[question.id])}</span>
                                ) : question.type === 'video_response' ? (
                                  <div className="flex items-center space-x-2">
                                    <Video className="h-4 w-4 text-purple-600" />
                                    <span className="text-xs sm:text-sm">Video recorded</span>
                                    {answers[question.id]?.transcription && (
                                      <span className="text-xs text-gray-600 truncate">
                                        - "{answers[question.id].transcription.substring(0, 30)}..."
                                      </span>
                                    )}
                                  </div>
                                ) : question.type === 'audio_response' ? (
                                  <div className="flex items-center space-x-2">
                                    <Mic className="h-4 w-4 text-indigo-600" />
                                    <span className="text-xs sm:text-sm">Audio recorded</span>
                                    {answers[question.id]?.transcription && (
                                      <span className="text-xs text-gray-600 truncate">
                                        - "{answers[question.id].transcription.substring(0, 30)}..."
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs sm:text-sm line-clamp-3">{String(answers[question.id])}</p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center text-red-600">
                              <AlertCircle className="h-4 w-4 mr-2" />
                              <span className="text-xs sm:text-sm font-medium">No answer provided</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Footer Actions */}
            <DialogFooter className="border-t bg-gray-50 p-4 sm:p-6 flex-shrink-0">
              <div className="flex flex-col sm:flex-row w-full gap-3 sm:gap-4">
                {/* Warning for unanswered questions */}
                {Object.keys(answers).length < exam.questions.length && (
                  <div className="bg-orange-100 border border-orange-300 rounded-lg p-3 mb-3 sm:mb-0">
                    <div className="flex items-center text-orange-800">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      <span className="text-xs sm:text-sm font-medium">
                        {exam.questions.length - Object.keys(answers).length} question(s) unanswered
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:ml-auto">
                  <Button
                    variant="outline"
                    onClick={() => setShowReviewModal(false)}
                    className="w-full sm:w-auto px-4 py-2 text-sm"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Continue Exam
                  </Button>
                  
                  <Button
                    onClick={handleSubmitExam}
                    className="w-full sm:w-auto bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold px-6 py-2 text-sm"
                    disabled={submitExamMutation.isPending}
                  >
                    {submitExamMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Submit Exam
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
