import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Plus, Save, Eye, Send, Info } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Question, InsertExam } from "@shared/schema";
import QuestionForms from "./question-forms";
import AIGenerator from "./ai-generator";

const examSchema = z.object({
  title: z.string().min(1, "Title is required"),
  subject: z.string().min(1, "Subject is required"),
  instructions: z.string().optional(),
  duration: z.number().min(1, "Duration must be at least 1 minute"),
  totalPoints: z.number().min(1, "Total points must be at least 1"),
  createdBy: z.number().default(1), // Mock user ID
  status: z.string().default("draft"),
  settings: z.object({
    randomizeQuestions: z.boolean().default(false),
    showResultsImmediately: z.boolean().default(true),
    allowRetakes: z.boolean().default(false),
    availableFrom: z.string().optional(),
    availableUntil: z.string().optional(),
  }).default({}),
});

type ExamFormData = z.infer<typeof examSchema>;

export default function ExamCreator() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ExamFormData>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      title: "",
      subject: "",
      instructions: "",
      duration: 60,
      totalPoints: 100,
      createdBy: 1,
      status: "draft",
      settings: {
        randomizeQuestions: false,
        showResultsImmediately: true,
        allowRetakes: false,
      },
    },
  });

  const createExamMutation = useMutation({
    mutationFn: async (data: InsertExam) => {
      const response = await apiRequest("POST", "/api/exams", data);
      return response.json();
    },
    onSuccess: async (exam) => {
      // Create questions for the exam
      for (let i = 0; i < questions.length; i++) {
        const questionData = {
          ...questions[i],
          examId: exam.id,
          order: i + 1,
        };
        delete (questionData as any).id; // Remove ID for creation
        await apiRequest("POST", "/api/questions", questionData);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/exams"] });
      toast({
        title: "Success",
        description: "Exam created successfully!",
      });
      
      // Reset form
      form.reset();
      setQuestions([]);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create exam: " + error.message,
        variant: "destructive",
      });
    },
  });

  const publishExamMutation = useMutation({
    mutationFn: async (data: InsertExam) => {
      const examData = { ...data, status: "published" };
      const response = await apiRequest("POST", "/api/exams", examData);
      return response.json();
    },
    onSuccess: async (exam) => {
      // Create questions for the exam
      for (let i = 0; i < questions.length; i++) {
        const questionData = {
          ...questions[i],
          examId: exam.id,
          order: i + 1,
        };
        delete (questionData as any).id;
        await apiRequest("POST", "/api/questions", questionData);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/exams"] });
      
      const examUrl = `${window.location.origin}/exam/${exam.id}`;
      
      toast({
        title: "Exam Published!",
        description: (
          <div className="space-y-2">
            <p>Your exam has been published successfully.</p>
            <div className="p-2 bg-gray-100 rounded text-sm">
              <strong>Share this link with students:</strong><br />
              <a href={examUrl} className="text-blue-600 break-all">{examUrl}</a>
            </div>
          </div>
        ),
      });
      
      form.reset();
      setQuestions([]);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to publish exam: " + error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ExamFormData) => {
    if (questions.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one question to the exam.",
        variant: "destructive",
      });
      return;
    }

    // Calculate total points from questions
    const calculatedTotalPoints = questions.reduce((sum, q) => sum + q.points, 0);
    const examData = { ...data, totalPoints: calculatedTotalPoints };
    
    createExamMutation.mutate(examData);
  };

  const onPublish = (data: ExamFormData) => {
    if (questions.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one question to the exam.",
        variant: "destructive",
      });
      return;
    }

    const calculatedTotalPoints = questions.reduce((sum, q) => sum + q.points, 0);
    const examData = { ...data, totalPoints: calculatedTotalPoints };
    
    publishExamMutation.mutate(examData);
  };

  const addQuestion = (question: Omit<Question, "id" | "examId" | "order">) => {
    const newQuestion: Question = {
      ...question,
      id: Date.now(), // Temporary ID
      examId: 0, // Will be set when exam is created
      order: questions.length + 1,
    };
    setQuestions([...questions, newQuestion]);
    setShowQuestionForm(false);
  };

  const updateQuestion = (updatedQuestion: Question) => {
    setQuestions(questions.map(q => q.id === updatedQuestion.id ? updatedQuestion : q));
    setEditingQuestion(null);
    setShowQuestionForm(false);
  };

  const deleteQuestion = (questionId: number) => {
    setQuestions(questions.filter(q => q.id !== questionId));
  };

  const addAIQuestions = (aiQuestions: any[]) => {
    const newQuestions: Question[] = aiQuestions.map((q, index) => ({
      id: Date.now() + index,
      examId: 0,
      type: q.type,
      question: q.question,
      options: q.options || [],
      correctAnswer: q.correctAnswer,
      points: q.points,
      order: questions.length + index + 1,
    }));
    
    setQuestions([...questions, ...newQuestions]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main Exam Form */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Create New Exam</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Exam Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter exam title..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select subject" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Mathematics">Mathematics</SelectItem>
                            <SelectItem value="Science">Science</SelectItem>
                            <SelectItem value="History">History</SelectItem>
                            <SelectItem value="English">English</SelectItem>
                            <SelectItem value="Physics">Physics</SelectItem>
                            <SelectItem value="Chemistry">Chemistry</SelectItem>
                            <SelectItem value="Biology">Biology</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (minutes)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="60" 
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Total Points</label>
                    <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                      {questions.reduce((sum, q) => sum + q.points, 0)} points (calculated from questions)
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="instructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instructions</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter exam instructions for students..."
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Questions Section */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Questions ({questions.length})</h3>
                    <Button 
                      type="button"
                      onClick={() => {
                        setEditingQuestion(null);
                        setShowQuestionForm(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Question
                    </Button>
                  </div>

                  {/* Question List */}
                  <div className="space-y-4">
                    {questions.map((question, index) => (
                      <QuestionDisplay
                        key={question.id}
                        question={question}
                        index={index + 1}
                        onEdit={() => {
                          setEditingQuestion(question);
                          setShowQuestionForm(true);
                        }}
                        onDelete={() => deleteQuestion(question.id)}
                      />
                    ))}

                    {questions.length === 0 && (
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                        <Plus className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500 mb-4">Add questions to your exam</p>
                        <div className="flex justify-center space-x-3">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setEditingQuestion(null);
                              setShowQuestionForm(true);
                            }}
                          >
                            Add Manually
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* AI Generator */}
        <AIGenerator onQuestionsGenerated={addAIQuestions} />

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Exam Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Randomize Questions</label>
              <FormField
                control={form.control}
                name="settings.randomizeQuestions"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Show Results Immediately</label>
              <FormField
                control={form.control}
                name="settings.showResultsImmediately"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Allow Retakes</label>
              <FormField
                control={form.control}
                name="settings.allowRetakes"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <Button 
                className="w-full"
                onClick={form.handleSubmit(onSubmit)}
                disabled={createExamMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {createExamMutation.isPending ? "Saving..." : "Save Exam"}
              </Button>
              
              <Button 
                variant="secondary" 
                className="w-full"
                disabled
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview Exam
              </Button>
              
              <Button 
                className="w-full bg-orange-500 hover:bg-orange-600"
                onClick={form.handleSubmit(onPublish)}
                disabled={publishExamMutation.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                {publishExamMutation.isPending ? "Publishing..." : "Publish & Share"}
              </Button>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700 flex items-start">
                <Info className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" />
                Once published, you'll get a shareable link for students
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Question Form Modal */}
      {showQuestionForm && (
        <QuestionForms
          question={editingQuestion}
          onSave={editingQuestion ? updateQuestion : addQuestion}
          onCancel={() => {
            setShowQuestionForm(false);
            setEditingQuestion(null);
          }}
        />
      )}
    </div>
  );
}

function QuestionDisplay({ 
  question, 
  index, 
  onEdit, 
  onDelete 
}: { 
  question: Question; 
  index: number; 
  onEdit: () => void; 
  onDelete: () => void; 
}) {
  const getTypeLabel = (type: string) => {
    switch (type) {
      case "multiple_choice": return "Multiple Choice";
      case "short_answer": return "Short Answer";
      case "essay": return "Essay";
      case "true_false": return "True/False";
      default: return type;
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center space-x-2">
          <span className="bg-primary text-white text-xs px-2 py-1 rounded">Q{index}</span>
          <span className="text-sm text-gray-600">{getTypeLabel(question.type)}</span>
          <span className="text-sm text-gray-600">• {question.points} points</span>
        </div>
        <div className="flex space-x-1">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <span className="sr-only">Edit</span>
            ✏️
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <span className="sr-only">Delete</span>
            🗑️
          </Button>
        </div>
      </div>
      
      <p className="text-gray-900 mb-3">{question.question}</p>
      
      {question.type === "multiple_choice" && question.options && (
        <div className="space-y-2">
          {(question.options as string[]).map((option, idx) => (
            <div key={idx} className="flex items-center space-x-2">
              <div className={`w-4 h-4 border-2 rounded-full ${
                option === question.correctAnswer 
                  ? "border-green-500 bg-green-500" 
                  : "border-gray-300"
              }`} />
              <span className="text-sm">{option}</span>
              {option === question.correctAnswer && (
                <span className="text-xs text-green-600 font-medium">Correct</span>
              )}
            </div>
          ))}
        </div>
      )}
      
      {question.type !== "multiple_choice" && question.correctAnswer && (
        <div className="bg-white border border-gray-200 rounded p-3">
          <span className="text-sm text-gray-500">Expected answer: {question.correctAnswer}</span>
        </div>
      )}
    </div>
  );
}
