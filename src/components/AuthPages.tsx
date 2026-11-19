import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Shield,
  UserPlus,
} from 'lucide-react';
import { apiRequest, setAuthSession } from '../api.ts';
import type { PageId, User } from '../types.ts';

interface AuthPagesProps {
  mode: 'login' | 'register';
  onNavigate: (page: PageId) => void;
  onAuthenticated: (user: User) => void;
}

const DEPARTMENTS = [
  'Computer Science',
  'Artificial Intelligence',
  'Cybersecurity',
  'Data Science',
  'Mathematics',
  'Physics & Quantum Engineering',
];

function validateEmailValue(raw: string): string | null {
  const val = raw.trim();
  if (!val) return 'Institutional email is required.';
  if (/\s/.test(val)) return 'Email address cannot contain spaces.';
  if (!val.includes('@')) return "Include an '@' symbol in your email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) {
    return 'Enter a valid email address (e.g. name@smartlib.edu).';
  }
  return null;
}

function validateStudentIdValue(raw: string): string | null {
  const val = raw.trim();
  if (!val) return 'Student ID is required.';
  if (!/^[A-Za-z0-9-]{4,32}$/.test(val)) {
    return 'Enter a valid Student ID (e.g. CS-2024-1042).';
  }
  return null;
}

function validateLoginPasswordValue(raw: string): string | null {
  if (!raw) return 'Password is required.';
  if (raw.length < 4) return 'Password must be at least 4 characters.';
  return null;
}

function validateRegisterPasswordValue(raw: string): string | null {
  if (!raw) return 'Password is required.';
  if (raw.length < 8) return 'Password must be at least 8 characters long.';
  return null;
}

function validateFullNameValue(raw: string): string | null {
  const val = raw.trim();
  if (!val) return 'Full name is required.';
  if (val.length < 2) return 'Enter your full legal name.';
  return null;
}

