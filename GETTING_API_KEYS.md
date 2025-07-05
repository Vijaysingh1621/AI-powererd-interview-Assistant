# 🔑 Getting Your Google Gemini API Key

## Step-by-Step Instructions

### 1. **Go to Google AI Studio**
   - Visit: [https://makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
   - Sign in with your Google account

### 2. **Create a New API Key**
   - Click "Create API Key"
   - Select "Create API key in new project" (or choose existing project)
   - Copy the generated API key

### 3. **Update Your .env.local File**
   Replace the placeholder in your `.env.local` file:
   ```bash
   GEMINI_API_KEY="your-actual-api-key-here"
   ```

### 4. **Important Notes**
   - ⚠️ **Keep your API key secure** - never commit it to version control
   - 🆓 **Free tier available** - Google AI Studio offers free usage quotas
   - 📊 **Monitor usage** - Check your usage at [Google AI Studio](https://makersuite.google.com/)

### 5. **Verify Your Setup**
   After adding your API key, run:
   ```bash
   yarn verify-setup
   ```

## Troubleshooting

### If you get "API key not valid" errors:
1. **Double-check the key** - Make sure you copied it correctly
2. **Remove quotes** - The key should be in quotes in .env.local: `GEMINI_API_KEY="your-key"`
3. **Check billing** - Some features require billing enabled
4. **Wait a few minutes** - New API keys might take time to activate

### Alternative: Using Google Cloud Console
If Google AI Studio doesn't work, you can also create an API key through:
1. [Google Cloud Console](https://console.cloud.google.com/)
2. Go to "APIs & Services" > "Credentials"
3. Create a new API key
4. Enable the "Generative Language API"

## Current Status
✅ Pinecone API key configured  
❌ Gemini API key needs to be updated  
❌ Other API keys still need configuration  

Once you update your Gemini API key, your PDF uploads should work perfectly!
