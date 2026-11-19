import { Router } from 'express';
import { db } from '../db.ts';
import { type AuthenticatedRequest, requireAuth } from '../security.ts';
import { orchestrateAgentQuery, type AiModePreference } from '../agents/orchestrator.ts';

export const chatRouter = Router();

chatRouter.get('/status', requireAuth, (_req, res) => {
  const key = process.env.GEMINI_API_KEY;
  const onlineAvailable = Boolean(key && key !== 'MY_GEMINI_API_KEY' && key.trim().length >= 10);
  const defaultMode = (
    db.prepare("SELECT value FROM system_settings WHERE key = 'default_ai_mode'").get() as { value: string } | undefined
  )?.value || 'auto';

  res.json({
    onlineAvailable,
    defaultMode,
    offlineEngine: 'SmartLib Local NLP v1 (Intent + TF-IDF + SQLite)',
  });
});

chatRouter.get('/sessions', requireAuth, (req: AuthenticatedRequest, res) => {
  const sessions = db.prepare(`
    SELECT
      session_id,
      MIN(CASE WHEN role = 'user' THEN message END) as first_prompt,
      MAX(created_at) as last_active,
      COUNT(*) as message_count
    FROM chat_history
    WHERE user_id = ?
    GROUP BY session_id
    ORDER BY MAX(id) DESC
    LIMIT 25
  `).all(req.user!.id);

  res.json({ sessions });
});

chatRouter.get('/sessions/:sessionId', requireAuth, (req: AuthenticatedRequest, res) => {
  const sessionId = String(req.params.sessionId);
  const messages = db.prepare(`
    SELECT id, session_id, role, message, agent_used, ai_mode, created_at
    FROM chat_history
    WHERE user_id = ? AND session_id = ?
    ORDER BY id ASC
  `).all(req.user!.id, sessionId);

  res.json({ messages });
});

chatRouter.delete('/sessions/:sessionId', requireAuth, (req: AuthenticatedRequest, res) => {
  const sessionId = String(req.params.sessionId);
  db.prepare('DELETE FROM chat_history WHERE user_id = ? AND session_id = ?').run(req.user!.id, sessionId);
  res.json({ ok: true });
});

chatRouter.post('/message', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { message, sessionId, mode } = req.body as {
    message?: string;
    sessionId?: string;
    mode?: AiModePreference;
  };

  const trimmed = (message || '').trim();
  if (!trimmed) {
    res.status(400).json({ error: 'Message cannot be empty.' });
    return;
  }

  const activeSessionId = (sessionId || `sess-${Date.now()}`).slice(0, 64);
  const modePref: AiModePreference = mode === 'online' || mode === 'offline' || mode === 'auto' ? mode : 'auto';

  const result = await orchestrateAgentQuery(trimmed, req.user!, activeSessionId, modePref);

  const insertMsg = db.prepare(`
    INSERT INTO chat_history (user_id, session_id, role, message, agent_used, ai_mode)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertMsg.run(req.user!.id, activeSessionId, 'user', trimmed, result.agentLabel, result.modeUsed);
  const assistantRow = insertMsg.run(
    req.user!.id,
    activeSessionId,
    'assistant',
    result.reply,
    result.agentLabel,
    result.modeUsed
  );

  res.json({
    sessionId: activeSessionId,
    assistantMessageId: Number(assistantRow.lastInsertRowid),
    timestamp: new Date().toISOString(),
    ...result,
  });
});
