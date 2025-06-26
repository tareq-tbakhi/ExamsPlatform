import { users, exams, questions, submissions, type User, type InsertUser, type Exam, type InsertExam, type Question, type InsertQuestion, type Submission, type InsertSubmission, type ExamWithQuestions, type ExamWithStats, type SubmissionWithExam } from "@shared/schema";

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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private exams: Map<number, Exam>;
  private questions: Map<number, Question>;
  private submissions: Map<number, Submission>;
  private currentUserId: number;
  private currentExamId: number;
  private currentQuestionId: number;
  private currentSubmissionId: number;

  constructor() {
    this.users = new Map();
    this.exams = new Map();
    this.questions = new Map();
    this.submissions = new Map();
    this.currentUserId = 1;
    this.currentExamId = 1;
    this.currentQuestionId = 1;
    this.currentSubmissionId = 1;
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Exams
  async createExam(insertExam: InsertExam): Promise<Exam> {
    const id = this.currentExamId++;
    const exam: Exam = { 
      ...insertExam, 
      id, 
      createdAt: new Date() 
    };
    this.exams.set(id, exam);
    return exam;
  }

  async getExam(id: number): Promise<Exam | undefined> {
    return this.exams.get(id);
  }

  async getExamWithQuestions(id: number): Promise<ExamWithQuestions | undefined> {
    const exam = this.exams.get(id);
    if (!exam) return undefined;

    const examQuestions = Array.from(this.questions.values())
      .filter(q => q.examId === id)
      .sort((a, b) => a.order - b.order);

    return {
      ...exam,
      questions: examQuestions
    };
  }

  async getExamsByCreator(createdBy: number): Promise<ExamWithStats[]> {
    const userExams = Array.from(this.exams.values())
      .filter(exam => exam.createdBy === createdBy)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());

    return userExams.map(exam => {
      const questionsCount = Array.from(this.questions.values())
        .filter(q => q.examId === exam.id).length;
      
      const examSubmissions = Array.from(this.submissions.values())
        .filter(s => s.examId === exam.id);
      
      const submissionsCount = examSubmissions.length;
      const averageScore = submissionsCount > 0 
        ? examSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / submissionsCount 
        : undefined;

      return {
        ...exam,
        questionsCount,
        submissionsCount,
        averageScore
      };
    });
  }

  async updateExam(id: number, updateData: Partial<InsertExam>): Promise<Exam | undefined> {
    const exam = this.exams.get(id);
    if (!exam) return undefined;

    const updatedExam = { ...exam, ...updateData };
    this.exams.set(id, updatedExam);
    return updatedExam;
  }

  async deleteExam(id: number): Promise<boolean> {
    const deleted = this.exams.delete(id);
    if (deleted) {
      // Also delete related questions and submissions
      await this.deleteQuestionsByExam(id);
      Array.from(this.submissions.entries())
        .filter(([, submission]) => submission.examId === id)
        .forEach(([submissionId]) => this.submissions.delete(submissionId));
    }
    return deleted;
  }

  // Questions
  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    const id = this.currentQuestionId++;
    const question: Question = { ...insertQuestion, id };
    this.questions.set(id, question);
    return question;
  }

  async getQuestionsByExam(examId: number): Promise<Question[]> {
    return Array.from(this.questions.values())
      .filter(q => q.examId === examId)
      .sort((a, b) => a.order - b.order);
  }

  async updateQuestion(id: number, updateData: Partial<InsertQuestion>): Promise<Question | undefined> {
    const question = this.questions.get(id);
    if (!question) return undefined;

    const updatedQuestion = { ...question, ...updateData };
    this.questions.set(id, updatedQuestion);
    return updatedQuestion;
  }

  async deleteQuestion(id: number): Promise<boolean> {
    return this.questions.delete(id);
  }

  async deleteQuestionsByExam(examId: number): Promise<boolean> {
    const questionIds = Array.from(this.questions.entries())
      .filter(([, question]) => question.examId === examId)
      .map(([id]) => id);
    
    questionIds.forEach(id => this.questions.delete(id));
    return questionIds.length > 0;
  }

  // Submissions
  async createSubmission(insertSubmission: InsertSubmission): Promise<Submission> {
    const id = this.currentSubmissionId++;
    const submission: Submission = { 
      ...insertSubmission, 
      id, 
      submittedAt: new Date() 
    };
    this.submissions.set(id, submission);
    return submission;
  }

  async getSubmission(id: number): Promise<Submission | undefined> {
    return this.submissions.get(id);
  }

  async getSubmissionsByExam(examId: number): Promise<SubmissionWithExam[]> {
    const examSubmissions = Array.from(this.submissions.values())
      .filter(s => s.examId === examId)
      .sort((a, b) => new Date(b.submittedAt!).getTime() - new Date(a.submittedAt!).getTime());

    const exam = this.exams.get(examId);
    const examTitle = exam?.title || "Unknown Exam";

    return examSubmissions.map(submission => ({
      ...submission,
      examTitle
    }));
  }

  async getRecentSubmissions(limit: number = 10): Promise<SubmissionWithExam[]> {
    const allSubmissions = Array.from(this.submissions.values())
      .sort((a, b) => new Date(b.submittedAt!).getTime() - new Date(a.submittedAt!).getTime())
      .slice(0, limit);

    return allSubmissions.map(submission => {
      const exam = this.exams.get(submission.examId);
      return {
        ...submission,
        examTitle: exam?.title || "Unknown Exam"
      };
    });
  }

  async updateSubmissionScore(id: number, score: number): Promise<Submission | undefined> {
    const submission = this.submissions.get(id);
    if (!submission) return undefined;

    const updatedSubmission = { ...submission, score };
    this.submissions.set(id, updatedSubmission);
    return updatedSubmission;
  }
}

export const storage = new MemStorage();
