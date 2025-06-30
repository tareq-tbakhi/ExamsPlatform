# Google Text-to-Speech Setup

## 1. Add API Key to Environment

Add this line to your `.env` file:
```
VITE_GOOGLE_TTS_API_KEY=AIzaSyBcK3PSLNU7YmFP5YR0S0Vw0TIZjMOb_jo
```

## 2. Test the Demo

1. Make sure your server is running:
   ```bash
   npm run dev
   ```

2. Visit the Google TTS demo page:
   ```
   http://localhost:5001/google-tts-demo
   ```

3. Try different voices:
   - **ar-XA-Wavenet-C** (Female, Premium)
   - **ar-XA-Wavenet-D** (Male, Premium)
   - **ar-XA-Standard-A** (Female, Standard)
   - **ar-XA-Standard-B** (Male, Standard)

## 3. Features

- **Natural Arabic Voice**: Google's WaveNet voices sound very natural
- **Multiple Voice Options**: Choose between male/female and standard/premium voices
- **Automatic Fallback**: If Google TTS fails, it falls back to browser TTS
- **Integrated in Audio Questions**: Audio questions now use Google TTS automatically

## 4. Testing in Exam

1. Create an exam with audio questions
2. Take the exam as a student
3. The questions will be spoken using Google TTS

## 5. Voice Quality Comparison

| Voice Type | Quality | Natural Sound | Cost |
|------------|---------|---------------|------|
| Browser TTS | Low | Robotic | Free |
| Google Standard | Good | Semi-natural | Low |
| Google WaveNet | Excellent | Very natural | Higher |

## 6. Troubleshooting

If Google TTS doesn't work:

1. Check the browser console for errors
2. Verify the API key is correct
3. Check if the API key has Text-to-Speech API enabled
4. Look for CORS errors (might need a proxy in production)

## 7. API Limits

- The free tier includes 1 million characters per month
- WaveNet voices count as 4x standard voices
- Monitor usage in Google Cloud Console 