export type AgentId =
  | 'AGENT_1_CHATBOT'
  | 'AGENT_2_SEARCH'
  | 'AGENT_3_AVAILABILITY'
  | 'AGENT_4_RECOMMENDATION'
  | 'AGENT_5_BORROWING'
  | 'AGENT_6_DIGITAL_LIBRARY'
  | 'AGENT_7_ADMIN';

export interface IntentClassification {
  agent: AgentId;
  agentLabel: string;
  confidence: number;
  keywords: string[];
  extractedIsbn: string | null;
  extractedDepartment: string | null;
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
  'should', 'can', 'could', 'may', 'might', 'must', 'i', 'me', 'my',
  'you', 'your', 'we', 'our', 'they', 'their', 'it', 'its', 'this',
  'that', 'these', 'those', 'in', 'on', 'at', 'by', 'for', 'with',
  'about', 'against', 'between', 'into', 'through', 'during', 'before',
  'after', 'above', 'below', 'to', 'from', 'up', 'down', 'of', 'off',
  'over', 'under', 'please', 'tell', 'give', 'show', 'me', 'any', 'some',
  'what', 'which', 'who', 'when', 'where', 'how', 'why', 'books', 'book',
  'library', 'need', 'want', 'looking', 'help'
]);

const SYNONYMS: Record<string, string[]> = {
  ai: ['artificial', 'intelligence', 'machine', 'learning', 'neural', 'transformer', 'nlp'],
  ml: ['machine', 'learning', 'deep', 'ai'],
  cybersecurity: ['security', 'cryptography', 'hacking', 'pentest', 'network', 'zero-trust'],
  programming: ['python', 'java', 'algorithms', 'software', 'coding', 'code'],
  db: ['database', 'sql', 'distributed', 'data'],
  math: ['mathematics', 'linear', 'algebra', 'quantum'],
  pdf: ['notes', 'lecture', 'slides', 'paper', 'ebook', 'digital', 'document', 'study'],
};

const DEPARTMENTS = [
  'Computer Science',
  'Artificial Intelligence',
  'Cybersecurity',
  'Data Science',
  'Mathematics',
  'Physics & Quantum Engineering',
];

export function tokenizeAndClean(input: string): string[] {
  const raw = input
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const tokens: string[] = [];
  for (const w of raw) {
    if (STOP_WORDS.has(w)) continue;
    const stemmed = stemWord(w);
    tokens.push(stemmed);
    if (SYNONYMS[w]) {
      for (const syn of SYNONYMS[w]) {
        tokens.push(stemWord(syn));
      }
    }
  }
  return Array.from(new Set(tokens));
}

export function stemWord(word: string): string {
  if (word.length <= 3) return word;
  return word
    .replace(/(ing|tion|ations|ment|ness|ies|es|s)$/i, (m) => (m === 'ies' ? 'y' : ''))
    .toLowerCase();
}

export function extractIsbn(input: string): string | null {
  const match = input.match(/(?:97[89][-\s]?)?\d{1,5}[-\s]?\d{1,7}[-\s]?\d{1,7}[-\s]?[\dX]/i);
  if (match && match[0].replace(/[-\s]/g, '').length >= 10) {
    return match[0].trim();
  }
  return null;
}

export function extractDepartment(input: string): string | null {
  const lower = input.toLowerCase();
  if (lower.includes('cyber') || lower.includes('security') || lower.includes('cryptography')) return 'Cybersecurity';
  if (lower.includes('artificial intelligence') || lower.includes('machine learning') || /\bai\b/.test(lower) || lower.includes('nlp')) return 'Artificial Intelligence';
  if (lower.includes('data science') || lower.includes('database') || lower.includes('distributed')) return 'Data Science';
  if (lower.includes('computer science') || lower.includes('python') || lower.includes('java') || lower.includes('algorithm')) return 'Computer Science';
  if (lower.includes('math') || lower.includes('algebra')) return 'Mathematics';
  if (lower.includes('quantum') || lower.includes('physics')) return 'Physics & Quantum Engineering';
  for (const dept of DEPARTMENTS) {
    if (lower.includes(dept.toLowerCase())) return dept;
  }
  return null;
}

