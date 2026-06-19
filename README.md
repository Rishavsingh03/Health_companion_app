# AI Health Companion

Full-stack local MVP for an AI-powered health companion. Users can sign up, log in, upload a prescription with symptom notes, and view saved Gemini-generated structured summaries later from their history.

Docker and EC2 deployment are intentionally not included yet. This version is focused on making the app work locally first.

## Tech Stack

- `client/`: Vite React, TypeScript, Tailwind CSS, lucide-react
- `server/`: Express, TypeScript, Mongoose, Zod, JWT HttpOnly cookies, Multer
- Database: MongoDB Atlas
- AI: Google Gemini API, with local mock mode available
- File storage: local `server/uploads/` folder, 5 MB upload cap

## Features Implemented

- Email/password signup and login
- Password hashing with bcrypt
- JWT session stored in an HttpOnly cookie
- Protected submission APIs
- JPG/PNG/PDF upload with 5 MB max size
- Symptom notes capture
- PDF embedded text extraction when possible
- Gemini structured analysis path
- `AI_MOCK_MODE=true` for local testing without Gemini calls
- Saved submission history per user
- Detail page for each saved analysis
- Owner-only original file access
- User-visible medical disclaimer

## Folder Structure

```text
client/
  src/
  package.json
server/
  src/
  .env.example
  package.json
package.json
```

## Local Setup

Install dependencies from the project root:

```bash
npm run install:all
```

Create `server/.env`:

```bash
cp server/.env.example server/.env
```

Update at least:

```env
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=a_long_random_secret
AI_MOCK_MODE=true
```

Create `client/.env` if needed:

```bash
cp client/.env.example client/.env
```

Start the API:

```bash
npm run dev:server
```

Start the frontend in another terminal:

```bash
npm run dev:client
```

Open:

```text
http://localhost:5173
```

## MongoDB Atlas Setup

1. Create a free MongoDB Atlas cluster.
2. Create a database user.
3. Add your current IP address to Atlas Network Access.
4. Copy the connection string.
5. Put it in `server/.env` as `MONGODB_URI`.

For local testing, the server still needs MongoDB even when `AI_MOCK_MODE=true`, because users and submissions are persisted.

## Gemini Setup

For local UI/backend testing without Gemini:

```env
AI_MOCK_MODE=true
```

For real Gemini calls:

```env
AI_MOCK_MODE=false
GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_MODEL=gemini-2.5-flash
```

The model is configurable so it can be changed if Google updates free-tier model availability.

## API Summary

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/submissions`
- `GET /api/submissions`
- `GET /api/submissions/:id`
- `GET /api/submissions/:id/file`

One user can create many submissions. Each submission stores one uploaded prescription, the symptom notes, and one saved Gemini analysis.

## AI Flow

1. User uploads prescription and symptoms.
2. Server validates auth, file type, size, and notes.
3. If PDF, server tries embedded text extraction.
4. If extracted text is meaningful, Gemini receives the text.
5. If text is weak or file is JPG/PNG, Gemini receives the original file bytes.
6. Gemini returns structured JSON.
7. Server validates and saves the structured response in MongoDB.
8. Future page loads read from MongoDB and do not re-call Gemini.

## Tests

Run backend tests after installing dependencies:

```bash
npm --prefix server run test
```

Build both apps:

```bash
npm run build:server
npm run build:client
```

Current tests cover validation and PDF extraction threshold helpers. More API tests can be added once the local environment is stable.

## Known Tradeoffs

- MongoDB Atlas reduces EC2 resource pressure later, but redeployers need their own `MONGODB_URI`.
- Local file storage is simple, but production should use S3 or equivalent object storage.
- HttpOnly cookies are safer than localStorage, but local HTTP cannot use the `Secure` cookie flag.
- The upload request waits for Gemini; a production app should use background jobs for long analyses.
- No true local OCR is implemented; Gemini reads images and scanned PDFs.
- Medicine reminders are skipped in this first version.
- This is not medical advice and is not production healthcare software.
