import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  AlertCircle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();

  const { data: exam, isLoading, error } = useQuery<ExamWithQuestions>({
    queryKey: ["/api/exams", examId],
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
    onSuccess: (result) => {
      setSubmissionResult(result);
      setExamSubmitted(true);
      toast({
        title: "Exam Submitted!",
        description: "Your answers have been recorded successfully.",
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
    setExamStarted(true);
  };

  const handleAnswerChange = (questionId: number, answer: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
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
    };

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
      <div className="min-h-screen bg-gray-50 py-8">
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
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
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-3">
                  <Badge className="bg-primary text-white">
                    Question {currentQuestionIndex + 1}
                  </Badge>
                  <span className="text-sm text-gray-600 capitalize">
                    {currentQuestion.type.replace('_', ' ')}
                  </span>
                  <span className="text-sm text-gray-600">• {currentQuestion.points} points</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleFlag(currentQuestion.id)}
                  className={flaggedQuestions.has(currentQuestion.id) ? 'text-orange-600' : 'text-gray-400'}
                >
                  <Flag className="h-4 w-4" />
                </Button>
              </div>

              <div className="mb-6">
                <p className="text-lg text-gray-900 mb-4">{currentQuestion.question}</p>

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
              </div>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                  disabled={currentQuestionIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>

                <Button
                  onClick={() => setCurrentQuestionIndex(Math.min(exam.questions.length - 1, currentQuestionIndex + 1))}
                  disabled={currentQuestionIndex === exam.questions.length - 1}
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
  );
}