export function AuthPages({ mode, onNavigate, onAuthenticated }: AuthPagesProps) {
  const [portal, setPortal] = useState<'student' | 'admin'>('student');
  const [identifierMode, setIdentifierMode] = useState<'email' | 'student_id'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [loginTouched, setLoginTouched] = useState<{ identifier: boolean; password: boolean }>({
    identifier: false,
    password: false,
  });
  const [loginSubmitAttempted, setLoginSubmitAttempted] = useState(false);

  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [department, setDepartment] = useState('Computer Science');
  const [yearOfStudy, setYearOfStudy] = useState('3rd Year');
  const [regTouched, setRegTouched] = useState<{
    fullName: boolean;
    studentId: boolean;
    email: boolean;
    password: boolean;
  }>({
    fullName: false,
    studentId: false,
    email: false,
    password: false,
  });
  const [regSubmitAttempted, setRegSubmitAttempted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [catalogStats, setCatalogStats] = useState<{
    totalTitles: number;
    availableCopies: number;
    digitalCount: number;
  } | null>(null);

  const identifierInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const regNameRef = useRef<HTMLInputElement>(null);
  const regStudentIdRef = useRef<HTMLInputElement>(null);
  const regEmailRef = useRef<HTMLInputElement>(null);
  const regPasswordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiRequest<{ stats: { totalTitles: number; availableCopies: number; digitalCount: number } }>(
      '/api/library/overview'
    )
      .then((res) => setCatalogStats(res.stats))
      .catch(() => null);
  }, []);

  const activeIdentifierMode = portal === 'admin' ? 'email' : identifierMode;
  const identifierErrorRaw =
    activeIdentifierMode === 'email' ? validateEmailValue(email) : validateStudentIdValue(email);
  const passwordErrorRaw = validateLoginPasswordValue(password);

  const showIdentifierError = (loginTouched.identifier || loginSubmitAttempted) && Boolean(identifierErrorRaw);
  const showIdentifierValid = (loginTouched.identifier || loginSubmitAttempted) && !identifierErrorRaw;
  const showPasswordError = (loginTouched.password || loginSubmitAttempted) && Boolean(passwordErrorRaw);
  const showPasswordValid = (loginTouched.password || loginSubmitAttempted) && !passwordErrorRaw;

  const regErrors = {
    fullName: validateFullNameValue(fullName),
    studentId: validateStudentIdValue(studentId),
    email: validateEmailValue(email),
    password: validateRegisterPasswordValue(password),
  };

  const resetFormState = () => {
    setServerError(null);
    setLoginTouched({ identifier: false, password: false });
    setLoginSubmitAttempted(false);
    setRegTouched({ fullName: false, studentId: false, email: false, password: false });
    setRegSubmitAttempted(false);
  };

  const handlePortalSwitch = (nextPortal: 'student' | 'admin') => {
    setPortal(nextPortal);
    if (nextPortal === 'admin') {
      setIdentifierMode('email');
    }
    resetFormState();
  };

  const handleToggleIdentifierMode = (nextMode: 'email' | 'student_id') => {
    setIdentifierMode(nextMode);
    setEmail('');
    setServerError(null);
    setLoginTouched((prev) => ({ ...prev, identifier: false }));
    setLoginSubmitAttempted(false);
    setTimeout(() => identifierInputRef.current?.focus(), 0);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setLoginSubmitAttempted(true);
    setLoginTouched({ identifier: true, password: true });

    if (identifierErrorRaw) {
      identifierInputRef.current?.focus();
      return;
    }
    if (passwordErrorRaw) {
      passwordInputRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ user: User; csrfToken: string; sessionToken: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
          portal,
          rememberMe,
        }),
      });
      setAuthSession(res.sessionToken, res.csrfToken, rememberMe);
      onAuthenticated(res.user);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setRegSubmitAttempted(true);
    setRegTouched({ fullName: true, studentId: true, email: true, password: true });

    if (regErrors.fullName) {
      regNameRef.current?.focus();
      return;
    }
    if (regErrors.studentId) {
      regStudentIdRef.current?.focus();
      return;
    }
    if (regErrors.email) {
      regEmailRef.current?.focus();
      return;
    }
    if (regErrors.password) {
      regPasswordRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ user: User; csrfToken: string; sessionToken: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          student_id: studentId.trim(),
          department,
          year_of_study: yearOfStudy,
          password,
        }),
      });
      setAuthSession(res.sessionToken, res.csrfToken, true);
      onAuthenticated(res.user);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (type: 'student' | 'admin') => {
    setServerError(null);
    setLoginSubmitAttempted(false);
    setIdentifierMode('email');
    if (type === 'student') {
      setPortal('student');
      setEmail('maya.lin@smartlib.edu');
      setPassword('Student@2026');
    } else {
      setPortal('admin');
      setEmail('admin@smartlib.edu');
      setPassword('Admin@SmartLib2026');
    }
    setLoginTouched({ identifier: true, password: true });
  };

  return (
    <div className="min-h-screen bg-[#211e18] text-[#eee2ca] flex flex-col field-stage">
      {/* Top Bar */}
      <header className="bg-[#1d1a15] border-b border-[#3a382b] px-6 h-16 flex items-center justify-between gap-6">
        <button
          type="button"
          onClick={() => onNavigate('landing')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#c5b79e] hover:text-[#eee2ca] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Library Showcase</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('landing')}
          className="font-display italic font-semibold text-base tracking-tight text-[#c3a47b] whitespace-nowrap shrink-0 cursor-pointer"
        >
          SmartLib AI
        </button>

        <button
          type="button"
          onClick={() => {
            resetFormState();
            onNavigate(mode === 'login' ? 'register' : 'login');
          }}
          className="text-xs font-semibold text-[#c3a47b] hover:text-[#dbc39c] whitespace-nowrap shrink-0 cursor-pointer"
        >
          {mode === 'login' ? 'Register Student ID' : 'Sign In'}
        </button>
      </header>

      {/* Split-Screen Editorial Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12">
        {/* Left Academic Showcase Panel */}
        <aside className="lg:col-span-6 bg-[#1d1a15] text-[#eee2ca] relative overflow-hidden flex flex-col justify-between p-8 lg:p-14 border-b lg:border-b-0 lg:border-r border-[#3a382b]">
          <img
            src="/src/assets/images/hero_academic_library_1795095651840.jpg"
            alt="SmartLib modern university library interior"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-20 sepia-[.35]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1d1a15] via-[#29251d]/85 to-[#1d1a15]/75" />

          <div className="relative z-10 max-w-lg">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-[#c3a47b] mb-4">
              <BookOpen className="w-4 h-4" />
              <span>SmartLib AI · Multi-Agent Workspace</span>
            </div>
            <h2 className="text-2xl lg:text-4xl font-display font-semibold tracking-tight text-balance leading-tight mb-4 text-[#eee2ca]">
              {mode === 'login'
                ? 'Access live catalog availability, active loans, and your AI librarian.'
                : 'Activate your institutional SmartLib AI student account.'}
            </h2>
            <p className="text-sm text-[#c5b79e] leading-relaxed">
              Sign in with your institutional email or Student ID. All sessions are protected with
              bcrypt password hashing, HTTP-only signed cookies, CSRF verification, and role-based
              access controls.
            </p>
          </div>

          <div className="relative z-10 mt-10 pt-8 border-t border-[#3a382b] grid grid-cols-3 gap-4 max-w-lg">
            <div>
              <div className="text-[11px] text-[#c5b79e] mb-1">Catalog Titles</div>
              <div className="text-xl font-mono font-semibold tabular-nums text-[#eee2ca]">
                {catalogStats ? catalogStats.totalTitles : '15'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#c5b79e] mb-1">On Shelf Now</div>
              <div className="text-xl font-mono font-semibold tabular-nums text-[#c3a47b]">
                {catalogStats ? catalogStats.availableCopies : '49'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#c5b79e] mb-1">Digital Archives</div>
              <div className="text-xl font-mono font-semibold tabular-nums text-[#eee2ca]">
                {catalogStats ? catalogStats.digitalCount : '5'}
              </div>
            </div>
          </div>
        </aside>

        {/* Right Authentication Form Panel */}
        <section className="lg:col-span-6 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-[450px] bg-[#29251d] border border-[#3a382b] rounded-sm p-8">
            {mode === 'login' ? (
              <>
                <div className="mb-6">
                  <p className="text-xs font-medium text-[#c3a47b] mb-1">Portal Authentication</p>
                  <h1 className="text-2xl font-display font-semibold text-[#eee2ca]">
                    Sign in to SmartLib AI
                  </h1>
                </div>

                {/* Role Switcher */}
                <div className="grid grid-cols-2 gap-1 p-1 bg-[#1d1a15] border border-[#3a382b] rounded-sm mb-6" role="tablist" aria-label="Authentication Portal">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={portal === 'student'}
                    onClick={() => handlePortalSwitch('student')}
                    className={`py-2 text-xs font-semibold rounded-sm transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                      portal === 'student'
                        ? 'bg-[#c3a47b] text-[#1d1a15]'
                        : 'text-[#c5b79e] hover:text-[#eee2ca]'
                    }`}
                  >
                    Student Portal
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={portal === 'admin'}
                    onClick={() => handlePortalSwitch('admin')}
                    className={`py-2 text-xs font-semibold rounded-sm transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                      portal === 'admin'
                        ? 'bg-[#c3a47b] text-[#1d1a15]'
                        : 'text-[#c5b79e] hover:text-[#eee2ca]'
                    }`}
                  >
                    Administrator Portal
                  </button>
                </div>

                {serverError && (
                  <div
                    role="alert"
                    className="mb-4 p-3 bg-[#3f201d] border border-[#a96346] text-xs text-[#f8d7cf] rounded-sm flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 text-[#e5988b] shrink-0 mt-0.5" />
                    <span>{serverError}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} noValidate className="space-y-4">
                  {/* Email / Student ID Field */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label htmlFor="login-identifier" className="text-xs font-semibold text-[#eee2ca]">
                        {activeIdentifierMode === 'email'
                          ? portal === 'admin'
                            ? 'Administrator Email'
                            : 'Institutional Email'
                          : 'Student ID'}
                      </label>
                      {portal === 'student' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleIdentifierMode(
                              identifierMode === 'email' ? 'student_id' : 'email'
                            )
                          }
                          className="text-[11px] font-medium text-[#c3a47b] hover:text-[#dbc39c] underline underline-offset-2 cursor-pointer whitespace-nowrap"
                        >
                          {identifierMode === 'email' ? 'Use Student ID instead' : 'Use Email instead'}
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      <input
                        ref={identifierInputRef}
                        id="login-identifier"
                        type={activeIdentifierMode === 'email' ? 'email' : 'text'}
                        inputMode={activeIdentifierMode === 'email' ? 'email' : 'text'}
                        autoComplete="username"
                        aria-required="true"
                        aria-invalid={showIdentifierError}
                        aria-describedby={showIdentifierError ? 'login-identifier-error' : undefined}
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (serverError) setServerError(null);
                        }}
                        onBlur={() => setLoginTouched((prev) => ({ ...prev, identifier: true }))}
                        placeholder={
                          activeIdentifierMode === 'email'
                            ? portal === 'admin'
                              ? 'admin@smartlib.edu'
                              : 'maya.lin@smartlib.edu'
                            : 'CS-2024-1042'
                        }
                        className={`w-full pl-3.5 pr-9 py-2.5 text-sm bg-[#1d1a15] text-[#eee2ca] placeholder:text-[#c5b79e]/45 border rounded-sm transition-colors duration-150 focus:outline-none ${
                          activeIdentifierMode === 'student_id' ? 'font-mono' : ''
                        } ${
                          showIdentifierError
                            ? 'border-[#e5988b] focus:border-[#e5988b]'
                            : showIdentifierValid
                            ? 'border-[#89946f] focus:border-[#c3a47b]'
                            : 'border-[#3a382b] focus:border-[#c3a47b]'
                        }`}
                      />
                      {showIdentifierError && (
                        <AlertCircle
                          aria-hidden="true"
                          className="w-4 h-4 text-[#e5988b] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        />
                      )}
                      {showIdentifierValid && (
                        <CheckCircle2
                          aria-hidden="true"
                          className="w-4 h-4 text-[#b4c99e] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        />
                      )}
                    </div>

                    {showIdentifierError && (
                      <p
                        id="login-identifier-error"
                        role="alert"
                        className="mt-1.5 text-xs text-[#e5988b]"
                      >
                        {identifierErrorRaw}
                      </p>
                    )}
                  </div>

                  {/* Password Field */}
                  <div>
                    <label htmlFor="login-password" className="block text-xs font-semibold text-[#eee2ca] mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        ref={passwordInputRef}
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        aria-required="true"
                        aria-invalid={showPasswordError}
                        aria-describedby={showPasswordError ? 'login-password-error' : undefined}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (serverError) setServerError(null);
                        }}
                        onBlur={() => setLoginTouched((prev) => ({ ...prev, password: true }))}
                        placeholder="Enter your password"
                        className={`w-full pl-3.5 pr-16 py-2.5 text-sm bg-[#1d1a15] text-[#eee2ca] placeholder:text-[#c5b79e]/45 border rounded-sm transition-colors duration-150 focus:outline-none ${
                          showPasswordError
                            ? 'border-[#e5988b] focus:border-[#e5988b]'
                            : showPasswordValid
                            ? 'border-[#89946f] focus:border-[#c3a47b]'
                            : 'border-[#3a382b] focus:border-[#c3a47b]'
                        }`}
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                        {showPasswordError && (
                          <AlertCircle aria-hidden="true" className="w-4 h-4 text-[#e5988b] pointer-events-none" />
                        )}
                        {showPasswordValid && (
                          <CheckCircle2 aria-hidden="true" className="w-4 h-4 text-[#b4c99e] pointer-events-none" />
                        )}
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="p-1 text-[#c5b79e] hover:text-[#eee2ca] cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {showPasswordError && (
                      <p id="login-password-error" role="alert" className="mt-1.5 text-xs text-[#e5988b]">
                        {passwordErrorRaw}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <label className="inline-flex items-center gap-2 text-[#c5b79e] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded-sm border-[#3a382b] bg-[#1d1a15] accent-[#c3a47b]"
                      />
                      <span>Keep me signed in for 7 days</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-[#c3a47b] text-[#1d1a15] text-sm font-semibold rounded-sm hover:bg-[#dbc39c] disabled:opacity-60 transition-colors duration-150 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    {portal === 'admin' ? <Shield className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    <span>
                      {loading
                        ? 'Verifying Credentials...'
                        : `Sign In as ${portal === 'admin' ? 'Administrator' : 'Student'}`}
                    </span>
                  </button>
                </form>

                {/* Quick-Fill Demo Credentials */}
                <div className="mt-6 pt-5 border-t border-[#3a382b]">
                  <div className="text-xs font-medium text-[#c5b79e] mb-2.5">
                    Demo Credentials (Click to Autofill)
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => fillDemoAccount('student')}
                      className="px-3 py-2 text-xs font-medium bg-[#1d1a15] border border-[#3a382b] hover:border-[#c3a47b] text-[#eee2ca] rounded-sm text-left transition-colors cursor-pointer"
                    >
                      <div className="font-semibold text-[#c3a47b]">Student Account</div>
                      <div className="text-[11px] font-mono text-[#c5b79e] truncate">maya.lin@smartlib.edu</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => fillDemoAccount('admin')}
                      className="px-3 py-2 text-xs font-medium bg-[#1d1a15] border border-[#3a382b] hover:border-[#c3a47b] text-[#eee2ca] rounded-sm text-left transition-colors cursor-pointer"
                    >
                      <div className="font-semibold text-[#c3a47b]">Admin Account</div>
                      <div className="text-[11px] font-mono text-[#c5b79e] truncate">admin@smartlib.edu</div>
                    </button>
                  </div>
                </div>

                <div className="mt-5 text-center text-xs text-[#c5b79e]">
                  New student?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      resetFormState();
                      onNavigate('register');
                    }}
                    className="font-semibold text-[#c3a47b] hover:underline cursor-pointer"
                  >
                    Register Student Account
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-6">
                  <p className="text-xs font-medium text-[#c3a47b] mb-1">New Student Onboarding</p>
                  <h1 className="text-2xl font-display font-semibold text-[#eee2ca]">
                    Register Student Account
                  </h1>
                </div>

                {serverError && (
                  <div
                    role="alert"
                    className="mb-4 p-3 bg-[#3f201d] border border-[#a96346] text-xs text-[#f8d7cf] rounded-sm flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 text-[#e5988b] shrink-0 mt-0.5" />
                    <span>{serverError}</span>
                  </div>
                )}

                <form onSubmit={handleRegister} noValidate className="space-y-4">
                  <div>
                    <label htmlFor="reg-fullname" className="block text-xs font-semibold text-[#eee2ca] mb-1">
                      Full Name
                    </label>
                    <input
                      ref={regNameRef}
                      id="reg-fullname"
                      type="text"
                      aria-required="true"
                      aria-invalid={(regTouched.fullName || regSubmitAttempted) && Boolean(regErrors.fullName)}
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (serverError) setServerError(null);
                      }}
                      onBlur={() => setRegTouched((prev) => ({ ...prev, fullName: true }))}
                      placeholder="e.g. Priya Sharma"
                      className={`w-full px-3.5 py-2 text-sm bg-[#1d1a15] text-[#eee2ca] placeholder:text-[#c5b79e]/45 border rounded-sm focus:outline-none ${
                        (regTouched.fullName || regSubmitAttempted) && regErrors.fullName
                          ? 'border-[#e5988b]'
                          : 'border-[#3a382b] focus:border-[#c3a47b]'
                      }`}
                    />
                    {(regTouched.fullName || regSubmitAttempted) && regErrors.fullName && (
                      <p role="alert" className="mt-1 text-xs text-[#e5988b]">{regErrors.fullName}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="reg-studentid" className="block text-xs font-semibold text-[#eee2ca] mb-1">
                        Student ID
                      </label>
                      <input
                        ref={regStudentIdRef}
                        id="reg-studentid"
                        type="text"
                        aria-required="true"
                        aria-invalid={(regTouched.studentId || regSubmitAttempted) && Boolean(regErrors.studentId)}
                        value={studentId}
                        onChange={(e) => {
                          setStudentId(e.target.value);
                          if (serverError) setServerError(null);
                        }}
                        onBlur={() => setRegTouched((prev) => ({ ...prev, studentId: true }))}
                        placeholder="CS-2026-1099"
                        className={`w-full px-3.5 py-2 text-sm font-mono bg-[#1d1a15] text-[#eee2ca] placeholder:text-[#c5b79e]/45 border rounded-sm focus:outline-none ${
                          (regTouched.studentId || regSubmitAttempted) && regErrors.studentId
                            ? 'border-[#e5988b]'
                            : 'border-[#3a382b] focus:border-[#c3a47b]'
                        }`}
                      />
                      {(regTouched.studentId || regSubmitAttempted) && regErrors.studentId && (
                        <p role="alert" className="mt-1 text-xs text-[#e5988b]">{regErrors.studentId}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="reg-year" className="block text-xs font-semibold text-[#eee2ca] mb-1">
                        Year of Study
                      </label>
                      <select
                        id="reg-year"
                        value={yearOfStudy}
                        onChange={(e) => setYearOfStudy(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-[#1d1a15] text-[#eee2ca] border border-[#3a382b] rounded-sm focus:outline-none focus:border-[#c3a47b]"
                      >
                        <option>1st Year</option>
                        <option>2nd Year</option>
                        <option>3rd Year</option>
                        <option>4th Year</option>
                        <option>Postgraduate</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-dept" className="block text-xs font-semibold text-[#eee2ca] mb-1">
                      Department
                    </label>
                    <select
                      id="reg-dept"
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
                    <label htmlFor="reg-email" className="block text-xs font-semibold text-[#eee2ca] mb-1">
                      College Email
                    </label>
                    <input
                      ref={regEmailRef}
                      id="reg-email"
                      type="email"
                      inputMode="email"
                      aria-required="true"
                      aria-invalid={(regTouched.email || regSubmitAttempted) && Boolean(regErrors.email)}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (serverError) setServerError(null);
                      }}
                      onBlur={() => setRegTouched((prev) => ({ ...prev, email: true }))}
                      placeholder="name@smartlib.edu"
                      className={`w-full px-3.5 py-2 text-sm bg-[#1d1a15] text-[#eee2ca] placeholder:text-[#c5b79e]/45 border rounded-sm focus:outline-none ${
                        (regTouched.email || regSubmitAttempted) && regErrors.email
                          ? 'border-[#e5988b]'
                          : 'border-[#3a382b] focus:border-[#c3a47b]'
                      }`}
                    />
                    {(regTouched.email || regSubmitAttempted) && regErrors.email && (
                      <p role="alert" className="mt-1 text-xs text-[#e5988b]">{regErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="reg-password" className="block text-xs font-semibold text-[#eee2ca] mb-1">
                      Password (minimum 8 characters)
                    </label>
                    <div className="relative">
                      <input
                        ref={regPasswordRef}
                        id="reg-password"
                        type={showPassword ? 'text' : 'password'}
                        aria-required="true"
                        aria-invalid={(regTouched.password || regSubmitAttempted) && Boolean(regErrors.password)}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (serverError) setServerError(null);
                        }}
                        onBlur={() => setRegTouched((prev) => ({ ...prev, password: true }))}
                        placeholder="Create a strong password"
                        className={`w-full pl-3.5 pr-10 py-2 text-sm bg-[#1d1a15] text-[#eee2ca] placeholder:text-[#c5b79e]/45 border rounded-sm focus:outline-none ${
                          (regTouched.password || regSubmitAttempted) && regErrors.password
                            ? 'border-[#e5988b]'
                            : 'border-[#3a382b] focus:border-[#c3a47b]'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#c5b79e] hover:text-[#eee2ca] cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {(regTouched.password || regSubmitAttempted) && regErrors.password && (
                      <p role="alert" className="mt-1 text-xs text-[#e5988b]">{regErrors.password}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-[#c3a47b] text-[#1d1a15] text-sm font-semibold rounded-sm hover:bg-[#dbc39c] disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{loading ? 'Creating Account...' : 'Create Student Account'}</span>
                  </button>
                </form>

                <div className="mt-5 text-center text-xs text-[#c5b79e]">
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      resetFormState();
                      onNavigate('login');
                    }}
                    className="font-semibold text-[#c3a47b] hover:underline cursor-pointer"
                  >
                    Sign in here
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
