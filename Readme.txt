How to start

=== 로컬 개발 (Local Development) ===

1. Setup Gemini API Key
   - Get API key from https://makersuite.google.com/app/apikey
   - Create backend/.env file:
     cp backend/.env.example backend/.env
   - Add your API key to backend/.env:
     GEMINI_API_KEY=your-api-key-here

2. Install dependencies
   npm install

3. Start development server
   npm run dev

=== Netlify 배포 (Deployment) ===

See NETLIFY_DEPLOY.md for detailed deployment instructions

Quick steps:
1. Push to GitHub
2. Connect to Netlify
3. Set environment variables (GEMINI_API_KEY)
4. Deploy!

Your app will work with Gemini AI on Netlify Functions.