import dotenv from "dotenv";

// Load environment variables before anything else
dotenv.config();

// Debug: Log loaded Google TTS API key
console.log("Google TTS API Key loaded:", process.env.GOOGLE_TTS_API_KEY ? "✓ (Key present)" : "✗ (Key missing)");

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
  googleTts: {
    apiKey: process.env.GOOGLE_TTS_API_KEY || process.env.VITE_GOOGLE_TTS_API_KEY || "",
  },
  server: {
    port: parseInt(process.env.PORT || "5001"),
    host: process.env.HOST || "127.0.0.1",
  },
}; 