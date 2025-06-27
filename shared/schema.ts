import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const exams = pgTable("exams", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  instructions: text("instructions"),
  duration: integer("duration").notNull(), // minutes
  totalPoints: integer("total_points").notNull(),
  createdBy: integer("created_by").notNull(),
  status: text("status").notNull().default("draft"), // draft, published, archived
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull(),
  type: text("type").notNull(), // multiple_choice, short_answer, essay
  question: text("question").notNull(),
  options: jsonb("options").default([]), // for multiple choice
  correctAnswer: text("correct_answer"), // for multiple choice and short answer
  points: integer("points").notNull(),
  order: integer("order").notNull(),
});

export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull(),
  studentName: text("student_name").notNull(),
  studentEmail: text("student_email"),
  answers: jsonb("answers").notNull(),
  score: integer("score"),
  totalPoints: integer("total_points").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow(),
  timeSpent: integer("time_spent"), // minutes
  proctoringData: jsonb("proctoring_data").default({}), // stores video urls, violations, etc
  sessionId: text("session_id"), // proctoring session identifier
});

export const proctoringViolations = pgTable("proctoring_violations", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull(),
  type: text("type").notNull(), // critical, major, minor
  category: text("category").notNull(), // no_face, multiple_faces, tab_switch, copy_paste, etc
  description: text("description").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  evidence: jsonb("evidence").default({}), // screenshot, audio data, etc
});

export const videoQuestions = pgTable("video_questions", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull(),
  question: text("question").notNull(),
  maxDuration: integer("max_duration").notNull(), // seconds
  order: integer("order").notNull(),
  points: integer("points").notNull(),
});

export const videoAnswers = pgTable("video_answers", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull(),
  videoQuestionId: integer("video_question_id").notNull(),
  videoUrl: text("video_url"),
  transcript: text("transcript"),
  confidence: integer("confidence"), // transcription confidence 0-100
  duration: integer("duration"), // seconds
  submittedAt: timestamp("submitted_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertExamSchema = createInsertSchema(exams).omit({
  id: true,
  createdAt: true,
});

export const insertQuestionSchema = createInsertSchema(questions).omit({
  id: true,
});

export const insertSubmissionSchema = createInsertSchema(submissions).omit({
  id: true,
  submittedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Exam = typeof exams.$inferSelect;
export type InsertExam = z.infer<typeof insertExamSchema>;

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;

export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;

// Extended types for API responses
export type ExamWithQuestions = Exam & {
  questions: Question[];
};

export type ExamWithStats = Exam & {
  questionsCount: number;
  submissionsCount: number;
  averageScore?: number;
};

export type SubmissionWithExam = Submission & {
  examTitle: string;
};

// New proctoring types
export const insertProctoringViolationSchema = createInsertSchema(proctoringViolations).omit({
  id: true,
  timestamp: true,
});

export const insertVideoQuestionSchema = createInsertSchema(videoQuestions).omit({
  id: true,
});

export const insertVideoAnswerSchema = createInsertSchema(videoAnswers).omit({
  id: true,
  submittedAt: true,
});

export type ProctoringViolation = typeof proctoringViolations.$inferSelect;
export type InsertProctoringViolation = z.infer<typeof insertProctoringViolationSchema>;

export type VideoQuestion = typeof videoQuestions.$inferSelect;
export type InsertVideoQuestion = z.infer<typeof insertVideoQuestionSchema>;

export type VideoAnswer = typeof videoAnswers.$inferSelect;
export type InsertVideoAnswer = z.infer<typeof insertVideoAnswerSchema>;

export type ExamWithVideoQuestions = Exam & {
  questions: Question[];
  videoQuestions: VideoQuestion[];
};

// AI Analysis tables
export const aiAnalysisResults = pgTable("ai_analysis_results", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  videoPath: text("video_path").notNull(),
  overallSuspicion: integer("overall_suspicion").notNull(), // Store as percentage (0-100)
  summary: text("summary").notNull(),
  analyzedAt: timestamp("analyzed_at").defaultNow().notNull(),
});

export const analysisViolations = pgTable("analysis_violations", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id").notNull().references(() => aiAnalysisResults.id, { onDelete: "cascade" }),
  severity: text("severity").notNull(), // 'critical', 'major', 'minor'
  confidence: integer("confidence").notNull(), // Store as percentage (0-100)
  description: text("description").notNull(),
  recommendations: jsonb("recommendations").notNull(),
  suspiciousActivities: jsonb("suspicious_activities").notNull(),
});

export const analysisTimeline = pgTable("analysis_timeline", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id").notNull().references(() => aiAnalysisResults.id, { onDelete: "cascade" }),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(), // Store as Unix timestamp or seconds
  activity: text("activity").notNull(),
  severity: text("severity").notNull(),
});

export const aiReports = pgTable("ai_reports", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  reportType: text("report_type").notNull(), // 'violation_report', 'comprehensive_analysis', etc.
  content: text("content").notNull(), // The generated report content
  violationCount: integer("violation_count").notNull(),
  suspicionLevel: integer("suspicion_level").notNull(), // Overall suspicion 0-100
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

// AI Analysis types
export const insertAiAnalysisResultSchema = createInsertSchema(aiAnalysisResults).omit({
  id: true,
  analyzedAt: true,
});

export const insertAnalysisViolationSchema = createInsertSchema(analysisViolations).omit({
  id: true,
});

export const insertAnalysisTimelineSchema = createInsertSchema(analysisTimeline).omit({
  id: true,
});

export const insertAiReportSchema = createInsertSchema(aiReports).omit({
  id: true,
  generatedAt: true,
});

export type AiAnalysisResult = typeof aiAnalysisResults.$inferSelect;
export type InsertAiAnalysisResult = z.infer<typeof insertAiAnalysisResultSchema>;

export type AnalysisViolation = typeof analysisViolations.$inferSelect;
export type InsertAnalysisViolation = z.infer<typeof insertAnalysisViolationSchema>;

export type AnalysisTimeline = typeof analysisTimeline.$inferSelect;
export type InsertAnalysisTimeline = z.infer<typeof insertAnalysisTimelineSchema>;

export type AiReport = typeof aiReports.$inferSelect;
export type InsertAiReport = z.infer<typeof insertAiReportSchema>;
