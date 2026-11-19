import { useEffect, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Download,
  Edit3,
  Plus,
  Trash2,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { apiRequest } from '../api.ts';
import type { AiMode, Book, Category, PageId } from '../types.ts';

/* -------------------------------------------------------------------------- */
/* PAGE 12: ADMIN DASHBOARD                                                   */
/* -------------------------------------------------------------------------- */
interface AdminDashboardData {
  kpis: {
    totalTitles: number;
    totalCopies: number;
    availableCopies: number;
    borrowedCopies: number;
    totalStudents: number;
    activeLoans: number;
    overdueBooks: number;
    activeReservations: number;
  };
  departmentStats: Array<{
    department: string;
    title_count: number;
    total_copies: number;
    available_copies: number;
    total_loans: number;
  }>;
  recentTransactions: Array<{
    id: number;
    issue_date: string;
    due_date: string;
    return_date: string | null;
    status: string;
    book_title: string;
    isbn: string;
    student_name: string;
    student_id: string | null;
    department: string;
  }>;
}

export function AdminDashboardPage({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<AdminDashboardData>('/api/admin/dashboard');
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleForceReturn = async (loanId: number) => {
    await apiRequest(`/api/admin/loans/${loanId}/force-return`, { method: 'POST' });
    await load();
  };

  if (loading || !data) {
    return (
      <div className="bg-[#29251d] border border-[#3a382b] rounded-sm p-10 text-center text-sm text-[#c5b79e]">
        Loading administrator telemetry...
      </div>
    );
  }

  const maxDeptCopies = Math.max(1, ...data.departmentStats.map((d) => d.total_copies));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-display font-semibold text-[#eee2ca]">
            Administrator Control Center
          </h1>
          <p className="text-xs text-[#c5b79e]">
            Real-time inventory, circulation velocity, and overdue oversight.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('book-management')}
            className="px-3.5 py-2 bg-[#c3a47b] text-[#1d1a15] text-xs font-semibold rounded-sm hover:bg-[#dbc39c] cursor-pointer"
          >
            Manage Catalog
          </button>
          <button
            type="button"
            onClick={() => onNavigate('reports')}
            className="px-3.5 py-2 border border-[#3a382b] bg-[#1d1a15] text-[#eee2ca] text-xs font-semibold rounded-sm hover:border-[#c3a47b] cursor-pointer"
          >
            View Reports
          </button>
        </div>
      </div>

      {/* 5-Column Admin KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-[#29251d] border border-[#3a382b] p-4 rounded-sm">
          <div className="text-xs text-[#c5b79e] mb-1">Total Books</div>
          <div className="text-2xl font-mono font-semibold tabular-nums text-[#eee2ca]">
            {data.kpis.totalCopies}
          </div>
          <div className="text-[11px] text-[#c5b79e]/80 tabular-nums">{data.kpis.totalTitles} distinct titles</div>
        </div>
        <div className="bg-[#29251d] border border-[#3a382b] p-4 rounded-sm">
          <div className="text-xs text-[#c5b79e] mb-1">Total Students</div>
          <div className="text-2xl font-mono font-semibold tabular-nums text-[#eee2ca]">
            {data.kpis.totalStudents}
          </div>
          <div className="text-[11px] text-[#c5b79e]/80">Registered accounts</div>
        </div>
        <div className="bg-[#29251d] border border-[#3a382b] p-4 rounded-sm">
          <div className="text-xs text-[#c5b79e] mb-1">Available Copies</div>
          <div className="text-2xl font-mono font-semibold tabular-nums text-[#c3a47b]">
            {data.kpis.availableCopies}
          </div>
          <div className="text-[11px] text-[#c5b79e]/80">Ready on shelf</div>
        </div>
        <div className="bg-[#29251d] border border-[#3a382b] p-4 rounded-sm">
          <div className="text-xs text-[#c5b79e] mb-1">Borrowed Books</div>
          <div className="text-2xl font-mono font-semibold tabular-nums text-[#eee2ca]">
            {data.kpis.activeLoans}
          </div>
          <div className="text-[11px] text-[#c5b79e]/80 tabular-nums">{data.kpis.activeReservations} queued holds</div>
        </div>
        <div className="bg-[#29251d] border border-[#3a382b] p-4 rounded-sm col-span-2 lg:col-span-1">
          <div className="text-xs text-[#c5b79e] mb-1">Overdue Books</div>
          <div className={`text-2xl font-mono font-semibold tabular-nums ${data.kpis.overdueBooks > 0 ? 'text-[#e5988b]' : 'text-[#b4c99e]'}`}>
            {data.kpis.overdueBooks}
          </div>
          <div className="text-[11px] text-[#c5b79e]/80">Past return deadline</div>
        </div>
      </section>

      {/* Department Inventory Chart */}
      <section className="bg-[#29251d] border border-[#3a382b] rounded-sm p-6">
        <h2 className="text-sm font-display font-semibold text-[#eee2ca] mb-4">
          Department Inventory &amp; Shelf Utilization
        </h2>
        <div className="space-y-4">
          {data.departmentStats.map((d) => {
            const totalPct = Math.round((d.total_copies / maxDeptCopies) * 100);
            const availPct = Math.round((d.available_copies / maxDeptCopies) * 100);
            return (
              <div key={d.department} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#eee2ca]">
                    {d.department} ({d.title_count} titles)
                  </span>
                  <span className="font-mono tabular-nums text-[#c5b79e]">
                    {d.available_copies}/{d.total_copies} on shelf · {d.total_loans} cumulative loans
                  </span>
                </div>
                <div className="w-full h-3 bg-[#1d1a15] border border-[#3a382b] rounded-sm overflow-hidden relative">
                  <div
                    className="h-full bg-[#3a382b] absolute top-0 left-0"
                    style={{ width: `${totalPct}%` }}
                  />
                  <div
                    className="h-full bg-[#c3a47b] absolute top-0 left-0"
                    style={{ width: `${availPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-3 border-t border-[#3a382b] flex items-center gap-6 text-[11px] text-[#c5b79e]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-[#c3a47b] inline-block rounded-xs" /> Available on Shelf
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-[#3a382b] inline-block rounded-xs" /> Checked Out / Total Capacity
          </span>
        </div>
      </section>

      {/* Recent Transactions Table */}
      <section className="bg-[#29251d] border border-[#3a382b] rounded-sm">
        <div className="px-5 py-4 border-b border-[#3a382b]">
          <h2 className="text-sm font-display font-semibold text-[#eee2ca]">
            Recent Circulation Transactions
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#3a382b] bg-[#1d1a15] text-xs font-semibold text-[#c5b79e]">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Book Title</th>
                <th className="py-3 px-4">Issued</th>
                <th className="py-3 px-4">Due</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3a382b] text-sm">
              {data.recentTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-[#322d23] transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-medium text-[#eee2ca]">{tx.student_name}</div>
                    <div className="text-xs font-mono text-[#c5b79e]">{tx.student_id || tx.department}</div>
                  </td>
                  <td className="py-3 px-4 text-[#eee2ca]/90">{tx.book_title}</td>
                  <td className="py-3 px-4 text-xs font-mono tabular-nums text-[#c5b79e]">
                    {new Date(tx.issue_date).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-xs font-mono tabular-nums text-[#c5b79e]">
                    {new Date(tx.due_date).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-xs font-semibold">
                    {tx.status === 'returned' ? (
                      <span className="text-[#b4c99e]">Returned</span>
                    ) : tx.status === 'overdue' ? (
                      <span className="text-[#e5988b]">Overdue</span>
                    ) : (
                      <span className="text-[#c3a47b]">Borrowed</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {tx.status !== 'returned' ? (
                      <button
                        type="button"
                        onClick={() => void handleForceReturn(tx.id)}
                        className="px-2.5 py-1 text-xs font-semibold border border-[#3a382b] bg-[#1d1a15] text-[#eee2ca] hover:border-[#c3a47b] rounded-sm cursor-pointer"
                      >
                        Mark Returned
                      </button>
                    ) : (
                      <span className="text-xs text-[#c5b79e]/60">Closed</span>
                    )}
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

/* -------------------------------------------------------------------------- */
/* PAGE 13: BOOK MANAGEMENT (CRUD + CONFIRMATION + CSV EXPORT)                */
/* -------------------------------------------------------------------------- */
export function BookManagementPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filter, setFilter] = useState('');
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    author: '',
    isbn: '',
    category_id: 1,
    department: 'Computer Science',
    subject: '',
    publisher: 'Academic Press',
    publish_year: 2024,
    total_copies: 3,
    available_copies: 3,
    shelf_location: 'A-120 · Wing North',
    description: '',
  });

  const loadAll = async () => {
    const [bRes, cRes] = await Promise.all([
      apiRequest<{ books: Book[] }>('/api/library/books'),
      apiRequest<{ categories: Category[] }>('/api/library/categories'),
    ]);
    setBooks(bRes.books);
    setCategories(cRes.categories);
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const openAdd = () => {
    setError(null);
    setEditingId(null);
    setForm({
      title: '',
      author: '',
      isbn: '',
      category_id: categories[0]?.id || 1,
      department: 'Computer Science',
      subject: '',
      publisher: 'Academic Press',
      publish_year: 2025,
      total_copies: 3,
      available_copies: 3,
      shelf_location: 'A-120 · Row 1 · Wing North',
      description: '',
    });
    setModalMode('add');
  };

  const openEdit = (b: Book) => {
    setError(null);
    setEditingId(b.id);
    setForm({
      title: b.title,
      author: b.author,
      isbn: b.isbn,
      category_id: b.category_id,
      department: b.department,
      subject: b.subject,
      publisher: b.publisher,
      publish_year: b.publish_year,
      total_copies: b.total_copies,
      available_copies: b.available_copies,
      shelf_location: b.shelf_location,
      description: b.description,
    });
    setModalMode('edit');
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (modalMode === 'add') {
        await apiRequest('/api/admin/books', {
          method: 'POST',
          body: JSON.stringify(form),
        });
      } else if (modalMode === 'edit' && editingId) {
        await apiRequest(`/api/admin/books/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
      }
      setModalMode(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setError(null);
    try {
      await apiRequest(`/api/admin/books/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
      setDeleteTarget(null);
    }
  };

  const exportCsv = () => {
    const header = ['ID', 'Title', 'Author', 'ISBN', 'Department', 'Subject', 'Available', 'Total', 'Shelf'];
    const rows = books.map((b) => [
      b.id,
      `"${b.title.replace(/"/g, '""')}"`,
      `"${b.author.replace(/"/g, '""')}"`,
      b.isbn,
      `"${b.department}"`,
      `"${b.subject}"`,
      b.available_copies,
      b.total_copies,
      `"${b.shelf_location}"`,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smartlib_inventory.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const visible = books.filter((b) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q) ||
      b.isbn.toLowerCase().includes(q) ||
      b.department.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="bg-[#29251d] border border-[#3a382b] rounded-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter catalog by title, author, ISBN, or department..."
            className="w-full px-3.5 py-2 text-sm bg-[#1d1a15] text-[#eee2ca] placeholder:text-[#c5b79e]/45 border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#3a382b] bg-[#1d1a15] text-xs font-semibold text-[#eee2ca] rounded-sm hover:border-[#c3a47b] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#c3a47b]" />
            <span>Download CSV</span>
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#c3a47b] text-[#1d1a15] text-xs font-semibold rounded-sm hover:bg-[#dbc39c] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Book</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-[#3f201d] border border-[#a96346] text-xs text-[#e5988b] rounded-sm">
          {error}
        </div>
      )}

      <div className="bg-[#29251d] border border-[#3a382b] rounded-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#3a382b] bg-[#1d1a15] text-xs font-semibold text-[#c5b79e]">
              <th className="py-3 px-4">Title &amp; Author</th>
              <th className="py-3 px-4">ISBN</th>
              <th className="py-3 px-4">Department</th>
              <th className="py-3 px-4">Shelf</th>
              <th className="py-3 px-4 text-right">Stock</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3a382b] text-sm">
            {visible.map((b) => (
              <tr key={b.id} className="hover:bg-[#322d23] transition-colors">
                <td className="py-3 px-4">
                  <div className="font-semibold text-[#eee2ca]">{b.title}</div>
                  <div className="text-xs text-[#c5b79e]">{b.author} · {b.publish_year}</div>
                </td>
                <td className="py-3 px-4 font-mono text-xs tabular-nums text-[#c5b79e]">{b.isbn}</td>
                <td className="py-3 px-4 text-xs text-[#eee2ca]/90">{b.department}</td>
                <td className="py-3 px-4 text-xs text-[#c5b79e]">{b.shelf_location}</td>
                <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                  <span className={b.available_copies > 0 ? 'text-[#b4c99e] font-semibold' : 'text-[#e5988b] font-semibold'}>
                    {b.available_copies}/{b.total_copies}
                  </span>
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                  <button
                    type="button"
                    onClick={() => openEdit(b)}
                    className="p-1.5 text-[#c5b79e] hover:text-[#c3a47b] border border-[#3a382b] bg-[#1d1a15] rounded-sm cursor-pointer"
                    title="Edit book"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(b)}
                    className="p-1.5 text-[#c5b79e] hover:text-[#e5988b] border border-[#3a382b] bg-[#1d1a15] rounded-sm cursor-pointer"
                    title="Delete book"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Book Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 bg-[#1d1a15]/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#29251d] border border-[#3a382b] rounded-sm max-w-xl w-full p-6 my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-display font-semibold text-[#eee2ca]">
                {modalMode === 'add' ? 'Catalog New Book' : 'Update Book Record'}
              </h3>
              <button type="button" onClick={() => setModalMode(null)} className="text-[#c5b79e] hover:text-[#eee2ca] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#c5b79e] mb-1">Book Title</label>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[#1d1a15] text-[#eee2ca] border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#c5b79e] mb-1">Author(s)</label>
                  <input
                    required
                    value={form.author}
                    onChange={(e) => setForm({ ...form, author: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[#1d1a15] text-[#eee2ca] border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#c5b79e] mb-1">ISBN</label>
                  <input
                    required
                    value={form.isbn}
                    onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono bg-[#1d1a15] text-[#eee2ca] border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#c5b79e] mb-1">Department</label>
                  <input
                    required
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[#1d1a15] text-[#eee2ca] border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#c5b79e] mb-1">Subject</label>
                  <input
                    required
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[#1d1a15] text-[#eee2ca] border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#c5b79e] mb-1">Category</label>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm bg-[#1d1a15] text-[#eee2ca] border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#c5b79e] mb-1">Shelf Location</label>
                  <input
                    required
                    value={form.shelf_location}
                    onChange={(e) => setForm({ ...form, shelf_location: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[#1d1a15] text-[#eee2ca] border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#c5b79e] mb-1">Total Copies</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={form.total_copies}
                    onChange={(e) => setForm({ ...form, total_copies: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-mono bg-[#1d1a15] text-[#eee2ca] border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
                  />
                </div>
                {modalMode === 'edit' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#c5b79e] mb-1">Available Copies</label>
                    <input
                      type="number"
                      min={0}
                      max={form.total_copies}
                      required
                      value={form.available_copies}
                      onChange={(e) => setForm({ ...form, available_copies: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm font-mono bg-[#1d1a15] text-[#eee2ca] border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
                    />
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#c5b79e] mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[#1d1a15] text-[#eee2ca] border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2 text-xs border border-[#3a382b] bg-[#1d1a15] text-[#eee2ca] hover:border-[#c3a47b] rounded-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#c3a47b] text-[#1d1a15] text-xs font-semibold rounded-sm hover:bg-[#dbc39c] cursor-pointer"
                >
                  {modalMode === 'add' ? 'Add Book to Catalog' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-[#1d1a15]/80 flex items-center justify-center p-4">
          <div className="bg-[#29251d] border border-[#3a382b] rounded-sm max-w-md w-full p-6">
            <h3 className="text-base font-display font-semibold text-[#eee2ca] mb-2">
              Confirm Book Deletion
            </h3>
            <p className="text-sm text-[#c5b79e] mb-5 leading-relaxed">
              Remove <span className="font-semibold text-[#eee2ca]">"{deleteTarget.title}"</span> (ISBN {deleteTarget.isbn}) from the catalog? This action is recorded in the admin audit log.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-medium border border-[#3a382b] bg-[#1d1a15] text-[#eee2ca] rounded-sm hover:border-[#c3a47b] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                className="px-4 py-2 text-xs font-semibold bg-[#a96346] text-[#eee2ca] border border-[#e5988b]/40 rounded-sm hover:bg-[#3f201d] cursor-pointer"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* PAGE 14: STUDENT MANAGEMENT                                                */
/* -------------------------------------------------------------------------- */
interface StudentRow {
  id: number;
  full_name: string;
  email: string;
  student_id: string | null;
  department: string;
  year_of_study: string;
  status: 'active' | 'suspended';
  active_loans: number;
  overdue_loans: number;
  last_login_at: string | null;
}

export function StudentManagementPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [search, setSearch] = useState('');
  const [issueStudent, setIssueStudent] = useState<StudentRow | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<number>(0);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const [sRes, bRes] = await Promise.all([
      apiRequest<{ students: StudentRow[] }>('/api/admin/students'),
      apiRequest<{ books: Book[] }>('/api/library/books?available=true'),
    ]);
    setStudents(sRes.students);
    setBooks(bRes.books);
    if (bRes.books.length > 0 && !selectedBookId) {
      setSelectedBookId(bRes.books[0].id);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleStatus = async (s: StudentRow) => {
    const next = s.status === 'active' ? 'suspended' : 'active';
    await apiRequest(`/api/admin/students/${s.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: next }),
    });
    await load();
  };

  const handleIssueBook = async (e: FormEvent) => {
    e.preventDefault();
    if (!issueStudent || !selectedBookId) return;
    setMsg(null);
    try {
      await apiRequest('/api/admin/loans/issue', {
        method: 'POST',
        body: JSON.stringify({ bookId: selectedBookId, userId: issueStudent.id, days: 14 }),
      });
      setMsg(`Issued selected book to ${issueStudent.full_name}.`);
      setIssueStudent(null);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Unable to issue book.');
    }
  };

  const filtered = students.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.full_name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.student_id || '').toLowerCase().includes(q) ||
      s.department.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="bg-[#29251d] border border-[#3a382b] rounded-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search students by name, ID, email, or department..."
          className="w-full max-w-md px-3.5 py-2 text-sm bg-[#1d1a15] text-[#eee2ca] placeholder:text-[#c5b79e]/45 border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
        />
        <div className="text-xs font-mono text-[#c5b79e] tabular-nums">
          {filtered.length} registered students
        </div>
      </div>

      {msg && (
        <div className="p-3 bg-[#253022] border border-[#89946f] text-xs text-[#b4c99e] rounded-sm">
          {msg}
        </div>
      )}

      <div className="bg-[#29251d] border border-[#3a382b] rounded-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#3a382b] bg-[#1d1a15] text-xs font-semibold text-[#c5b79e]">
              <th className="py-3 px-4">Student</th>
              <th className="py-3 px-4">Department</th>
              <th className="py-3 px-4 text-right">Active Loans</th>
              <th className="py-3 px-4 text-right">Overdue</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3a382b] text-sm">
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-[#322d23] transition-colors">
                <td className="py-3.5 px-4">
                  <div className="font-semibold text-[#eee2ca]">{s.full_name}</div>
                  <div className="text-xs text-[#c5b79e] font-mono">{s.student_id} · {s.email}</div>
                </td>
                <td className="py-3.5 px-4 text-xs text-[#eee2ca]/90">
                  {s.department} · {s.year_of_study}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-[#eee2ca]">{s.active_loans}</td>
                <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums">
                  <span className={s.overdue_loans > 0 ? 'text-[#e5988b] font-semibold' : 'text-[#c5b79e]'}>
                    {s.overdue_loans}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-xs font-semibold">
                  <span className={s.status === 'active' ? 'text-[#b4c99e]' : 'text-[#e5988b]'}>
                    {s.status === 'active' ? 'Active' : 'Suspended'}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-2">
                  <button
                    type="button"
                    onClick={() => setIssueStudent(s)}
                    disabled={s.status === 'suspended'}
                    className="px-2.5 py-1 text-xs font-semibold bg-[#c3a47b] text-[#1d1a15] hover:bg-[#dbc39c] rounded-sm disabled:opacity-40 cursor-pointer"
                  >
                    Issue Book
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleStatus(s)}
                    className="px-2.5 py-1 text-xs font-medium border border-[#3a382b] bg-[#1d1a15] text-[#eee2ca] hover:border-[#c3a47b] rounded-sm inline-flex items-center gap-1 cursor-pointer"
                  >
                    {s.status === 'active' ? (
                      <>
                        <UserX className="w-3 h-3 text-[#e5988b]" />
                        <span>Suspend</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3 h-3 text-[#b4c99e]" />
                        <span>Activate</span>
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {issueStudent && (
        <div className="fixed inset-0 z-50 bg-[#1d1a15]/80 flex items-center justify-center p-4">
          <div className="bg-[#29251d] border border-[#3a382b] rounded-sm max-w-md w-full p-6">
            <h3 className="text-base font-display font-semibold text-[#eee2ca] mb-1">
              Issue Book to {issueStudent.full_name}
            </h3>
            <p className="text-xs text-[#c5b79e] mb-4">{issueStudent.student_id} · 14-day standard loan</p>
            <form onSubmit={handleIssueBook} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#c5b79e] mb-1">
                  Select Available Catalog Book
                </label>
                <select
                  value={selectedBookId}
                  onChange={(e) => setSelectedBookId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm bg-[#1d1a15] text-[#eee2ca] border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
                >
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} ({b.available_copies} avail.)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIssueStudent(null)}
                  className="px-4 py-2 text-xs border border-[#3a382b] bg-[#1d1a15] text-[#eee2ca] rounded-sm hover:border-[#c3a47b] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#c3a47b] text-[#1d1a15] text-xs font-semibold rounded-sm hover:bg-[#dbc39c] cursor-pointer"
                >
                  Confirm Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* PAGE 15: REPORTS AND ANALYTICS                                             */
/* -------------------------------------------------------------------------- */
interface ReportsPayload {
  topBooks: Array<{ id: number; title: string; author: string; department: string; loan_count: number; available_copies: number; total_copies: number }>;
  overdueList: Array<{ id: number; due_date: string; title: string; isbn: string; full_name: string; student_id: string | null; email: string }>;
  digitalStats: Array<{ id: number; title: string; department: string; resource_type: string; download_count: number }>;
  activityLogs: Array<{ id: number; actor_email: string; action: string; entity_type: string; details: string; created_at: string }>;
}

export function ReportsAnalyticsPage() {
  const [report, setReport] = useState<ReportsPayload | null>(null);

  useEffect(() => {
    apiRequest<ReportsPayload>('/api/admin/reports').then(setReport).catch(() => null);
  }, []);

  if (!report) {
    return (
      <div className="bg-[#29251d] border border-[#3a382b] rounded-sm p-10 text-center text-sm text-[#c5b79e]">
        Generating reports &amp; audit trails...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Borrowed Books */}
        <section className="bg-[#29251d] border border-[#3a382b] rounded-sm">
          <div className="px-5 py-4 border-b border-[#3a382b]">
            <h2 className="text-sm font-display font-semibold text-[#eee2ca]">
              Most Circulated Catalog Titles
            </h2>
          </div>
          <div className="divide-y divide-[#3a382b]">
            {report.topBooks.map((b) => (
              <div key={b.id} className="px-5 py-3 flex items-center justify-between gap-4 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold text-[#eee2ca] truncate">{b.title}</div>
                  <div className="text-[#c5b79e]">{b.department} · {b.available_copies}/{b.total_copies} on shelf</div>
                </div>
                <div className="font-mono font-semibold text-[#c3a47b] tabular-nums shrink-0">
                  {b.loan_count} loans
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Digital Resource Usage */}
        <section className="bg-[#29251d] border border-[#3a382b] rounded-sm">
          <div className="px-5 py-4 border-b border-[#3a382b]">
            <h2 className="text-sm font-display font-semibold text-[#eee2ca]">
              Digital Archive Downloads
            </h2>
          </div>
          <div className="divide-y divide-[#3a382b]">
            {report.digitalStats.map((d) => (
              <div key={d.id} className="px-5 py-3 flex items-center justify-between gap-4 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold text-[#eee2ca] truncate">{d.title}</div>
                  <div className="text-[#c5b79e] uppercase font-mono">{d.resource_type} · {d.department}</div>
                </div>
                <div className="font-mono font-semibold text-[#c3a47b] tabular-nums shrink-0">
                  {d.download_count} downloads
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Overdue Ledger */}
      <section className="bg-[#29251d] border border-[#3a382b] rounded-sm">
        <div className="px-5 py-4 border-b border-[#3a382b]">
          <h2 className="text-sm font-display font-semibold text-[#eee2ca]">
            Overdue Books Ledger ({report.overdueList.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#3a382b] bg-[#1d1a15] text-xs font-semibold text-[#c5b79e]">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Book Title</th>
                <th className="py-3 px-4">ISBN</th>
                <th className="py-3 px-4 text-right">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3a382b] text-xs">
              {report.overdueList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-[#c5b79e]">
                    No overdue loans recorded.
                  </td>
                </tr>
              ) : (
                report.overdueList.map((o) => (
                  <tr key={o.id} className="hover:bg-[#322d23]">
                    <td className="py-3 px-4 font-medium text-[#eee2ca]">
                      {o.full_name} ({o.student_id})
                    </td>
                    <td className="py-3 px-4 text-[#eee2ca]/90">{o.title}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-[#c5b79e]">{o.isbn}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#e5988b] font-semibold">
                      {new Date(o.due_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Admin Activity Audit Log */}
      <section className="bg-[#29251d] border border-[#3a382b] rounded-sm">
        <div className="px-5 py-4 border-b border-[#3a382b]">
          <h2 className="text-sm font-display font-semibold text-[#eee2ca]">
            Administrator &amp; Security Audit Log
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#3a382b] bg-[#1d1a15] text-xs font-semibold text-[#c5b79e]">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3a382b] text-xs">
              {report.activityLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#322d23]">
                  <td className="py-2.5 px-4 font-mono tabular-nums text-[#c5b79e] whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[#eee2ca]">{log.actor_email}</td>
                  <td className="py-2.5 px-4 font-mono font-semibold text-[#c3a47b]">{log.action}</td>
                  <td className="py-2.5 px-4 text-[#c5b79e]">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* PAGE 16: SYSTEM SETTINGS                                                   */
/* -------------------------------------------------------------------------- */
export function SettingsPage({
  aiMode,
  onChangeAiMode,
}: {
  aiMode: AiMode;
  onChangeAiMode: (m: AiMode) => void;
}) {
  const [settings, setSettings] = useState({
    default_ai_mode: aiMode,
    loan_duration_days: '14',
    max_active_loans: '5',
    library_hours: 'Mon–Sat 07:30–22:00 · Sun 10:00–18:00',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiRequest<{ settings: typeof settings }>('/api/admin/settings')
      .then((res) => setSettings((prev) => ({ ...prev, ...res.settings })))
      .catch(() => null);
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaved(false);
    await apiRequest('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    onChangeAiMode(settings.default_ai_mode as AiMode);
    setSaved(true);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-[#29251d] border border-[#3a382b] rounded-sm p-6">
        <h1 className="text-lg font-display font-semibold text-[#eee2ca] mb-1">
          Library &amp; AI Orchestrator Settings
        </h1>
        <p className="text-xs text-[#c5b79e] mb-6">
          Configure circulation rules and the default AI routing strategy for SmartLib AI.
        </p>

        {saved && (
          <div className="mb-4 p-3 bg-[#253022] border border-[#89946f] text-xs text-[#b4c99e] rounded-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>System configuration saved to SQLite.</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#c5b79e] mb-1">
              Default AI Operation Mode
            </label>
            <select
              value={settings.default_ai_mode}
              onChange={(e) => setSettings({ ...settings, default_ai_mode: e.target.value as AiMode })}
              className="w-full px-3 py-2 text-sm bg-[#1d1a15] text-[#eee2ca] border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
            >
              <option value="auto">Automatic Mode (Online Gemini AI with Offline NLP Fallback)</option>
              <option value="online">Online AI Mode (Gemini API Grounded)</option>
              <option value="offline">Offline AI Mode (Local NLP &amp; SQLite Only)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#c5b79e] mb-1">
                Standard Loan Duration (Days)
              </label>
              <input
                type="number"
                min={1}
                max={90}
                value={settings.loan_duration_days}
                onChange={(e) => setSettings({ ...settings, loan_duration_days: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono bg-[#1d1a15] text-[#eee2ca] border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#c5b79e] mb-1">
                Max Concurrent Books per Student
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={settings.max_active_loans}
                onChange={(e) => setSettings({ ...settings, max_active_loans: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono bg-[#1d1a15] text-[#eee2ca] border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#c5b79e] mb-1">
              Library Operating Hours
            </label>
            <input
              type="text"
              value={settings.library_hours}
              onChange={(e) => setSettings({ ...settings, library_hours: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-[#1d1a15] text-[#eee2ca] border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
            />
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 bg-[#c3a47b] text-[#1d1a15] text-xs font-semibold rounded-sm hover:bg-[#dbc39c] cursor-pointer"
          >
            Save Configuration
          </button>
        </form>
      </div>

      <div className="bg-[#29251d] border border-[#3a382b] rounded-sm p-6 text-xs text-[#c5b79e] space-y-2">
        <div className="font-semibold text-[#eee2ca]">Database &amp; Security Architecture</div>
        <p>
          Active Storage Engine: <span className="font-mono text-[#c3a47b]">SQLite (WAL mode · Foreign Keys Enabled)</span>.
          MySQL-compatible DDL is maintained in <span className="font-mono text-[#eee2ca]">database/schema.sql</span> for multi-node campus deployment.
        </p>
        <p>
          Server-Side AI Integration: Gemini API credentials are read exclusively from server environment secrets and never exposed to client bundles.
        </p>
      </div>
    </div>
  );
}
