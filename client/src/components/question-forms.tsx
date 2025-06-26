import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Minus } from "lucide-react";
import type { Question } from "@shared/schema";

const questionSchema = z.object({
  type: z.enum(["multiple_choice", "short_answer", "essay", "true_false"]),
  question: z.string().min(1, "Question is required"),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().optional(),
  points: z.number().min(1, "Points must be at least 1"),
});

type QuestionFormData = z.infer<typeof questionSchema>;

interface QuestionFormsProps {
  question?: Question | null;
  onSave: (question: any) => void;
  onCancel: () => void;
}

export default function QuestionForms({ question, onSave, onCancel }: QuestionFormsProps) {
  const [options, setOptions] = useState<string[]>(
    question?.options as string[] || ["", "", "", ""]
  );

  const form = useForm<QuestionFormData>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      type: question?.type as any || "multiple_choice",
      question: question?.question || "",
      options: question?.options as string[] || [],
      correctAnswer: question?.correctAnswer || "",
      points: question?.points || 5,
    },
  });

  const watchedType = form.watch("type");

  const onSubmit = (data: QuestionFormData) => {
    let processedData = { ...data };

    if (data.type === "multiple_choice") {
      const validOptions = options.filter(opt => opt.trim() !== "");
      if (validOptions.length < 2) {
        form.setError("options", { message: "At least 2 options are required" });
        return;
      }
      processedData.options = validOptions;
      
      if (!data.correctAnswer || !validOptions.includes(data.correctAnswer)) {
        form.setError("correctAnswer", { message: "Please select a valid correct answer" });
        return;
      }
    } else if (data.type === "true_false") {
      processedData.options = ["True", "False"];
      if (!["True", "False"].includes(data.correctAnswer || "")) {
        form.setError("correctAnswer", { message: "Please select True or False" });
        return;
      }
    }

    onSave(processedData);
  };

  const addOption = () => {
    setOptions([...options, ""]);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
      
      // Update form if the removed option was the correct answer
      const currentCorrect = form.getValues("correctAnswer");
      if (currentCorrect === options[index]) {
        form.setValue("correctAnswer", "");
      }
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {question ? "Edit Question" : "Add New Question"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
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
                        <SelectItem value="short_answer">Short Answer</SelectItem>
                        <SelectItem value="essay">Essay</SelectItem>
                        <SelectItem value="true_false">True/False</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="points"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Points</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter your question here..."
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Multiple Choice Options */}
            {watchedType === "multiple_choice" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <FormLabel>Answer Options</FormLabel>
                  <Button type="button" variant="outline" size="sm" onClick={addOption}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Option
                  </Button>
                </div>

                <div className="space-y-2">
                  {options.map((option, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <span className="text-sm w-8">{String.fromCharCode(65 + index)}.</span>
                      <Input
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={`Option ${String.fromCharCode(65 + index)}`}
                        className="flex-1"
                      />
                      {options.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOption(index)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <FormField
                  control={form.control}
                  name="correctAnswer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correct Answer</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select the correct answer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {options.filter(opt => opt.trim() !== "").map((option, index) => (
                            <SelectItem key={index} value={option}>
                              {String.fromCharCode(65 + index)}. {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* True/False Options */}
            {watchedType === "true_false" && (
              <FormField
                control={form.control}
                name="correctAnswer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correct Answer</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select the correct answer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="True">True</SelectItem>
                        <SelectItem value="False">False</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Short Answer/Essay Expected Answer */}
            {(watchedType === "short_answer" || watchedType === "essay") && (
              <FormField
                control={form.control}
                name="correctAnswer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {watchedType === "essay" ? "Grading Guidelines" : "Expected Answer"}
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={
                          watchedType === "essay" 
                            ? "Enter grading guidelines or key points to look for..."
                            : "Enter the expected answer or key points..."
                        }
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit">
                {question ? "Update Question" : "Add Question"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
