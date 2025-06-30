import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Mic, X, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const questionTypes = [
  { id: "multiple_choice", label: "Multiple Choice", emoji: "🔘" },
  { id: "true_false", label: "True/False", emoji: "✓✗" },
  { id: "short_answer", label: "Short Answer", emoji: "💬" },
  { id: "essay", label: "Essay", emoji: "📝" },
  { id: "coding", label: "Coding", emoji: "💻" },
  { id: "video_response", label: "Video Response", emoji: "🎥" },
  { id: "audio_response", label: "Audio Response", emoji: "🎤" },
];

const difficulties = [
  { id: "easy", label: "Easy", emoji: "😊" },
  { id: "medium", label: "Medium", emoji: "🤔" },
  { id: "hard", label: "Hard", emoji: "🔥" },
];

const questionCounts = [5, 10, 15, 20];

interface Message {
  id: string;
  type: "system" | "user";
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

interface AIGeneratorProps {
  onQuestionsGenerated: (questions: any[]) => void;
  isInPopover?: boolean;
  onClose?: () => void;
}

type ConversationStep = "topic" | "description" | "language" | "types" | "difficulty" | "count" | "confirm" | "generating";

export default function AIGenerator({ onQuestionsGenerated, isInPopover = false, onClose }: AIGeneratorProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStep, setCurrentStep] = useState<ConversationStep>("topic");
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [formData, setFormData] = useState({
    topic: "",
    description: "",
    language: "english",
    questionTypes: [] as string[],
    difficulty: "medium",
    count: 5,
  });
  
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initialize conversation
    setTimeout(() => {
      addSystemMessage(
        "Hello! I'm your AI Question Generator assistant. 🎓\n\nI can help you create high-quality exam questions in seconds. Just tell me what topic you'd like questions about, and I'll guide you through the process.\n\nWhat subject or topic would you like to create questions for?",
        ["Mathematics", "Programming", "History", "Science", "English Literature", "Physics"]
      );
    }, 100);
    
