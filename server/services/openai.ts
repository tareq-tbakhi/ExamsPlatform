import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

export interface GenerateQuestionsRequest {
  topic: string;
  questionType: "multiple_choice" | "true_false" | "short_answer" | "essay" | "coding" | "video_response" | "audio_response";
  difficulty: "easy" | "medium" | "hard";
  count: number;
  subject?: string;
}

export interface GeneratedQuestion {
  question: string;
  type: string;
  options?: string[];
  correctAnswer?: string;
  points: number;
  difficulty: string;
}

export async function generateQuestions(request: GenerateQuestionsRequest): Promise<GeneratedQuestion[]> {
  try {
    const prompt = createPrompt(request);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert educator and test creator. Generate educational exam questions based on the given parameters. Always respond with valid JSON format."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    if (!result.questions || !Array.isArray(result.questions)) {
      throw new Error("Invalid response format from OpenAI");
    }

    return result.questions.map((q: any, index: number) => ({
      question: q.question,
      type: request.questionType,
      options: q.options || [],
      correctAnswer: q.correctAnswer || q.correct_answer,
      points: calculatePoints(request.questionType, request.difficulty),
      difficulty: request.difficulty
    }));
  } catch (error) {
    console.error("Error generating questions:", error);
    throw new Error("Failed to generate questions: " + (error as Error).message);
  }
}

function createPrompt(request: GenerateQuestionsRequest): string {
  const { topic, questionType, difficulty, count, subject } = request;
  
  let prompt = `Generate ${count} ${difficulty} level ${questionType.replace('_', ' ')} question(s) about "${topic}"`;
  
  if (subject) {
    prompt += ` for a ${subject} exam`;
  }
  
  prompt += `.\n\nRequirements:\n`;
  
  switch (questionType) {
    case "multiple_choice":
      prompt += `- Each question should have 4 options (A, B, C, D)
- Clearly indicate the correct answer
- Make distractors plausible but clearly incorrect
- Avoid "all of the above" or "none of the above" options`;
      break;
    case "short_answer":
      prompt += `- Questions should require 1-3 sentence answers
- Provide a sample correct answer
- Focus on key concepts and understanding`;
      break;
    case "essay":
      prompt += `- Questions should require detailed explanations or analysis
- Provide guidance on expected answer length (e.g., 200-300 words)
- Focus on critical thinking and application`;
      break;
    case "true_false":
      prompt += `- Create clear, unambiguous statements
- Avoid overly obvious or trick questions
- Indicate the correct answer (true or false)`;
      break;
    case "coding":
      prompt += `- Create programming problems that test algorithm and logic skills
- Provide a clear problem statement with input/output examples
- Include starter code template in JavaScript
- Focus on data structures, algorithms, and problem-solving`;
      break;
    case "video_response":
      prompt += `- Create questions that require verbal explanation or demonstration
- Suitable for oral presentations, explanations, or visual demonstrations
- Provide keywords that should be mentioned in the response
- Focus on communication skills and practical application`;
      break;
    case "audio_response":
      prompt += `- Create questions that require verbal answers or pronunciation
- Suitable for language learning, oral explanations, or voice responses
- Provide expected keywords for automatic transcription grading
- Focus on speaking skills and verbal communication`;
      break;
  }
  
  prompt += `\n\nDifficulty level "${difficulty}" means:`;
  switch (difficulty) {
    case "easy":
      prompt += ` Basic recall and understanding of fundamental concepts`;
      break;
    case "medium":
      prompt += ` Application of concepts and moderate analysis`;
      break;
    case "hard":
      prompt += ` Complex analysis, synthesis, and evaluation of concepts`;
      break;
  }
  
  prompt += `\n\nRespond in JSON format with this structure:
{
  "questions": [
    {
      "question": "The question text",
      "type": "${questionType}",
      "options": ["A", "B", "C", "D"], // only for multiple choice
      "correctAnswer": "The correct answer", // for multiple choice: the letter (A,B,C,D), for others: the answer text or keywords
      "explanation": "Brief explanation of the correct answer", // optional
      "metadata": { // optional, for coding/video/audio questions
        "keywords": ["keyword1", "keyword2"], // for video/audio questions
        "template": "code template", // for coding questions
        "maxDuration": 120, // for video/audio questions in seconds
        "language": "javascript" // for coding questions
      }
    }
  ]
}`;

  return prompt;
}

function calculatePoints(questionType: string, difficulty: string): number {
  const basePoints = {
    multiple_choice: 5,
    true_false: 3,
    short_answer: 10,
    essay: 20,
    coding: 25,
    video_response: 15,
    audio_response: 12
  };
  
  const difficultyMultiplier = {
    easy: 1,
    medium: 1.5,
    hard: 2
  };
  
  const base = basePoints[questionType as keyof typeof basePoints] || 5;
  const multiplier = difficultyMultiplier[difficulty as keyof typeof difficultyMultiplier] || 1;
  
  return Math.round(base * multiplier);
}
