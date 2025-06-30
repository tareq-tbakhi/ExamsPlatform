# Google Text-to-Speech Setup Guide

This guide explains how to enable and use Google Cloud Text-to-Speech in the ExamCraft platform.

## Current Configuration

✅ **Google TTS is now enabled** with API key configured in `.env`
✅ **Default voice**: ar-XA-Standard-B (Male Standard - clear and natural Arabic voice)

Your API key `AIzaSyBcK3PSLNU7YmFP5YR0S0Vw0TIZjMOb_jo` needs Text-to-Speech API access.

## Quick Fix Steps:

### 1. Enable the API
Go to this direct link:
```
https://console.cloud.google.com/apis/library/texttospeech.googleapis.com
```

Click the **"ENABLE"** button.

### 2. Check API Key Restrictions
Go to:
```
https://console.cloud.google.com/apis/credentials
```

1. Find your API key
2. Click on it
3. Under "API restrictions", select either:
   - **"Don't restrict key"** (easiest)
   - OR add **"Cloud Text-to-Speech API"** to the allowed list

### 3. Wait and Test
- Wait 2-3 minutes for changes to propagate
- Refresh your exam platform page
- Try the audio question again

## Alternative: Create a New API Key

If the above doesn't work:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click **"+ CREATE CREDENTIALS"** → **"API key"**
3. Copy the new key
4. Update your `.env` file:
   ```
   GOOGLE_TTS_API_KEY=your-new-key-here
   VITE_GOOGLE_TTS_API_KEY=your-new-key-here
   ```
5. Restart the server

## Still Not Working?

The API might need billing enabled. Google gives $300 free credit for new accounts:
1. Go to: https://console.cloud.google.com/billing
2. Set up billing (you won't be charged within free tier)
3. Text-to-Speech free tier: 1 million characters/month

## Test in Browser Console

Once enabled, you can test directly:
```javascript
// Open browser console (F12) and run:
fetch('/api/tts/synthesize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'مرحبا، هذا اختبار',
    voiceConfig: {
      languageCode: 'ar-XA',
      name: 'ar-XA-Wavenet-C',
      ssmlGender: 'FEMALE'
    }
  })
}).then(r => r.json()).then(console.log)
```

If you see `audioContent` in the response, it's working! 