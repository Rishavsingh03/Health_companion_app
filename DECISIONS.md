# Decision Log And Known Tradeoffs

## Core Decisions

| Area | Choice | Why | Tradeoff |
| --- | --- | --- | --- |
| Repo layout | `client/` and `server/` | Easy to understand and present | No shared package for types |
| Frontend | Vite React SPA | Fast local dev and simple later Nginx hosting | No SSR |
| Backend | Express + TypeScript | Simple REST API with stronger contracts than plain JS | More setup than JS |
| Styling | Tailwind + lucide | Fast polished dashboard UI | Requires Tailwind build setup |
| API style | REST JSON | Easy to test and explain | Less end-to-end type sharing than tRPC |
| Auth | JWT in HttpOnly cookie | Safer than storing token in localStorage | Local HTTP cannot use `Secure` cookie flag |
| Database | MongoDB Atlas | Keeps EC2 lighter and matches MongoDB familiarity | Reviewers need their own `MONGODB_URI` |
| File storage | Local disk / later Docker volume | Simple and assignment-allowed | Uses server disk; production should use object storage |
| Upload cap | 5 MB | Protects disk and request size | Large prescriptions are rejected |
| AI flow | Synchronous analysis on upload | Simpler local MVP and demo | User waits for Gemini |
| OCR/extraction | Hybrid, no Tesseract | Avoids brittle local OCR and heavy native deps | Not a true local OCR pipeline |
| PDF handling | Extract embedded text first | Cheap and transparent for text PDFs | Scanned PDFs fall back to Gemini |
| Image handling | Send image bytes to Gemini | Better for handwritten/phone photos than local OCR | Gemini may misread poor handwriting |
| AI persistence | Store Gemini JSON in MongoDB | History loads without repeated LLM calls | Stored output can become stale |
| Optional reminders | Skipped in v1 | Must-haves stay stable first | Good-to-have not implemented |

## Known Flaws Accepted In V1

- The app is not production healthcare software.
- No HTTPS yet; this is local-first and later EC2 HTTP demo unless HTTPS is added.
- No email verification, password reset, refresh token rotation, rate limiting, or account lockout.
- Uploaded files are stored on server disk and are not backed up.
- Gemini output can be wrong or incomplete.
- Poor scans or unclear handwriting may produce weak results.
- Atlas is external infrastructure, so the app is not fully self-contained.
- API analysis is synchronous; background jobs would be better for production.

