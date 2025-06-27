import { 
  users, exams, questions, submissions, proctoringViolations, videoQuestions, videoAnswers,
  aiAnalysisResults, analysisViolations, analysisTimeline,
  type User, type InsertUser, type Exam, type InsertExam, type Question, type InsertQuestion, 
  type Submission, type InsertSubmission, type ExamWithQuestions, type ExamWithStats, 
  type SubmissionWithExam, type ProctoringViolation, type InsertProctoringViolation,
  type VideoQuestion, type InsertVideoQuestion, type VideoAnswer, type InsertVideoAnswer,
  type AiAnalysisResult, type InsertAiAnalysisResult, type AnalysisViolation, 
  type InsertAnalysisViolation, type AnalysisTimeline, type InsertAnalysisTimeline
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

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

  // Proctoring Violations
  createProctoringViolation(violation: InsertProctoringViolation): Promise<ProctoringViolation>;
  getViolationsBySubmission(submissionId: number): Promise<ProctoringViolation[]>;

  // Video Questions
  createVideoQuestion(question: InsertVideoQuestion): Promise<VideoQuestion>;
  getVideoQuestionsByExam(examId: number): Promise<VideoQuestion[]>;
  updateVideoQuestion(id: number, question: Partial<InsertVideoQuestion>): Promise<VideoQuestion | undefined>;
  deleteVideoQuestion(id: number): Promise<boolean>;

  // Video Answers
  createVideoAnswer(answer: InsertVideoAnswer): Promise<VideoAnswer>;
  getVideoAnswersBySubmission(submissionId: number): Promise<VideoAnswer[]>;
  updateVideoAnswer(id: number, answer: Partial<InsertVideoAnswer>): Promise<VideoAnswer | undefined>;

  // AI Analysis Results
  createAiAnalysisResult(analysis: InsertAiAnalysisResult): Promise<AiAnalysisResult>;
  createAnalysisViolations(violations: InsertAnalysisViolation[]): Promise<AnalysisViolation[]>;
  createAnalysisTimeline(timeline: InsertAnalysisTimeline[]): Promise<AnalysisTimeline[]>;
  getAnalysisResultsBySubmission(submissionId: number): Promise<AiAnalysisResult[]>;
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

  async getRecentSubmissions(limit: number = 20): Promise<SubmissionWithExam[]> {
    const recentSubmissions = await db
      .select({
        submission: submissions,
        examTitle: exams.title
      })
      .from(submissions)
      .leftJoin(exams, eq(submissions.examId, exams.id))
      .orderBy(desc(submissions.submittedAt))
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

  // Proctoring Violations
  async createProctoringViolation(insertViolation: InsertProctoringViolation): Promise<ProctoringViolation> {
    const [violation] = await db
      .insert(proctoringViolations)
      .values(insertViolation)
      .returning();
    return violation;
  }

  async getViolationsBySubmission(submissionId: number): Promise<ProctoringViolation[]> {
    return await db
      .select()
      .from(proctoringViolations)
      .where(eq(proctoringViolations.submissionId, submissionId))
      .orderBy(proctoringViolations.timestamp);
  }

  // Video Questions
  async createVideoQuestion(insertQuestion: InsertVideoQuestion): Promise<VideoQuestion> {
    const [question] = await db
      .insert(videoQuestions)
      .values(insertQuestion)
      .returning();
    return question;
  }

  async getVideoQuestionsByExam(examId: number): Promise<VideoQuestion[]> {
    return await db
      .select()
      .from(videoQuestions)
      .where(eq(videoQuestions.examId, examId))
      .orderBy(videoQuestions.order);
  }

  async updateVideoQuestion(id: number, updateData: Partial<InsertVideoQuestion>): Promise<VideoQuestion | undefined> {
    const [question] = await db
      .update(videoQuestions)
      .set(updateData)
      .where(eq(videoQuestions.id, id))
      .returning();
    return question || undefined;
  }

  async deleteVideoQuestion(id: number): Promise<boolean> {
    const result = await db
      .delete(videoQuestions)
      .where(eq(videoQuestions.id, id));
    return (result as any).changes > 0;
  }

  // Video Answers
  async createVideoAnswer(insertAnswer: InsertVideoAnswer): Promise<VideoAnswer> {
    const [answer] = await db
      .insert(videoAnswers)
      .values(insertAnswer)
      .returning();
    return answer;
  }

  async getVideoAnswersBySubmission(submissionId: number): Promise<VideoAnswer[]> {
    return await db
      .select()
      .from(videoAnswers)
      .where(eq(videoAnswers.submissionId, submissionId))
      .orderBy(videoAnswers.submittedAt);
  }

  async updateVideoAnswer(id: number, updateData: Partial<InsertVideoAnswer>): Promise<VideoAnswer | undefined> {
    const [answer] = await db
      .update(videoAnswers)
      .set(updateData)
      .where(eq(videoAnswers.id, id))
      .returning();
    return answer || undefined;
  }

  // AI Analysis Results
  async createAiAnalysisResult(insertAnalysis: InsertAiAnalysisResult): Promise<AiAnalysisResult> {
    const [analysis] = await db
      .insert(aiAnalysisResults)
      .values(insertAnalysis)
      .returning();
    return analysis;
  }

  async createAnalysisViolations(insertViolations: InsertAnalysisViolation[]): Promise<AnalysisViolation[]> {
    const violations = await db
      .insert(analysisViolations)
      .values(insertViolations)
      .returning();
    return violations;
  }

  async createAnalysisTimeline(insertTimeline: InsertAnalysisTimeline[]): Promise<AnalysisTimeline[]> {
    const timeline = await db
      .insert(analysisTimeline)
      .values(insertTimeline)
      .returning();
    return timeline;
  }

  async getAnalysisResultsBySubmission(submissionId: number): Promise<AiAnalysisResult[]> {
    return await db
      .select()
      .from(aiAnalysisResults)
      .where(eq(aiAnalysisResults.submissionId, submissionId))
      .orderBy(desc(aiAnalysisResults.analyzedAt));
  }
}



export const storage = new DatabaseStorage();
