import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  Download,
  FileText,
  Mic,
  MicOff,
  QrCode,
  Search,
  X,
} from 'lucide-react';
import { apiRequest, downloadAuthorizedFile } from '../api.ts';
import type { Book, DigitalResource, PageId } from '../types.ts';

/* -------------------------------------------------------------------------- */
/* PAGE 6: BOOK SEARCH & QR CODE LOOKUP                                       */
/* -------------------------------------------------------------------------- */
interface BookSearchPageProps {
  onOpenBook: (bookId: number) => void;
}

const DEPARTMENTS = [
  'All',
  'Computer Science',
  'Artificial Intelligence',
  'Cybersecurity',
  'Data Science',
  'Mathematics',
  'Physics & Quantum Engineering',
];

export function BookSearchPage({ onOpenBook }: BookSearchPageProps) {
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('All');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [listening, setListening] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrCodeInput, setQrCodeInput] = useState('');
  const [qrError, setQrError] = useState<string | null>(null);

  const fetchBooks = async (q = query, dept = department, avail = availableOnly) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (dept !== 'All') params.set('department', dept);
      if (avail) params.set('available', 'true');
      const res = await apiRequest<{ books: Book[] }>(`/api/library/books?${params.toString()}`);
      setBooks(res.books);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department, availableOnly]);

  const handleVoiceSearch = () => {
    const win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
      };
    };
    const Recognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Recognition) return;
    const rec = new Recognition();
    rec.lang = 'en-US';
    setListening(true);
    rec.onresult = (e) => {
      const t = e.results?.[0]?.[0]?.transcript || '';
      setQuery(t);
      void fetchBooks(t, department, availableOnly);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  };

  const handleQrLookup = async () => {
    setQrError(null);
    if (!qrCodeInput.trim()) return;
    try {
      const res = await apiRequest<{ book: Book }>(
        `/api/library/books/qr/${encodeURIComponent(qrCodeInput.trim())}`
      );
      setQrModalOpen(false);
      onOpenBook(res.book.id);
    } catch (err) {
      setQrError(err instanceof Error ? err.message : 'QR lookup failed.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Filter Bar */}
      <div className="bg-[#29251d] border border-[#3a382b] rounded-sm p-5">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#c3a47b] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void fetchBooks();
              }}
              placeholder="Search by title, author, ISBN, subject, or keyword..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#1d1a15] text-[#eee2ca] placeholder:text-[#c5b79e]/45 border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
            />
          </div>

          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="px-3.5 py-2.5 text-sm bg-[#1d1a15] text-[#eee2ca] border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
          >
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d === 'All' ? 'All Departments' : d}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void fetchBooks()}
            className="px-5 py-2.5 bg-[#c3a47b] text-[#1d1a15] text-xs font-semibold rounded-sm hover:bg-[#dbc39c] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Search Catalog
          </button>

          <button
            type="button"
            onClick={handleVoiceSearch}
            title="Voice Search"
            className={`px-3 py-2.5 border rounded-sm text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              listening
                ? 'border-[#a96346] bg-[#3f201d] text-[#e5988b]'
                : 'border-[#3a382b] bg-[#1d1a15] text-[#eee2ca] hover:border-[#c3a47b]'
            }`}
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-[#c3a47b]" />}
            <span className="hidden sm:inline">{listening ? 'Listening...' : 'Voice'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setQrError(null);
              setQrModalOpen(true);
            }}
            className="px-3.5 py-2.5 border border-[#3a382b] bg-[#1d1a15] text-[#eee2ca] hover:border-[#c3a47b] rounded-sm text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <QrCode className="w-4 h-4 text-[#c3a47b]" />
            <span>QR Lookup</span>
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-[#3a382b] flex items-center justify-between text-xs">
          <label className="inline-flex items-center gap-2 text-[#c5b79e] cursor-pointer">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(e) => setAvailableOnly(e.target.checked)}
              className="rounded-sm border-[#3a382b] bg-[#1d1a15] accent-[#c3a47b]"
            />
            <span>Show only books currently on shelf</span>
          </label>
          <span className="font-mono text-[#c5b79e] tabular-nums">
            {books.length} title{books.length === 1 ? '' : 's'} matched
          </span>
        </div>
      </div>

      {/* Results Grid */}
      {loading ? (
        <div className="bg-[#29251d] border border-[#3a382b] rounded-sm p-10 text-center text-sm text-[#c5b79e]">
          Querying SQLite catalog...
        </div>
      ) : books.length === 0 ? (
        <div className="bg-[#29251d] border border-[#3a382b] rounded-sm p-10 text-center">
          <BookOpen className="w-8 h-8 text-[#c5b79e]/40 mx-auto mb-2" />
          <p className="text-sm text-[#c5b79e] mb-3">No books matched your filter criteria.</p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setDepartment('All');
              setAvailableOnly(false);
              void fetchBooks('', 'All', false);
            }}
            className="px-4 py-2 bg-[#c3a47b] text-[#1d1a15] text-xs font-semibold rounded-sm hover:bg-[#dbc39c] cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {books.map((book) => (
            <div
              key={book.id}
              onClick={() => onOpenBook(book.id)}
              className="bg-[#29251d] border border-[#3a382b] hover:border-[#c3a47b] hover:bg-[#322d23] rounded-sm p-5 flex flex-col justify-between transition-colors cursor-pointer"
            >
              <div>
                <div className="text-xs text-[#c3a47b] mb-1.5">
                  {book.department} · {book.subject}
                </div>
                <h3 className="text-base font-display font-semibold text-[#eee2ca] leading-snug mb-1">
                  {book.title}
                </h3>
                <p className="text-xs text-[#c5b79e] mb-3">
                  {book.author} · {book.publisher} ({book.publish_year})
                </p>
                <p className="text-xs text-[#c5b79e]/85 line-clamp-2 leading-relaxed">
                  {book.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#3a382b] flex items-center justify-between text-xs">
                <span className="font-mono text-[#c5b79e]/80 tabular-nums">ISBN {book.isbn}</span>
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    book.available_copies > 0 ? 'text-[#b4c99e]' : 'text-[#e5988b]'
                  }`}
                >
                  {book.available_copies}/{book.total_copies} Available
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Code Identification Modal */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#1d1a15]/80 flex items-center justify-center p-4">
          <div className="bg-[#29251d] border border-[#3a382b] rounded-sm max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-display font-semibold text-[#eee2ca]">
                QR Code / ISBN Book Lookup
              </h3>
              <button
                type="button"
                onClick={() => setQrModalOpen(false)}
                className="text-[#c5b79e] hover:text-[#eee2ca] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#c5b79e] mb-4 leading-relaxed">
              Enter a SmartLib shelf QR payload (e.g. <span className="font-mono text-[#eee2ca]">SMARTLIB:BOOK:1:978-1590282755</span>) or an ISBN to open the book record immediately.
            </p>
            {qrError && (
              <div className="mb-3 p-2.5 bg-[#3f201d] border border-[#a96346] text-xs text-[#e5988b] rounded-sm">
                {qrError}
              </div>
            )}
            <input
              type="text"
              value={qrCodeInput}
              onChange={(e) => setQrCodeInput(e.target.value)}
              placeholder="SMARTLIB:BOOK:1:978-1590282755"
              className="w-full px-3 py-2 text-sm font-mono bg-[#1d1a15] text-[#eee2ca] placeholder:text-[#c5b79e]/45 border border-[#3a382b] rounded-sm mb-4 focus:outline-none focus:border-[#c3a47b]"
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setQrCodeInput('SMARTLIB:BOOK:1:978-1590282755')}
                className="text-xs text-[#c3a47b] hover:text-[#dbc39c] hover:underline cursor-pointer"
              >
                Test Sample QR
              </button>
              <button
                type="button"
                onClick={() => void handleQrLookup()}
                className="px-4 py-2 bg-[#c3a47b] text-[#1d1a15] text-xs font-semibold rounded-sm hover:bg-[#dbc39c] cursor-pointer"
              >
                Identify Book
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* PAGE 7: BOOK DETAILS PAGE                                                  */
/* -------------------------------------------------------------------------- */
interface BookDetailsPageProps {
  bookId: number;
  onBack: () => void;
  onOpenBook: (bookId: number) => void;
  onRefreshNotifications: () => void;
}

export function BookDetailsPage({
  bookId,
  onBack,
  onOpenBook,
  onRefreshNotifications,
}: BookDetailsPageProps) {
  const [book, setBook] = useState<Book | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [relatedBooks, setRelatedBooks] = useState<Book[]>([]);
  const [userLoan, setUserLoan] = useState<{ id: number; due_date: string } | null>(null);
  const [userReservation, setUserReservation] = useState<{ id: number; expires_at: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{
        book: Book;
        qrDataUrl: string;
        relatedBooks: Book[];
        userLoan: { id: number; due_date: string } | null;
        userReservation: { id: number; expires_at: string } | null;
      }>(`/api/library/books/${bookId}`);
      setBook(res.book);
      setQrDataUrl(res.qrDataUrl);
      setRelatedBooks(res.relatedBooks);
      setUserLoan(res.userLoan);
      setUserReservation(res.userReservation);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setActionMsg(null);
    void loadDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const handleBorrow = async () => {
    setActionMsg(null);
    try {
      const res = await apiRequest<{ loanId: number; dueDate: string }>(
        `/api/library/books/${bookId}/borrow`,
        { method: 'POST' }
      );
      setActionMsg({
        type: 'ok',
        text: `Book issued to your account. Return due by ${new Date(res.dueDate).toLocaleDateString()}.`,
      });
      await loadDetails();
      onRefreshNotifications();
    } catch (err) {
      setActionMsg({ type: 'err', text: err instanceof Error ? err.message : 'Borrow failed.' });
    }
  };

  const handleReserve = async () => {
    setActionMsg(null);
    try {
      await apiRequest(`/api/library/books/${bookId}/reserve`, { method: 'POST' });
      setActionMsg({ type: 'ok', text: 'Reservation hold placed. You will be notified when a copy returns.' });
      await loadDetails();
    } catch (err) {
      setActionMsg({ type: 'err', text: err instanceof Error ? err.message : 'Reservation failed.' });
    }
  };

  if (loading || !book) {
    return (
      <div className="bg-[#29251d] border border-[#3a382b] rounded-sm p-10 text-center text-sm text-[#c5b79e]">
        Loading book metadata...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-semibold text-[#c5b79e] hover:text-[#eee2ca] cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 text-[#c3a47b]" />
        <span>Back to Search Results</span>
      </button>

      {actionMsg && (
        <div
          className={`p-3.5 text-xs rounded-sm border ${
            actionMsg.type === 'ok'
              ? 'bg-[#253022] border-[#89946f] text-[#b4c99e]'
              : 'bg-[#3f201d] border-[#a96346] text-[#e5988b]'
          }`}
        >
          {actionMsg.text}
        </div>
      )}

      <div className="bg-[#29251d] border border-[#3a382b] rounded-sm p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-5">
          <div>
            <div className="text-xs text-[#c3a47b] font-medium mb-1">
              {book.department} · {book.category_name || book.subject}
            </div>
            <h1 className="text-2xl lg:text-3xl font-display font-semibold text-[#eee2ca] mb-2">
              {book.title}
            </h1>
            <div className="text-sm text-[#c5b79e]">
              By <span className="font-semibold text-[#eee2ca]">{book.author}</span> · {book.publisher} ({book.publish_year})
            </div>
          </div>

          <p className="text-sm text-[#c5b79e] leading-relaxed max-w-[70ch]">
            {book.description}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-[#3a382b] text-xs">
            <div>
              <div className="text-[#c5b79e]/80 mb-1">ISBN-13</div>
              <div className="font-mono font-semibold text-[#eee2ca] tabular-nums">{book.isbn}</div>
            </div>
            <div>
              <div className="text-[#c5b79e]/80 mb-1">Shelf Coordinates</div>
              <div className="font-semibold text-[#eee2ca]">{book.shelf_location}</div>
            </div>
            <div>
              <div className="text-[#c5b79e]/80 mb-1">Available Copies</div>
              <div className={`font-mono font-semibold tabular-nums ${book.available_copies > 0 ? 'text-[#b4c99e]' : 'text-[#e5988b]'}`}>
                {book.available_copies} of {book.total_copies}
              </div>
            </div>
            <div>
              <div className="text-[#c5b79e]/80 mb-1">Active Holds</div>
              <div className="font-mono font-semibold text-[#eee2ca] tabular-nums">
                {book.active_reservations ?? 0}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {userLoan ? (
              <div className="px-4 py-2.5 bg-[#1d1a15] border border-[#3a382b] text-xs font-semibold text-[#c3a47b] rounded-sm">
                Currently Checked Out by You · Due {new Date(userLoan.due_date).toLocaleDateString()}
              </div>
            ) : book.available_copies > 0 ? (
              <button
                type="button"
                onClick={() => void handleBorrow()}
                className="px-5 py-2.5 bg-[#c3a47b] text-[#1d1a15] text-xs font-semibold rounded-sm hover:bg-[#dbc39c] transition-colors cursor-pointer"
              >
                Borrow Book (14-Day Loan)
              </button>
            ) : (
              <button
                type="button"
                disabled={Boolean(userReservation)}
                onClick={() => void handleReserve()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#c3a47b] text-[#1d1a15] text-xs font-semibold rounded-sm hover:bg-[#dbc39c] disabled:opacity-60 transition-colors cursor-pointer"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>{userReservation ? 'Reservation Active' : 'Place Reservation Hold'}</span>
              </button>
            )}
          </div>
        </div>

        {/* QR Code Identification Card */}
        <div className="lg:col-span-4 border border-[#3a382b] bg-[#1d1a15] rounded-sm p-6 flex flex-col items-center justify-center text-center">
          <div className="text-xs font-semibold text-[#eee2ca] mb-3">
            Shelf QR Identification Tag
          </div>
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt={`QR code for ${book.title}`}
              className="w-40 h-40 border border-[#3a382b] bg-white p-2 rounded-sm mb-3"
            />
          )}
          <div className="font-mono text-[11px] text-[#c3a47b] break-all">{book.qr_code_data}</div>
          <div className="text-[11px] text-[#c5b79e]/80 mt-2">
            Scan at self-checkout desk or use QR Lookup in Book Search.
          </div>
        </div>
      </div>

      {relatedBooks.length > 0 && (
        <div className="bg-[#29251d] border border-[#3a382b] rounded-sm p-6">
          <h2 className="text-sm font-display font-semibold text-[#eee2ca] mb-4">
            Related Titles in {book.department}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {relatedBooks.map((rb) => (
              <button
                key={rb.id}
                type="button"
                onClick={() => onOpenBook(rb.id)}
                className="text-left p-4 bg-[#1d1a15] border border-[#3a382b] hover:border-[#c3a47b] hover:bg-[#322d23] rounded-sm transition-colors cursor-pointer"
              >
                <div className="text-xs font-semibold text-[#eee2ca] line-clamp-2 mb-1">{rb.title}</div>
                <div className="text-[11px] text-[#c5b79e] mb-2">{rb.author}</div>
                <div className="text-[11px] font-mono text-[#c3a47b] tabular-nums">
                  {rb.available_copies}/{rb.total_copies} available
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* PAGE 9: BOOK RECOMMENDATIONS                                               */
/* -------------------------------------------------------------------------- */
interface RecommendationsPageProps {
  onOpenBook: (bookId: number) => void;
}

const INTEREST_TOPICS = [
  { id: 'all', label: 'All Interests' },
  { id: 'artificial intelligence', label: 'Artificial Intelligence' },
  { id: 'cybersecurity', label: 'Cybersecurity' },
  { id: 'python', label: 'Python & Programming' },
  { id: 'data', label: 'Data & Systems' },
  { id: 'quantum', label: 'Science & Quantum' },
];

export function RecommendationsPage({ onOpenBook }: RecommendationsPageProps) {
  const [interest, setInterest] = useState('all');
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiRequest<{ recommendations: Book[] }>(
      `/api/library/recommendations?interest=${encodeURIComponent(interest)}`
    )
      .then((res) => setBooks(res.recommendations))
      .finally(() => setLoading(false));
  }, [interest]);

  return (
    <div className="space-y-6">
      <div className="bg-[#29251d] border border-[#3a382b] rounded-sm p-6">
        <h1 className="text-xl font-display font-semibold text-[#eee2ca] mb-1">
          Personalized Book Recommendations
        </h1>
        <p className="text-sm text-[#c5b79e] mb-4">
          Curated by the Recommendation Agent based on your academic department, borrowing history, and selected focus area.
        </p>

        <div className="flex flex-wrap gap-1.5">
          {INTEREST_TOPICS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setInterest(t.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm border transition-colors cursor-pointer ${
                interest === t.id
                  ? 'bg-[#c3a47b] text-[#1d1a15] border-[#c3a47b] font-semibold'
                  : 'bg-[#1d1a15] text-[#c5b79e] border-[#3a382b] hover:border-[#c3a47b] hover:text-[#eee2ca]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bg-[#29251d] border border-[#3a382b] rounded-sm p-10 text-center text-sm text-[#c5b79e]">
          Computing personalized recommendations...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {books.map((b) => (
            <div
              key={b.id}
              onClick={() => onOpenBook(b.id)}
              className="bg-[#29251d] border border-[#3a382b] hover:border-[#c3a47b] hover:bg-[#322d23] rounded-sm p-5 flex flex-col justify-between transition-colors cursor-pointer"
            >
              <div>
                <div className="text-[11px] font-medium text-[#c3a47b] mb-1">
                  {b.recommendationReason} · {b.department}
                </div>
                <h3 className="text-base font-display font-semibold text-[#eee2ca] mb-1">
                  {b.title}
                </h3>
                <p className="text-xs text-[#c5b79e] mb-3">{b.author}</p>
                <p className="text-xs text-[#c5b79e]/85 line-clamp-3 leading-relaxed">
                  {b.description}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#3a382b] flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-[#c5b79e]/80">{b.shelf_location}</span>
                <span className={b.available_copies > 0 ? 'text-[#b4c99e] font-semibold' : 'text-[#e5988b]'}>
                  {b.available_copies}/{b.total_copies} on shelf
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* PAGE 10: DIGITAL LIBRARY                                                   */
/* -------------------------------------------------------------------------- */
export function DigitalLibraryPage({ onNavigate }: { onNavigate?: (p: PageId) => void }) {
  const [resources, setResources] = useState<DigitalResource[]>([]);
  const [q, setQ] = useState('');
  const [department, setDepartment] = useState('All');
  const [loading, setLoading] = useState(true);

  const loadResources = async (search = q, dept = department) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (dept !== 'All') params.set('department', dept);
      const res = await apiRequest<{ resources: DigitalResource[] }>(
        `/api/library/digital-resources?${params.toString()}`
      );
      setResources(res.resources);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department]);

  return (
    <div className="space-y-6">
      <div className="bg-[#29251d] border border-[#3a382b] rounded-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-8 p-6 flex flex-col justify-center">
          <p className="text-xs font-medium text-[#c3a47b] mb-1">Authorized Digital Archive</p>
          <h1 className="text-xl font-display font-semibold text-[#eee2ca] mb-2">
            Lecture Notes, Study Packets &amp; Technical Papers
          </h1>
          <p className="text-sm text-[#c5b79e] mb-5">
            Access-controlled academic resources curated by faculty and verified by the Digital Library Agent.
          </p>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void loadResources();
              }}
              placeholder="Search digital notes by subject or title..."
              className="flex-1 px-3.5 py-2 text-sm bg-[#1d1a15] text-[#eee2ca] placeholder:text-[#c5b79e]/45 border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
            />
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="px-3 py-2 text-sm bg-[#1d1a15] text-[#eee2ca] border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d === 'All' ? 'All Departments' : d}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadResources()}
              className="px-4 py-2 bg-[#c3a47b] text-[#1d1a15] text-xs font-semibold rounded-sm hover:bg-[#dbc39c] cursor-pointer"
            >
              Filter
            </button>
          </div>
        </div>
        <div className="lg:col-span-4 min-h-[180px] border-t lg:border-t-0 lg:border-l border-[#3a382b] bg-[#1d1a15]">
          <img
            src="/src/assets/images/banner_digital_archive_1795095651225.jpg"
            alt="Academic study desk for digital archive"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-90"
          />
        </div>
      </div>

      <div className="bg-[#29251d] border border-[#3a382b] rounded-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#3a382b] bg-[#1d1a15] text-xs font-semibold text-[#c5b79e]">
              <th className="py-3 px-4">Resource Title &amp; Summary</th>
              <th className="py-3 px-4">Department</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4 text-right">Size</th>
              <th className="py-3 px-4 text-right">Downloads</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3a382b] text-sm">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#c5b79e]">Loading digital resources...</td>
              </tr>
            ) : resources.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#c5b79e]">
                  No authorized digital materials matched your query.
                </td>
              </tr>
            ) : (
              resources.map((r) => (
                <tr key={r.id} className="hover:bg-[#322d23] transition-colors">
                  <td className="py-3.5 px-4 max-w-md">
                    <div className="flex items-start gap-2.5">
                      <FileText className="w-4 h-4 text-[#c3a47b] shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-[#eee2ca]">{r.title}</div>
                        <div className="text-xs text-[#c5b79e] mt-0.5">{r.author} · {r.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-[#eee2ca]/90">{r.department}</td>
                  <td className="py-3.5 px-4 text-xs font-mono text-[#c5b79e] uppercase">{r.resource_type.replace('_', ' ')}</td>
                  <td className="py-3.5 px-4 text-right text-xs font-mono tabular-nums text-[#c5b79e]">{r.file_size_kb} KB</td>
                  <td className="py-3.5 px-4 text-right text-xs font-mono tabular-nums text-[#c5b79e]">{r.download_count}</td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        void downloadAuthorizedFile(
                          `/api/library/digital-resources/${r.id}/download`,
                          r.file_name
                        ).then(() => loadResources());
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#c3a47b] text-[#1d1a15] text-xs font-semibold rounded-sm hover:bg-[#dbc39c] transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {onNavigate && (
        <div className="text-xs text-[#c5b79e]">
          Need help finding course-specific study material?{' '}
          <button type="button" onClick={() => onNavigate('ai-chat')} className="text-[#c3a47b] font-semibold hover:text-[#dbc39c] hover:underline cursor-pointer">
            Ask the Digital Library Agent
          </button>
        </div>
      )}
    </div>
  );
}
