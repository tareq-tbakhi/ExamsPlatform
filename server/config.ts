import dotenv from "dotenv";

// Load environment variables before anything else
dotenv.config();

// Export configuration after loading .env
export const config = {
  database: {
    url: process.env.DATABASE_URL || "",
  },
  session: {
    secret: process.env.SESSION_SECRET || "dev-secret",
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
  },
  server: {
    port: parseInt(process.env.PORT || "5001"),
    host: process.env.HOST || "127.0.0.1",
  },
}; 