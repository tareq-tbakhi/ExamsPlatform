import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
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
import { AIGeneratorTrigger } from "./ai-generator-trigger";
import { useAuth } from "../hooks/useAuth";

const examSchema = z.object({
  title: z.string().min(1, "Title is required"),
  subject: z.string().min(1, "Subject is required"),
  instructions: z.string().optional(),
  duration: z.number().min(1, "Duration must be at least 1 minute"),
  totalPoints: z.number().min(1, "Total points must be at least 1"),
  createdBy: z.string().default("local-dev-user"),
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
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const { toast } = useToast();

  const form = useForm<ExamFormData>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      title: "",
      subject: "",
      instructions: "",
      duration: 60,
      totalPoints: 100,
      createdBy: (user as any)?.id || "local-dev-user",
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
        title: t('common.success'),
        description: t('messages.exam_created_desc'),
      });
      
      // Reset form
      form.reset();
      setQuestions([]);
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: t('messages.error_occurred') + ": " + error.message,
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
        title: t('messages.exam_published'),
        description: (
          <div className="space-y-2">
            <p>{t('messages.exam_published_desc')}</p>
            <div className="p-2 bg-gray-100 rounded text-sm">
              <strong>{t('messages.share_link')}:</strong><br />
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
        title: t('common.error'),
        description: t('messages.error_occurred') + ": " + error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ExamFormData) => {
    if (questions.length === 0) {
      toast({
        title: t('common.error'),
        description: t('messages.add_question_required'),
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
        title: t('common.error'),
        description: t('messages.add_question_required'),
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
      weight: 1.0,
      autoGraded: true,
      passingScore: null,
      timeLimit: null,
      metadata: {},
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
      weight: 1.0,
      autoGraded: true,
      passingScore: null,
      timeLimit: null,
      metadata: {},
    }));
    
    setQuestions([...questions, ...newQuestions]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 exam-creator">
      {/* Main Exam Form */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('exam.creator.create_new_exam')}</CardTitle>
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
                        <FormLabel>{t('exam.creator.exam_title')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('exam.creator.enter_exam_title')} {...field} />
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
                        <FormLabel>{t('exam.subject')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('exam.creator.select_subject')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Mathematics">{t('exam.creator.subjects.mathematics')}</SelectItem>
                            <SelectItem value="Science">{t('exam.creator.subjects.science')}</SelectItem>
                            <SelectItem value="History">{t('exam.creator.subjects.history')}</SelectItem>
                            <SelectItem value="English">{t('exam.creator.subjects.english')}</SelectItem>
                            <SelectItem value="Physics">{t('exam.creator.subjects.physics')}</SelectItem>
                            <SelectItem value="Chemistry">{t('exam.creator.subjects.chemistry')}</SelectItem>
                            <SelectItem value="Biology">{t('exam.creator.subjects.biology')}</SelectItem>
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
                        <FormLabel>{t('exam.creator.duration_minutes')}</FormLabel>
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
                    <label className="text-sm font-medium">{t('exam.creator.total_points')}</label>
                    <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                      {questions.reduce((sum, q) => sum + q.points, 0)} {t('exam.creator.points_calculated')}
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="instructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('exam.instructions')}</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder={t('exam.creator.enter_instructions')}
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
                    <h3 className="text-lg font-medium">{t('exam.creator.questions_count')} ({questions.length})</h3>
                    <Button 
                      type="button"
                      onClick={() => {
                        setEditingQuestion(null);
                        setShowQuestionForm(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t('exam.creator.add_question')}
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
                        <p className="text-gray-500 mb-4">{t('exam.creator.add_questions_prompt')}</p>
                        <div className="flex justify-center space-x-3">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setEditingQuestion(null);
                              setShowQuestionForm(true);
                            }}
                          >
                            {t('exam.creator.add_manually')}
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
        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t('exam.creator.exam_settings')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t('exam.creator.randomize_questions')}</label>
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
              <label className="text-sm font-medium">{t('exam.creator.show_results_immediately')}</label>
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
              <label className="text-sm font-medium">{t('exam.creator.allow_retakes')}</label>
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
                {createExamMutation.isPending ? t('exam.creator.saving') : t('exam.creator.save_exam')}
              </Button>
              
              <Button 
                variant="secondary" 
                className="w-full"
                disabled
              >
                <Eye className="h-4 w-4 mr-2" />
                {t('exam.creator.preview_exam')}
              </Button>
              
              <Button 
                className="w-full bg-orange-500 hover:bg-orange-600"
                onClick={form.handleSubmit(onPublish)}
                disabled={publishExamMutation.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                {publishExamMutation.isPending ? t('exam.creator.publishing') : t('exam.creator.publish_share')}
              </Button>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700 flex items-start">
                <Info className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" />
                {t('exam.creator.publish_info')}
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

      {/* AI Question Generator Floating Button */}
      <AIGeneratorTrigger 
        onGenerate={addAIQuestions}
        examTitle={form.watch('title')}
        language="en"
      />
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
  const { t } = useTranslation();
  
  const getTypeLabel = (type: string) => {
    switch (type) {
      case "multiple_choice": return t('exam.question_types.multiple_choice');
      case "short_answer": return t('exam.question_types.short_answer');
      case "essay": return t('exam.question_types.essay');
      case "true_false": return t('exam.question_types.true_false');
      case "video_response": return t('exam.question_types.video_response');
      case "audio_response": return t('exam.question_types.audio_response');
      case "coding": return t('exam.question_types.coding');
      default: return type;
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 question-display">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center space-x-2">
          <span className="bg-primary text-white text-xs px-2 py-1 rounded">Q{index}</span>
          <span className="text-sm text-gray-600">{getTypeLabel(question.type)}</span>
          <span className="text-sm text-gray-600">• {question.points} {t('exam.creator.points')}</span>
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
      
      {question.type === "multiple_choice" && question.options && Array.isArray(question.options) ? (
        <div className="space-y-2">
          {(question.options as string[]).map((option, idx) => (
            <div key={idx} className="flex items-center space-x-2">
              <div className={`w-4 h-4 border-2 rounded-full ${
                option === question.correctAnswer 
                  ? "border-green-500 bg-green-500" 
                  : "border-gray-300"
              }`} />
              <span className="text-sm">{String(option)}</span>
              {option === question.correctAnswer && (
                <span className="text-xs text-green-600 font-medium">{t('exam.creator.correct')}</span>
              )}
            </div>
          ))}
        </div>
      ) : null}
      
      {question.type === "audio_response" && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <span className="text-sm text-blue-700">
            🎤 {t('exam.creator.audio_question_note')}
          </span>
        </div>
      )}
      
      {question.type === "video_response" && (
        <div className="bg-purple-50 border border-purple-200 rounded p-3">
          <span className="text-sm text-purple-700">
            📹 {t('exam.creator.video_question_note')}
          </span>
        </div>
      )}
      
      {question.type !== "multiple_choice" && question.type !== "audio_response" && question.type !== "video_response" && question.correctAnswer && (
        <div className="bg-white border border-gray-200 rounded p-3">
          <span className="text-sm text-gray-500">{t('exam.creator.expected_answer')}: {String(question.correctAnswer)}</span>
        </div>
      )}
    </div>
  );
}
