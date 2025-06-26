import { users, exams, questions, submissions, type User, type InsertUser, type Exam, type InsertExam, type Question, type InsertQuestion, type Submission, type InsertSubmission, type ExamWithQuestions, type ExamWithStats, type SubmissionWithExam } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Exams
  createExam(exam: InsertExam): Promise<Exam>;
  getExam(id: number): Promise<Exam | undefined>;
  getExamWithQuestions(id: number): Promise<ExamWithQuestions | undefined>;
  getExamsByCreator(createdBy: number): Promise<ExamWithStats[]>;
  updateExam(id: number, exam: Partial<InsertExam>): Promise<Exam | undefined>;
  deleteExam(id: number): Promise<boolean>;

  // Questions
  createQuestion(question: InsertQuestion): Promise<Question>;
  getQuestionsByExam(examId: number): Promise<Question[]>;
  updateQuestion(id: number, question: Partial<InsertQuestion>): Promise<Question | undefined>;
  deleteQuestion(id: number): Promise<boolean>;
  deleteQuestionsByExam(examId: number): Promise<boolean>;

  // Submissions
  createSubmission(submission: InsertSubmission): Promise<Submission>;
  getSubmission(id: number): Promise<Submission | undefined>;
  getSubmissionsByExam(examId: number): Promise<SubmissionWithExam[]>;
  getRecentSubmissions(limit?: number): Promise<SubmissionWithExam[]>;
  updateSubmissionScore(id: number, score: number): Promise<Submission | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createExam(insertExam: InsertExam): Promise<Exam> {
    const [exam] = await db
      .insert(exams)
      .values(insertExam)
      .returning();
    return exam;
  }

  async getExam(id: number): Promise<Exam | undefined> {
    const [exam] = await db.select().from(exams).where(eq(exams.id, id));
    return exam || undefined;
  }

  async getExamWithQuestions(id: number): Promise<ExamWithQuestions | undefined> {
    const exam = await this.getExam(id);
    if (!exam) return undefined;

    const examQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.examId, id))
      .orderBy(questions.order);

    return {
      ...exam,
      questions: examQuestions
    };
  }

  async getExamsByCreator(createdBy: number): Promise<ExamWithStats[]> {
    const userExams = await db
      .select()
      .from(exams)
      .where(eq(exams.createdBy, createdBy))
      .orderBy(exams.createdAt);

    const examStats = await Promise.all(
      userExams.map(async (exam) => {
        const questionsList = await db
          .select()
          .from(questions)
          .where(eq(questions.examId, exam.id));

        const examSubmissions = await db
          .select()
          .from(submissions)
          .where(eq(submissions.examId, exam.id));

        const submissionsCount = examSubmissions.length;
        const averageScore = submissionsCount > 0 
          ? examSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / submissionsCount 
          : undefined;

        return {
          ...exam,
          questionsCount: questionsList.length,
          submissionsCount,
          averageScore
        };
      })
    );

    return examStats;
  }

  async updateExam(id: number, updateData: Partial<InsertExam>): Promise<Exam | undefined> {
    const [exam] = await db
      .update(exams)
      .set(updateData)
      .where(eq(exams.id, id))
      .returning();
    return exam || undefined;
  }

  async deleteExam(id: number): Promise<boolean> {
    // Delete related questions and submissions first
    await this.deleteQuestionsByExam(id);
    await db.delete(submissions).where(eq(submissions.examId, id));
    
    const result = await db.delete(exams).where(eq(exams.id, id));
    return (result.rowCount || 0) > 0;
  }

  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    const [question] = await db
      .insert(questions)
      .values(insertQuestion)
      .returning();
    return question;
  }

  async getQuestionsByExam(examId: number): Promise<Question[]> {
    return await db
      .select()
      .from(questions)
      .where(eq(questions.examId, examId))
      .orderBy(questions.order);
  }

  async updateQuestion(id: number, updateData: Partial<InsertQuestion>): Promise<Question | undefined> {
    const [question] = await db
      .update(questions)
      .set(updateData)
      .where(eq(questions.id, id))
      .returning();
    return question || undefined;
  }

  async deleteQuestion(id: number): Promise<boolean> {
    const result = await db.delete(questions).where(eq(questions.id, id));
    return (result.rowCount || 0) > 0;
  }

  async deleteQuestionsByExam(examId: number): Promise<boolean> {
    const result = await db.delete(questions).where(eq(questions.examId, examId));
    return (result.rowCount || 0) > 0;
  }

  async createSubmission(insertSubmission: InsertSubmission): Promise<Submission> {
    const [submission] = await db
      .insert(submissions)
      .values(insertSubmission)
      .returning();
    return submission;
  }

  async getSubmission(id: number): Promise<Submission | undefined> {
    const [submission] = await db.select().from(submissions).where(eq(submissions.id, id));
    return submission || undefined;
  }

  async getSubmissionsByExam(examId: number): Promise<SubmissionWithExam[]> {
    const examSubmissions = await db
      .select({
        submission: submissions,
        examTitle: exams.title
      })
      .from(submissions)
      .leftJoin(exams, eq(submissions.examId, exams.id))
      .where(eq(submissions.examId, examId))
      .orderBy(submissions.submittedAt);

    return examSubmissions.map(({ submission, examTitle }) => ({
      ...submission,
      examTitle: examTitle || "Unknown Exam"
    }));
  }

  async getRecentSubmissions(limit: number = 10): Promise<SubmissionWithExam[]> {
    const recentSubmissions = await db
      .select({
        submission: submissions,
        examTitle: exams.title
      })
      .from(submissions)
      .leftJoin(exams, eq(submissions.examId, exams.id))
      .orderBy(submissions.submittedAt)
      .limit(limit);

    return recentSubmissions.map(({ submission, examTitle }) => ({
      ...submission,
      examTitle: examTitle || "Unknown Exam"
    }));
  }

  async updateSubmissionScore(id: number, score: number): Promise<Submission | undefined> {
    const [submission] = await db
      .update(submissions)
      .set({ score })
      .where(eq(submissions.id, id))
      .returning();
    return submission || undefined;
  }
}



export const storage = new DatabaseStorage();
