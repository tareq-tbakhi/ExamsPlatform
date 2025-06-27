import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Wand2, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const aiGeneratorSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  questionType: z.enum(["multiple_choice", "true_false", "short_answer", "essay", "coding", "video_response", "audio_response"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  count: z.number().min(1, "Count must be at least 1").max(20, "Maximum 20 questions"),
  subject: z.string().optional(),
});

type AIGeneratorFormData = z.infer<typeof aiGeneratorSchema>;

interface AIGeneratorProps {
  onQuestionsGenerated: (questions: any[]) => void;
}

export default function AIGenerator({ onQuestionsGenerated }: AIGeneratorProps) {
  const { toast } = useToast();

  const form = useForm<AIGeneratorFormData>({
    resolver: zodResolver(aiGeneratorSchema),
    defaultValues: {
      topic: "",
      questionType: "multiple_choice",
      difficulty: "medium",
      count: 5,
      subject: "",
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (data: AIGeneratorFormData) => {
      const response = await apiRequest("POST", "/api/generate-questions", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.questions && data.questions.length > 0) {
        onQuestionsGenerated(data.questions);
        toast({
          title: "Success!",
          description: `Generated ${data.questions.length} questions successfully.`,
        });
        form.reset();
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
                    />
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
              name="questionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                      <SelectItem value="true_false">True/False</SelectItem>
                      <SelectItem value="short_answer">Short Answer</SelectItem>
                      <SelectItem value="essay">Essay</SelectItem>
                      <SelectItem value="coding">Coding Challenges</SelectItem>
                      <SelectItem value="video_response">Video Response</SelectItem>
                      <SelectItem value="audio_response">Audio Response</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <FormLabel>Number of Questions</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="1" 
                      max="20"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
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
