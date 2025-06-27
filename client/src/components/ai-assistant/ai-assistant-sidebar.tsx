import { useState, useEffect } from "react";
import { X, MessageSquare, Lightbulb, HelpCircle, Zap, Settings, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AIMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  context?: string;
}

interface ContextualSuggestion {
  id: string;
  title: string;
  description: string;
  action: string;
  priority: "high" | "medium" | "low";
}

interface AIAssistantSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIAssistantSidebar({ isOpen, onClose }: AIAssistantSidebarProps) {
  const [location] = useLocation();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [contextualSuggestions, setContextualSuggestions] = useState<ContextualSuggestion[]>([]);
  const [activeTab, setActiveTab] = useState<"chat" | "suggestions" | "help">("chat");

  // AI Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (data: { message: string; context: string }) => {
      return await apiRequest("/api/ai-assistant/chat", "POST", data);
    },
    onSuccess: (response) => {
      const assistantMessage: AIMessage = {
        id: Date.now().toString() + "_assistant",
        type: "assistant",
        content: response.response,
        timestamp: new Date(),
        context: location
      };
      setMessages(prev => [...prev, assistantMessage]);
    },
  });

  // Context suggestions mutation
  const suggestionsMutation = useMutation({
    mutationFn: async (context: string) => {
      return await apiRequest("/api/ai-assistant/suggestions", "POST", { context });
    },
    onSuccess: (response) => {
      setContextualSuggestions(response.suggestions || []);
    },
  });

  // Get current page context for AI understanding
  const getPageContext = () => {
    const path = location;
    if (path.includes("/exam/")) return "exam_taking";
    if (path.includes("/create")) return "exam_creation";
    if (path.includes("/results")) return "results_viewing";
    if (path.includes("/admin")) return "administration";
    if (path === "/") return "dashboard";
    return "general";
  };

  // Load contextual suggestions when sidebar opens or location changes
  useEffect(() => {
    if (isOpen) {
      const context = getPageContext();
      suggestionsMutation.mutate(context);
    }
  }, [isOpen, location]);

  // Handle sending a message
  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const userMessage: AIMessage = {
      id: Date.now().toString() + "_user",
      type: "user",
      content: inputMessage,
      timestamp: new Date(),
      context: location
    };

    setMessages(prev => [...prev, userMessage]);
    
    const context = getPageContext();
    chatMutation.mutate({
      message: inputMessage,
      context: `${context}|${location}`
    });

    setInputMessage("");
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: ContextualSuggestion) => {
    const userMessage: AIMessage = {
      id: Date.now().toString() + "_user",
      type: "user",
      content: suggestion.title,
      timestamp: new Date(),
      context: location
    };

    setMessages(prev => [...prev, userMessage]);
    
    const context = getPageContext();
    chatMutation.mutate({
      message: `Help me with: ${suggestion.title}. ${suggestion.description}`,
      context: `${context}|${location}`
    });

    setActiveTab("chat");
  };

  // Get contextual help content
  const getHelpContent = () => {
    const context = getPageContext();
    const helpContent = {
      exam_taking: {
        title: "Taking an Exam",
        tips: [
          "Ensure stable internet connection",
          "Keep your face visible to the camera",
          "Avoid switching between applications",
          "Save answers frequently",
          "Use video questions for detailed responses"
        ]
      },
      exam_creation: {
        title: "Creating Exams",
        tips: [
          "Use AI question generation for faster setup",
          "Set appropriate time limits for each section",
          "Configure proctoring settings based on exam importance",
          "Test your exam before publishing",
          "Invite students using CSV upload for bulk operations"
        ]
      },
      results_viewing: {
        title: "Viewing Results",
        tips: [
          "Review AI proctoring violations for irregularities",
          "Check individual question performance",
          "Export results for further analysis",
          "Use grading analytics to identify learning gaps",
          "Monitor video question responses"
        ]
      },
      administration: {
        title: "Platform Administration",
        tips: [
          "Manage user roles and permissions",
          "Monitor system performance and usage",
          "Review and act on proctoring reports",
          "Bulk invite users for platform access",
          "Configure platform-wide settings"
        ]
      },
      dashboard: {
        title: "Dashboard Overview",
        tips: [
          "Quick access to recent exams and submissions",
          "Monitor active exams and student participation",
          "Check system notifications and alerts",
          "Access administrative functions",
          "Review performance analytics"
        ]
      },
      general: {
        title: "General Help",
        tips: [
          "Use the AI assistant for contextual help",
          "Navigate using the sidebar menu",
          "Check your profile and settings",
          "Contact support for technical issues",
          "Explore feature documentation"
        ]
      }
    };

    return helpContent[context as keyof typeof helpContent] || helpContent.general;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-background border-l border-border shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">AI Assistant</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-border">
        <Button
          variant={activeTab === "chat" ? "default" : "ghost"}
          size="sm"
          className="flex-1 rounded-none"
          onClick={() => setActiveTab("chat")}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Chat
        </Button>
        <Button
          variant={activeTab === "suggestions" ? "default" : "ghost"}
          size="sm"
          className="flex-1 rounded-none"
          onClick={() => setActiveTab("suggestions")}
        >
          <Lightbulb className="h-4 w-4 mr-2" />
          Suggestions
        </Button>
        <Button
          variant={activeTab === "help" ? "default" : "ghost"}
          size="sm"
          className="flex-1 rounded-none"
          onClick={() => setActiveTab("help")}
        >
          <HelpCircle className="h-4 w-4 mr-2" />
          Help
        </Button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "chat" && (
          <div className="h-full flex flex-col">
            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Ask me anything about ExamCraft!</p>
                    <p className="text-sm">I can help with exam creation, proctoring, grading, and more.</p>
                  </div>
                )}
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.type === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                {chatMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-muted p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Input
                  placeholder="Ask about exams, proctoring, grading..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  disabled={chatMutation.isPending}
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || chatMutation.isPending}
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "suggestions" && (
          <ScrollArea className="h-full p-4">
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Contextual suggestions for {getPageContext().replace("_", " ")}
              </div>
              
              {suggestionsMutation.isPending && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading suggestions...</span>
                </div>
              )}

              {contextualSuggestions.map((suggestion) => (
                <Card
                  key={suggestion.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm">{suggestion.title}</h4>
                      <Badge 
                        variant={
                          suggestion.priority === "high" ? "destructive" :
                          suggestion.priority === "medium" ? "default" : "secondary"
                        }
                        className="text-xs"
                      >
                        {suggestion.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {suggestion.description}
                    </p>
                  </CardContent>
                </Card>
              ))}

              {contextualSuggestions.length === 0 && !suggestionsMutation.isPending && (
                <div className="text-center text-muted-foreground py-8">
                  <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No suggestions available</p>
                  <p className="text-sm">Try switching to chat for general help</p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {activeTab === "help" && (
          <ScrollArea className="h-full p-4">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{getHelpContent().title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {getHelpContent().tips.map((tip, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <p className="text-sm">{tip}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Separator />

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Start a conversation
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Get contextual suggestions
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Browse documentation
                  </Button>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}