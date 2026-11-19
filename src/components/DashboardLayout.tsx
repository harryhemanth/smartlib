import { useState, type ReactNode } from 'react';
import {
  BarChart3,
  Bell,
  BookCheck,
  BookOpen,
  Bot,
  Compass,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import type { AiMode, NotificationItem, PageId, User } from '../types.ts';

interface DashboardLayoutProps {
  user: User;
  activePage: PageId;
  aiMode: AiMode;
  unreadNotifications: number;
  notifications: NotificationItem[];
  onNavigate: (page: PageId) => void;
  onMarkNotificationsRead: () => void;
  onLogout: () => void;
  children: ReactNode;
}

const PAGE_LABELS: Record<PageId, string> = {
  landing: 'Home',
  login: 'Sign In',
  register: 'Register',
  'student-dashboard': 'Student Dashboard',
  'ai-chat': 'AI Chat Assistant',
  'book-search': 'Book Search & QR Lookup',
  'book-details': 'Book Details',
  'borrowed-books': 'My Borrowed Books',
  recommendations: 'Book Recommendations',
  'digital-library': 'Digital Library',
  'student-profile': 'Student Profile',
  'admin-dashboard': 'Admin Dashboard',
  'book-management': 'Book Management',
  'student-management': 'Student Management',
  reports: 'Reports & Analytics',
  settings: 'System Settings',
};

export function DashboardLayout({
  user,
  activePage,
  aiMode,
  unreadNotifications,
  notifications,
  onNavigate,
  onMarkNotificationsRead,
  onLogout,
  children,
}: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const studentNav: Array<{ id: PageId; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'student-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'ai-chat', label: 'AI Chat Assistant', icon: Bot },
    { id: 'book-search', label: 'Book Search', icon: Search },
    { id: 'borrowed-books', label: 'My Borrowed Books', icon: BookCheck },
    { id: 'recommendations', label: 'Recommendations', icon: Compass },
    { id: 'digital-library', label: 'Digital Library', icon: FolderOpen },
    { id: 'student-profile', label: 'My Profile', icon: UserIcon },
  ];

  const adminNav: Array<{ id: PageId; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'admin-dashboard', label: 'Admin Dashboard', icon: ShieldCheck },
    { id: 'book-management', label: 'Book Management', icon: BookOpen },
    { id: 'student-management', label: 'Student Management', icon: Users },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (id: PageId) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  const avatarSrc =
    user.avatar_url ||
    (user.role === 'admin'
      ? '/src/assets/images/avatar_admin_librarian_1795095651881.jpg'
      : '/src/assets/images/avatar_student_profile_1795095652304.jpg');

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#1d1a15] text-[#eee2ca] select-none">
      <div className="h-16 px-5 flex items-center justify-between border-b border-[#3a382b]">
        <button
          type="button"
          onClick={() => handleNavClick('landing')}
          className="font-display italic font-semibold text-base tracking-tight text-[#c3a47b] whitespace-nowrap cursor-pointer"
        >
          SmartLib AI
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1 text-[#c5b79e] hover:text-[#eee2ca]"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        <div>
          <div className="px-3 mb-2 text-[11px] font-medium text-[#c5b79e]/80">
            Library Workspace
          </div>
          <nav className="space-y-0.5">
            {studentNav.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id || (activePage === 'book-details' && item.id === 'book-search');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-sm transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#29251d] text-[#c3a47b] font-semibold border border-[#3a382b]'
                      : 'text-[#c5b79e] hover:bg-[#29251d]/70 hover:text-[#eee2ca] border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {user.role === 'admin' && (
          <div>
            <div className="px-3 mb-2 text-[11px] font-medium text-[#c3a47b]">
              Administration
            </div>
            <nav className="space-y-0.5">
              {adminNav.map((item) => {
                const Icon = item.icon;
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-sm transition-colors whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-[#29251d] text-[#c3a47b] font-semibold border border-[#3a382b]'
                        : 'text-[#c5b79e] hover:bg-[#29251d]/70 hover:text-[#eee2ca] border border-transparent'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[#3a382b] space-y-3">
        <div className="flex items-center gap-3">
          <img
            src={avatarSrc}
            alt={user.full_name}
            referrerPolicy="no-referrer"
            className="w-9 h-9 object-cover rounded-sm border border-[#3a382b] shrink-0"
          />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-[#eee2ca] truncate">{user.full_name}</div>
            <div className="text-[11px] text-[#c5b79e] truncate">
              {user.role === 'admin' ? 'Administrator' : user.student_id || user.department}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-[#c5b79e] border border-[#3a382b] hover:border-[#c3a47b] hover:text-[#eee2ca] rounded-sm transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#211e18] text-[#eee2ca] flex field-stage">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-[260px] shrink-0 border-r border-[#3a382b]">
        <div className="sticky top-0 h-screen">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-[260px] h-full border-r border-[#3a382b]">
            <SidebarContent />
          </div>
          <div
            className="flex-1 bg-black/70"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 h-16 bg-[#1d1a15]/95 backdrop-blur border-b border-[#3a382b] px-4 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-[#c5b79e] hover:text-[#eee2ca] border border-[#3a382b] rounded-sm"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <button
                type="button"
                onClick={() => onNavigate('landing')}
                className="text-[#c5b79e] hover:text-[#eee2ca] hidden sm:inline cursor-pointer"
              >
                SmartLib AI
              </button>
              <span className="text-[#3a382b] hidden sm:inline">/</span>
              <span className="font-display font-semibold text-[#eee2ca] truncate">
                {PAGE_LABELS[activePage]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('ai-chat')}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#eee2ca] bg-[#29251d] border border-[#3a382b] hover:border-[#c3a47b] rounded-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5 text-[#c3a47b]" />
              <span>AI Mode: {aiMode === 'auto' ? 'Automatic' : aiMode === 'online' ? 'Online' : 'Offline'}</span>
            </button>

            {/* Notifications Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  const next = !notifOpen;
                  setNotifOpen(next);
                  if (next && unreadNotifications > 0) {
                    onMarkNotificationsRead();
                  }
                }}
                className="relative p-2 bg-[#29251d] border border-[#3a382b] hover:border-[#c3a47b] rounded-sm text-[#c5b79e] hover:text-[#eee2ca] cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-[#c3a47b] text-[#1d1a15] text-[10px] font-mono font-semibold flex items-center justify-center rounded-sm tabular-nums">
                    {unreadNotifications}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-[#29251d] border border-[#3a382b] shadow-xl rounded-sm z-40">
                  <div className="px-4 py-3 border-b border-[#3a382b] flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#eee2ca]">Library Notifications</span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-[#c5b79e] hover:text-[#eee2ca] cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-[#3a382b]">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-xs text-[#c5b79e] text-center">No notifications yet.</div>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className="p-3.5">
                          <div className="text-xs font-semibold text-[#eee2ca] mb-0.5">{n.title}</div>
                          <div className="text-xs text-[#c5b79e] leading-relaxed">{n.message}</div>
                          <div className="text-[11px] font-mono text-[#c5b79e]/70 mt-1 tabular-nums">
                            {new Date(n.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onNavigate('student-profile')}
              className="px-3 py-1.5 text-xs font-semibold bg-[#c3a47b] text-[#1d1a15] rounded-sm hover:bg-[#dbc39c] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {user.role === 'admin' ? 'Admin Profile' : 'Profile'}
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 lg:p-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
