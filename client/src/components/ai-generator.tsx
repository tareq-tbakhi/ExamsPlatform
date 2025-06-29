import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Wand2, Loader2, Mic, MicOff, Languages } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const questionTypes = [
  { id: "multiple_choice", label: "Multiple Choice" },
  { id: "true_false", label: "True/False" },
  { id: "short_answer", label: "Short Answer" },
  { id: "essay", label: "Essay" },
  { id: "coding", label: "Coding Challenges" },
  { id: "video_response", label: "Video Response" },
  { id: "audio_response", label: "Audio Response" },
] as const;

const aiGeneratorSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  description: z.string().optional(),
  questionTypes: z.array(z.string()).min(1, "Select at least one question type"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  count: z.number().min(1, "Count must be at least 1").max(20, "Maximum 20 questions"),
  subject: z.string().optional(),
  language: z.enum(["en", "ar"]).default("en"),
});

type AIGeneratorFormData = z.infer<typeof aiGeneratorSchema>;

interface AIGeneratorProps {
  onQuestionsGenerated: (questions: any[]) => void;
}

export default function AIGenerator({ onQuestionsGenerated }: AIGeneratorProps) {
  const { toast } = useToast();
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["multiple_choice"]);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<"en" | "ar">("en");
  const recognitionRef = useRef<any>(null);

  const form = useForm<AIGeneratorFormData>({
    resolver: zodResolver(aiGeneratorSchema),
    defaultValues: {
      topic: "",
      description: "",
      questionTypes: ["multiple_choice"],
      difficulty: "medium",
      count: 5,
      subject: "",
      language: "en",
    },
  });

  const startVoiceRecognition = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast({
        title: "Not Supported",
        description: "Voice recognition is not supported in your browser. Please use Chrome or Edge.",
        variant: "destructive",
      });
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = selectedLanguage === "ar" ? "ar-SA" : "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    
    recognition.onstart = () => {
      setIsRecording(true);
      toast({
        title: selectedLanguage === "ar" ? "جاري التسجيل..." : "Recording...",
        description: selectedLanguage === "ar" ? "تحدث الآن" : "Speak now",
      });
    };
    
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }
      
      if (finalTranscript) {
        const currentValue = form.getValues("description") || "";
        form.setValue("description", currentValue + finalTranscript);
      }
    };
    
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
      toast({
        title: "Error",
        description: "Voice recognition error. Please try again.",
        variant: "destructive",
      });
    };
    
    recognition.onend = () => {
      setIsRecording(false);
    };
    
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopVoiceRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const generateMutation = useMutation({
    mutationFn: async (data: AIGeneratorFormData) => {
      // Make multiple API calls for each selected question type
      const allQuestions = [];
      const questionsPerType = Math.ceil(data.count / data.questionTypes.length);
      
      for (const questionType of data.questionTypes) {
        const response = await apiRequest("POST", "/api/generate-questions", {
          ...data,
          questionType,
          count: questionsPerType,
          // Include description in the topic if provided
          topic: data.description ? `${data.topic}. Additional context: ${data.description}` : data.topic,
        });
        const result = await response.json();
        if (result.questions) {
          allQuestions.push(...result.questions);
        }
      }
      
      // Limit to requested count
      return { questions: allQuestions.slice(0, data.count) };
    },
    onSuccess: (data) => {
      if (data.questions && data.questions.length > 0) {
        onQuestionsGenerated(data.questions);
        toast({
          title: "Success!",
          description: `Generated ${data.questions.length} questions successfully.`,
        });
        form.reset();
        setSelectedTypes(["multiple_choice"]);
      } else {
        toast({
          title: "No questions generated",
          description: "Please try again with different parameters.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      console.error("AI generation error:", error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate questions. Please check your OpenAI API key and try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AIGeneratorFormData) => {
    generateMutation.mutate(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Wand2 className="h-5 w-5 mr-2 text-primary" />
          AI Question Generator
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="topic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Topic</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., World War II, Algebra, Cell Biology"
                      {...field} 
                      dir={selectedLanguage === "ar" ? "rtl" : "ltr"}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center justify-between">
                    <span>Description (Optional)</span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedLanguage(selectedLanguage === "en" ? "ar" : "en")}
                      >
                        <Languages className="h-4 w-4 mr-1" />
                        {selectedLanguage === "ar" ? "العربية" : "English"}
                      </Button>
                      <Button
                        type="button"
                        variant={isRecording ? "destructive" : "outline"}
                        size="sm"
                        onClick={isRecording ? stopVoiceRecognition : startVoiceRecognition}
                      >
                        {isRecording ? (
                          <>
                            <MicOff className="h-4 w-4 mr-1" />
                            Stop
                          </>
                        ) : (
                          <>
                            <Mic className="h-4 w-4 mr-1" />
                            Record
                          </>
                        )}
                      </Button>
                    </div>
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={selectedLanguage === "ar" 
                        ? "صف نوع الأسئلة التي تحتاجها، والمواضيع المحددة، والسياق، وأي متطلبات خاصة..."
                        : "Describe the type of questions you need, specific topics, context, and any special requirements..."}
                      {...field} 
                      rows={4}
                      dir={selectedLanguage === "ar" ? "rtl" : "ltr"}
                      className="resize-none"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedLanguage === "ar" 
                      ? "يمكنك الكتابة بالعربية أو الإنجليزية أو استخدام التسجيل الصوتي"
                      : "You can type in Arabic or English, or use voice recording"}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., History, Mathematics"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="questionTypes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question Types</FormLabel>
                  <div className="space-y-2 border rounded-lg p-3">
                    {questionTypes.map((type) => (
                      <div key={type.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={type.id}
                          checked={field.value?.includes(type.id)}
                          onCheckedChange={(checked) => {
                            const updatedTypes = checked
                              ? [...(field.value || []), type.id]
                              : field.value?.filter((t) => t !== type.id) || [];
                            field.onChange(updatedTypes);
                            setSelectedTypes(updatedTypes);
                          }}
                        />
                        <label
                          htmlFor={type.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {type.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="difficulty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Difficulty</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Number of Questions</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="1" 
                      max="20"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
                  {selectedTypes.length > 1 && (
                    <p className="text-xs text-muted-foreground">
                      Will generate approximately {Math.ceil(field.value / selectedTypes.length)} questions per type
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full"
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate Questions
                </>
              )}
            </Button>

            {process.env.NODE_ENV === "development" && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Make sure your OpenAI API key is set in the environment variables for AI generation to work.
                </p>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
