import { useEffect, useState } from 'react';
import { apiRequest, clearAuthSession, setAuthSession } from './api.ts';
import { WebsiteLoader } from './components/WebsiteLoader.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import { AuthPages } from './components/AuthPages.tsx';
import { DashboardLayout } from './components/DashboardLayout.tsx';
import { StudentDashboard } from './components/StudentDashboard.tsx';
import { AiChatAssistant } from './components/AiChatAssistant.tsx';
import {
  BookDetailsPage,
  BookSearchPage,
  DigitalLibraryPage,
  RecommendationsPage,
} from './components/CatalogPages.tsx';
import { BorrowedBooksPage, StudentProfilePage } from './components/BorrowingAndProfile.tsx';
import {
  AdminDashboardPage,
  BookManagementPage,
  ReportsAnalyticsPage,
  SettingsPage,
  StudentManagementPage,
} from './components/AdminPages.tsx';
import type { AiMode, NotificationItem, PageId, User } from './types.ts';

const PATH_TO_PAGE: Record<string, PageId> = {
  '/': 'landing',
  '/home': 'landing',
  '/showcase': 'landing',
  '/login': 'login',
  '/register': 'register',
  '/dashboard': 'student-dashboard',
  '/chat': 'ai-chat',
  '/search': 'book-search',
  '/borrowed': 'borrowed-books',
  '/recommendations': 'recommendations',
  '/digital-library': 'digital-library',
  '/profile': 'student-profile',
  '/admin': 'admin-dashboard',
  '/admin/books': 'book-management',
  '/admin/students': 'student-management',
  '/admin/reports': 'reports',
  '/admin/settings': 'settings',
};

const PAGE_TO_PATH: Record<PageId, string> = {
  landing: '/',
  login: '/login',
  register: '/register',
  'student-dashboard': '/dashboard',
  'ai-chat': '/chat',
  'book-search': '/search',
  'book-details': '/book',
  'borrowed-books': '/borrowed',
  recommendations: '/recommendations',
  'digital-library': '/digital-library',
  'student-profile': '/profile',
  'admin-dashboard': '/admin',
  'book-management': '/admin/books',
  'student-management': '/admin/students',
  reports: '/admin/reports',
  settings: '/admin/settings',
};

function resolveInitialPage(): { page: PageId; bookId: number } {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path.startsWith('/book/')) {
    const id = Number(path.split('/')[2]);
    if (Number.isFinite(id) && id > 0) {
      return { page: 'book-details', bookId: id };
    }
  }
  return { page: PATH_TO_PAGE[path] || 'landing', bookId: 1 };
}

