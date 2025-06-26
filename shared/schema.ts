import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
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
