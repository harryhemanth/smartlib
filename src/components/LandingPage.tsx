import { useEffect, useState } from 'react';
import { BookOpen, Cpu, Database, FileText, Search, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../api.ts';
import type { Book, PageId } from '../types.ts';
import { Scene } from './BestsellersScene.tsx';

interface LandingPageProps {
  onNavigate: (page: PageId) => void;
  isAuthenticated: boolean;
  userRole?: 'student' | 'admin';
}

interface OverviewPayload {
  stats: {
    totalTitles: number;
    totalCopies: number;
    availableCopies: number;
    digitalCount: number;
  };
  recentBooks: Book[];
}

export function LandingPage({ onNavigate, isAuthenticated, userRole }: LandingPageProps) {
  const [overview, setOverview] = useState<OverviewPayload | null>(null);

  useEffect(() => {
    apiRequest<OverviewPayload>('/api/library/overview')
      .then(setOverview)
      .catch(() => null);
  }, []);

  const primaryPortalPage: PageId = isAuthenticated
    ? userRole === 'admin'
      ? 'admin-dashboard'
      : 'student-dashboard'
    : 'login';

  return (
    <div className="min-h-screen bg-[#211e18] text-[#eee2ca] flex flex-col field-stage">
      {/* 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#1d1a15]/95 backdrop-blur border-b border-[#3a382b]">
        <div className="max-w-[1360px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => onNavigate('landing')}
            className="text-lg font-display italic font-semibold tracking-tight text-[#c3a47b] whitespace-nowrap shrink-0 cursor-pointer"
          >
            SmartLib AI
          </button>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#c5b79e]">
            <a href="#showcase" className="hover:text-[#eee2ca] transition-colors whitespace-nowrap shrink-0">
              Showcase
            </a>
            <a href="#catalog-preview" className="hover:text-[#eee2ca] transition-colors whitespace-nowrap shrink-0">
              Catalog
            </a>
            <a href="#agents" className="hover:text-[#eee2ca] transition-colors whitespace-nowrap shrink-0">
              Multi-Agent AI
            </a>
            <button
              type="button"
              onClick={() => onNavigate('register')}
              className="hover:text-[#eee2ca] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Student Registration
            </button>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => onNavigate(primaryPortalPage)}
              className="px-4 py-2 text-xs font-semibold tracking-wide bg-[#c3a47b] text-[#1d1a15] rounded-sm hover:bg-[#dbc39c] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isAuthenticated ? 'Open Dashboard' : 'Continue to Login'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Exact ThreeUI BestsellersBookShowcase Editorial Experience */}
        <section id="showcase" className="w-full border-b border-[#3a382b] bg-[#29251d]">
          <Scene />
        </section>

        {/* Next Step: Proceed to Login / Registration */}
        <section className="bg-[#29251d] border-b border-[#3a382b]">
          <div className="max-w-[1360px] mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-[#eee2ca]">
              Ready to access your loans, smart book search, and AI librarian?
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {!isAuthenticated && (
                <button
                  type="button"
                  onClick={() => onNavigate('register')}
                  className="px-4 py-2 text-xs font-semibold border border-[#3a382b] bg-[#1d1a15] text-[#eee2ca] rounded-sm hover:border-[#c3a47b] transition-colors whitespace-nowrap cursor-pointer"
                >
                  Register Student ID
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigate(primaryPortalPage)}
                className="px-5 py-2 text-xs font-semibold bg-[#c3a47b] text-[#1d1a15] rounded-sm hover:bg-[#dbc39c] transition-colors whitespace-nowrap cursor-pointer"
              >
                {isAuthenticated ? 'Open Dashboard' : 'Next: Sign In'}
              </button>
            </div>
          </div>
        </section>

        {/* 4-Column Live Catalog Metrics Strip */}
        <section className="bg-[#1d1a15] border-b border-[#3a382b]">
          <div className="max-w-[1360px] mx-auto px-6 py-7 grid grid-cols-2 lg:grid-cols-4 gap-6 divide-y lg:divide-y-0 lg:divide-x divide-[#3a382b]">
            <div className="pt-2 lg:pt-0 lg:pr-6">
              <div className="text-xs text-[#c5b79e] mb-1">Cataloged Titles</div>
              <div className="text-2xl font-mono font-semibold tabular-nums text-[#eee2ca]">
                {overview ? overview.stats.totalTitles : '—'}
              </div>
            </div>
            <div className="pt-2 lg:pt-0 lg:px-6">
              <div className="text-xs text-[#c5b79e] mb-1">Total Library Volumes</div>
              <div className="text-2xl font-mono font-semibold tabular-nums text-[#eee2ca]">
                {overview ? overview.stats.totalCopies : '—'}
              </div>
            </div>
            <div className="pt-2 lg:pt-0 lg:px-6">
              <div className="text-xs text-[#c5b79e] mb-1">Copies On Shelf Now</div>
              <div className="text-2xl font-mono font-semibold tabular-nums text-[#c3a47b]">
                {overview ? overview.stats.availableCopies : '—'}
              </div>
            </div>
            <div className="pt-2 lg:pt-0 lg:pl-6">
              <div className="text-xs text-[#c5b79e] mb-1">Authorized Digital Archives</div>
              <div className="text-2xl font-mono font-semibold tabular-nums text-[#eee2ca]">
                {overview ? overview.stats.digitalCount : '—'}
              </div>
            </div>
          </div>
        </section>

        {/* 7-Agent Orchestrator Section */}
        <section id="agents" className="max-w-[1360px] mx-auto px-6 py-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-xs font-medium text-[#c3a47b] mb-2">Orchestrated Architecture</p>
              <h2 className="text-2xl lg:text-3xl font-display font-semibold tracking-tight text-[#eee2ca] text-balance">
                Seven specialized agents routed from one unified prompt.
              </h2>
            </div>
            <p className="text-sm text-[#c5b79e] max-w-md">
              Every query is classified by intent and grounded against verified SQLite circulation
              and catalog tables before generating an answer.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                num: '01',
                title: 'AI Library Chatbot',
                desc: 'Handles general academic inquiries, borrowing rules, library hours, and contextual multi-turn conversations.',
                icon: BookOpen,
              },
              {
                num: '02',
                title: 'Smart Book Search',
                desc: 'Parses natural-language queries across book titles, authors, ISBN numbers, departments, and course subjects.',
                icon: Search,
              },
              {
                num: '03',
                title: 'Book Availability Agent',
                desc: 'Verifies live shelf copy counts, active loan tallies, exact wing/row coordinates, and reservation queues.',
                icon: Database,
              },
              {
                num: '04',
                title: 'Recommendation Agent',
                desc: 'Ranks textbooks by student department, subject focus (AI, Cybersecurity, Python, Math), and shelf readiness.',
                icon: Cpu,
              },
              {
                num: '05',
                title: 'Borrowing Management',
                desc: 'Tracks issue dates, upcoming return deadlines, overdue flags, renewal eligibility, and circulation history.',
                icon: ShieldCheck,
              },
              {
                num: '06 & 07',
                title: 'Digital Archive & Admin Control',
                desc: 'Serves role-authorized PDFs and lecture notes while restricting inventory CRUD and student audits to administrators.',
                icon: FileText,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.num}
                  className="bg-[#29251d] border border-[#3a382b] p-6 rounded-sm hover:border-[#c3a47b]/60 transition-colors"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono font-semibold text-[#c3a47b] tabular-nums">
                      Agent {item.num}
                    </span>
                    <Icon className="w-4 h-4 text-[#c5b79e]" />
                  </div>
                  <h3 className="text-base font-display font-semibold text-[#eee2ca] mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-[#c5b79e] leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Live Catalog Preview Table */}
        <section id="catalog-preview" className="max-w-[1360px] mx-auto px-6 pb-16">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-display font-semibold text-[#eee2ca]">
                Recent Catalog Acquisitions
              </h2>
              <p className="text-sm text-[#c5b79e]">
                Live availability synchronized from the SmartLib SQLite database.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(primaryPortalPage)}
              className="px-4 py-2 text-xs font-semibold border border-[#c3a47b]/50 bg-[#29251d] text-[#eee2ca] rounded-sm hover:border-[#dbc39c] hover:text-[#dbc39c] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Search Full Catalog
            </button>
          </div>

          <div className="bg-[#29251d] border border-[#3a382b] rounded-sm overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#3a382b] bg-[#1d1a15] text-xs font-semibold text-[#c5b79e]">
                  <th className="py-3 px-4">Title &amp; Author</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">ISBN</th>
                  <th className="py-3 px-4">Shelf Location</th>
                  <th className="py-3 px-4 text-right">Availability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3a382b] text-sm">
                {(overview?.recentBooks || []).map((b) => (
                  <tr key={b.id} className="hover:bg-[#322d23] transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-[#eee2ca]">{b.title}</div>
                      <div className="text-xs text-[#c5b79e]">{b.author} · {b.publish_year}</div>
                    </td>
                    <td className="py-3 px-4 text-[#eee2ca]/90">{b.department}</td>
                    <td className="py-3 px-4 font-mono text-xs text-[#c5b79e] tabular-nums">{b.isbn}</td>
                    <td className="py-3 px-4 text-xs text-[#c5b79e]">{b.shelf_location}</td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                      <span className={b.available_copies > 0 ? 'text-[#b4c99e] font-semibold' : 'text-[#e5988b] font-semibold'}>
                        {b.available_copies}/{b.total_copies} {b.available_copies > 0 ? 'Available' : 'Checked Out'}
                      </span>
                    </td>
                  </tr>
                ))}
                {!overview && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-[#c5b79e]">
                      Loading live catalog records...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="bg-[#1d1a15] border-t border-[#3a382b] py-6">
        <div className="max-w-[1360px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#c5b79e]">
          <div>SmartLib AI · Intelligent College Library &amp; Multi-Agent System</div>
          <div className="flex items-center gap-6">
            <button type="button" onClick={() => onNavigate('login')} className="hover:text-[#eee2ca] cursor-pointer">
              Student &amp; Admin Sign In
            </button>
            <button type="button" onClick={() => onNavigate('register')} className="hover:text-[#eee2ca] cursor-pointer">
              Register Student ID
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
