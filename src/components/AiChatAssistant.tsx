import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Bot,
  Check,
  Copy,
  FileText,
  Mic,
  MicOff,
  Plus,
  Send,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { apiRequest, downloadAuthorizedFile } from '../api.ts';
import type { AiMode, ChatMessage, ChatSessionSummary, PageId } from '../types.ts';

interface AiChatAssistantProps {
  aiMode: AiMode;
  onChangeAiMode: (mode: AiMode) => void;
  initialPrompt: string | null;
  onClearInitialPrompt: () => void;
  onOpenBook: (bookId: number) => void;
  onNavigate: (page: PageId) => void;
}

const SUGGESTED_QUESTIONS = [
  'Find Python programming books',
  'Is Java Programming available?',
  'Recommend cybersecurity books',
  'Show my borrowed books',
  'What books are available for Artificial Intelligence?',
  'When is my book return date?',
  'Find lecture notes for AI and Python',
];

export function AiChatAssistant({
  aiMode,
  onChangeAiMode,
  initialPrompt,
  onClearInitialPrompt,
  onOpenBook,
  onNavigate,
}: AiChatAssistantProps) {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>(`sess-${Date.now()}`);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [onlineAvailable, setOnlineAvailable] = useState(false);
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadSessions = async () => {
    try {
      const res = await apiRequest<{ sessions: ChatSessionSummary[] }>('/api/chat/sessions');
      setSessions(res.sessions);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    apiRequest<{ onlineAvailable: boolean }>('/api/chat/status')
      .then((s) => setOnlineAvailable(s.onlineAvailable))
      .catch(() => setOnlineAvailable(false));
    loadSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    if (initialPrompt) {
      const prompt = initialPrompt;
      onClearInitialPrompt();
      void sendMessage(prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  const loadSessionMessages = async (sid: string) => {
    setActiveSessionId(sid);
    try {
      const res = await apiRequest<{ messages: ChatMessage[] }>(`/api/chat/sessions/${encodeURIComponent(sid)}`);
      setMessages(res.messages);
    } catch {
      setMessages([]);
    }
  };

  const handleNewConversation = () => {
    setActiveSessionId(`sess-${Date.now()}`);
    setMessages([]);
  };

  const handleClearConversation = async () => {
    try {
      await apiRequest(`/api/chat/sessions/${encodeURIComponent(activeSessionId)}`, { method: 'DELETE' });
      setMessages([]);
      await loadSessions();
    } catch {
      setMessages([]);
    }
  };

  const sendMessage = async (textOverride?: string) => {
    const query = (textOverride ?? input).trim();
    if (!query || sending) return;
    if (!textOverride) setInput('');

    const optimisticUser: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      message: query,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setSending(true);

    try {
      const res = await apiRequest<{
        sessionId: string;
        assistantMessageId: number;
        timestamp: string;
        reply: string;
        agentLabel: string;
        modeUsed: 'online' | 'offline';
        fallbackUsed: boolean;
        fallbackReason?: string;
        books?: ChatMessage['books'];
        digitalResources?: ChatMessage['digitalResources'];
        loans?: ChatMessage['loans'];
        suggestedActions?: ChatMessage['suggestedActions'];
      }>('/api/chat/message', {
        method: 'POST',
        body: JSON.stringify({
          message: query,
          sessionId: activeSessionId,
          mode: aiMode,
        }),
      });

      const assistantMsg: ChatMessage = {
        id: res.assistantMessageId,
        role: 'assistant',
        message: res.reply,
        agent_used: res.agentLabel,
        ai_mode: res.modeUsed,
        fallbackUsed: res.fallbackUsed,
        fallbackReason: res.fallbackReason,
        created_at: res.timestamp,
        books: res.books,
        digitalResources: res.digitalResources,
        loans: res.loans,
        suggestedActions: res.suggestedActions,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      await loadSessions();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          message: err instanceof Error ? err.message : 'Unable to reach SmartLib AI orchestrator.',
          agent_used: 'System Notice',
          ai_mode: 'offline',
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendMessage();
  };

  const handleCopy = (id: string | number, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }).catch(() => null);
  };

  const handleVoiceInput = () => {
    const win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
      };
    };

    const Recognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceNote('Voice dictation is not supported in this browser; please type your query.');
      return;
    }
    setVoiceNote(null);
    const rec = new Recognition();
    rec.lang = 'en-US';
    rec.interimResults = false;
    setListening(true);
    rec.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };
    rec.onerror = () => {
      setListening(false);
      setVoiceNote('Microphone capture unavailable or permission denied.');
    };
    rec.onend = () => setListening(false);
    rec.start();
  };

  return (
    <div className="bg-[#29251d] border border-[#3a382b] rounded-sm flex flex-col lg:flex-row h-[calc(100vh-140px)] min-h-[600px] overflow-hidden">
      {/* Left Conversation History Sidebar */}
      <aside className="w-full lg:w-[270px] border-b lg:border-b-0 lg:border-r border-[#3a382b] bg-[#1d1a15] flex flex-col shrink-0 max-h-48 lg:max-h-none">
        <div className="p-3.5 border-b border-[#3a382b] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleNewConversation}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 bg-[#c3a47b] text-[#1d1a15] text-xs font-semibold rounded-sm hover:bg-[#dbc39c] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Conversation</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#3a382b]">
          {sessions.length === 0 ? (
            <div className="p-4 text-xs text-[#c5b79e]/80">
              Your previous conversations with the librarian agents will appear here.
            </div>
          ) : (
            sessions.map((s) => (
              <button
                key={s.session_id}
                type="button"
                onClick={() => void loadSessionMessages(s.session_id)}
                className={`w-full text-left px-3.5 py-3 transition-colors cursor-pointer ${
                  s.session_id === activeSessionId
                    ? 'bg-[#29251d] border-r-2 border-[#c3a47b]'
                    : 'hover:bg-[#29251d]/60'
                }`}
              >
                <div className="text-xs font-medium text-[#eee2ca] truncate">
                  {s.first_prompt || 'New Library Session'}
                </div>
                <div className="text-[11px] font-mono text-[#c5b79e]/70 mt-0.5 tabular-nums">
                  {s.message_count} messages · {new Date(s.last_active).toLocaleDateString()}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#211e18]">
        {/* Chat Header Bar: AI Mode Selector + Real Status + Clear */}
        <div className="px-5 py-3 border-b border-[#3a382b] bg-[#29251d] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Bot className="w-4 h-4 text-[#c3a47b]" />
            <div>
              <div className="text-sm font-display font-semibold text-[#eee2ca]">
                Multi-Agent AI Library Assistant
              </div>
              <div className="text-[11px] text-[#c5b79e] flex items-center gap-1.5">
                {aiMode === 'offline' || !onlineAvailable ? (
                  <>
                    <WifiOff className="w-3 h-3 text-[#c5b79e]" />
                    <span>
                      {aiMode === 'offline'
                        ? 'Offline NLP Engine Active (Local SQLite)'
                        : 'Online AI Key Unset · Automatic Offline NLP Ready'}
                    </span>
                  </>
                ) : (
                  <>
                    <Wifi className="w-3 h-3 text-[#b4c99e]" />
                    <span className="text-[#b4c99e] font-medium">
                      Online Gemini AI Connected (Automatic Fallback Enabled)
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Segmented AI Mode Selector */}
            <div className="flex items-center p-0.5 bg-[#1d1a15] border border-[#3a382b] rounded-sm">
              {([
                { id: 'auto', label: 'Automatic' },
                { id: 'online', label: 'Online AI' },
                { id: 'offline', label: 'Offline AI' },
              ] as Array<{ id: AiMode; label: string }>).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChangeAiMode(m.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors whitespace-nowrap cursor-pointer ${
                    aiMode === m.id
                      ? 'bg-[#c3a47b] text-[#1d1a15] font-semibold'
                      : 'text-[#c5b79e] hover:text-[#eee2ca]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void handleClearConversation()}
              title="Clear conversation"
              className="p-2 text-[#c5b79e] hover:text-[#e5988b] border border-[#3a382b] bg-[#1d1a15] rounded-sm transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#211e18]">
          {messages.length === 0 && (
            <div className="max-w-2xl mx-auto py-8">
              <h2 className="text-lg font-display font-semibold text-[#eee2ca] mb-2">
                Ask any library, catalog, borrowing, or research question
              </h2>
              <p className="text-sm text-[#c5b79e] mb-6 leading-relaxed">
                The AI Agent Orchestrator automatically routes your query to the right specialized
                agent (Search, Availability, Recommendations, Borrowing, Digital Library, or Admin)
                and grounds every fact in the live SQLite database.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void sendMessage(q)}
                    className="p-3 text-left text-xs font-medium text-[#eee2ca] bg-[#29251d] border border-[#3a382b] hover:border-[#c3a47b] hover:bg-[#322d23] rounded-sm transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] lg:max-w-[75%] rounded-sm p-4 border ${
                  m.role === 'user'
                    ? 'bg-[#c3a47b] text-[#1d1a15] border-[#c3a47b]'
                    : 'bg-[#29251d] text-[#eee2ca] border-[#3a382b]'
                }`}
              >
                {m.role === 'assistant' && (
                  <div className="flex items-center justify-between gap-4 pb-2 mb-2 border-b border-[#3a382b] text-[11px] text-[#c5b79e]">
                    <span>
                      {m.agent_used || 'SmartLib Orchestrator'} ·{' '}
                      <span className="font-medium text-[#c3a47b]">
                        {m.ai_mode === 'online' ? 'Online AI' : 'Offline NLP'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(m.id, m.message)}
                      className="inline-flex items-center gap-1 text-[#c5b79e] hover:text-[#eee2ca] cursor-pointer"
                    >
                      {copiedId === m.id ? <Check className="w-3 h-3 text-[#b4c99e]" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === m.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                )}

                <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.message}</div>

                {m.fallbackUsed && m.fallbackReason && (
                  <div className="mt-2 pt-2 border-t border-[#3a382b] text-[11px] text-[#dbc39c]">
                    {m.fallbackReason}
                  </div>
                )}

                {/* Grounded Book Results */}
                {m.books && m.books.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#3a382b] space-y-2">
                    <div className="text-[11px] font-semibold text-[#c5b79e]">
                      Catalog Matches ({m.books.length})
                    </div>
                    {m.books.slice(0, 4).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => onOpenBook(b.id)}
                        className="w-full text-left p-2.5 bg-[#1d1a15] hover:bg-[#322d23] hover:border-[#c3a47b] border border-[#3a382b] rounded-sm flex items-center justify-between gap-3 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#eee2ca] truncate">{b.title}</div>
                          <div className="text-[11px] text-[#c5b79e] truncate">
                            {b.author} · {b.shelf_location}
                          </div>
                        </div>
                        <span
                          className={`text-[11px] font-mono font-semibold shrink-0 tabular-nums ${
                            b.available_copies > 0 ? 'text-[#b4c99e]' : 'text-[#e5988b]'
                          }`}
                        >
                          {b.available_copies}/{b.total_copies}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Grounded Digital Resources */}
                {m.digitalResources && m.digitalResources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#3a382b] space-y-2">
                    <div className="text-[11px] font-semibold text-[#c5b79e]">
                      Digital Archive Documents
                    </div>
                    {m.digitalResources.slice(0, 3).map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() =>
                          void downloadAuthorizedFile(
                            `/api/library/digital-resources/${d.id}/download`,
                            d.file_name
                          )
                        }
                        className="w-full text-left p-2.5 bg-[#1d1a15] hover:bg-[#322d23] hover:border-[#c3a47b] border border-[#3a382b] rounded-sm flex items-center justify-between gap-3 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-[#c3a47b] shrink-0" />
                          <span className="text-xs font-medium text-[#eee2ca] truncate">{d.title}</span>
                        </div>
                        <span className="text-[11px] font-mono text-[#c3a47b] shrink-0">Download</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Quick Navigation Actions */}
                {m.suggestedActions && m.suggestedActions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.suggestedActions.map((act, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (act.view === 'book-details' && act.entityId) {
                            onOpenBook(act.entityId);
                          } else {
                            onNavigate(act.view as PageId);
                          }
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-[#c3a47b] bg-[#1d1a15] border border-[#c3a47b]/40 hover:border-[#c3a47b] hover:bg-[#322d23] rounded-sm transition-colors cursor-pointer"
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>
                )}

                <div
                  className={`mt-2 text-[10px] font-mono tabular-nums ${
                    m.role === 'user' ? 'text-[#1d1a15]/75' : 'text-[#c5b79e]/65'
                  }`}
                >
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="bg-[#29251d] border border-[#3a382b] rounded-sm px-4 py-3 text-xs text-[#c5b79e]">
                Orchestrator routing query and verifying SQLite catalog...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Composer */}
        <div className="p-4 border-t border-[#3a382b] bg-[#29251d]">
          {voiceNote && (
            <div className="mb-2 text-xs text-[#dbc39c]">{voiceNote}</div>
          )}
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleVoiceInput}
              title="Voice search input"
              className={`p-2.5 border rounded-sm transition-colors cursor-pointer ${
                listening
                  ? 'border-[#a96346] bg-[#3f201d] text-[#e5988b]'
                  : 'border-[#3a382b] bg-[#1d1a15] text-[#c5b79e] hover:border-[#c3a47b] hover:text-[#eee2ca]'
              }`}
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about Python books, Java availability, due dates, or lecture PDFs..."
              className="flex-1 px-3.5 py-2.5 text-sm bg-[#1d1a15] text-[#eee2ca] placeholder:text-[#c5b79e]/45 border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="px-4 py-2.5 bg-[#c3a47b] text-[#1d1a15] text-xs font-semibold rounded-sm hover:bg-[#dbc39c] disabled:opacity-50 transition-colors inline-flex items-center gap-2 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
