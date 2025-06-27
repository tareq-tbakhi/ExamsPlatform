import { GoogleGenAI } from "@google/genai";
import { transcriptionService } from "./transcription";
import type { 
  Question, 
  Submission, 
  QuestionGrade, 
  InsertQuestionGrade,
  CodingTestCase,
  CodingSubmission
} from "@shared/schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface GradingResult {
  questionId: number;
  score: number;
  maxScore: number;
  isCorrect: boolean;
  feedback: string;
  gradingType: "auto" | "manual" | "ai";
}

export interface ScoreBreakdown {
  multipleChoice: { earned: number; total: number; count: number };
  trueFalse: { earned: number; total: number; count: number };
  shortAnswer: { earned: number; total: number; count: number };
  essay: { earned: number; total: number; count: number };
  coding: { earned: number; total: number; count: number };
  videoResponse: { earned: number; total: number; count: number };
  audioResponse: { earned: number; total: number; count: number };
}

export interface OverallGradingResult {
  totalScore: number;
  totalPossible: number;
  weightedScore: number;
  passingStatus: "passed" | "failed" | "pending";
  gradingStatus: "completed" | "pending" | "partial";
  scoreBreakdown: ScoreBreakdown;
  questionGrades: GradingResult[];
}

export class AutoGradingService {
  
  /**
   * Grade a multiple choice question
   */
  gradeMultipleChoice(question: Question, studentAnswer: string): GradingResult {
    const isCorrect = studentAnswer === question.correctAnswer;
    const score = isCorrect ? question.points : 0;
    
    return {
      questionId: question.id,
      score,
      maxScore: question.points,
      isCorrect,
      feedback: isCorrect 
        ? "Correct answer!" 
        : `Incorrect. The correct answer was: ${question.correctAnswer}`,
      gradingType: "auto"
    };
  }

  /**
   * Grade a true/false question
   */
  gradeTrueFalse(question: Question, studentAnswer: string): GradingResult {
    const normalizedAnswer = studentAnswer.toLowerCase().trim();
    const correctAnswer = question.correctAnswer?.toLowerCase().trim();
    const isCorrect = normalizedAnswer === correctAnswer;
    const score = isCorrect ? question.points : 0;
    
    return {
      questionId: question.id,
      score,
      maxScore: question.points,
      isCorrect,
      feedback: isCorrect 
        ? "Correct!" 
        : `Incorrect. The correct answer was: ${question.correctAnswer}`,
      gradingType: "auto"
    };
  }