    setTimeout(() => {
      inputRef.current?.focus();
    }, 200);
  }, []);

  const addSystemMessage = (content: string, suggestions?: string[]) => {
    const message: Message = {
      id: Date.now().toString(),
      type: "system",
      content,
      timestamp: new Date(),
      suggestions,
    };
    setMessages(prev => [...prev, message]);
    setShowSuggestions(true);
  };

  const addUserMessage = (content: string) => {
    const message: Message = {
      id: Date.now().toString(),
      type: "user",
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, message]);
    setShowSuggestions(false);
  };

  const parseUserInput = (input: string) => {
    const lowerInput = input.toLowerCase().trim();
    
    // Check for difficulty keywords
    if (["easy", "medium", "hard"].includes(lowerInput)) {
      return { type: "difficulty", value: lowerInput };
    }
    
    // Check for number (question count)
    const numberMatch = lowerInput.match(/^(\d+)\s*(questions?)?$/);
    if (numberMatch) {
      return { type: "count", value: parseInt(numberMatch[1]) };
    }
    
    // Check for generate/confirm keywords
    if (["generate", "confirm", "yes", "create", "go", "start"].includes(lowerInput)) {
      return { type: "confirm", value: true };
    }
    
    // Check for skip
    if (["skip", "next", "no"].includes(lowerInput)) {
      return { type: "skip", value: true };
    }
    
    return { type: "text", value: input };
  };

  const handleSend = () => {
    if (!input.trim() && currentStep !== "types") return;
    
    // For question types, check if we have selections
    if (currentStep === "types" && formData.questionTypes.length > 0 && !input.trim()) {
      handleQuestionTypesDone();
      return;
    }

    const userInput = input.trim();
    const parsed = parseUserInput(userInput);
    
    addUserMessage(userInput);
    setInput("");

    // Process based on current step and parsed input
    switch (currentStep) {
      case "topic":
        setFormData(prev => ({ ...prev, topic: userInput }));
        setTimeout(() => {
          addSystemMessage(
            "Perfect! Would you like to add any specific details or requirements?\n\nYou can include things like:\n• Learning objectives\n• Specific topics to cover\n• Areas to emphasize\n\nOr you can skip this step.",
            ["Skip", "Add details"]
          );
          setCurrentStep("description");
        }, 500);
        break;

      case "description":
        if (parsed.type === "skip") {
          showLanguageSelection();
        } else {
          setFormData(prev => ({ ...prev, description: userInput }));
          showLanguageSelection();
        }
        break;

      case "language":
        // Accept any language input
        if (userInput.trim()) {
          setFormData(prev => ({ ...prev, language: userInput.toLowerCase() }));
          addUserMessage(userInput);
          showQuestionTypes();
        } else {
          addSystemMessage("Please enter a language name");
        }
        break;

      case "types":
        if (["done", "finish", "next", "continue"].includes(userInput.toLowerCase())) {
          handleQuestionTypesDone();
        }
        break;

      case "difficulty":
        if (parsed.type === "difficulty" && typeof parsed.value === "string") {
          handleDifficultySelect(parsed.value);
        } else {
          addSystemMessage("Please choose a difficulty level: easy, medium, or hard");
        }
        break;

      case "count":
        if (parsed.type === "count" && typeof parsed.value === "number") {
          handleCountSelect(parsed.value);
        } else {
          addSystemMessage("Please enter a number for the question count (e.g., 10)");
        }
        break;

      case "confirm":
        if (parsed.type === "confirm") {
          handleGenerate();
        } else if (["restart", "start over", "cancel"].includes(userInput.toLowerCase())) {
          resetConversation();
        } else {
          addSystemMessage("Type 'generate' to create your questions or 'restart' to start over");
        }
        break;
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    switch (currentStep) {
      case "topic":
        // For topic suggestions, process them directly
        if (["Mathematics", "Programming", "History", "Science", "English Literature", "Physics"].includes(suggestion)) {
          addUserMessage(suggestion);
          setFormData(prev => ({ ...prev, topic: suggestion }));
          setTimeout(() => {
            addSystemMessage(
              "Perfect! Would you like to add any specific details or requirements?\n\nYou can include things like:\n• Learning objectives\n• Specific topics to cover\n• Areas to emphasize\n\nOr you can skip this step.",
              ["Skip", "Add details"]
            );
            setCurrentStep("description");
          }, 500);
        } else {
          setInput(suggestion);
          setTimeout(() => handleSend(), 100);
        }
        break;
        
      case "description":
        if (suggestion === "Skip") {
          addUserMessage("Skip");
          showLanguageSelection();
        } else {
          inputRef.current?.focus();
        }
        break;
        
      case "language":
        // For suggestion buttons, use predefined language codes
        const langMap: { [key: string]: string } = { 
          "English": "en", 
          "Arabic": "ar", 
          "French": "fr",
          "German": "de",
          "Spanish": "es",
          "Chinese": "zh"
        };
        const langCode = langMap[suggestion as keyof typeof langMap];
        if (langCode) {
          addUserMessage(suggestion);
          setFormData(prev => ({ ...prev, language: langCode }));
          showQuestionTypes();
        } else {
          // For any other suggestion, use it as-is (lowercase)
          addUserMessage(suggestion);
          setFormData(prev => ({ ...prev, language: suggestion.toLowerCase() }));
          showQuestionTypes();
        }
        break;
        
      case "types":
        const type = questionTypes.find(t => t.label === suggestion);
        if (type) {
          toggleQuestionType(type.id);
        }
        break;
        
      case "difficulty":
        handleDifficultySelect(suggestion.toLowerCase());
        break;
        
      case "count":
        handleCountSelect(parseInt(suggestion));
        break;
        
      case "confirm":
        if (suggestion === "Generate") {
          handleGenerate();
        } else if (suggestion === "Start over") {
          resetConversation();
        }
        break;
        
      case "generating":
        if (suggestion === "Generate more") {
          resetConversation();
        } else if (suggestion === "Close") {
          handleClose();
        } else if (suggestion === "Try again") {
          handleGenerate();
        } else if (suggestion === "Start over") {
          resetConversation();
        }
        break;
    }
  };

  const toggleQuestionType = (typeId: string) => {
    const type = questionTypes.find(t => t.id === typeId);
    if (!type) return;

    setFormData(prev => {
      const newTypes = prev.questionTypes.includes(typeId)
        ? prev.questionTypes.filter(t => t !== typeId)
        : [...prev.questionTypes, typeId];
      
      return { ...prev, questionTypes: newTypes };
    });
  };

  const removeQuestionType = (typeId: string) => {
    setFormData(prev => ({
      ...prev,
      questionTypes: prev.questionTypes.filter(t => t !== typeId)
    }));
  };

  const handleQuestionTypesDone = () => {
    if (formData.questionTypes.length === 0) {
      addSystemMessage(
        "Please select at least one question type first!\n\nChoose from the options below:",
        questionTypes.map(t => t.label)
      );
      return;
    }

    const selected = formData.questionTypes
      .map(id => questionTypes.find(t => t.id === id))
      .filter(Boolean)
      .map(t => `${t!.emoji} ${t!.label}`)
      .join(", ");
    
    addUserMessage(`Selected: ${selected}`);
    
    setTimeout(() => {
      addSystemMessage(
        `Great choices!\n\nWhat difficulty level would you prefer?`,
        ["Easy", "Medium", "Hard"]
      );
      setCurrentStep("difficulty");
    }, 500);
  };

  const handleDifficultySelect = (difficulty: string) => {
    setFormData(prev => ({ ...prev, difficulty }));
    addUserMessage(difficulty.charAt(0).toUpperCase() + difficulty.slice(1));
    
    setTimeout(() => {
      addSystemMessage(
        `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} difficulty selected.\n\nHow many questions do you need?`,
        ["5", "10", "15", "20"]
      );
      setCurrentStep("count");
    }, 500);
  };

  const handleCountSelect = (count: number) => {
    setFormData(prev => ({ ...prev, count }));
    addUserMessage(`${count} questions`);
    
    setTimeout(() => {
      showConfirmation();
    }, 500);
  };

  const showLanguageSelection = () => {
    setTimeout(() => {
      addSystemMessage(
        "What language should the questions be in?\n\nYou can choose from the suggestions below or type any language (e.g., German, Spanish, Italian, Japanese, etc.)",
        ["English", "Arabic", "French"]
      );
      setCurrentStep("language");
    }, 500);
  };

  const showQuestionTypes = () => {
    setTimeout(() => {
      addSystemMessage(
        "What types of questions would you like?\nSelect all that apply, then press Enter or type 'done'.",
        questionTypes.map(t => t.label)
      );
      setCurrentStep("types");
    }, 500);
  };

  const showConfirmation = () => {
    setCurrentStep("confirm");
    const questionTypesList = formData.questionTypes.map(id => {
      const type = questionTypes.find(t => t.id === id);
      return type ? `${type.emoji} ${type.label}` : id;
    });

    // Format language display - handle both codes and full names
    const languageCodeMap: { [key: string]: string } = {
      "en": "English",
      "ar": "Arabic",
      "fr": "French",
      "de": "German",
      "es": "Spanish",
      "zh": "Chinese",
      "ja": "Japanese",
      "ko": "Korean",
      "pt": "Portuguese",
      "it": "Italian",
      "ru": "Russian"
    };
    
    const languageDisplay = languageCodeMap[formData.language] || 
      formData.language.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    const summaryHtml = `
<div style="background: linear-gradient(135deg, #f5f3ff 0%, #fef3ff 100%); padding: 20px; border-radius: 12px; margin-bottom: 12px;">
  <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #1a1a1a;">
    Your Exam Configuration
  </h3>
  
  <div style="display: flex; flex-direction: column; gap: 12px;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="width: 40px; height: 40px; background: #7c3aed; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <span style="font-size: 20px;">📚</span>
      </div>
      <div>
        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Topic</div>
        <div style="font-size: 15px; color: #1a1a1a; font-weight: 500;">${formData.topic}</div>
      </div>
    </div>
    
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="width: 40px; height: 40px; background: #10b981; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <span style="font-size: 20px;">🌐</span>
      </div>
      <div>
        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Language</div>
        <div style="font-size: 15px; color: #1a1a1a; font-weight: 500;">${languageDisplay}</div>
      </div>
    </div>
    
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="width: 40px; height: 40px; background: #ec4899; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <span style="font-size: 20px;">❓</span>
      </div>
      <div style="flex: 1;">
        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Question Types</div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px;">
          ${questionTypesList.map(type => 
            `<span style="background: white; padding: 4px 8px; border-radius: 6px; font-size: 13px; border: 1px solid #e5e7eb;">${type}</span>`
          ).join('')}
        </div>
      </div>
    </div>
    
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="width: 40px; height: 40px; background: #f59e0b; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <span style="font-size: 20px;">🎯</span>
      </div>
      <div>
        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Difficulty</div>
        <div style="font-size: 15px; color: #1a1a1a; font-weight: 500; text-transform: capitalize;">${formData.difficulty}</div>
      </div>
    </div>
    
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="width: 40px; height: 40px; background: #3b82f6; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <span style="font-size: 20px;">🔢</span>
      </div>
      <div>
        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Number of Questions</div>
        <div style="font-size: 15px; color: #1a1a1a; font-weight: 500;">${formData.count} questions</div>
      </div>
    </div>
  </div>
</div>

<div style="text-align: center; color: #4b5563; font-size: 14px;">
  Ready to generate your questions!
</div>`;

    setTimeout(() => {
      const message: Message = {
        id: Date.now().toString(),
        type: "system",
        content: summaryHtml,
        timestamp: new Date(),
        suggestions: ["Generate", "Start over"],
      };
      setMessages(prev => [...prev, message]);
      setShowSuggestions(true);
    }, 500);
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const allQuestions = [];
      const questionsPerType = Math.ceil(formData.count / formData.questionTypes.length);
      
      for (const questionType of formData.questionTypes) {
        const response = await apiRequest("POST", "/api/generate-questions", {
          topic: formData.description ? `${formData.topic}. Additional context: ${formData.description}` : formData.topic,
          questionType,
          count: questionsPerType,
          difficulty: formData.difficulty,
          language: formData.language,
        });
        const result = await response.json();
        if (result.questions) {
          allQuestions.push(...result.questions);
        }
      }
      
      return { questions: allQuestions.slice(0, formData.count) };
    },
    onSuccess: (data) => {
      if (data.questions && data.questions.length > 0) {
        onQuestionsGenerated(data.questions);
        addSystemMessage(
          `✅ Successfully generated ${data.questions.length} questions!\n\nThey've been added to your exam.`,
          ["Generate more", "Close"]
        );
      }
    },
    onError: (error) => {
      addSystemMessage(
        `❌ Oops! Something went wrong: ${error.message}\n\nWould you like to try again?`,
        ["Try again", "Start over"]
      );
    },
  });

  const handleGenerate = () => {
    addUserMessage("Generate");
    setCurrentStep("generating");
    
    setTimeout(() => {
      addSystemMessage("✨ Generating your questions...");
      generateMutation.mutate();
    }, 500);
  };

  const resetConversation = () => {
    setMessages([]);
    setCurrentStep("topic");
    setFormData({
      topic: "",
      description: "",
      language: "english",
      questionTypes: [],
      difficulty: "medium",
      count: 5,
    });
    setInput("");
    
    setTimeout(() => {
      addSystemMessage(
        "Hello! I'm your AI Question Generator assistant. 🎓\n\nI can help you create high-quality exam questions in seconds. Just tell me what topic you'd like questions about, and I'll guide you through the process.\n\nWhat subject or topic would you like to create questions for?",
        ["Mathematics", "Programming", "History", "Science", "English Literature", "Physics"]
      );
    }, 100);
  };

  const startVoiceRecognition = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast({
        title: "Voice input not supported",
        description: "Please use Chrome or Edge for voice input.",
        variant: "destructive",
      });
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => {
      setIsRecording(true);
    };
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };
    
    recognition.onerror = () => {
      setIsRecording(false);
    };
    
    recognition.onend = () => {
      setIsRecording(false);
    };
    
    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  const getPlaceholder = () => {
    switch (currentStep) {
      case "topic":
        return "e.g., JavaScript, Calculus, World History...";
      case "description":
        return "Add specific details, learning objectives, or focus areas...\n(Press Shift+Enter for new line, Enter to continue)";
      case "language":
        return "Enter any language (e.g., German, Spanish, Japanese)...";
      case "types":
        return formData.questionTypes.length > 0 
          ? "Press Enter to continue or add more types..." 
          : "Type or click question types...";
      case "difficulty":
        return "Type 'easy', 'medium', or 'hard'...";
      case "count":
        return "Enter number of questions (e.g., 10)...";
      case "confirm":
        return "Type 'generate' to create questions...";
      default:
        return "Ask me anything...";
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600/5 via-purple-600/5 to-pink-600/5 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">AI Question Generator</h2>
              <p className="text-sm text-gray-500">Create questions with AI assistance</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50 flex flex-col">
        <div className="flex-1" /> {/* Spacer to push messages to bottom */}
        
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className={cn(
                "mb-4 flex",
                message.type === "system" ? "justify-start" : "justify-end"
              )}
            >
              <div
                className={cn(
                  "rounded-2xl px-4 py-3",
                  message.type === "system"
                    ? "bg-white text-gray-800 shadow-sm border border-gray-200 max-w-[85%]"
                    : "bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                )}
              >
                {message.type === "system" && message.content.includes('<div') ? (
                  <div dangerouslySetInnerHTML={{ __html: message.content }} />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {/* Suggestions */}
        {showSuggestions && messages[messages.length - 1]?.suggestions && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-2 mb-4"
          >
            {messages[messages.length - 1].suggestions!.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className={cn(
                  "px-4 py-2 bg-white rounded-xl text-sm hover:bg-gray-100 transition-colors border border-gray-200",
                  currentStep === "types" && formData.questionTypes.includes(
                    questionTypes.find(t => t.label === suggestion)?.id || ""
                  ) && "bg-violet-100 border-violet-300 text-violet-700"
                )}
              >
                {currentStep === "types" && (
                  <span className="mr-1">
                    {questionTypes.find(t => t.label === suggestion)?.emoji}
                  </span>
                )}
                {suggestion}
              </button>
            ))}
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {currentStep !== "generating" ? (
        <div className="bg-white border-t px-6 py-4">
          <div className="relative">
            {/* Selected question type chips */}
            {currentStep === "types" && formData.questionTypes.length > 0 && (
              <div className={cn(
                "flex flex-wrap gap-1 p-2 mb-2",
                "bg-gray-50 rounded-xl border border-gray-200"
              )}>
                {formData.questionTypes.map(typeId => {
                  const type = questionTypes.find(t => t.id === typeId);
                  if (!type) return null;
                  return (
                    <div
                      key={typeId}
                      className="bg-violet-100 text-violet-700 px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1"
                    >
                      <span>{type.emoji}</span>
                      <span>{type.label}</span>
                      <button
                        onClick={() => removeQuestionType(typeId)}
                        className="ml-1 hover:text-violet-900"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            
            <div className="relative">
              {currentStep === "description" ? (
                <Textarea
                  ref={inputRef as any}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={getPlaceholder()}
                  className="w-full min-h-[80px] max-h-[120px] pl-4 pr-16 pt-3 text-sm border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent resize-none"
                  rows={3}
                />
              ) : (
                <Input
                  ref={inputRef as any}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={getPlaceholder()}
                  className="w-full h-12 pl-4 pr-16 text-sm border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent"
                />
              )}
              <div className={cn(
                "absolute right-2 flex items-center gap-1",
                currentStep === "description" ? "top-3" : "top-1/2 -translate-y-1/2"
              )}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={startVoiceRecognition}
                  disabled={isRecording}
                >
                  {isRecording ? (
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border-t px-6 py-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-violet-600 to-pink-600 animate-spin" />
              <div className="absolute inset-2 bg-white rounded-full" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-violet-600 animate-spin" />
              </div>
            </div>
            <p className="text-sm text-gray-600 animate-pulse">Creating amazing questions for you...</p>
          </div>
        </div>
      )}
    </div>
  );
}