export function classifyIntent(query: string, userRole: 'student' | 'admin'): IntentClassification {
  const lower = query.toLowerCase();
  const isbn = extractIsbn(query);
  const department = extractDepartment(query);
  const keywords = tokenizeAndClean(query);

  const scores: Record<AgentId, number> = {
    AGENT_1_CHATBOT: 0.2,
    AGENT_2_SEARCH: 0,
    AGENT_3_AVAILABILITY: 0,
    AGENT_4_RECOMMENDATION: 0,
    AGENT_5_BORROWING: 0,
    AGENT_6_DIGITAL_LIBRARY: 0,
    AGENT_7_ADMIN: 0,
  };

  // Agent 7: Admin Management
  if (/\b(admin|inventory report|overdue report|all students|audit log|add book|delete book|manage student|library report|total students)\b/i.test(lower)) {
    scores.AGENT_7_ADMIN += userRole === 'admin' ? 5.0 : 2.5;
  }

  // Agent 5: Borrowing Management
  if (/\b(my borrowed|borrowed books|my loans|due date|return date|when is my|overdue|renew|return book|issue book|borrowing history|my books|checked out)\b/i.test(lower)) {
    scores.AGENT_5_BORROWING += 4.5;
  }

  // Agent 6: Digital Library
  if (/\b(pdf|lecture note|notes|study material|digital|download|ebook|research paper|slides|manual|document)\b/i.test(lower)) {
    scores.AGENT_6_DIGITAL_LIBRARY += 4.2;
  }

  // Agent 3: Availability Agent
  if (/\b(available|availability|in stock|copies|copy|shelf|location|where is|reserved|reservation|hold|is .* available|how many copies)\b/i.test(lower)) {
    scores.AGENT_3_AVAILABILITY += 4.0;
  }

  // Agent 4: Recommendation Agent
  if (/\b(recommend|recommendation|suggest|suggestion|best books|what should i read|popular|top books|for my department|interest)\b/i.test(lower)) {
    scores.AGENT_4_RECOMMENDATION += 4.2;
  }

  // Agent 2: Smart Book Search
  if (isbn || /\b(find|search|look up|lookup|books on|books about|books for|author|isbn|title|subject|who wrote)\b/i.test(lower)) {
    scores.AGENT_2_SEARCH += 3.6;
  }

  // Boost search if specific technical subject is present without recommendation/availability/digital triggers
  if (keywords.length > 0 && scores.AGENT_4_RECOMMENDATION === 0 && scores.AGENT_5_BORROWING === 0 && scores.AGENT_6_DIGITAL_LIBRARY === 0) {
    scores.AGENT_2_SEARCH += 1.5;
  }

  // Agent 1: General library conversation (hours, policy, greetings, how does X work)
  if (/\b(hello|hi|hey|hours|open|close|fine|policy|rules|how do i|help|what can you do|who are you|thank)\b/i.test(lower)) {
    scores.AGENT_1_CHATBOT += 3.8;
  }

  let bestAgent: AgentId = 'AGENT_1_CHATBOT';
  let bestScore = -1;
  for (const [agent, score] of Object.entries(scores) as [AgentId, number][]) {
    if (score > bestScore) {
      bestScore = score;
      bestAgent = agent;
    }
  }

  const labels: Record<AgentId, string> = {
    AGENT_1_CHATBOT: 'Agent 1 · AI Library Chatbot',
    AGENT_2_SEARCH: 'Agent 2 · Smart Book Search',
    AGENT_3_AVAILABILITY: 'Agent 3 · Book Availability',
    AGENT_4_RECOMMENDATION: 'Agent 4 · Book Recommendation',
    AGENT_5_BORROWING: 'Agent 5 · Borrowing Management',
    AGENT_6_DIGITAL_LIBRARY: 'Agent 6 · Digital Library',
    AGENT_7_ADMIN: 'Agent 7 · Admin Management',
  };

  const confidence = Math.min(0.98, Math.max(0.55, Number((bestScore / 5.5).toFixed(2))));

  return {
    agent: bestAgent,
    agentLabel: labels[bestAgent],
    confidence,
    keywords,
    extractedIsbn: isbn,
    extractedDepartment: department,
  };
}

export function scoreTextRelevance(queryKeywords: string[], documentText: string): number {
  if (queryKeywords.length === 0) return 0;
  const docTokens = new Set(tokenizeAndClean(documentText));
  const docLower = documentText.toLowerCase();
  let score = 0;
  for (const kw of queryKeywords) {
    if (docTokens.has(kw)) {
      score += 2.0;
    } else if (docLower.includes(kw)) {
      score += 1.2;
    }
  }
  return score;
}
