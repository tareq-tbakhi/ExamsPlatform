import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real, bigint, varchar, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User management with roles and Replit Auth integration
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(), // Replit user ID
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: text("role").notNull().default("student"), // admin, teacher_supervisor, teacher, student
  permissions: jsonb("permissions").default([]), // Additional permissions array
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const exams = pgTable("exams", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  instructions: text("instructions"),
  duration: integer("duration").notNull(), // minutes
  totalPoints: integer("total_points").notNull(),
  createdBy: varchar("created_by").notNull(), // Now references user.id (string)
  status: text("status").notNull().default("draft"), // draft, published, archived
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull(),
  type: text("type").notNull(), // multiple_choice, short_answer, essay, true_false, coding, video_response, audio_response
  question: text("question").notNull(),
  options: jsonb("options").default([]), // for multiple choice
  correctAnswer: text("correct_answer"), // for multiple choice, short answer, true_false
  points: integer("points").notNull(),
  order: integer("order").notNull(),
  // Enhanced grading settings
  weight: real("weight").default(1.0), // Question importance weight (1.0 = normal, 2.0 = double weight)
  autoGraded: boolean("auto_graded").default(true), // Whether question is auto-graded
  passingScore: integer("passing_score"), // Minimum score to pass this question (percentage)
  // Question-specific settings
  timeLimit: integer("time_limit"), // Time limit in seconds for this question
  metadata: jsonb("metadata").default({}), // Additional settings (test cases for coding, rubric for essays, etc)
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
  // Enhanced grading data
  weightedScore: real("weighted_score"), // Score considering question weights
  passingStatus: text("passing_status"), // "passed", "failed", "pending"
  gradingStatus: text("grading_status").default("pending"), // "completed", "pending", "partial"
  autoGradedScore: integer("auto_graded_score"), // Score from auto-graded questions only
  manualGradedScore: integer("manual_graded_score"), // Score from manually graded questions
  scoreBreakdown: jsonb("score_breakdown").default({}), // Detailed score by question type
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

// Authentication and user management schemas
export const insertUserSchema = createInsertSchema(users);

export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  role: true,
  isActive: true,
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

// User types for Replit Auth
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;

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

// Question-level grading results
export const questionGrades = pgTable("question_grades", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  answer: jsonb("answer").notNull(), // Student's actual answer
  score: integer("score").notNull(), // Points earned for this question
  maxScore: integer("max_score").notNull(), // Maximum possible points
  isCorrect: boolean("is_correct"), // For auto-graded questions
  gradingType: text("grading_type").notNull(), // "auto", "manual", "ai"
  feedback: text("feedback"), // Grader feedback or AI explanation
  gradedAt: timestamp("graded_at").defaultNow(),
  gradedBy: text("graded_by"), // "system", "ai", or grader identifier
});

// Coding challenge test cases and results
export const codingTestCases = pgTable("coding_test_cases", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  input: text("input").notNull(),
  expectedOutput: text("expected_output").notNull(),
  isHidden: boolean("is_hidden").default(false), // Hidden test cases for security
  weight: real("weight").default(1.0), // Weight of this test case
  timeLimit: integer("time_limit").default(5000), // Time limit in milliseconds
});

export const codingSubmissions = pgTable("coding_submissions", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  language: text("language").notNull(), // "javascript", "python", "java", etc.
  testResults: jsonb("test_results").notNull(), // Results of running test cases
  executionTime: integer("execution_time"), // Total execution time in ms
  score: integer("score").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow(),
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

// Grading system schemas
export const insertQuestionGradeSchema = createInsertSchema(questionGrades).omit({
  id: true,
  gradedAt: true,
});

export const insertCodingTestCaseSchema = createInsertSchema(codingTestCases).omit({
  id: true,
});

export const insertCodingSubmissionSchema = createInsertSchema(codingSubmissions).omit({
  id: true,
  submittedAt: true,
});

export type QuestionGrade = typeof questionGrades.$inferSelect;
export type InsertQuestionGrade = z.infer<typeof insertQuestionGradeSchema>;

export type CodingTestCase = typeof codingTestCases.$inferSelect;
export type InsertCodingTestCase = z.infer<typeof insertCodingTestCaseSchema>;

export type CodingSubmission = typeof codingSubmissions.$inferSelect;
export type InsertCodingSubmission = z.infer<typeof insertCodingSubmissionSchema>;

// Exam invitations table for CSV/Excel student uploads
export const examInvitations = pgTable("exam_invitations", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").references(() => exams.id, { onDelete: "cascade" }).notNull(),
  studentEmail: varchar("student_email", { length: 255 }).notNull(),
  studentName: varchar("student_name", { length: 255 }),
  registrationNumber: varchar("registration_number", { length: 100 }),
  inviteStatus: varchar("invite_status", { length: 50 }).default("pending"), // pending, sent, accessed, completed
  inviteToken: varchar("invite_token", { length: 255 }).unique(),
  accessedAt: timestamp("accessed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertExamInvitationSchema = createInsertSchema(examInvitations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ExamInvitation = typeof examInvitations.$inferSelect;
export type InsertExamInvitation = z.infer<typeof insertExamInvitationSchema>;

// User Invitations table for platform access
export const userInvitations = pgTable("user_invitations", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  role: varchar("role", { length: 50 }).notNull().default("teacher"),
  invitedBy: varchar("invited_by", { length: 255 }).notNull(),
  inviteToken: varchar("invite_token", { length: 255 }).notNull().unique(),
  inviteStatus: varchar("invite_status", { length: 50 }).notNull().default("pending"),
  invitedAt: timestamp("invited_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  expiresAt: timestamp("expires_at").notNull(),
});

export const insertUserInvitationSchema = createInsertSchema(userInvitations).omit({
  id: true,
  invitedAt: true,
});

// User schemas already defined above - removing duplicates

export type UserInvitation = typeof userInvitations.$inferSelect;
export type InsertUserInvitation = z.infer<typeof insertUserInvitationSchema>;
