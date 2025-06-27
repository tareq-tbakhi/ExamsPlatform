import { 
  users, exams, questions, submissions, proctoringViolations, videoQuestions, videoAnswers,
  aiAnalysisResults, analysisViolations, analysisTimeline, aiReports,
  questionGrades, codingTestCases, codingSubmissions, examInvitations, userInvitations,
  type User, type InsertUser, type UpsertUser, type Exam, type InsertExam, type Question, type InsertQuestion, 
  type Submission, type InsertSubmission, type ExamWithQuestions, type ExamWithStats, 
  type SubmissionWithExam, type ProctoringViolation, type InsertProctoringViolation,
  type VideoQuestion, type InsertVideoQuestion, type VideoAnswer, type InsertVideoAnswer,
  type AiAnalysisResult, type InsertAiAnalysisResult, type AnalysisViolation, 
  type InsertAnalysisViolation, type AnalysisTimeline, type InsertAnalysisTimeline,
  type AiReport, type InsertAiReport, type QuestionGrade, type InsertQuestionGrade,
  type CodingTestCase, type InsertCodingTestCase, type CodingSubmission, type InsertCodingSubmission,
  type ExamInvitation, type InsertExamInvitation, type UserInvitation, type InsertUserInvitation
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Additional user management
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUserRole(id: string, role: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  activateUser(id: string, isActive: boolean): Promise<User | undefined>;

  // Exams
  createExam(exam: InsertExam): Promise<Exam>;
  getExam(id: number): Promise<Exam | undefined>;
  getExamWithQuestions(id: number): Promise<ExamWithQuestions | undefined>;
  getExamsByCreator(createdBy: string): Promise<ExamWithStats[]>;
  updateExam(id: number, exam: Partial<InsertExam>): Promise<Exam | undefined>;
  deleteExam(id: number): Promise<boolean>;

  // Questions
  createQuestion(question: InsertQuestion): Promise<Question>;
  getQuestion(id: number): Promise<Question | undefined>;
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
  getTimelineByAnalysisId(analysisId: number): Promise<AnalysisTimeline[]>;

  // AI Reports
  createAiReport(report: InsertAiReport): Promise<AiReport>;
  getAiReportsBySubmission(submissionId: number): Promise<AiReport[]>;

  // Grading System
  createQuestionGrade(grade: InsertQuestionGrade): Promise<QuestionGrade>;
  getQuestionGradesBySubmission(submissionId: number): Promise<QuestionGrade[]>;
  updateSubmissionGrading(submissionId: number, gradingData: {
    score?: number;
    weightedScore?: number;
    passingStatus?: string;
    gradingStatus?: string;
    autoGradedScore?: number;
    manualGradedScore?: number;
    scoreBreakdown?: any;
  }): Promise<Submission | undefined>;

  // Coding Challenges
  createCodingTestCase(testCase: InsertCodingTestCase): Promise<CodingTestCase>;
  getCodingTestCasesByQuestion(questionId: number): Promise<CodingTestCase[]>;
  createCodingSubmission(submission: InsertCodingSubmission): Promise<CodingSubmission>;
  getCodingSubmissionsBySubmission(submissionId: number): Promise<CodingSubmission[]>;

  // Exam Invitations
  createExamInvitation(invitation: InsertExamInvitation): Promise<ExamInvitation>;
  createBulkExamInvitations(invitations: InsertExamInvitation[]): Promise<ExamInvitation[]>;
  getExamInvitations(examId: number): Promise<ExamInvitation[]>;
  updateInvitationStatus(id: number, status: string, accessedAt?: Date): Promise<ExamInvitation | undefined>;
  getInvitationByToken(token: string): Promise<ExamInvitation | undefined>;
  getInvitationByStudentDetails(name: string, email: string, registrationNumber: string): Promise<ExamInvitation | undefined>;
  getInvitationsByEmail(email: string): Promise<ExamInvitation[]>;

  // User Invitations (Platform Access)
  createUserInvitation(invitation: InsertUserInvitation): Promise<UserInvitation>;
  getUserInvitations(): Promise<UserInvitation[]>;
  getUserInvitationByToken(token: string): Promise<UserInvitation | undefined>;
  getUserInvitationByEmail(email: string): Promise<UserInvitation | undefined>;
  updateUserInvitationStatus(id: number, status: string, acceptedAt?: Date): Promise<UserInvitation | undefined>;
  deleteUserInvitation(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Additional user management
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async updateUserRole(id: string, role: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async activateUser(id: string, isActive: boolean): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
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

  async getExamsByCreator(createdBy: string): Promise<ExamWithStats[]> {
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

  async getQuestion(id: number): Promise<Question | undefined> {
    const [question] = await db.select().from(questions).where(eq(questions.id, id));
    return question || undefined;
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

  async getTimelineByAnalysisId(analysisId: number): Promise<AnalysisTimeline[]> {
    return await db
      .select()
      .from(analysisTimeline)
      .where(eq(analysisTimeline.analysisId, analysisId))
      .orderBy(analysisTimeline.timestamp);
  }

  async createAiReport(insertReport: InsertAiReport): Promise<AiReport> {
    const [report] = await db
      .insert(aiReports)
      .values(insertReport)
      .returning();
    return report;
  }

  async getAiReportsBySubmission(submissionId: number): Promise<AiReport[]> {
    return await db
      .select()
      .from(aiReports)
      .where(eq(aiReports.submissionId, submissionId))
      .orderBy(desc(aiReports.generatedAt));
  }

  // Grading System Implementation
  async createQuestionGrade(insertGrade: InsertQuestionGrade): Promise<QuestionGrade> {
    const [grade] = await db
      .insert(questionGrades)
      .values(insertGrade)
      .returning();
    return grade;
  }

  async getQuestionGradesBySubmission(submissionId: number): Promise<QuestionGrade[]> {
    return await db
      .select()
      .from(questionGrades)
      .where(eq(questionGrades.submissionId, submissionId))
      .orderBy(questionGrades.questionId);
  }

  async updateSubmissionGrading(submissionId: number, gradingData: {
    score?: number;
    weightedScore?: number;
    passingStatus?: string;
    gradingStatus?: string;
    autoGradedScore?: number;
    manualGradedScore?: number;
    scoreBreakdown?: any;
  }): Promise<Submission | undefined> {
    const [updated] = await db
      .update(submissions)
      .set(gradingData)
      .where(eq(submissions.id, submissionId))
      .returning();
    return updated;
  }

  // Coding Challenges Implementation
  async createCodingTestCase(insertTestCase: InsertCodingTestCase): Promise<CodingTestCase> {
    const [testCase] = await db
      .insert(codingTestCases)
      .values(insertTestCase)
      .returning();
    return testCase;
  }

  async getCodingTestCasesByQuestion(questionId: number): Promise<CodingTestCase[]> {
    return await db
      .select()
      .from(codingTestCases)
      .where(eq(codingTestCases.questionId, questionId))
      .orderBy(codingTestCases.id);
  }

  async createCodingSubmission(insertSubmission: InsertCodingSubmission): Promise<CodingSubmission> {
    const [submission] = await db
      .insert(codingSubmissions)
      .values(insertSubmission)
      .returning();
    return submission;
  }

  async getCodingSubmissionsBySubmission(submissionId: number): Promise<CodingSubmission[]> {
    return await db
      .select()
      .from(codingSubmissions)
      .where(eq(codingSubmissions.submissionId, submissionId));
  }

  // Exam Invitations methods
  async createExamInvitation(insertInvitation: InsertExamInvitation): Promise<ExamInvitation> {
    const [invitation] = await db
      .insert(examInvitations)
      .values(insertInvitation)
      .returning();
    return invitation;
  }

  async createBulkExamInvitations(insertInvitations: InsertExamInvitation[]): Promise<ExamInvitation[]> {
    return await db
      .insert(examInvitations)
      .values(insertInvitations)
      .returning();
  }

  async getExamInvitations(examId: number): Promise<ExamInvitation[]> {
    return await db
      .select()
      .from(examInvitations)
      .where(eq(examInvitations.examId, examId))
      .orderBy(desc(examInvitations.createdAt));
  }

  async updateInvitationStatus(id: number, status: string, accessedAt?: Date): Promise<ExamInvitation | undefined> {
    const updateData: any = { inviteStatus: status, updatedAt: new Date() };
    if (accessedAt) {
      updateData.accessedAt = accessedAt;
    }

    const [updated] = await db
      .update(examInvitations)
      .set(updateData)
      .where(eq(examInvitations.id, id))
      .returning();
    return updated;
  }

  async getInvitationByToken(token: string): Promise<ExamInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(examInvitations)
      .where(eq(examInvitations.inviteToken, token));
    return invitation;
  }

  async getInvitationByStudentDetails(name: string, email: string, registrationNumber: string): Promise<ExamInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(examInvitations)
      .where(
        and(
          eq(examInvitations.studentName, name),
          eq(examInvitations.studentEmail, email),
          eq(examInvitations.registrationNumber, registrationNumber)
        )
      );
    return invitation;
  }

  async getInvitationsByEmail(email: string): Promise<ExamInvitation[]> {
    return await db
      .select()
      .from(examInvitations)
      .where(eq(examInvitations.studentEmail, email));
  }

  // User Invitations (Platform Access)
  async createUserInvitation(insertInvitation: InsertUserInvitation): Promise<UserInvitation> {
    const [invitation] = await db
      .insert(userInvitations)
      .values(insertInvitation)
      .returning();
    return invitation;
  }

  async getUserInvitations(): Promise<UserInvitation[]> {
    return await db.select().from(userInvitations).orderBy(desc(userInvitations.invitedAt));
  }

  async getUserInvitationByToken(token: string): Promise<UserInvitation | undefined> {
    const [invitation] = await db.select().from(userInvitations).where(eq(userInvitations.inviteToken, token));
    return invitation;
  }

  async getUserInvitationByEmail(email: string): Promise<UserInvitation | undefined> {
    const [invitation] = await db.select().from(userInvitations).where(eq(userInvitations.email, email));
    return invitation;
  }

  async updateUserInvitationStatus(id: number, status: string, acceptedAt?: Date): Promise<UserInvitation | undefined> {
    const updateData: any = { inviteStatus: status };
    if (acceptedAt) {
      updateData.acceptedAt = acceptedAt;
    }

    const [updated] = await db
      .update(userInvitations)
      .set(updateData)
      .where(eq(userInvitations.id, id))
      .returning();
    return updated;
  }

  async deleteUserInvitation(id: number): Promise<boolean> {
    const result = await db.delete(userInvitations).where(eq(userInvitations.id, id));
    return result.rowCount > 0;
  }
}

export const storage = new DatabaseStorage();
