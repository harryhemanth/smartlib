import { useEffect, useState, type FormEvent } from 'react';
import { RotateCcw, ShieldAlert } from 'lucide-react';
import { apiRequest } from '../api.ts';
import type { Loan, NotificationItem, Reservation, User } from '../types.ts';

/* -------------------------------------------------------------------------- */
/* PAGE 8: MY BORROWED BOOKS                                                  */
/* -------------------------------------------------------------------------- */
interface BorrowedBooksPageProps {
  onOpenBook: (bookId: number) => void;
  onRefreshNotifications: () => void;
}

export function BorrowedBooksPage({ onOpenBook, onRefreshNotifications }: BorrowedBooksPageProps) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ loans: Loan[]; reservations: Reservation[] }>('/api/library/my-loans');
      setLoans(res.loans);
      setReservations(res.reservations);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleReturn = async (loanId: number) => {
    setFeedback(null);
    try {
      await apiRequest(`/api/library/loans/${loanId}/return`, { method: 'POST' });
      setFeedback({ type: 'ok', text: 'Book returned and shelf inventory updated.' });
      await loadData();
      onRefreshNotifications();
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Return failed.' });
    }
  };

  const handleRenew = async (loanId: number) => {
    setFeedback(null);
    try {
      const res = await apiRequest<{ dueDate: string }>(`/api/library/loans/${loanId}/renew`, { method: 'POST' });
      setFeedback({
        type: 'ok',
        text: `Loan renewed by 7 days. New due date: ${new Date(res.dueDate).toLocaleDateString()}.`,
      });
      await loadData();
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Renewal failed.' });
    }
  };

  const handleCancelReservation = async (resId: number) => {
    setFeedback(null);
    try {
      await apiRequest(`/api/library/reservations/${resId}`, { method: 'DELETE' });
      setFeedback({ type: 'ok', text: 'Reservation cancelled.' });
      await loadData();
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Cancellation failed.' });
    }
  };

  const activeLoans = loans.filter((l) => l.status !== 'returned');
  const historyLoans = loans.filter((l) => l.status === 'returned');

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-3.5 text-xs rounded-sm border ${
            feedback.type === 'ok'
              ? 'bg-[#253022] border-[#89946f] text-[#b4c99e]'
              : 'bg-[#3f201d] border-[#a96346] text-[#e5988b]'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Active Borrowed Books */}
      <section className="bg-[#29251d] border border-[#3a382b] rounded-sm">
        <div className="px-5 py-4 border-b border-[#3a382b] flex items-center justify-between">
          <div>
            <h1 className="text-base font-display font-semibold text-[#eee2ca]">
              Currently Borrowed Books
            </h1>
            <p className="text-xs text-[#c5b79e]">
              Active loans, renewal eligibility, and return deadlines.
            </p>
          </div>
          <span className="text-xs font-mono text-[#c3a47b] tabular-nums">
            {activeLoans.length} active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#3a382b] bg-[#1d1a15] text-xs font-semibold text-[#c5b79e]">
                <th className="py-3 px-4">Book Title &amp; Shelf</th>
                <th className="py-3 px-4">Issue Date</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3a382b] text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#c5b79e]">Loading loans...</td>
                </tr>
              ) : activeLoans.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#c5b79e]">
                    You have no active borrowed books.
                  </td>
                </tr>
              ) : (
                activeLoans.map((l) => {
                  const daysLeft = Math.ceil((new Date(l.due_date).getTime() - Date.now()) / 86400000);
                  const isOverdue = l.status === 'overdue' || daysLeft < 0;
                  return (
                    <tr key={l.id} className="hover:bg-[#322d23] transition-colors">
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => onOpenBook(l.book_id)}
                          className="font-semibold text-[#eee2ca] hover:text-[#c3a47b] text-left cursor-pointer"
                        >
                          {l.title}
                        </button>
                        <div className="text-xs text-[#c5b79e]">{l.author} · {l.shelf_location}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono tabular-nums text-[#c5b79e]">
                        {new Date(l.issue_date).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono tabular-nums text-[#c5b79e]">
                        {new Date(l.due_date).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold">
                        {isOverdue ? (
                          <span className="text-[#e5988b] inline-flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Overdue ({Math.abs(daysLeft)}d)
                          </span>
                        ) : (
                          <span className="text-[#c3a47b]">Active ({daysLeft}d remaining)</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => void handleRenew(l.id)}
                          disabled={l.renewal_count >= 2}
                          className="px-3 py-1.5 text-xs font-medium border border-[#3a382b] bg-[#1d1a15] text-[#eee2ca] hover:border-[#c3a47b] disabled:opacity-40 rounded-sm cursor-pointer"
                        >
                          Renew ({2 - l.renewal_count} left)
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleReturn(l.id)}
                          className="px-3 py-1.5 text-xs font-semibold bg-[#c3a47b] text-[#1d1a15] hover:bg-[#dbc39c] rounded-sm inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Return</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Active Reservations */}
      <section className="bg-[#29251d] border border-[#3a382b] rounded-sm">
        <div className="px-5 py-4 border-b border-[#3a382b]">
          <h2 className="text-sm font-display font-semibold text-[#eee2ca]">
            Active Book Reservations
          </h2>
        </div>
        <div className="divide-y divide-[#3a382b]">
          {reservations.length === 0 ? (
            <div className="p-6 text-xs text-[#c5b79e]">No active reservation holds.</div>
          ) : (
            reservations.map((r) => (
              <div key={r.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <button
                    type="button"
                    onClick={() => onOpenBook(r.book_id)}
                    className="text-sm font-semibold text-[#eee2ca] hover:text-[#c3a47b] cursor-pointer"
                  >
                    {r.title}
                  </button>
                  <div className="text-xs text-[#c5b79e] mt-0.5">
                    {r.author} · Reserved {new Date(r.reserved_at).toLocaleDateString()} · Expires {new Date(r.expires_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCancelReservation(r.id)}
                  className="px-3 py-1.5 text-xs font-medium border border-[#a96346] bg-[#3f201d] text-[#e5988b] hover:opacity-90 rounded-sm cursor-pointer"
                >
                  Cancel Hold
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Return History */}
      <section className="bg-[#29251d] border border-[#3a382b] rounded-sm">
        <div className="px-5 py-4 border-b border-[#3a382b]">
          <h2 className="text-sm font-display font-semibold text-[#eee2ca]">Return History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#3a382b] bg-[#1d1a15] text-xs font-semibold text-[#c5b79e]">
                <th className="py-3 px-4">Book Title</th>
                <th className="py-3 px-4">Issued</th>
                <th className="py-3 px-4">Returned</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3a382b] text-sm">
              {historyLoans.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-xs text-[#c5b79e]">
                    No returned items yet.
                  </td>
                </tr>
              ) : (
                historyLoans.map((h) => (
                  <tr key={h.id} className="hover:bg-[#322d23]">
                    <td className="py-3 px-4 font-medium text-[#eee2ca]">{h.title}</td>
                    <td className="py-3 px-4 text-xs font-mono tabular-nums text-[#c5b79e]">
                      {new Date(h.issue_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono tabular-nums text-[#c5b79e]">
                      {h.return_date ? new Date(h.return_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-semibold text-[#b4c99e]">
                      Returned
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* PAGE 11: STUDENT PROFILE & LOGIN ACTIVITY                                  */
/* -------------------------------------------------------------------------- */
interface StudentProfilePageProps {
  user: User;
  notifications: NotificationItem[];
  onUserUpdated: (user: User) => void;
}

const DEPARTMENTS = [
  'Computer Science',
  'Artificial Intelligence',
  'Cybersecurity',
  'Data Science',
  'Mathematics',
  'Physics & Quantum Engineering',
  'Library Administration',
];

export function StudentProfilePage({ user, notifications, onUserUpdated }: StudentProfilePageProps) {
  const [fullName, setFullName] = useState(user.full_name);
  const [department, setDepartment] = useState(user.department);
  const [yearOfStudy, setYearOfStudy] = useState(user.year_of_study);
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [loginLogs, setLoginLogs] = useState<
    Array<{ id: number; ip_address: string; user_agent: string; status: string; created_at: string }>
  >([]);

  useEffect(() => {
    apiRequest<{ activity: typeof loginLogs }>('/api/auth/login-activity')
      .then((r) => setLoginLogs(r.activity))
      .catch(() => null);
  }, []);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    try {
      const res = await apiRequest<{ user: User }>('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ full_name: fullName, department, year_of_study: yearOfStudy }),
      });
      onUserUpdated(res.user);
      setProfileMsg({ type: 'ok', text: 'Profile details saved.' });
    } catch (err) {
      setProfileMsg({ type: 'err', text: err instanceof Error ? err.message : 'Update failed.' });
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    try {
      await apiRequest('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setPwMsg({ type: 'ok', text: 'Password updated successfully.' });
    } catch (err) {
      setPwMsg({ type: 'err', text: err instanceof Error ? err.message : 'Password change failed.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Form */}
        <section className="bg-[#29251d] border border-[#3a382b] rounded-sm p-6">
          <h1 className="text-base font-display font-semibold text-[#eee2ca] mb-1">
            Account Profile
          </h1>
          <p className="text-xs text-[#c5b79e] mb-5">
            {user.email} · {user.student_id || 'Staff'} · Role: {user.role.toUpperCase()}
          </p>

          {profileMsg && (
            <div
              className={`mb-4 p-3 text-xs rounded-sm border ${
                profileMsg.type === 'ok'
                  ? 'bg-[#253022] border-[#89946f] text-[#b4c99e]'
                  : 'bg-[#3f201d] border-[#a96346] text-[#e5988b]'
              }`}
            >
              {profileMsg.text}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#c5b79e] mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-[#1d1a15] text-[#eee2ca] border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#c5b79e] mb-1">Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#1d1a15] text-[#eee2ca] border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#c5b79e] mb-1">Academic Year</label>
                <input
                  type="text"
                  value={yearOfStudy}
                  onChange={(e) => setYearOfStudy(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#1d1a15] text-[#eee2ca] border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-[#c3a47b] text-[#1d1a15] text-xs font-semibold rounded-sm hover:bg-[#dbc39c] cursor-pointer"
            >
              Save Profile Changes
            </button>
          </form>
        </section>

        {/* Security & Password */}
        <section className="bg-[#29251d] border border-[#3a382b] rounded-sm p-6">
          <h2 className="text-base font-display font-semibold text-[#eee2ca] mb-1">
            Security &amp; Password
          </h2>
          <p className="text-xs text-[#c5b79e] mb-5">
            Passwords are salted and hashed server-side using bcrypt.
          </p>

          {pwMsg && (
            <div
              className={`mb-4 p-3 text-xs rounded-sm border ${
                pwMsg.type === 'ok'
                  ? 'bg-[#253022] border-[#89946f] text-[#b4c99e]'
                  : 'bg-[#3f201d] border-[#a96346] text-[#e5988b]'
              }`}
            >
              {pwMsg.text}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#c5b79e] mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-[#1d1a15] text-[#eee2ca] border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#c5b79e] mb-1">
                New Password (min 8 chars)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-[#1d1a15] text-[#eee2ca] border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#c3a47b] text-[#1d1a15] text-xs font-semibold rounded-sm hover:bg-[#dbc39c] cursor-pointer"
            >
              Update Password
            </button>
          </form>
        </section>
      </div>

      {/* Login Activity & Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-[#29251d] border border-[#3a382b] rounded-sm">
          <div className="px-5 py-4 border-b border-[#3a382b]">
            <h2 className="text-sm font-display font-semibold text-[#eee2ca]">Recent Login Activity</h2>
          </div>
          <div className="divide-y divide-[#3a382b] max-h-72 overflow-y-auto">
            {loginLogs.map((log) => (
              <div key={log.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="font-medium text-[#eee2ca] truncate">{log.user_agent}</div>
                  <div className="text-[#c5b79e]/80 font-mono tabular-nums">IP {log.ip_address}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={log.status === 'success' ? 'text-[#b4c99e] font-semibold' : 'text-[#e5988b] font-semibold'}>
                    {log.status === 'success' ? 'Authenticated' : 'Denied'}
                  </div>
                  <div className="text-[11px] font-mono text-[#c5b79e]/70 tabular-nums">
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#29251d] border border-[#3a382b] rounded-sm">
          <div className="px-5 py-4 border-b border-[#3a382b]">
            <h2 className="text-sm font-display font-semibold text-[#eee2ca]">Notification Archive</h2>
          </div>
          <div className="divide-y divide-[#3a382b] max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-xs text-[#c5b79e]">No notifications recorded.</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="p-3.5 text-xs">
                  <div className="font-semibold text-[#eee2ca]">{n.title}</div>
                  <div className="text-[#c5b79e] mt-0.5">{n.message}</div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
