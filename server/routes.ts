import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertExamSchema, insertQuestionSchema, insertSubmissionSchema } from "@shared/schema";
import { generateQuestions, type GenerateQuestionsRequest } from "./services/openai";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Exam routes
  app.post("/api/exams", async (req, res) => {
    try {
      const examData = insertExamSchema.parse(req.body);
      const exam = await storage.createExam(examData);
      res.json(exam);
    } catch (error) {
      res.status(400).json({ message: "Invalid exam data", error: (error as Error).message });
    }
  });

  app.get("/api/exams/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const exam = await storage.getExamWithQuestions(id);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }
      res.json(exam);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch exam", error: (error as Error).message });
    }
  });

  // Default route for exam creator (uses default user ID 1)
  app.get("/api/exams/creator", async (req, res) => {
    try {
      const createdBy = 1; // Default user ID for demo purposes
      const exams = await storage.getExamsByCreator(createdBy);
      res.json(exams);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch exams", error: (error as Error).message });
    }
  });

  app.get("/api/exams/creator/:createdBy", async (req, res) => {
    try {
      const createdBy = parseInt(req.params.createdBy);
      const exams = await storage.getExamsByCreator(createdBy);
      res.json(exams);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch exams", error: (error as Error).message });
    }
  });

  app.put("/api/exams/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = insertExamSchema.partial().parse(req.body);
      const exam = await storage.updateExam(id, updateData);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }
      res.json(exam);
    } catch (error) {
      res.status(400).json({ message: "Invalid exam data", error: (error as Error).message });
    }
  });

  app.delete("/api/exams/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteExam(id);
      if (!deleted) {
        return res.status(404).json({ message: "Exam not found" });
      }
      res.json({ message: "Exam deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete exam", error: (error as Error).message });
    }
  });

  // Question routes
  app.post("/api/questions", async (req, res) => {
    try {
      const questionData = insertQuestionSchema.parse(req.body);
      const question = await storage.createQuestion(questionData);
      res.json(question);
    } catch (error) {
      res.status(400).json({ message: "Invalid question data", error: (error as Error).message });
    }
  });

  app.get("/api/questions/exam/:examId", async (req, res) => {
    try {
      const examId = parseInt(req.params.examId);
      const questions = await storage.getQuestionsByExam(examId);
      res.json(questions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch questions", error: (error as Error).message });
    }
  });

  app.put("/api/questions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = insertQuestionSchema.partial().parse(req.body);
      const question = await storage.updateQuestion(id, updateData);
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }
      res.json(question);
    } catch (error) {
      res.status(400).json({ message: "Invalid question data", error: (error as Error).message });
    }
  });

  app.delete("/api/questions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteQuestion(id);
      if (!deleted) {
        return res.status(404).json({ message: "Question not found" });
      }
      res.json({ message: "Question deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete question", error: (error as Error).message });
    }
  });

  // AI generation route
  app.post("/api/generate-questions", async (req, res) => {
    try {
      const requestSchema = z.object({
        topic: z.string().min(1),
        questionType: z.enum(["multiple_choice", "short_answer", "essay", "true_false"]),
        difficulty: z.enum(["easy", "medium", "hard"]),
        count: z.number().min(1).max(20),
        subject: z.string().optional()
      });

      const requestData: GenerateQuestionsRequest = requestSchema.parse(req.body);
      const questions = await generateQuestions(requestData);
      res.json({ questions });
    } catch (error) {
      res.status(400).json({ message: "Failed to generate questions", error: (error as Error).message });
    }
  });

  // Submission routes
  app.post("/api/submissions", async (req, res) => {
    try {
      const submissionData = insertSubmissionSchema.parse(req.body);
      
      // Calculate score for multiple choice questions
      const exam = await storage.getExamWithQuestions(submissionData.examId);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      let score = 0;
      const answers = submissionData.answers as Record<string, any>;

      exam.questions.forEach(question => {
        const studentAnswer = answers[question.id.toString()];
        if (question.type === "multiple_choice" && studentAnswer === question.correctAnswer) {
          score += question.points;
        }
        // For short_answer and essay, manual grading would be needed
      });

      const submissionWithScore = {
        ...submissionData,
        score,
      };

      const submission = await storage.createSubmission(submissionWithScore);
      res.json(submission);
    } catch (error) {
      res.status(400).json({ message: "Invalid submission data", error: (error as Error).message });
    }
  });

  app.get("/api/submissions/exam/:examId", async (req, res) => {
    try {
      const examId = parseInt(req.params.examId);
      const submissions = await storage.getSubmissionsByExam(examId);
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch submissions", error: (error as Error).message });
    }
  });

  app.get("/api/submissions/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const submissions = await storage.getRecentSubmissions(limit);
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent submissions", error: (error as Error).message });
    }
  });

  app.put("/api/submissions/:id/score", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { score } = req.body;
      
      if (typeof score !== "number" || score < 0) {
        return res.status(400).json({ message: "Invalid score" });
      }

      const submission = await storage.updateSubmissionScore(id, score);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }
      res.json(submission);
    } catch (error) {
      res.status(500).json({ message: "Failed to update score", error: (error as Error).message });
    }
  });

  // Stats route for dashboard
  app.get("/api/stats", async (req, res) => {
    try {
      // Mock user ID - in real app this would come from authentication
      const userId = 1;
      
      const userExams = await storage.getExamsByCreator(userId);
      const recentSubmissions = await storage.getRecentSubmissions();
      
      const totalExams = userExams.length;
      const totalSubmissions = userExams.reduce((sum, exam) => sum + exam.submissionsCount, 0);
      const averageScore = userExams.length > 0 
        ? userExams.reduce((sum, exam) => sum + (exam.averageScore || 0), 0) / userExams.filter(exam => exam.averageScore).length
        : 0;
      
      const passRate = recentSubmissions.length > 0
        ? (recentSubmissions.filter(sub => (sub.score || 0) >= (sub.totalPoints * 0.6)).length / recentSubmissions.length) * 100
        : 0;

      res.json({
        totalExams,
        totalSubmissions,
        averageScore: Math.round(averageScore * 10) / 10,
        passRate: Math.round(passRate)
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats", error: (error as Error).message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
