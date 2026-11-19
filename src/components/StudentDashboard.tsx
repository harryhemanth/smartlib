import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Bot, Calendar, Search } from 'lucide-react';
import { apiRequest } from '../api.ts';
import type { Book, Loan, PageId, User } from '../types.ts';

interface StudentDashboardProps {
  user: User;
  onNavigate: (page: PageId) => void;
  onOpenBook: (bookId: number) => void;
  onAskAi: (prompt: string) => void;
}

interface OverviewData {
  stats: {
    totalTitles: number;
    totalCopies: number;
    availableCopies: number;
    digitalCount: number;
  };
  recentBooks: Book[];
  myLoans: Loan[];
  recommendedBooks: Book[];
}

export function StudentDashboard({ user, onNavigate, onOpenBook, onAskAi }: StudentDashboardProps) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [quickPrompt, setQuickPrompt] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiRequest<OverviewData>('/api/library/overview')
      .then(setData)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const handleQuickAsk = (e: FormEvent) => {
    e.preventDefault();
    if (!quickPrompt.trim()) return;
    onAskAi(quickPrompt.trim());
  };

  const nextLoan = data?.myLoans?.[0] || null;
  const nextDueDisplay = nextLoan
    ? new Date(nextLoan.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'None';

  return (
    <div className="space-y-8">
      {/* Welcome Header + Quick AI Assistant Bar */}
      <section className="bg-[#29251d] border border-[#3a382b] rounded-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="text-xs text-[#c3a47b] mb-1">
              {user.department} · {user.year_of_study} · {user.student_id || user.email}
            </div>
            <h1 className="text-2xl font-display font-semibold text-[#eee2ca]">
              Welcome back, {user.full_name}
            </h1>
            <p className="text-sm text-[#c5b79e] mt-1">
              Query the multi-agent librarian, inspect shelf availability, or manage your active loans.
            </p>
          </div>

          <form onSubmit={handleQuickAsk} className="flex w-full lg:w-[460px] gap-2">
            <div className="relative flex-1">
              <Bot className="w-4 h-4 text-[#c3a47b] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={quickPrompt}
                onChange={(e) => setQuickPrompt(e.target.value)}
                placeholder="Ask SmartLib AI (e.g. Find Python books)..."
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#1d1a15] text-[#eee2ca] placeholder:text-[#c5b79e]/45 border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 bg-[#c3a47b] text-[#1d1a15] text-xs font-semibold rounded-sm hover:bg-[#dbc39c] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Ask Agent
            </button>
          </form>
        </div>

        <div className="mt-4 pt-4 border-t border-[#3a382b] flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[#c5b79e] mr-1">Suggested prompts:</span>
          {[
            'Find Python programming books',
            'Is Java Programming available?',
            'Show my borrowed books',
            'Recommend cybersecurity books',
          ].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onAskAi(q)}
              className="px-2.5 py-1 bg-[#1d1a15] hover:border-[#c3a47b] text-[#eee2ca] border border-[#3a382b] rounded-sm transition-colors cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>
      </section>

      {/* 4-Column KPI Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#29251d] border border-[#3a382b] p-5 rounded-sm">
          <div className="text-xs text-[#c5b79e] mb-1">Total Library Books</div>
          <div className="text-2xl font-mono font-semibold tabular-nums text-[#eee2ca]">
            {loading ? '—' : data?.stats.totalTitles ?? 0}
          </div>
          <div className="text-xs text-[#c5b79e]/80 mt-1 tabular-nums">
            {data ? `${data.stats.totalCopies} physical volumes` : 'Loading...'}
          </div>
        </div>

        <div className="bg-[#29251d] border border-[#3a382b] p-5 rounded-sm">
          <div className="text-xs text-[#c5b79e] mb-1">Available Copies</div>
          <div className="text-2xl font-mono font-semibold tabular-nums text-[#c3a47b]">
            {loading ? '—' : data?.stats.availableCopies ?? 0}
          </div>
          <div className="text-xs text-[#c5b79e]/80 mt-1">Ready for immediate issue</div>
        </div>

        <div className="bg-[#29251d] border border-[#3a382b] p-5 rounded-sm">
          <div className="text-xs text-[#c5b79e] mb-1">Currently Borrowed</div>
          <div className="text-2xl font-mono font-semibold tabular-nums text-[#eee2ca]">
            {loading ? '—' : data?.myLoans.length ?? 0}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('borrowed-books')}
            className="text-xs font-medium text-[#c3a47b] hover:underline mt-1 cursor-pointer"
          >
            Manage loans
          </button>
        </div>

        <div className="bg-[#29251d] border border-[#3a382b] p-5 rounded-sm">
          <div className="text-xs text-[#c5b79e] mb-1">Next Return Date</div>
          <div className="text-2xl font-mono font-semibold tabular-nums text-[#eee2ca]">
            {loading ? '—' : nextDueDisplay}
          </div>
          <div className="text-xs text-[#c5b79e]/80 mt-1 truncate">
            {nextLoan ? nextLoan.title : 'No active due dates'}
          </div>
        </div>
      </section>

      {/* Main Content Grid: Upcoming Return Dates + Recommended Books */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 bg-[#29251d] border border-[#3a382b] rounded-sm flex flex-col">
          <div className="px-5 py-4 border-b border-[#3a382b] flex items-center justify-between">
            <h2 className="text-sm font-display font-semibold text-[#eee2ca]">
              Upcoming Return Dates
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('borrowed-books')}
              className="text-xs font-medium text-[#c3a47b] hover:underline cursor-pointer"
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-[#3a382b] flex-1">
            {!loading && (data?.myLoans.length || 0) === 0 && (
              <div className="p-6 text-center">
                <Calendar className="w-6 h-6 text-[#c5b79e]/50 mx-auto mb-2" />
                <p className="text-sm text-[#c5b79e] mb-3">You have no books checked out right now.</p>
                <button
                  type="button"
                  onClick={() => onNavigate('book-search')}
                  className="px-3.5 py-2 bg-[#c3a47b] text-[#1d1a15] text-xs font-semibold rounded-sm cursor-pointer"
                >
                  Browse Catalog
                </button>
              </div>
            )}
            {(data?.myLoans || []).map((loan) => {
              const daysLeft = Math.ceil((new Date(loan.due_date).getTime() - Date.now()) / 86400000);
              const isOverdue = daysLeft < 0 || loan.status === 'overdue';
              return (
                <div
                  key={loan.id}
                  onClick={() => onOpenBook(loan.book_id)}
                  className="p-4 hover:bg-[#322d23] transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#eee2ca] truncate">
                        {loan.title}
                      </div>
                      <div className="text-xs text-[#c5b79e] mt-0.5">
                        {loan.author} · {loan.shelf_location}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-xs font-mono font-semibold tabular-nums ${isOverdue ? 'text-[#e5988b]' : 'text-[#c3a47b]'}`}>
                        {isOverdue ? `Overdue ${Math.abs(daysLeft)}d` : `Due in ${daysLeft}d`}
                      </div>
                      <div className="text-[11px] font-mono text-[#c5b79e]/70 tabular-nums">
                        {new Date(loan.due_date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="lg:col-span-7 bg-[#29251d] border border-[#3a382b] rounded-sm flex flex-col">
          <div className="px-5 py-4 border-b border-[#3a382b] flex items-center justify-between">
            <h2 className="text-sm font-display font-semibold text-[#eee2ca]">
              Recommended for {user.department}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('recommendations')}
              className="text-xs font-medium text-[#c3a47b] hover:underline cursor-pointer"
            >
              Explore more
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#3a382b] flex-1">
            {(data?.recommendedBooks || []).slice(0, 4).map((b) => (
              <div
                key={b.id}
                onClick={() => onOpenBook(b.id)}
                className="p-4 border-b border-[#3a382b] hover:bg-[#322d23] transition-colors cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="text-[11px] text-[#c3a47b] font-medium mb-1">
                    {b.department} · {b.subject}
                  </div>
                  <div className="text-sm font-semibold text-[#eee2ca] line-clamp-2 mb-1">
                    {b.title}
                  </div>
                  <div className="text-xs text-[#c5b79e]">{b.author}</div>
                </div>
                <div className="mt-3 pt-2 border-t border-[#3a382b] flex items-center justify-between text-xs font-mono tabular-nums">
                  <span className={b.available_copies > 0 ? 'text-[#b4c99e] font-semibold' : 'text-[#e5988b]'}>
                    {b.available_copies}/{b.total_copies} on shelf
                  </span>
                  <span className="text-[#c5b79e] inline-flex items-center gap-1">
                    Inspect <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Recently Added Books Table */}
      <section className="bg-[#29251d] border border-[#3a382b] rounded-sm">
        <div className="px-5 py-4 border-b border-[#3a382b] flex items-center justify-between">
          <h2 className="text-sm font-display font-semibold text-[#eee2ca]">
            Recently Added Catalog Titles
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('book-search')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#c3a47b] hover:text-[#dbc39c] cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Open Full Search</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#3a382b] bg-[#1d1a15] text-xs font-semibold text-[#c5b79e]">
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">Author</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Shelf Location</th>
                <th className="py-3 px-4 text-right">Copies</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3a382b] text-sm">
              {(data?.recentBooks || []).map((book) => (
                <tr
                  key={book.id}
                  onClick={() => onOpenBook(book.id)}
                  className="hover:bg-[#322d23] transition-colors cursor-pointer"
                >
                  <td className="py-3 px-4 font-medium text-[#eee2ca]">{book.title}</td>
                  <td className="py-3 px-4 text-[#c5b79e]">{book.author}</td>
                  <td className="py-3 px-4 text-[#c5b79e]">{book.subject}</td>
                  <td className="py-3 px-4 text-xs text-[#c5b79e]/80">{book.shelf_location}</td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                    <span className={book.available_copies > 0 ? 'text-[#b4c99e] font-semibold' : 'text-[#e5988b] font-semibold'}>
                      {book.available_copies}/{book.total_copies}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