export default function App() {
  const initial = resolveInitialPage();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [loadProgress, setLoadProgress] = useState(18);
  const [loadStatus, setLoadStatus] = useState('Connecting to SmartLib catalog...');
  const [activePage, setActivePage] = useState<PageId>(initial.page);
  const [selectedBookId, setSelectedBookId] = useState<number>(initial.bookId);
  const [aiMode, setAiMode] = useState<AiMode>('auto');
  const [pendingAiPrompt, setPendingAiPrompt] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const syncUrl = (page: PageId, bookId?: number) => {
    const targetPath = page === 'book-details' && bookId ? `/book/${bookId}` : PAGE_TO_PATH[page] || '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ page, bookId }, '', targetPath);
    }
  };

  const loadNotifications = async () => {
    try {
      const res = await apiRequest<{ notifications: NotificationItem[] }>('/api/library/notifications');
      setNotifications(res.notifications);
      setUnreadNotifications(res.notifications.filter((n) => n.is_read === 0).length);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const onPopState = () => {
      const resolved = resolveInitialPage();
      setActivePage(resolved.page);
      setSelectedBookId(resolved.bookId);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const t1 = window.setTimeout(() => {
      setLoadProgress(56);
      setLoadStatus('Verifying session & role permissions...');
    }, 260);
    const t2 = window.setTimeout(() => {
      setLoadProgress(88);
      setLoadStatus('Preparing Multi-Agent Library Workspace...');
    }, 580);
    const t3 = window.setTimeout(() => {
      setLoadProgress(100);
      setSplashDone(true);
    }, 950);

    apiRequest<{ user: User | null; csrfToken: string | null; sessionToken: string | null; unreadNotifications: number }>('/api/auth/me')
      .then((res) => {
        if (res.user) {
          setUser(res.user);
          if (res.sessionToken) {
            setAuthSession(res.sessionToken, res.csrfToken, true);
          }
          setUnreadNotifications(res.unreadNotifications);
          void loadNotifications();
        } else {
          clearAuthSession();
        }
      })
      .catch(() => null)
      .finally(() => setAuthChecked(true));

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, []);

  const handleAuthenticated = (authenticatedUser: User) => {
    setUser(authenticatedUser);
    void loadNotifications();
    const target: PageId = authenticatedUser.role === 'admin' ? 'admin-dashboard' : 'student-dashboard';
    setActivePage(target);
    syncUrl(target);
  };

  const handleLogout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => null);
    clearAuthSession();
    setUser(null);
    setNotifications([]);
    setUnreadNotifications(0);
    setActivePage('login');
    syncUrl('login');
  };

  const handleNavigate = (page: PageId) => {
    const adminOnlyPages: PageId[] = [
      'admin-dashboard',
      'book-management',
      'student-management',
      'reports',
      'settings',
    ];
    if (adminOnlyPages.includes(page) && user?.role !== 'admin') {
      setActivePage('student-dashboard');
      syncUrl('student-dashboard');
      return;
    }
    setActivePage(page);
    syncUrl(page);
  };

  const handleOpenBook = (bookId: number) => {
    setSelectedBookId(bookId);
    setActivePage('book-details');
    syncUrl('book-details', bookId);
  };

  const handleAskAi = (prompt: string) => {
    setPendingAiPrompt(prompt);
    setActivePage('ai-chat');
    syncUrl('ai-chat');
  };

  const handleMarkNotificationsRead = async () => {
    await apiRequest('/api/library/notifications/read', { method: 'POST' }).catch(() => null);
    setUnreadNotifications(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
  };

  if (!authChecked || !splashDone) {
    return <WebsiteLoader progress={loadProgress} statusLabel={loadStatus} />;
  }

  if (activePage === 'landing') {
    return (
      <LandingPage
        onNavigate={handleNavigate}
        isAuthenticated={Boolean(user)}
        userRole={user?.role}
      />
    );
  }

  if (!user || activePage === 'login' || activePage === 'register') {
    const authMode = activePage === 'register' ? 'register' : 'login';
    return (
      <AuthPages
        mode={authMode}
        onNavigate={handleNavigate}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  return (
    <DashboardLayout
      user={user}
      activePage={activePage}
      aiMode={aiMode}
      unreadNotifications={unreadNotifications}
      notifications={notifications}
      onNavigate={handleNavigate}
      onMarkNotificationsRead={() => void handleMarkNotificationsRead()}
      onLogout={() => void handleLogout()}
    >
      {activePage === 'student-dashboard' && (
        <StudentDashboard
          user={user}
          onNavigate={handleNavigate}
          onOpenBook={handleOpenBook}
          onAskAi={handleAskAi}
        />
      )}

      {activePage === 'ai-chat' && (
        <AiChatAssistant
          aiMode={aiMode}
          onChangeAiMode={setAiMode}
          initialPrompt={pendingAiPrompt}
          onClearInitialPrompt={() => setPendingAiPrompt(null)}
          onOpenBook={handleOpenBook}
          onNavigate={handleNavigate}
        />
      )}

      {activePage === 'book-search' && <BookSearchPage onOpenBook={handleOpenBook} />}

      {activePage === 'book-details' && (
        <BookDetailsPage
          bookId={selectedBookId}
          onBack={() => handleNavigate('book-search')}
          onOpenBook={handleOpenBook}
          onRefreshNotifications={() => void loadNotifications()}
        />
      )}

      {activePage === 'borrowed-books' && (
        <BorrowedBooksPage
          onOpenBook={handleOpenBook}
          onRefreshNotifications={() => void loadNotifications()}
        />
      )}

      {activePage === 'recommendations' && <RecommendationsPage onOpenBook={handleOpenBook} />}

      {activePage === 'digital-library' && <DigitalLibraryPage onNavigate={handleNavigate} />}

      {activePage === 'student-profile' && (
        <StudentProfilePage
          user={user}
          notifications={notifications}
          onUserUpdated={setUser}
        />
      )}

      {activePage === 'admin-dashboard' && user.role === 'admin' && (
        <AdminDashboardPage onNavigate={handleNavigate} />
      )}

      {activePage === 'book-management' && user.role === 'admin' && <BookManagementPage />}

      {activePage === 'student-management' && user.role === 'admin' && <StudentManagementPage />}

      {activePage === 'reports' && user.role === 'admin' && <ReportsAnalyticsPage />}

      {activePage === 'settings' && user.role === 'admin' && (
        <SettingsPage aiMode={aiMode} onChangeAiMode={setAiMode} />
      )}
    </DashboardLayout>
  );
}