  /**
   * Grade a short answer using AI
   */
  async gradeShortAnswer(question: Question, studentAnswer: string): Promise<GradingResult> {
    try {
      const prompt = `Grade this short answer question:

Question: ${question.question}
Correct Answer: ${question.correctAnswer}
Student Answer: ${studentAnswer}
Maximum Points: ${question.points}

Provide a score from 0 to ${question.points} and brief feedback. Consider:
- Accuracy of the answer
- Key concepts covered
- Completeness of response

Respond with JSON in this format:
{
  "score": number,
  "feedback": "string explaining the grade"
}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              score: { type: "number" },
              feedback: { type: "string" }
            },
            required: ["score", "feedback"]
          }
        },
        contents: prompt
      });

      const result = JSON.parse(response.text || "{}");
      const score = Math.min(Math.max(0, result.score), question.points);
      
      return {
        questionId: question.id,
        score,
        maxScore: question.points,
        isCorrect: score === question.points,
        feedback: result.feedback || "Graded by AI",
        gradingType: "ai"
      };
    } catch (error) {
      console.error("Failed to grade short answer with AI:", error);
      return {
        questionId: question.id,
        score: 0,
        maxScore: question.points,
        isCorrect: false,
        feedback: "Unable to grade automatically. Manual review required.",
        gradingType: "manual"
      };
    }
  }

  /**
   * Grade an essay using AI with rubric
   */
  async gradeEssay(question: Question, studentAnswer: string): Promise<GradingResult> {
    try {
      const rubric = question.metadata?.rubric as any || {
        criteria: ["Content Quality", "Organization", "Grammar & Style"],
        maxPoints: question.points
      };

      const prompt = `Grade this essay question using the provided rubric:

Question: ${question.question}
Student Answer: ${studentAnswer}
Maximum Points: ${question.points}

Rubric Criteria: ${rubric.criteria?.join(", ") || "Content, Organization, Writing Quality"}

Provide detailed feedback and a score from 0 to ${question.points}. Consider:
- Relevance to the question
- Depth of analysis
- Organization and structure
- Writing quality and clarity
- Use of examples or evidence

Respond with JSON in this format:
{
  "score": number,
  "feedback": "detailed feedback explaining the grade and areas for improvement"
}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              score: { type: "number" },
              feedback: { type: "string" }
            },
            required: ["score", "feedback"]
          }
        },
        contents: prompt
      });

      const result = JSON.parse(response.text || "{}");
      const score = Math.min(Math.max(0, result.score), question.points);
      
      return {
        questionId: question.id,
        score,
        maxScore: question.points,
        isCorrect: score >= (question.points * 0.7), // 70% threshold
        feedback: result.feedback || "Graded by AI",
        gradingType: "ai"
      };
    } catch (error) {
      console.error("Failed to grade essay with AI:", error);
      return {
        questionId: question.id,
        score: 0,
        maxScore: question.points,
        isCorrect: false,
        feedback: "Unable to grade automatically. Manual review required.",
        gradingType: "manual"
      };
    }
  }

  /**
   * Execute and grade coding challenges
   */
  async gradeCoding(question: Question, code: string, language: string, testCases: CodingTestCase[]): Promise<GradingResult> {
    try {
      const testResults = await this.executeCodingTests(code, language, testCases);
      const passedTests = testResults.filter(result => result.passed).length;
      const totalTests = testResults.length;
      const score = Math.round((passedTests / totalTests) * question.points);
      
      const feedback = `${passedTests}/${totalTests} test cases passed. ${
        passedTests === totalTests ? "Excellent work!" : 
        passedTests > totalTests / 2 ? "Good progress, but some test cases failed." :
        "Most test cases failed. Please review your solution."
      }`;

      return {
        questionId: question.id,
        score,
        maxScore: question.points,
        isCorrect: passedTests === totalTests,
        feedback,
        gradingType: "auto"
      };
    } catch (error) {
      console.error("Failed to grade coding question:", error);
      return {
        questionId: question.id,
        score: 0,
        maxScore: question.points,
        isCorrect: false,
        feedback: "Code execution failed. Manual review required.",
        gradingType: "manual"
      };
    }
  }

  /**
   * Grade a video response question
   */
  async gradeVideoResponse(question: Question, answer: any): Promise<GradingResult> {
    try {
      const videoPath = answer.videoPath || answer.filePath;
      if (!videoPath) {
        return {
          questionId: question.id,
          score: 0,
          maxScore: question.points,
          isCorrect: false,
          feedback: "No video file provided",
          gradingType: "manual"
        };
      }

      // Transcribe the video audio
      const transcriptionResult = await transcriptionService.transcribeVideoAudio(videoPath, "ar");
      
      // Extract expected keywords from question metadata
      const expectedKeywords = question.metadata?.keywords as string[] || [];
      
      // Analyze the transcription for grading
      const analysis = await transcriptionService.analyzeTranscriptionForGrading(
        transcriptionResult.text,
        question.question,
        expectedKeywords,
        question.points
      );

      const detailedFeedback = `Transcription (${transcriptionResult.confidence}% confidence): "${transcriptionResult.text.substring(0, 100)}..."
      
Audio Quality: Clarity ${transcriptionResult.quality.clarity}%, Volume ${transcriptionResult.quality.volume}%
Content Analysis: ${analysis.feedback}
Keywords Covered: ${analysis.keywordsCovered.join(", ")}
Completeness: ${analysis.completeness}%, Relevance: ${analysis.relevance}%`;

      return {
        questionId: question.id,
        score: analysis.score,
        maxScore: question.points,
        isCorrect: analysis.score >= (question.points * 0.7), // 70% threshold
        feedback: detailedFeedback,
        gradingType: "ai"
      };
    } catch (error) {
      console.error("Failed to grade video response:", error);
      return {
        questionId: question.id,
        score: 0,
        maxScore: question.points,
        isCorrect: false,
        feedback: "Unable to process video response automatically. Manual review required.",
        gradingType: "manual"
      };
    }
  }

  /**
   * Grade an audio response question
   */
  async gradeAudioResponse(question: Question, answer: any): Promise<GradingResult> {
    try {
      const audioPath = answer.audioPath || answer.filePath;
      if (!audioPath) {
        return {
          questionId: question.id,
          score: 0,
          maxScore: question.points,
          isCorrect: false,
          feedback: "No audio file provided",
          gradingType: "manual"
        };
      }

      // Transcribe the audio
      const transcriptionResult = await transcriptionService.transcribeAudio(audioPath, "ar");
      
      // Extract expected keywords from question metadata
      const expectedKeywords = question.metadata?.keywords as string[] || [];
      
      // Analyze the transcription for grading
      const analysis = await transcriptionService.analyzeTranscriptionForGrading(
        transcriptionResult.text,
        question.question,
        expectedKeywords,
        question.points
      );

      const detailedFeedback = `Transcription (${transcriptionResult.confidence}% confidence): "${transcriptionResult.text.substring(0, 100)}..."
      
Audio Quality: Clarity ${transcriptionResult.quality.clarity}%, Volume ${transcriptionResult.quality.volume}%
Content Analysis: ${analysis.feedback}
Keywords Covered: ${analysis.keywordsCovered.join(", ")}
Completeness: ${analysis.completeness}%, Relevance: ${analysis.relevance}%
Sentiment: ${transcriptionResult.sentiment.score > 0 ? 'Positive' : 'Neutral/Negative'} (${transcriptionResult.sentiment.confidence}% confidence)`;

      return {
        questionId: question.id,
        score: analysis.score,
        maxScore: question.points,
        isCorrect: analysis.score >= (question.points * 0.7), // 70% threshold
        feedback: detailedFeedback,
        gradingType: "ai"
      };
    } catch (error) {
      console.error("Failed to grade audio response:", error);
      return {
        questionId: question.id,
        score: 0,
        maxScore: question.points,
        isCorrect: false,
        feedback: "Unable to process audio response automatically. Manual review required.",
        gradingType: "manual"
      };
    }
  }

  /**
   * Execute coding tests (simplified for demonstration)
   */
  private async executeCodingTests(code: string, language: string, testCases: CodingTestCase[]) {
    // This is a simplified implementation
    // In a real system, you'd use a secure sandbox like Docker
    const results = [];
    
    for (const testCase of testCases) {
      try {
        // For demo purposes, assume JavaScript execution
        if (language === "javascript") {
          const func = new Function("input", code + "\nreturn solution(input);");
          const output = func(testCase.input);
          const passed = String(output).trim() === testCase.expectedOutput.trim();
          
          results.push({
            testCaseId: testCase.id,
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            actualOutput: String(output),
            passed,
            executionTime: 10 // mock execution time
          });
        } else {
          // For other languages, return pending for manual evaluation
          results.push({
            testCaseId: testCase.id,
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            actualOutput: "Not executed",
            passed: false,
            executionTime: 0
          });
        }
      } catch (error) {
        results.push({
          testCaseId: testCase.id,
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          actualOutput: `Error: ${error}`,
          passed: false,
          executionTime: 0
        });
      }
    }
    
    return results;
  }

  /**
   * Grade an entire submission
   */
  async gradeSubmission(
    questions: Question[], 
    answers: Record<string, any>,
    testCases: CodingTestCase[] = []
  ): Promise<OverallGradingResult> {
    const questionGrades: GradingResult[] = [];
    const scoreBreakdown: ScoreBreakdown = {
      multipleChoice: { earned: 0, total: 0, count: 0 },
      trueFalse: { earned: 0, total: 0, count: 0 },
      shortAnswer: { earned: 0, total: 0, count: 0 },
      essay: { earned: 0, total: 0, count: 0 },
      coding: { earned: 0, total: 0, count: 0 },
      videoResponse: { earned: 0, total: 0, count: 0 },
      audioResponse: { earned: 0, total: 0, count: 0 }
    };

    for (const question of questions) {
      const answer = answers[question.id.toString()];
      if (!answer) continue;

      let result: GradingResult;

      switch (question.type) {
        case "multiple_choice":
          result = this.gradeMultipleChoice(question, answer);
          scoreBreakdown.multipleChoice.earned += result.score;
          scoreBreakdown.multipleChoice.total += result.maxScore;
          scoreBreakdown.multipleChoice.count++;
          break;

        case "true_false":
          result = this.gradeTrueFalse(question, answer);
          scoreBreakdown.trueFalse.earned += result.score;
          scoreBreakdown.trueFalse.total += result.maxScore;
          scoreBreakdown.trueFalse.count++;
          break;

        case "short_answer":
          result = await this.gradeShortAnswer(question, answer);
          scoreBreakdown.shortAnswer.earned += result.score;
          scoreBreakdown.shortAnswer.total += result.maxScore;
          scoreBreakdown.shortAnswer.count++;
          break;

        case "essay":
          result = await this.gradeEssay(question, answer);
          scoreBreakdown.essay.earned += result.score;
          scoreBreakdown.essay.total += result.maxScore;
          scoreBreakdown.essay.count++;
          break;

        case "coding":
          const questionTestCases = testCases.filter(tc => tc.questionId === question.id);
          result = await this.gradeCoding(question, answer.code, answer.language, questionTestCases);
          scoreBreakdown.coding.earned += result.score;
          scoreBreakdown.coding.total += result.maxScore;
          scoreBreakdown.coding.count++;
          break;

        case "video_response":
          result = await this.gradeVideoResponse(question, answer);
          scoreBreakdown.videoResponse.earned += result.score;
          scoreBreakdown.videoResponse.total += result.maxScore;
          scoreBreakdown.videoResponse.count++;
          break;

        case "audio_response":
          result = await this.gradeAudioResponse(question, answer);
          scoreBreakdown.audioResponse.earned += result.score;
          scoreBreakdown.audioResponse.total += result.maxScore;
          scoreBreakdown.audioResponse.count++;
          break;

        default:
          // For unknown question types, require manual grading
          result = {
            questionId: question.id,
            score: 0,
            maxScore: question.points,
            isCorrect: false,
            feedback: "Unknown question type - requires manual grading",
            gradingType: "manual"
          };
      }

      questionGrades.push(result);
    }

    // Calculate totals
    const totalScore = questionGrades.reduce((sum, grade) => sum + grade.score, 0);
    const totalPossible = questionGrades.reduce((sum, grade) => sum + grade.maxScore, 0);
    
    // Calculate weighted score
    const weightedScore = questionGrades.reduce((sum, grade) => {
      const question = questions.find(q => q.id === grade.questionId);
      const weight = question?.weight || 1.0;
      return sum + (grade.score * weight);
    }, 0);

    // Determine grading and passing status
    const manualGradingRequired = questionGrades.some(grade => grade.gradingType === "manual");
    const gradingStatus = manualGradingRequired ? "partial" : "completed";
    
    const percentage = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;
    const passingStatus = percentage >= 60 ? "passed" : "failed"; // 60% passing threshold

    return {
      totalScore,
      totalPossible,
      weightedScore,
      passingStatus,
      gradingStatus,
      scoreBreakdown,
      questionGrades
    };
  }
}

export const gradingService = new AutoGradingService();