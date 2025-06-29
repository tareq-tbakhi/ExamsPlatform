import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

interface ChatRequest {
  message: string;
  context: string;
}

interface SuggestionRequest {
  context: string;
}

interface ContextualSuggestion {
  id: string;
  title: string;
  description: string;
  action: string;
  priority: "high" | "medium" | "low";
}

export class AIAssistantService {
  // Generate contextual AI response based on user message and current page context
  async generateChatResponse(request: ChatRequest): Promise<string> {
    try {
      if (!openai) {
        console.warn("OpenAI API key not configured. AI Assistant is disabled.");
        return "AI Assistant is not configured. Please set up an OpenAI API key.";
      }
      
      const systemPrompt = this.getSystemPrompt(request.context);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: request.message
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      return response.choices[0].message.content || "I'm sorry, I couldn't generate a response at the moment.";
    } catch (error) {
      console.error("AI Assistant chat error:", error);
      return "I'm experiencing technical difficulties. Please try again later or contact support.";
    }
  }

  // Generate contextual suggestions based on current page/context
  async generateContextualSuggestions(request: SuggestionRequest): Promise<ContextualSuggestion[]> {
    try {
      const suggestions = this.getContextualSuggestions(request.context);
      return suggestions;
    } catch (error) {
      console.error("AI Assistant suggestions error:", error);
      return [];
    }
  }

  // Get system prompt based on context
  private getSystemPrompt(context: string): string {
    const [pageContext, fullPath] = context.split("|");
    
    const basePrompt = `You are an AI assistant for ExamCraft, an advanced AI-powered exam creation and proctoring platform. You help users with exam creation, taking exams, viewing results, administration, and general platform usage.

Current context: ${pageContext}
Current page: ${fullPath}

Key platform features:
- AI-powered question generation using OpenAI GPT-4o
- Advanced proctoring with real-time video recording and AI analysis
- Comprehensive grading system with automated scoring
- Video question support with Arabic transcription
- Role-based access control (super_admin, admin, teacher, student)
- Bulk student invitation system via CSV upload
- Real-time violation detection and reporting
- Multi-modal exam types (multiple choice, essay, video responses)

Provide helpful, specific, and actionable advice. Be concise but informative. Focus on the user's current context and provide relevant guidance.`;

    const contextSpecificPrompts = {
      exam_taking: `
The user is currently taking an exam. Focus on:
- Exam-taking best practices and tips
- Proctoring system guidance (camera, screen recording)
- Technical troubleshooting for exam interface
- Video question recording and submission help
- Time management and navigation tips`,

      exam_creation: `
The user is creating or editing an exam. Focus on:
- Exam design best practices and pedagogical guidance
- AI question generation tips and prompts
- Proctoring configuration recommendations
- Question type selection and setup
- Student invitation and access management`,

      results_viewing: `
The user is viewing exam results and analytics. Focus on:
- Interpreting proctoring violation reports
- Understanding grading analytics and score breakdowns
- Identifying learning gaps and performance patterns
- Exporting and sharing results
- Making data-driven educational decisions`,

      administration: `
The user is in the admin area. Focus on:
- User management and role assignment
- Platform configuration and settings
- System monitoring and performance
- Bulk operations and data management
- Security and access control`,

      dashboard: `
The user is on the main dashboard. Focus on:
- Platform navigation and feature overview
- Recent activity and notifications
- Quick access to common tasks
- Performance monitoring and insights
- Getting started guidance`,

      general: `
Provide general help about the platform. Focus on:
- Feature explanations and capabilities
- Navigation and user interface guidance
- Account management and settings
- Best practices for different user roles
- Troubleshooting common issues`
    };

    return basePrompt + (contextSpecificPrompts[pageContext as keyof typeof contextSpecificPrompts] || contextSpecificPrompts.general);
  }

