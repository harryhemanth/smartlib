import { GoogleGenAI } from '@google/genai';
import { db } from '../db.ts';
import type { AuthUser } from '../security.ts';
import { classifyIntent, type AgentId } from './nlpOffline.ts';
import { runSpecializedAgent, type AgentExecutionResult } from './specializedAgents.ts';

export type AiModePreference = 'online' | 'offline' | 'auto';

export interface OrchestratorResponse {
  reply: string;
  agent: AgentId;
  agentLabel: string;
  confidence: number;
  modeRequested: AiModePreference;
  modeUsed: 'online' | 'offline';
  fallbackUsed: boolean;
  fallbackReason?: string;
  books?: AgentExecutionResult['books'];
  digitalResources?: AgentExecutionResult['digitalResources'];
  loans?: AgentExecutionResult['loans'];
  suggestedActions?: AgentExecutionResult['suggestedActions'];
}

function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY' || key.trim().length < 10) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function orchestrateAgentQuery(
  query: string,
  user: AuthUser,
  sessionId: string,
  modePreference: AiModePreference = 'auto'
): Promise<OrchestratorResponse> {
  const intent = classifyIntent(query, user.role);
  const agentResult = runSpecializedAgent(intent, query, user);

  // If Offline mode is explicitly selected, never make external network calls
  if (modePreference === 'offline') {
    return {
      reply: agentResult.offlineReply,
      agent: agentResult.agent,
      agentLabel: agentResult.agentLabel,
      confidence: intent.confidence,
      modeRequested: modePreference,
      modeUsed: 'offline',
      fallbackUsed: false,
      books: agentResult.books,
      digitalResources: agentResult.digitalResources,
      loans: agentResult.loans,
      suggestedActions: agentResult.suggestedActions,
    };
  }

  // Online or Automatic Mode
  const ai = getGeminiClient();
  if (!ai) {
    if (modePreference === 'online') {
      return {
        reply: `${agentResult.offlineReply}\n\n(Note: Online AI service key is not configured in server secrets; fulfilled accurately via Offline NLP Engine.)`,
        agent: agentResult.agent,
        agentLabel: agentResult.agentLabel,
        confidence: intent.confidence,
        modeRequested: modePreference,
        modeUsed: 'offline',
        fallbackUsed: true,
        fallbackReason: 'Online AI credentials unavailable on server; switched to Offline NLP Engine.',
        books: agentResult.books,
        digitalResources: agentResult.digitalResources,
        loans: agentResult.loans,
        suggestedActions: agentResult.suggestedActions,
      };
    }

    return {
      reply: agentResult.offlineReply,
      agent: agentResult.agent,
      agentLabel: agentResult.agentLabel,
      confidence: intent.confidence,
      modeRequested: modePreference,
      modeUsed: 'offline',
      fallbackUsed: true,
      fallbackReason: 'Automatic fallback to local Offline NLP Engine.',
      books: agentResult.books,
      digitalResources: agentResult.digitalResources,
      loans: agentResult.loans,
      suggestedActions: agentResult.suggestedActions,
    };
  }

  // Fetch recent conversation turns for contextual continuity
  const recentHistory = db.prepare(`
    SELECT role, message FROM chat_history
    WHERE user_id = ? AND session_id = ?
    ORDER BY id DESC
    LIMIT 6
  `).all(user.id, sessionId) as Array<{ role: 'user' | 'assistant'; message: string }>;

  const historyTranscript = recentHistory
    .reverse()
    .map((m) => `${m.role === 'user' ? 'Student' : 'Librarian'}: ${m.message}`)
    .join('\n');

  const systemInstruction = `You are SmartLib AI, an academic college library multi-agent assistant.
Active Specialized Agent: ${agentResult.agentLabel}.
Authenticated User: ${user.full_name} (Role: ${user.role}, Department: ${user.department}, ID: ${user.student_id || 'N/A'}).

CRITICAL GROUNDING RULES:
1. You MUST rely strictly on the verified SQLite database records provided below for book availability, copy counts, shelf locations, ISBNs, user loan dates, and digital resource lists.
2. Never invent book availability, shelf locations, or loan due dates that are not in the verified context.
3. If the user asks an academic or conceptual question related to the books/subjects (e.g., explaining Python, AI, or Cybersecurity concepts), provide a crisp, scholarly explanation alongside the catalog findings.
4. Keep formatting clean, concise, and professional. Use bullet lists for multiple items.`;

  const promptPayload = `${historyTranscript ? `Recent Conversation:\n${historyTranscript}\n\n` : ''}Verified Database Context from ${agentResult.agentLabel}:
${agentResult.structuredContext}

Local Agent Baseline Summary:
${agentResult.offlineReply}

Current User Request:
${query}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: promptPayload,
      config: {
        systemInstruction,
      },
    });

    const onlineText = response.text?.trim();
    if (!onlineText) {
      throw new Error('Empty response received from Online AI model.');
    }

    return {
      reply: onlineText,
      agent: agentResult.agent,
      agentLabel: agentResult.agentLabel,
      confidence: intent.confidence,
      modeRequested: modePreference,
      modeUsed: 'online',
      fallbackUsed: false,
      books: agentResult.books,
      digitalResources: agentResult.digitalResources,
      loans: agentResult.loans,
      suggestedActions: agentResult.suggestedActions,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Online AI request failed';
    return {
      reply: agentResult.offlineReply,
      agent: agentResult.agent,
      agentLabel: agentResult.agentLabel,
      confidence: intent.confidence,
      modeRequested: modePreference,
      modeUsed: 'offline',
      fallbackUsed: true,
      fallbackReason: `Online AI unavailable (${reason}); fulfilled via Offline NLP Engine.`,
      books: agentResult.books,
      digitalResources: agentResult.digitalResources,
      loans: agentResult.loans,
      suggestedActions: agentResult.suggestedActions,
    };
  }
}
