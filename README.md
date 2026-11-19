# SmartLib AI – Intelligent College Library Agent

SmartLib AI is a full-stack, multi-agent academic library management platform supporting both **Online AI** (server-side Gemini API grounded in real database records) and **Offline AI** (local NLP intent classification, stemming, TF-IDF relevance scoring, and SQLite retrieval).

## Multi-Agent Architecture

All queries pass through `server/agents/orchestrator.ts` and are routed to seven specialized agents:

1. **Agent 1 – AI Library Chatbot**: General policies, library hours, borrowing rules, and multi-turn Q&A.
2. **Agent 2 – Smart Book Search**: Natural-language search across titles, authors, ISBNs, departments, and subjects.
3. **Agent 3 – Book Availability Agent**: Live copy counts (`available_copies / total_copies`), shelf coordinates, and active reservation queues.
4. **Agent 4 – Book Recommendation Agent**: Personalized textbook suggestions ranked by student department, interest, and availability.
5. **Agent 5 – Borrowing Management Agent**: Active loans, issue/due dates, overdue status, renewals, and returns.
6. **Agent 6 – Digital Library Agent**: Role-verified PDFs, lecture notes, and study packets with tracked downloads.
7. **Agent 7 – Admin Management Agent**: Role-gated operational analytics, catalog CRUD, student governance, and audit logs.

## AI Operation Modes

- **Automatic Mode**: Uses Online Gemini AI grounded with verified SQLite query results, falling back seamlessly to the local Offline NLP Engine if the API key is absent or network connectivity drops.
- **Online AI Mode**: Synthesizes conversational explanations via `@google/genai` (`gemini-4-hydrogen`) on the server side (`GEMINI_API_KEY` is never exposed to the browser).
- **Offline AI Mode**: Executes 100% locally with zero external API calls using `server/agents/nlpOffline.ts` and prepared SQLite statements.

## Security & Database

- **SQLite (`smartlib.db`)** with WAL mode and enforced foreign keys (`database/schema.sql` also provides MySQL-compatible DDL).
- **Bcrypt Password Hashing**, signed **HTTP-only session cookies**, **CSRF token validation** (`X-CSRF-Token`), parameterized SQL queries, and strict `requireAuth` / `requireAdmin` RBAC guards.
- **Audit Logging**: Tracks login attempts (`login_activity`) and administrative mutations (`admin_activity`).

## Running Locally in VS Code

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables (optional GEMINI_API_KEY for Online AI)
cp .env.example .env

# 3. Start full-stack Express + Vite server on port 3000
npm run dev
```

### Demo Accounts (Seeded Automatically)

- **Student Portal**: `maya.lin@smartlib.edu` / `Student@2026`
- **Admin Portal**: `admin@smartlib.edu` / `Admin@SmartLib2026`