  // Get contextual suggestions based on current page
  private getContextualSuggestions(context: string): ContextualSuggestion[] {
    const suggestionsByContext = {
      exam_taking: [
        {
          id: "stable_connection",
          title: "Ensure Stable Connection",
          description: "Check your internet connection to avoid submission issues",
          action: "connection_check",
          priority: "high" as const
        },
        {
          id: "camera_positioning",
          title: "Camera Position",
          description: "Adjust your camera to show your face clearly for proctoring",
          action: "camera_setup",
          priority: "medium" as const
        },
        {
          id: "save_frequently",
          title: "Save Progress",
          description: "Your answers are automatically saved, but check the save status",
          action: "save_check",
          priority: "low" as const
        },
        {
          id: "video_questions",
          title: "Video Question Tips",
          description: "Speak clearly and look at the camera for video responses",
          action: "video_help",
          priority: "medium" as const
        }
      ],

      exam_creation: [
        {
          id: "ai_questions",
          title: "Use AI Question Generation",
          description: "Let AI create questions based on your subject and learning objectives",
          action: "ai_generate",
          priority: "high" as const
        },
        {
          id: "proctoring_setup",
          title: "Configure Proctoring",
          description: "Set up appropriate proctoring settings for your exam security needs",
          action: "proctoring_config",
          priority: "high" as const
        },
        {
          id: "time_limits",
          title: "Set Time Limits",
          description: "Configure appropriate time limits for different question types",
          action: "time_config",
          priority: "medium" as const
        },
        {
          id: "invite_students",
          title: "Invite Students",
          description: "Use CSV upload to bulk invite students to your exam",
          action: "student_invite",
          priority: "medium" as const
        }
      ],

      results_viewing: [
        {
          id: "review_violations",
          title: "Review Proctoring Violations",
          description: "Check AI-detected violations and their confidence scores",
          action: "violation_review",
          priority: "high" as const
        },
        {
          id: "grade_analysis",
          title: "Analyze Grades",
          description: "Review individual question performance and overall statistics",
          action: "grade_analysis",
          priority: "medium" as const
        },
        {
          id: "video_responses",
          title: "Check Video Answers",
          description: "Review transcribed video responses and their scoring",
          action: "video_review",
          priority: "medium" as const
        },
        {
          id: "export_results",
          title: "Export Data",
          description: "Download results for further analysis or record keeping",
          action: "export_data",
          priority: "low" as const
        }
      ],

      administration: [
        {
          id: "user_management",
          title: "Manage User Roles",
          description: "Assign appropriate roles and permissions to platform users",
          action: "role_management",
          priority: "high" as const
        },
        {
          id: "system_monitoring",
          title: "Monitor System Health",
          description: "Check platform performance and usage statistics",
          action: "system_check",
          priority: "medium" as const
        },
        {
          id: "bulk_operations",
          title: "Bulk User Invitations",
          description: "Send platform invitations to multiple users at once",
          action: "bulk_invite",
          priority: "medium" as const
        },
        {
          id: "security_settings",
          title: "Review Security",
          description: "Configure platform-wide security and access settings",
          action: "security_config",
          priority: "high" as const
        }
      ],

      dashboard: [
        {
          id: "recent_activity",
          title: "Check Recent Activity",
          description: "Review latest exam submissions and system activity",
          action: "activity_review",
          priority: "medium" as const
        },
        {
          id: "quick_exam",
          title: "Create Quick Exam",
          description: "Start creating a new exam with AI assistance",
          action: "quick_create",
          priority: "high" as const
        },
        {
          id: "platform_tour",
          title: "Platform Tour",
          description: "Get an overview of all available features and capabilities",
          action: "feature_tour",
          priority: "low" as const
        },
        {
          id: "notifications",
          title: "Review Notifications",
          description: "Check for important system alerts and updates",
          action: "notification_check",
          priority: "medium" as const
        }
      ],

      general: [
        {
          id: "getting_started",
          title: "Getting Started Guide",
          description: "Learn the basics of using the ExamCraft platform",
          action: "guide_basic",
          priority: "high" as const
        },
        {
          id: "feature_overview",
          title: "Feature Overview",
          description: "Explore all available features and their capabilities",
          action: "feature_overview",
          priority: "medium" as const
        },
        {
          id: "best_practices",
          title: "Best Practices",
          description: "Learn recommended approaches for effective exam management",
          action: "best_practices",
          priority: "medium" as const
        },
        {
          id: "support_contact",
          title: "Contact Support",
          description: "Get help with technical issues or platform questions",
          action: "support_help",
          priority: "low" as const
        }
      ]
    };

    return suggestionsByContext[context as keyof typeof suggestionsByContext] || suggestionsByContext.general;
  }
}

export const aiAssistantService = new AIAssistantService();