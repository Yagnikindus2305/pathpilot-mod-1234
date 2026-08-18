import { createContext, Fragment, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowRight, BarChart3, BookOpen, BriefcaseBusiness, Check, CheckCircle2, ChevronDown, ChevronRight, Circle,
  Compass, Download, Eye, EyeOff, FileSearch, FileText, GraduationCap, KeyRound, LayoutDashboard, Linkedin, Lock, LogOut,
  Mail, Menu, MessageCircle, Moon, Pencil, Play, Plus, Shield, ShieldCheck, Sparkles, Sun, Target,
  TrendingUp, Trash2, Trophy, Upload, UserRound, X, Zap,
} from 'lucide-react';
import { AuthProvider, useAuth, logActivity } from '@/context/AuthContext';
import yagnikPhoto from '@/assets/founders/yagnik-chandira.jpeg';
import meetPhoto from '@/assets/founders/meet-mistry.jpeg';
import vidhiPhoto from '@/assets/founders/vidhi-ramani.jpeg';
import { PathpilotDataProvider, usePathpilotData } from '@/context/PathpilotDataContext';
import { supabase } from '@/lib/supabase';
import { analyzeResumeText, calculateJobRoles } from '@/lib/analysis';
import { DEFAULT_MILESTONES, ENTRY_LEVEL_ROLE, getMissingSkills, ROLE_SKILLS } from '@/lib/roleSkills';
import { buildJobSearchUrl, getApplications, recordApplication, updateApplicationStatus } from '@/lib/applications';
import { QUESTIONS, getTechnicalBank, getTechnicalDomain, type Question, type QuestionDifficulty } from '@/lib/questions';
import { canAccess, computeProgression, type ModuleId, type ProgressionState } from '@/lib/progression';
import { getCategoryForRole, getRoleByTitle, getRoleGrowthSkills, getRoleRequiredSkills, getRoleRoadmap, getRolesInCategory, getToolCheck } from '@/lib/pathpilot';
import { fetchRoadmap, fetchToolCheck, fetchCompanyMatch, fetchCombinedCompanyMatch, fetchLiveJobs, type CompanyMatch, type LiveJob, type ToolCheckItem, type GroupedOptions } from '@/lib/api';
import { useAIRole, isKnownRole, fetchAIRole } from '@/lib/aiRoleResolver';
import { fetchExperienceText } from '@/lib/experience';
import { isValidEmail, isValidPhone, EMAIL_HELP_TEXT, PHONE_HELP_TEXT, parsePhoneValue, formatPhoneValue, sanitizePhoneDigits, checkPasswordStrength, isStrongPassword, PASSWORD_HELP_TEXT } from '@/lib/validation';
import { COUNTRY_DIAL_CODES } from '@/lib/countries';
import { INDIAN_STATES, getCitiesForDistrict, getDistrictsForState } from '@/lib/india';
import { extractResumeText } from '@/lib/resumeText';
import { type ApplicationStatus, type AptitudeResult, type JobApplication, type Milestone, type Profile, type ResumeAnalysis, type ResumeComparison, type RoadmapSkill, type TargetJob, type WorkExperience } from '@/lib/types';

type Module = ModuleId;

// pathpilot-mod-1234: a scoped demo build of just Modules 1-4 (Auth &
// Profile, Resume Analysis, Skill Roadmap, Aptitude Test). Compare, the
// Growth Dashboard, and Admin are intentionally left out of this list — see
// App.tsx history in the main pathpilot-sgp repo for the full version.
const navItems: { id: Module; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'profile', label: 'Auth & Profile', icon: UserRound },
  { id: 'resume', label: 'Resume Analysis', icon: FileSearch },
  { id: 'roadmap', label: 'Skill Roadmap', icon: Target },
  { id: 'aptitude', label: 'Aptitude Test', icon: GraduationCap },
];

interface ProfileFormState {
  full_name: string;
  college: string;
  college_other: string;
  course: string;
  course_other: string;
  year: string;
  state: string;
  district: string;
  city: string;
  city_other: string;
  phone: string;
  target_role: string;
  role_other: string;
  target_roles: string[];
}

type Theme = 'light' | 'dark';
const THEME_STORAGE_KEY = 'pathpilot-theme';
const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | undefined>(undefined);

function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);
  const toggleTheme = useCallback(() => setTheme((t) => (t === 'light' ? 'dark' : 'light')), []);
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  return <button
    type="button"
    className={className ? `${className} theme-toggle` : 'theme-toggle'}
    onClick={toggleTheme}
    title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
  >
    {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
  </button>;
}

function PasswordInput({ value, onChange, placeholder, showStrength = false }: { value: string; onChange: (value: string) => void; placeholder?: string; showStrength?: boolean }) {
  const [visible, setVisible] = useState(false);
  const strength = showStrength ? checkPasswordStrength(value) : null;
  return <div className="password-field">
    <div className="password-input-wrap">
      <input required minLength={6} type={visible ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || 'At least 6 characters'} />
      <button type="button" className="password-toggle" tabIndex={-1} onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Hide password' : 'Show password'}>
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
    {showStrength && value && strength && <div className="password-strength">
      <div className={`strength-bar strength-${strength.score}`}><div style={{ width: `${(strength.score / 5) * 100}%` }} /></div>
      <span className={`strength-label strength-${strength.score}`}>{strength.label}</span>
      {strength.issues.length > 0 && <ul className="strength-issues">{strength.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
    </div>}
  </div>;
}

// Combined country-code + national-number entry. The stored value is always
// "+<dialcode> <digits>" (see formatPhoneValue) so it round-trips cleanly —
// a bare digit string (the format used before country selection existed) is
// parsed as an Indian number, so existing profiles keep working unchanged.
function PhoneInput({ value, onChange, required = false }: { value: string; onChange: (value: string) => void; required?: boolean }) {
  const parsed = parsePhoneValue(value);
  return <div className="phone-input-group">
    <select
      value={parsed.iso2}
      onChange={(e) => onChange(formatPhoneValue(e.target.value, parsed.digits))}
      aria-label="Country code"
    >
      {COUNTRY_DIAL_CODES.map((c) => <option key={c.iso2} value={c.iso2}>{c.name} (+{c.dialCode})</option>)}
    </select>
    <input
      required={required}
      type="tel"
      inputMode="numeric"
      value={parsed.digits}
      onChange={(e) => onChange(formatPhoneValue(parsed.iso2, sanitizePhoneDigits(e.target.value)))}
      placeholder={parsed.iso2 === 'IN' ? '9876543210' : 'Phone number'}
    />
  </div>;
}

// Icon mark: a gradient rounded-square with an ascending bar chart + trend
// line, echoing the growth/placement-tracking idea the app is built around.
function BrandMark({ size = 32 }: { size?: number }) {
  const gradId = useId();
  return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id={gradId} x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4d6bea" />
        <stop offset="1" stopColor="#1e2761" />
      </linearGradient>
    </defs>
    <rect width="40" height="40" rx="10" fill={`url(#${gradId})`} />
    <rect x="9" y="22" width="5" height="9" rx="1.5" fill="#aebcff" />
    <rect x="17" y="15" width="5" height="16" rx="1.5" fill="#fff" />
    <rect x="25" y="9" width="5" height="22" rx="1.5" fill="#fff" />
    <polyline points="11.5,19 19.5,13 27.5,7" stroke="#79e4b0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <circle cx="11.5" cy="19" r="2" fill="#aebcff" />
    <circle cx="27.5" cy="7" r="2.6" fill="#79e4b0" />
  </svg>;
}

function BrandLogo({ hero = false, light = false }: { hero?: boolean; light?: boolean }) {
  return <div className={['brand', light && 'brand-light', hero && 'brand-hero'].filter(Boolean).join(' ')}>
    <BrandMark size={hero ? 46 : 30} />
    <div>
      <span className="brand-word">path<span>pilot</span></span>
      {hero && <div className="brand-tagline">TRACK · GROW · GET PLACED</div>}
    </div>
  </div>;
}

function App() {
  return <ThemeProvider><AuthProvider><PathpilotDataProvider><AppRouter /></PathpilotDataProvider></AuthProvider></ThemeProvider>;
}

function AppRouter() {
  const { loading, user, profile, passwordRecovery } = useAuth();
  if (loading) return <LoadingScreen />;
  if (passwordRecovery) return <ResetPasswordScreen />;
  if (!user) return <AuthScreen />;
  if (profile && !profile.phone) return <PhoneGate />;
  return <Workspace />;
}

function ResetPasswordScreen() {
  const { updatePassword, clearPasswordRecovery, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isStrongPassword(password)) { setError(`Choose a stronger password. ${PASSWORD_HELP_TEXT}`); return; }
    setError(''); setBusy(true);
    const result = await updatePassword(password);
    if (result.error) setError(result.error);
    setBusy(false);
  }

  return <main className="auth-page">
    <section className="auth-visual">
      <BrandLogo hero light />
      <div className="visual-copy"><div className="eyebrow light"><span className="pulse-dot" /> ACCOUNT SECURITY</div><h1>Set a new<br /><em>password.</em></h1><p>Choose a fresh password to finish resetting access to your workspace.</p></div>
      <div className="orbit orbit-one" /><div className="orbit orbit-two" />
    </section>
    <section className="auth-form-wrap"><ThemeToggle className="auth-theme-toggle" /><div className="auth-form-box">
      <div className="mobile-brand"><BrandLogo /></div>
      <div className="auth-heading"><div className="eyebrow">RESET PASSWORD</div><h2>Choose a new password.</h2><p>This replaces your old password immediately.</p></div>
      <form onSubmit={submit} className="auth-form">
        <label>New password<PasswordInput value={password} onChange={setPassword} placeholder="At least 8 characters" showStrength /></label>
        {error && <div className="form-alert error"><X size={16} />{error}</div>}
        <button className="primary-btn full" disabled={busy}>{busy ? 'Saving…' : 'Update password'}<ArrowRight size={18} /></button>
      </form>
      <p className="switch-auth"><button onClick={() => { clearPasswordRecovery(); signOut(); }}>Cancel and sign in instead</button></p>
    </div></section>
  </main>;
}

function PhoneGate() {
  const { profile, updateProfile, signOut } = useAuth();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isValidPhone(phone)) { setError(`Enter a valid phone number. ${PHONE_HELP_TEXT}`); return; }
    setError(''); setBusy(true);
    const result = await updateProfile({ phone: phone.trim() });
    if (result.error) setError(result.error);
    setBusy(false);
  }

  return <main className="auth-page">
    <section className="auth-visual">
      <BrandLogo hero light />
      <div className="visual-copy"><div className="eyebrow light"><span className="pulse-dot" /> ONE LAST STEP</div><h1>Almost<br /><em>there.</em></h1><p>We use your phone number to keep your placement updates and milestones reachable.</p></div>
      <div className="orbit orbit-one" /><div className="orbit orbit-two" />
    </section>
    <section className="auth-form-wrap"><ThemeToggle className="auth-theme-toggle" /><div className="auth-form-box">
      <div className="mobile-brand"><BrandLogo /></div>
      <div className="auth-heading"><div className="eyebrow">{profile?.full_name ? `Welcome, ${profile.full_name.split(' ')[0]}.` : 'WELCOME'}</div><h2>Add your phone number.</h2><p>Required once, so your profile stays complete and verifiable.</p></div>
      <form onSubmit={submit} className="auth-form">
        <label>Phone number<PhoneInput required value={phone} onChange={setPhone} /></label>
        {error && <div className="form-alert error"><X size={16} />{error}</div>}
        <button className="primary-btn full" disabled={busy}>{busy ? 'Saving…' : 'Continue'}<ArrowRight size={18} /></button>
      </form>
      <p className="switch-auth"><button onClick={signOut}>Sign out instead</button></p>
    </div></section>
  </main>;
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span>{now.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })} · {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>;
}

const SUPPORT_EMAIL = 'pathpilot.net@gmail.com';

// Same modules the sidebar links to, so a click here follows the exact same
// unlock rules — reusing guardedNavigate means a locked module shows the
// "complete the previous step" banner instead of silently doing nothing.
// Every real module the sidebar links to, so a click here follows the exact
// same unlock rules — reusing guardedNavigate means a locked module shows the
// "complete the previous step" banner instead of silently doing nothing.
// Row-first order for a 3-column grid: [Auth&Profile, Roadmap, Aptitude] on
// row 1, [Resume, Compare, Dashboard] on row 2.
const FOOTER_PLATFORM_LINKS: { id: Module; label: string }[] = [
  { id: 'profile', label: 'Auth & Profile' },
  { id: 'resume', label: 'Resume Analysis' },
  { id: 'roadmap', label: 'Skill Roadmap' },
  { id: 'aptitude', label: 'Aptitude Test' },
];

function WorkspaceFooter({ progression, go }: { progression: ProgressionState; go: (module: Module) => void }) {
  return <footer className="app-footer workspace-footer">
    <div className="footer-top">
      <div className="footer-brand">
        <BrandLogo />
        <p>Turn potential into placement. A focused workspace to understand your skills, close the gap, and get interview-ready.</p>
      </div>
      <div className="footer-links">
        <span className="footer-links-label"><Compass size={13} /> Platform</span>
        <nav>
          {FOOTER_PLATFORM_LINKS.map((item) => {
            const access = canAccess(item.id, progression);
            return <button
              key={item.id}
              className={access.allowed ? 'footer-link' : 'footer-link locked'}
              title={!access.allowed ? access.reason : undefined}
              onClick={() => go(item.id)}
            >
              {item.label}{!access.allowed && <Lock size={10} />}
            </button>;
          })}
        </nav>
      </div>
      <div className="footer-links">
        <span className="footer-links-label"><MessageCircle size={13} /> Connect</span>
        <p className="footer-connect-copy">Have questions or feedback? We'd love to hear from you.</p>
        <a className="footer-link footer-email" href={`mailto:${SUPPORT_EMAIL}`}><Mail size={13} /> {SUPPORT_EMAIL}</a>
      </div>
    </div>
    <div className="footer-meta">
      <span>© {new Date().getFullYear()} PathPilot. All rights reserved.</span>
      <LiveClock />
    </div>
  </footer>;
}

function LoadingScreen() {
  return <div className="loading-screen"><div className="loader-mark"><Sparkles size={22} /></div><span>Loading your PathPilot</span></div>;
}

// Admin account is exempt from every recovery path (email-code sign-in,
// forgot-password) — one less way for someone who isn't the admin to try to
// get into it. If this password is ever lost, it has to be reset directly
// in the Supabase dashboard, not through the app.
const ADMIN_NO_RECOVERY_EMAIL = 'yagnikchandira.23.cse@iite.indusuni.ac.in';

function AuthScreen() {
  const { signIn, signUp, signInWithEmailOtp, verifyEmailOtp, verifyPasswordResetOtp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [authMethod, setAuthMethod] = useState<'password' | 'otp'>('password');
  const [forgotMode, setForgotMode] = useState(false);
  const [resetOtpSent, setResetOtpSent] = useState(false);
  const [resetOtpCode, setResetOtpCode] = useState('');
  const [email, setEmail] = useState('');
  const isNoRecoveryAccount = email.trim().toLowerCase() === ADMIN_NO_RECOVERY_EMAIL;
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(''); setNotice('');
    if (!isValidEmail(email)) {
      setError(EMAIL_HELP_TEXT);
      return;
    }
    if (mode === 'signup' && !isStrongPassword(password)) {
      setError(`Choose a stronger password. ${PASSWORD_HELP_TEXT}`);
      return;
    }
    if (mode === 'signup' && !isValidPhone(phone)) {
      setError(`Enter a valid phone number. ${PHONE_HELP_TEXT}`);
      return;
    }
    setBusy(true);
    const result = mode === 'signin' ? await signIn(email, password) : await signUp(email, password, name, phone.trim());
    if (result.error) setError(result.error);
    else if (mode === 'signup') {
      setNotice('Account created. You can now sign in and start building your career path.');
      setMode('signin');
    }
    setBusy(false);
  }

  async function sendResetOtp(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!isValidEmail(email)) { setError(EMAIL_HELP_TEXT); return; }
    if (isNoRecoveryAccount) { setError('Password recovery is disabled for this account.'); return; }
    setBusy(true);
    const result = await signInWithEmailOtp(email);
    setBusy(false);
    if (result.error) setError(result.error); else setResetOtpSent(true);
  }

  async function verifyResetOtp(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!resetOtpCode.trim()) { setError('Enter the code we sent you.'); return; }
    setBusy(true);
    const result = await verifyPasswordResetOtp(email, resetOtpCode.trim());
    setBusy(false);
    // On success, passwordRecovery flips true in AuthContext and AppRouter
    // swaps straight to ResetPasswordScreen — nothing else to do here.
    if (result.error) setError(result.error);
  }

  async function sendOtp(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!isValidEmail(email)) { setError(EMAIL_HELP_TEXT); return; }
    if (isNoRecoveryAccount) { setError('Email-code sign-in is disabled for this account.'); return; }
    setBusy(true);
    const result = await signInWithEmailOtp(email);
    setBusy(false);
    if (result.error) setError(result.error); else setOtpSent(true);
  }

  async function verifyOtpSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!otpCode.trim()) { setError('Enter the code we sent you.'); return; }
    setBusy(true);
    const result = await verifyEmailOtp(email, otpCode.trim());
    setBusy(false);
    if (result.error) setError(result.error);
  }

  return <main className="auth-page">
    <section className="auth-visual">
      <BrandLogo hero light />
      <div className="visual-copy"><div className="eyebrow light"><span className="pulse-dot" /> BUILT FOR YOUR NEXT MOVE</div><h1>Turn potential<br /><em>into placement.</em></h1><p>A focused workspace to understand your skills, sharpen your edge, and get closer to the role you want.</p></div>
      <div className="visual-stats"><div><strong>6</strong><span>career modules</span></div><div><strong>100%</strong><span>your pace</span></div><div><strong>∞</strong><span>possibilities</span></div></div>
      <div className="visual-about">
        <p>PathPilot brings resume analysis, skill-gap roadmaps, aptitude testing, and progress tracking into one guided placement-prep workspace — so you always know exactly what to work on next.</p>
        <div className="founders-row">
          <div className="founder-avatar"><div className="founder-photo"><img src={meetPhoto} alt="Meet Mistry" /></div><small>Meet Mistry</small><a className="founder-linkedin" href="https://www.linkedin.com/in/meet-mistry-4aa8b9284" target="_blank" rel="noreferrer"><Linkedin size={14} /> LinkedIn</a></div>
          <div className="founder-avatar"><div className="founder-photo"><img src={yagnikPhoto} alt="Yagnik Chandira" /></div><small>Yagnik Chandira</small><a className="founder-linkedin" href="https://www.linkedin.com/in/yagnik-chandira-a6b5aa2b2" target="_blank" rel="noreferrer"><Linkedin size={14} /> LinkedIn</a></div>
          <div className="founder-avatar"><div className="founder-photo"><img src={vidhiPhoto} alt="Vidhi Ramani" style={{ transform: 'scale(1.15)', objectPosition: 'center 15%' }} /></div><small>Vidhi Ramani</small><a className="founder-linkedin" href="https://www.linkedin.com/in/vidhi-ramani-6032052a7" target="_blank" rel="noreferrer"><Linkedin size={14} /> LinkedIn</a></div>
        </div>
      </div>
      <div className="orbit orbit-one" /><div className="orbit orbit-two" />
    </section>
    <section className="auth-form-wrap"><ThemeToggle className="auth-theme-toggle" /><div className="auth-form-box">
      <div className="mobile-brand"><BrandLogo /></div>
      {forgotMode ? <>
        <div className="auth-heading"><div className="eyebrow">RESET PASSWORD</div><h2>Forgot your password?</h2><p>{resetOtpSent ? `Enter the code we sent to ${email}.` : "Enter your email and we'll send you a code."}</p></div>
        {resetOtpSent ? <form onSubmit={verifyResetOtp} className="auth-form">
          <label>Verification code<input required value={resetOtpCode} onChange={(e) => setResetOtpCode(e.target.value)} placeholder="Enter the code" inputMode="numeric" /></label>
          {error && <div className="form-alert error"><X size={16} />{error}</div>}
          <button className="primary-btn full" disabled={busy}>{busy ? 'Verifying…' : 'Verify & continue'}<ArrowRight size={18} /></button>
          <p className="switch-auth"><button type="button" onClick={() => { setResetOtpSent(false); setResetOtpCode(''); setError(''); }}>Use a different email</button></p>
        </form> : <form onSubmit={sendResetOtp} className="auth-form">
          <label>Email address<input required type="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
          {error && <div className="form-alert error"><X size={16} />{error}</div>}
          <button className="primary-btn full" disabled={busy}>{busy ? 'Sending…' : 'Send code'}<ArrowRight size={18} /></button>
        </form>}
        <p className="switch-auth"><button onClick={() => { setForgotMode(false); setResetOtpSent(false); setResetOtpCode(''); setError(''); }}>Back to sign in</button></p>
      </> : <>
        <div className="auth-heading"><div className="eyebrow">YOUR CAREER, CLARIFIED</div><h2>{mode === 'signin' ? 'Welcome back.' : 'Start your journey.'}</h2><p>{mode === 'signin' ? 'Pick up right where you left off.' : 'Create your free workspace in under a minute.'}</p></div>
        {mode === 'signin' && !isNoRecoveryAccount && <div className="auth-method-tabs">
          <button type="button" className={authMethod === 'password' ? 'auth-method-tab active' : 'auth-method-tab'} onClick={() => { setAuthMethod('password'); setError(''); }}><Lock size={14} /> Password</button>
          <button type="button" className={authMethod === 'otp' ? 'auth-method-tab active' : 'auth-method-tab'} onClick={() => { setAuthMethod('otp'); setError(''); }}><KeyRound size={14} /> Email code</button>
        </div>}
        {mode === 'signin' && authMethod === 'otp' && !isNoRecoveryAccount ? (
          otpSent ? <form onSubmit={verifyOtpSubmit} className="auth-form">
            <label>Code sent to {email}<input required value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="Enter the code" inputMode="numeric" /></label>
            {error && <div className="form-alert error"><X size={16} />{error}</div>}
            <button className="primary-btn full" disabled={busy}>{busy ? 'Verifying…' : 'Verify & sign in'}<ArrowRight size={18} /></button>
            <p className="switch-auth"><button type="button" onClick={() => { setOtpSent(false); setOtpCode(''); setError(''); }}>Use a different email</button></p>
          </form> : <form onSubmit={sendOtp} className="auth-form">
            <label>Email address<input required type="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
            {error && <div className="form-alert error"><X size={16} />{error}</div>}
            <button className="primary-btn full" disabled={busy}>{busy ? 'Sending…' : 'Send code'}<ArrowRight size={18} /></button>
          </form>
        ) : <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && <label>Full name<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Aarav Sharma" /></label>}
          <label>Email address<input required type="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
          <label>Password<PasswordInput value={password} onChange={setPassword} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'} showStrength={mode === 'signup'} /></label>
          {mode === 'signin' && !isNoRecoveryAccount && <button type="button" className="forgot-link" onClick={() => { setForgotMode(true); setError(''); setNotice(''); }}>Forgot password?</button>}
          {mode === 'signup' && <label>Phone number<PhoneInput required value={phone} onChange={setPhone} /></label>}
          {error && <div className="form-alert error"><X size={16} />{error}</div>}
          {notice && <div className="form-alert success"><CheckCircle2 size={16} />{notice}</div>}
          <button className="primary-btn full" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Enter workspace' : 'Create account'}<ArrowRight size={18} /></button>
        </form>}
        <p className="switch-auth">{mode === 'signin' ? 'New to PathPilot?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setNotice(''); }}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></p>
      </>}
    </div></section>
  </main>;
}

function Workspace() {
  const { user, profile, signOut, updateProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  // pathpilot-mod-123: Admin isn't part of this scoped demo build, so this
  // always starts on Module 1 regardless of account type.
  const isAdmin = false;
  const [active, setActive] = useState<Module>('profile');
  const [mobileNav, setMobileNav] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [gateMsg, setGateMsg] = useState('');
  const displayName = profile?.full_name || 'Explorer';
  const [resume, setResume] = useState<ResumeAnalysis | null>(null);
  const [results, setResults] = useState<AptitudeResult[]>([]);
  const [roadmap, setRoadmap] = useState<RoadmapSkill[]>([]);
  const [comparisons, setComparisons] = useState<ResumeComparison[]>([]);
  const progression = useMemo(() => computeProgression(profile, resume, roadmap, results, comparisons), [profile, resume, roadmap, results, comparisons]);
  const refreshProgress = useCallback(async () => {
    if (!user) return;
    const [r, a, s, c] = await Promise.all([
      supabase.from('resume_analyses').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('aptitude_results').select('*').eq('user_id', user.id),
      supabase.from('roadmap_skills').select('*').eq('user_id', user.id),
      supabase.from('resume_comparisons').select('*').eq('user_id', user.id),
    ]);
    setResume(r.data as ResumeAnalysis | null);
    setResults((a.data || []) as AptitudeResult[]);
    setRoadmap((s.data || []) as RoadmapSkill[]);
    setComparisons((c.data || []) as ResumeComparison[]);
  }, [user]);
  useEffect(() => { refreshProgress(); }, [refreshProgress]);

  function guardedNavigate(module: Module) {
    const check = canAccess(module, progression);
    if (check.allowed) { setActive(module); setGateMsg(''); }
    else setGateMsg(check.reason || 'Complete the previous step first.');
  }

  return <div className="app-shell">
    <aside className={mobileNav ? 'sidebar open' : 'sidebar'}>
      <BrandLogo />
      <div className="sidebar-label">YOUR WORKSPACE</div>
      <nav>{navItems.filter((item) => isAdmin ? item.id === 'admin' : item.id !== 'admin').map((item) => { const Icon = item.icon; const access = canAccess(item.id, progression); return <button key={item.id} className={active === item.id ? 'nav-item active' : 'nav-item'} onClick={() => { guardedNavigate(item.id); setMobileNav(false); }}><Icon size={18} /><span>{item.label}</span>{!access.allowed ? <Lock size={13} className="nav-lock" /> : active === item.id && <ChevronRight size={15} className="nav-arrow" />}</button>; })}</nav>
      <div className="sidebar-bottom"><div className="tip-card"><div className="tip-icon"><Zap size={16} /></div><strong>Small steps, big shifts.</strong><p>Consistency beats intensity every time.</p></div><button className="profile-mini" onClick={() => setProfileOpen(true)}><span className="avatar">{displayName.charAt(0).toUpperCase()}</span><span className="profile-mini-text"><strong>{displayName}</strong><small>{profile?.target_role || 'Set your target role'}</small></span><Pencil size={14} /></button><ThemeToggle className="sidebar-theme-toggle" /><button className="signout" onClick={signOut}><LogOut size={15} /> Sign out</button></div>
    </aside>
    {mobileNav && <button className="nav-overlay" onClick={() => setMobileNav(false)} aria-label="Close menu" />}
    <main className="main-content"><header className="topbar"><button className="menu-btn" onClick={() => setMobileNav(true)}><Menu size={21} /></button><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{navItems.find((x) => x.id === active)?.label || 'Dashboard'}</strong></div><div className="topbar-actions"><span className="status-pill"><span className="status-dot" /> Workspace active</span><button className="top-avatar" onClick={() => setProfileOpen(true)}>{displayName.charAt(0).toUpperCase()}</button><button className="topbar-icon-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button><button className="topbar-icon-btn" onClick={signOut} title="Sign out"><LogOut size={16} /></button></div></header>{!isAdmin && <ModuleStepper active={active} progression={progression} go={guardedNavigate} />}<div className="page-wrap">{gateMsg && <div className="gate-banner"><Lock size={16} /> <span>{gateMsg}</span><button onClick={() => setGateMsg('')}><X size={15} /></button></div>}{active === 'dashboard' && <Dashboard go={guardedNavigate} />}{active === 'resume' && <ResumeAnalysisPage go={guardedNavigate} onProgress={refreshProgress} />}{active === 'roadmap' && <RoadmapPage go={guardedNavigate} onProgress={refreshProgress} />}{active === 'aptitude' && <AptitudePage go={guardedNavigate} onProgress={refreshProgress} />}{active === 'compare' && <ComparePage roadmap={roadmap} onProgress={refreshProgress} go={guardedNavigate} />}{active === 'profile' && <ProfilePage go={guardedNavigate} progression={progression} />}{active === 'admin' && <AdminPage />}</div>{!isAdmin && <WorkspaceFooter progression={progression} go={guardedNavigate} />}</main>
    {profileOpen && <ProfileModal profile={profile} onClose={() => setProfileOpen(false)} updateProfile={updateProfile} />}
  </div>;
}

const STEPPER_ITEMS: { id: Module; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'resume', label: 'Resume' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'aptitude', label: 'Aptitude' },
];

function ModuleStepper({ active, progression, go }: { active: Module; progression: ProgressionState; go: (module: Module) => void }) {
  const doneMap: Partial<Record<Module, boolean>> = { profile: progression.profile, resume: progression.resume, roadmap: progression.roadmap, aptitude: progression.aptitude, compare: progression.compare };
  return <div className="module-stepper">
    {STEPPER_ITEMS.map((item, i) => {
      const done = Boolean(doneMap[item.id]);
      const access = canAccess(item.id, progression);
      const prevDone = i > 0 && Boolean(doneMap[STEPPER_ITEMS[i - 1].id]);
      return <Fragment key={item.id}>
        {i > 0 && <div className={prevDone ? 'stepper-line done' : 'stepper-line'} />}
        <div className="stepper-node">
          <button
            className={['stepper-dot', done && 'done', active === item.id && 'active', !access.allowed && 'locked'].filter(Boolean).join(' ')}
            disabled={!access.allowed}
            title={!access.allowed ? access.reason : item.label}
            onClick={() => go(item.id)}
          >
            {done ? <Check size={16} /> : access.allowed ? i + 1 : <Lock size={12} />}
          </button>
          <span className={active === item.id ? 'active' : undefined}>{item.label}</span>
        </div>
      </Fragment>;
    })}
  </div>;
}

function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) { return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1></div>{children}</div>; }
function SectionTitle({ icon: Icon, title, action }: { icon: typeof Target; title: string; action?: React.ReactNode }) { return <div className="section-title"><div><Icon size={17} /><h3>{title}</h3></div>{action}</div>; }
function RadarChart({ data, size = 240 }: { data: { label: string; value: number }[]; size?: number }) {
  const center = size / 2;
  const radius = size / 2 - 42;
  const angleStep = (2 * Math.PI) / data.length;
  const pointAt = (i: number, r: number) => {
    const angle = -Math.PI / 2 + i * angleStep;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };
  const dataPoints = data.map((d, i) => pointAt(i, (Math.max(0, Math.min(100, d.value)) / 100) * radius));
  const dataPath = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="radar-chart">
    {[0.25, 0.5, 0.75, 1].map((r) => <polygon key={r} points={data.map((_, i) => { const p = pointAt(i, r * radius); return `${p.x},${p.y}`; }).join(' ')} className="radar-ring" />)}
    {data.map((_, i) => { const p = pointAt(i, radius); return <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} className="radar-axis" />; })}
    <polygon points={dataPath} className="radar-shape" />
    {data.map((d, i) => { const p = pointAt(i, radius + 24); return <text key={d.label} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" className="radar-label">{d.label}</text>; })}
  </svg>;
}

// A real line/area chart driven by actual resume-history data points —
// replaces the old "Skill growth over time" bar chart, which hardcoded five
// of its six bar heights regardless of the real user. Value labels aren't
// drawn on every point anymore (with a couple dozen resumes those collided
// into an unreadable mess) — click or tap a point to see exactly what it
// means: its value, date, and an optional detail string (e.g. the resume
// file name), shown in a small card below the chart.
function SkillGrowthChart({ points, height = 168 }: { points: { label: string; value: number; detail?: string }[]; height?: number }) {
  const gradId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  if (points.length === 0) {
    return <div className="empty-state growth-chart-empty">Analyze a resume to start tracking growth here.</div>;
  }
  const width = 560;
  const padTop = 20;
  const padBottom = 26;
  const padX = 12;
  const chartW = width - padX * 2;
  const chartH = height - padTop - padBottom;
  const max = Math.max(...points.map((p) => p.value), 1);
  const stepX = points.length > 1 ? chartW / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: points.length > 1 ? padX + i * stepX : width / 2,
    y: padTop + chartH - (p.value / max) * chartH,
    ...p,
  }));
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${padTop + chartH} L ${coords[0].x.toFixed(1)} ${padTop + chartH} Z`;
  // Thin the date labels under the axis to at most ~8, however many points
  // there are — a chart with two dozen resumes would otherwise print two
  // dozen overlapping dates.
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));
  const active = activeIndex != null ? coords[activeIndex] : null;
  return <div className="growth-chart-wrap">
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="growth-line-chart" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4d69db" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#4d69db" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke="#3b5bdb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => <g key={i}>
        {i % labelEvery === 0 && <text x={c.x} y={height - 6} textAnchor="middle" className="growth-chart-label">{c.label}</text>}
        <circle
          cx={c.x} cy={c.y} r={activeIndex === i ? 6 : 4}
          className={activeIndex === i ? 'growth-chart-dot active' : 'growth-chart-dot'}
          onClick={() => setActiveIndex(activeIndex === i ? null : i)}
          onMouseEnter={() => setActiveIndex(i)}
        />
      </g>)}
    </svg>
    <div className="growth-chart-tooltip">
      {active ? <><strong>{active.value} skill{active.value === 1 ? '' : 's'} detected</strong><span>{active.detail || active.label}</span></> : <span className="muted-label">Click a point on the line to see what it means.</span>}
    </div>
  </div>;
}

function ProgressRing({ score, size = 150 }: { score: number; size?: number }) { const radius = (size - 16) / 2; const circumference = 2 * Math.PI * radius; return <div className="progress-ring" style={{ width: size, height: size }}><svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}><circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} /><circle className="ring-value" cx={size / 2} cy={size / 2} r={radius} style={{ strokeDasharray: circumference, strokeDashoffset: circumference - (score / 100) * circumference }} /></svg><div className="ring-label"><strong>{score}</strong><span>/ 100</span></div></div>; }
function SkillTag({ children, green = false, red = false }: { children: React.ReactNode; green?: boolean; red?: boolean }) { return <span className={`skill-tag${green ? ' green' : ''}${red ? ' red' : ''}`}>{green && <Check size={12} />}{red && <X size={12} />}{children}</span>; }

// Company salary bands span a role's full range at that company — a "Dream
// (FAANG)" listing's ₹18-35 LPA is the company-wide band, not what your
// current match% would realistically land you. Tier communicates that: Mass
// recruiter/Tier-1 are near-term realistic targets, Dream tiers are stretch
// goals worth aiming for once you're actually interview-ready for them.
function tierClass(tier: string): string {
  const t = tier.toLowerCase();
  if (t.includes('dream')) return 'tier-dream';
  if (t.includes('tier-1')) return 'tier-1';
  if (t.includes('mid')) return 'tier-mid';
  return 'tier-mass';
}
function TierBadge({ tier }: { tier: string }) { return <span className={`tier-badge ${tierClass(tier)}`}>{tier}</span>; }

// Job-role seniority isn't tagged in the data — derived from the role's own
// average salary instead of a separate lookup, so it stays consistent as
// role data changes.
function roleTierFromSalary(avgLPA: number): { label: string; badgeClass: string } {
  if (avgLPA >= 15) return { label: 'Senior', badgeClass: 'tier-1' };
  if (avgLPA >= 6) return { label: 'Mid', badgeClass: 'tier-mid' };
  return { label: 'Entry', badgeClass: 'tier-mass' };
}
function matchLevel(pct: number): 'good' | 'fair' | 'low' {
  if (pct >= 60) return 'good';
  if (pct >= 30) return 'fair';
  return 'low';
}

function formatSalaryRange(min: number | null, max: number | null): string {
  if (!min && !max) return 'Salary not listed';
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  if (min && max) return `${fmt(min)}–${fmt(max)}`;
  return fmt((min || max) as number);
}

// Real, current postings via the Worker's Adzuna proxy — unlike every other
// "roles you can target" card in this app, this isn't bounded by a
// hand-authored dataset, so it's the answer to "thousands of jobs, not 40-50."
// Renders nothing at all if the feature isn't configured or returns no results,
// so an unset API key never shows a broken section on the dashboard.
function LiveJobsCard({ role, location, go }: { role?: string; location?: string; go: (module: Module) => void }) {
  const { user, session } = useAuth();
  const [jobs, setJobs] = useState<LiveJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [appliedKeys, setAppliedKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!role) { setJobs([]); setChecked(false); return; }
    let cancelled = false;
    setLoading(true);
    fetchLiveJobs(role, location).then((res) => { if (!cancelled) { setJobs(res); setChecked(true); } }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [role, location]);

  useEffect(() => { if (user) getApplications(user.id).then((apps) => setAppliedKeys(apps.map((a) => `${a.company}::${a.role}`))); }, [user]);

  async function apply(job: LiveJob) {
    if (!user) return;
    setAppliedKeys((prev) => Array.from(new Set([...prev, `${job.company}::${job.title}`])));
    await recordApplication(user.id, job.company, job.title, job.applyUrl || '#', user.email, session?.access_token);
    if (job.applyUrl) window.open(job.applyUrl, '_blank', 'noopener');
  }

  // Explains itself instead of silently vanishing — a missing target role or a
  // zero-result search used to just render nothing, which reads as "broken."
  if (!role) return <div className="content-card company-match-card">
    <SectionTitle icon={BriefcaseBusiness} title="Live job openings" />
    <div className="empty-state"><BriefcaseBusiness size={26} /><strong>Set a target role to see live openings matching you.</strong><button className="primary-btn" onClick={() => go('profile')}>Go to Profile <ArrowRight size={16} /></button></div>
  </div>;
  if (checked && !loading && jobs.length === 0) return <div className="content-card company-match-card">
    <SectionTitle icon={BriefcaseBusiness} title="Live job openings" />
    <div className="empty-state"><BriefcaseBusiness size={26} /><strong>No live listings found for "{role}"{location ? ` near ${location}` : ''} right now.</strong><p>Live postings change constantly — check back later, or broaden your target role.</p></div>
  </div>;
  if (!jobs.length) return null;
  return <div className="content-card company-match-card">
    <SectionTitle icon={BriefcaseBusiness} title="Live job openings" action={<span className="muted-label">Real postings, updated continuously</span>} />
    <p className="missing-intro">Sourced from live listings for "{role}"{location ? ` near ${location}` : ''} — apply directly, nothing here is a static list.</p>
    <div className="roles-list">
      {jobs.slice(0, 10).map((job) => { const applied = appliedKeys.includes(`${job.company}::${job.title}`); return <div className="role-row" key={job.id}>
        <div className="role-info"><strong>{job.title}</strong><div className="role-meta"><span>{job.company}</span>{job.location && <span>{job.location}</span>}</div></div>
        <div className="role-salary"><small>{formatSalaryRange(job.salaryMin, job.salaryMax)}</small></div>
        <button className={applied ? 'apply-btn applied' : 'apply-btn'} onClick={() => apply(job)}>{applied ? <><Check size={13} /> Applied</> : <>Apply <ArrowRight size={13} /></>}</button>
      </div>; })}
    </div>
  </div>;
}

const APTITUDE_CATEGORIES = ['Quantitative', 'Logical Reasoning', 'Verbal Ability', 'Technical MCQs'];

// Only the best attempt per category counts — retaking a weak category
// shouldn't drag the score down, and a category is only as good as your best
// shot at it, not the average of every attempt.
function bestAttemptPct(results: AptitudeResult[], category: string): number {
  const catResults = results.filter((r) => r.category === category);
  if (!catResults.length) return 0;
  return Math.max(...catResults.map((r) => Math.round((r.score / Math.max(r.total, 1)) * 100)));
}
const APPLICATION_STATUSES: ApplicationStatus[] = ['Applied', 'Interviewing', 'Offer', 'Rejected'];

function ApplicationsCard({ applications, onStatusChange }: { applications: JobApplication[]; onStatusChange: (id: string, status: ApplicationStatus) => void }) {
  return <div className="content-card">
    <SectionTitle icon={BriefcaseBusiness} title="My Applications" action={<span className="muted-label">{Math.min(applications.length, 10)}/10 tracked</span>} />
    {applications.length === 0 ? <div className="empty-state"><BriefcaseBusiness size={26} /><strong>No applications yet.</strong><p>Click Apply on a matched role in Resume Analysis to start tracking.</p></div> : <div className="applications-list">
      {applications.map((app) => <div className="application-row" key={app.id}>
        <div className="application-info"><strong>{app.role}</strong><span>{app.company}</span></div>
        <select value={app.status} onChange={(e) => onStatusChange(app.id, e.target.value as ApplicationStatus)} className={`status-select status-${app.status.toLowerCase()}`}>
          {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {app.link && <a href={app.link} target="_blank" rel="noreferrer" className="watch-link">View <ArrowRight size={12} /></a>}
      </div>)}
    </div>}
  </div>;
}

function Dashboard({ go }: { go: (module: Module) => void }) {
  const { user, profile } = useAuth();
  const [resume, setResume] = useState<ResumeAnalysis | null>(null); const [results, setResults] = useState<AptitudeResult[]>([]); const [roadmap, setRoadmap] = useState<RoadmapSkill[]>([]); const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [resumeHistory, setResumeHistory] = useState<ResumeAnalysis[]>([]);
  const loadApplications = useCallback(() => { if (user) getApplications(user.id).then(setApplications); }, [user]);
  useEffect(() => { if (!user) return; Promise.all([supabase.from('resume_analyses').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(), supabase.from('aptitude_results').select('*').eq('user_id', user.id), supabase.from('roadmap_skills').select('*').eq('user_id', user.id), supabase.from('milestones').select('*').eq('user_id', user.id), supabase.from('resume_analyses').select('id, file_name, ats_score, skills, created_at').eq('user_id', user.id).order('created_at', { ascending: true })]).then(([r, a, s, m, h]) => { setResume(r.data as ResumeAnalysis | null); setResults((a.data || []) as AptitudeResult[]); setRoadmap((s.data || []) as RoadmapSkill[]); setMilestones((m.data || []) as Milestone[]); setResumeHistory((h.data || []) as ResumeAnalysis[]); }); }, [user]);
  useEffect(() => { loadApplications(); }, [loadApplications]);
  const attemptedCategories = Array.from(new Set(results.map((r) => r.category)));
  const avg = attemptedCategories.length ? Math.round(attemptedCategories.reduce((sum, cat) => sum + bestAttemptPct(results, cat), 0) / attemptedCategories.length) : 0;
  const gainedSkillNames = roadmap.filter((x) => x.done).map((x) => x.skill_name);
  const skillsGained = gainedSkillNames.length;
  // Real data point per resume analysis — skills detected at that point in
  // time — instead of the old chart's five hardcoded bar heights that never
  // reflected anything about the actual account.
  const growthPoints = resumeHistory.map((r) => ({ label: new Date(r.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), value: r.skills.length, detail: `${r.file_name} · ${new Date(r.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}` }));
  const roadmapDone = roadmap.length > 0 && roadmap.every((x) => x.done);
  const aptitudePassed = results.some((r) => r.score / Math.max(r.total, 1) >= .7);
  const appliedCount = applications.length;
  const profileComplete = Boolean(profile?.full_name && profile?.college && profile?.target_role);
  const displayMilestones = milestones.length ? milestones : DEFAULT_MILESTONES.map((x) => ({ ...x, id: x.key, completed: false }));
  const isMilestoneDone = (m: Milestone) => m.completed || (m.key === 'complete_profile' && profileComplete) || (m.key === 'analyze_resume' && Boolean(resume)) || (m.key === 'complete_roadmap' && roadmapDone) || (m.key === 'aptitude_70' && aptitudePassed) || (m.key === 'apply_10' && appliedCount >= 10);
  const completedCount = displayMilestones.filter(isMilestoneDone).length;
  async function handleStatusChange(id: string, status: ApplicationStatus) {
    setApplications((prev) => prev.map((a) => a.id === id ? { ...a, status } : a));
    await updateApplicationStatus(id, status);
  }
  const radarData = APTITUDE_CATEGORIES.map((cat) => ({ label: cat, value: bestAttemptPct(results, cat) }));
  const untestedCategories = APTITUDE_CATEGORIES.filter((cat) => !results.some((r) => r.category === cat));
  const hasRoadmap = roadmap.length > 0;
  const skillsRemaining = roadmap.filter((x) => !x.done).length;
  const readyForNextRound = !hasRoadmap || roadmapDone;
  // Once every current roadmap skill is checked off, the loop should push the user
  // back to resume analysis instead of a dead-end roadmap page — that's how newly
  // missing skills (and a tougher round) get surfaced.
  const nextModule: Module = readyForNextRound ? 'resume' : 'roadmap';
  const nextLabel = readyForNextRound ? 'Grow further' : 'Continue building';
  const nextHeadline = readyForNextRound ? 'Your path is taking shape.' : `${skillsRemaining} skill video${skillsRemaining === 1 ? '' : 's'} left to close the gap.`;
  const nextSubCopy = readyForNextRound ? 'Re-analyze your resume to surface new missing skills and start a tougher round.' : 'Every skill you build is a step closer to the role you want.';
  return <><PageHeader eyebrow="YOUR MOMENTUM" title={`Good to see you, ${profile?.full_name?.split(' ')[0] || 'Explorer'}.`}><button className="secondary-btn" onClick={() => go('profile')}><UserRound size={16} /> Edit profile</button></PageHeader><div className="welcome-strip"><div className="welcome-icon"><Sparkles size={21} /></div><div><strong>{nextHeadline}</strong><p>{nextSubCopy}</p></div><button onClick={() => go(nextModule)}>{nextLabel} <ArrowRight size={16} /></button></div><div className="metric-grid"><MetricCard label="Resume score" value={resume ? `${resume.ats_score}` : '—'} suffix={resume ? '/100' : ''} icon={FileSearch} color="blue" onClick={() => go('resume')} /><MetricCard label="Skills gained" value={String(skillsGained)} suffix="" icon={TrendingUp} color="green" onClick={() => go('roadmap')} /></div><SalaryCard profile={profile} resume={resume} roadmap={roadmap} roadmapDone={roadmapDone} aptitudePassed={aptitudePassed} /><ApplicationsCard applications={applications} onStatusChange={handleStatusChange} /><LiveJobsCard role={profile?.target_role} location={profile?.city || profile?.state} go={go} /><div className="dashboard-grid"><div className="content-card growth-card"><SectionTitle icon={BarChart3} title="Skill growth over time" action={<span className="muted-label">Skills detected per resume analysis</span>} /><SkillGrowthChart points={growthPoints} /><div className="chart-legend"><span><i className="legend-blue" /> Skills covered</span><strong>{skillsGained} skills this journey</strong></div>{gainedSkillNames.length > 0 && <div className="tag-cloud growth-skills-list">{gainedSkillNames.map((name) => <SkillTag green key={name}>{name}</SkillTag>)}</div>}</div><div className="content-card milestone-card"><SectionTitle icon={Target} title="Milestones" /><div className="milestone-list">{displayMilestones.map((m) => { const done = isMilestoneDone(m); const statusText = done ? 'Completed' : m.key === 'apply_10' ? `In progress (${Math.min(appliedCount, 10)}/10)` : 'In progress'; return <div className={done ? 'milestone-row completed' : 'milestone-row'} key={m.id}><div className="milestone-dot" /><div><strong>{m.label}</strong><p>{statusText}</p></div></div>; })}</div><div className="milestone-footer"><strong>{completedCount}/{displayMilestones.length} complete</strong><span>Keep building with focus.</span></div></div></div></>;
}

function SalaryCard({ profile, resume, roadmap, roadmapDone, aptitudePassed }: { profile: Profile | null; resume: ResumeAnalysis | null; roadmap: RoadmapSkill[]; roadmapDone: boolean; aptitudePassed: boolean }) {
  const entry = ROLE_SKILLS[ENTRY_LEVEL_ROLE].salaryLPA;
  const beforeAvg = Math.round((entry.min + entry.max) / 2 * 10) / 10;
  // Rich role dataset (47 roles, incl. specialist tracks) is checked next since
  // ROLE_SKILLS only curates ~35 — and if a target role picked via "Other" free
  // text matches neither, the AI-inferred salary (see aiRoleResolver.ts) fills
  // the gap instead of silently showing nothing.
  const { data: aiRole } = useAIRole(profile?.target_role);
  const targetSalary = profile?.target_role ? getRoleByTitle(profile.target_role)?.salaryLPA || ROLE_SKILLS[profile.target_role]?.salaryLPA || aiRole?.salaryLPA : undefined;
  const bestMatch = resume?.job_roles?.[0];
  const qualified = roadmapDone && aptitudePassed && Boolean(targetSalary);

  // Roles the user would qualify for once every roadmap skill is checked off —
  // union of skills already detected on the resume and the skills the roadmap
  // is tracking, run back through the same role-matching used in Module 2.
  const futureSkills = useMemo(() => {
    const combined = new Set([...(resume?.skills || []), ...roadmap.map((r) => r.skill_name)]);
    return Array.from(combined);
  }, [resume, roadmap]);
  const futureJobRoles = useMemo(() => calculateJobRoles(futureSkills), [futureSkills]);
  // The forced entry-level fallback (always present, floored at 40% match) shouldn't
  // outrank a real specialist match, so prefer the best non-entry role when one exists —
  // this is what keeps the "after" range in step with the same min-max shown in Resume
  // Analysis / Compare instead of collapsing to the generic ₹1-2 LPA entry band.
  const bestFutureRole = futureJobRoles.find((r) => r.role !== ENTRY_LEVEL_ROLE) || futureJobRoles[0];
  const topFutureMatch = bestFutureRole?.match ?? 0;

  const after = qualified && targetSalary
    ? targetSalary
    : bestFutureRole
      ? { min: bestFutureRole.salary_min, max: bestFutureRole.salary_max }
      : bestMatch
        ? { min: bestMatch.salary_min, max: bestMatch.salary_max }
        : entry;
  const afterAvg = Math.round((after.min + after.max) / 2 * 10) / 10;
  const hikePct = beforeAvg ? Math.max(0, Math.round(((afterAvg - beforeAvg) / beforeAvg) * 100)) : 0;
  const maxScale = Math.max(entry.max, after.max, 12);

  return <>
    <div className="content-card salary-compare-card">
      <SectionTitle icon={TrendingUp} title="Salary Comparison" />
      <div className="salary-compare-grid">
        <div className="salary-compare-box before">
          <span className="muted-label">BEFORE ROADMAP</span>
          <strong className="big">₹{beforeAvg}<small>LPA</small></strong>
          <p>Current / fresher package</p>
          <div className="salary-compare-rows">
            <div><span>Fresher average (India)</span><strong>₹{entry.min}–{entry.max} LPA</strong></div>
            <div><span>Without skill gap filled</span><strong>₹{beforeAvg} LPA</strong></div>
            <div><span>Matching roles</span><strong>{bestMatch ? `~${bestMatch.match}%` : '—'}</strong></div>
          </div>
        </div>
        <div className="salary-compare-box after">
          <span className="muted-label">AFTER ROADMAP</span>
          <strong className="big">₹{after.min}–{after.max}<small>LPA</small></strong>
          <p>Expected post-roadmap package</p>
          <div className="salary-compare-rows">
            <div><span>{profile?.target_role || 'Target role'} avg</span><strong>₹{afterAvg} LPA</strong></div>
            <div><span>With all skills completed</span><strong>up to ₹{after.max} LPA</strong></div>
            <div><span>Matching roles boost</span><strong>~{topFutureMatch}%</strong></div>
          </div>
        </div>
      </div>
      <div className="salary-hike-banner">
        <div className="hike-icon"><TrendingUp size={18} /></div>
        <div><strong>Potential Salary Hike</strong><p>From ₹{beforeAvg} LPA → ₹{after.min}–{after.max} LPA after completing your roadmap</p></div>
        <div className="hike-value"><strong>+{hikePct}%</strong><span>average hike estimate</span></div>
      </div>
    </div>

    <div className="content-card">
      <SectionTitle icon={BarChart3} title="Package Range Visualised" />
      <div className="range-bars">
        <div className="range-bar-row"><div><span>Before Roadmap</span><strong>₹{entry.min}–{entry.max} LPA</strong></div><div className="range-track"><div className="range-fill before" style={{ width: `${(entry.max / maxScale) * 100}%` }} /></div></div>
        <div className="range-bar-row"><div><span>After Roadmap (Min)</span><strong>₹{after.min} LPA</strong></div><div className="range-track"><div className="range-fill after-min" style={{ width: `${(after.min / maxScale) * 100}%` }} /></div></div>
        <div className="range-bar-row"><div><span>After Roadmap (Max)</span><strong>₹{after.max} LPA</strong></div><div className="range-track"><div className="range-fill after-max" style={{ width: `${(after.max / maxScale) * 100}%` }} /></div></div>
      </div>
      <div className="range-axis"><span>₹0L</span><span>₹3L</span><span>₹6L</span><span>₹9L</span><span>₹{Math.round(maxScale)}L</span></div>
    </div>

    {futureJobRoles.length > 0 && <div className="content-card">
      <SectionTitle icon={BriefcaseBusiness} title="Jobs you can target after your roadmap" action={<span className="muted-label">Projected from resume + roadmap skills</span>} />
      <div className="roles-list">
        {futureJobRoles.slice(0, 5).map((role) => <div className="role-row" key={role.role}>
          <div className="role-rank">{role.match}%</div>
          <div className="role-info"><strong>{role.role}</strong></div>
          <div className="match-track"><div style={{ width: `${role.match}%` }} /></div>
          <div className="role-salary"><small>₹{role.salary_min}–{role.salary_max} LPA</small><strong>₹{role.salary_avg} LPA avg.</strong></div>
        </div>)}
      </div>
    </div>}
  </>;
}

function MetricCard({ label, value, suffix, icon: Icon, color, onClick }: { label: string; value: string; suffix: string; icon: typeof Target; color: string; onClick: () => void }) { return <button className="metric-card" onClick={onClick}><div className={`metric-icon ${color}`}><Icon size={19} /></div><div className="metric-label">{label}</div><div className="metric-value">{value}<small>{suffix}</small></div><ChevronRight className="metric-chevron" size={17} /></button>; }

// roadmap_skills has no target-role column — it's one flat list per user, so
// switching target role (or re-analyzing under a new one) leaves the old role's
// unfinished skills sitting in the table forever, permanently failing
// "roadmap complete" even though the current role's roadmap shows 100%.
// Drop anything that isn't part of the current role's skill set to keep it scoped.
async function pruneStaleRoadmapSkills(userId: string, requiredSkills: string[]) {
  const required = requiredSkills;
  if (!required.length) return;
  const keep = new Set(required.map((s) => s.toLowerCase()));
  const { data } = await supabase.from('roadmap_skills').select('skill_name').eq('user_id', userId);
  const stale = (data || []).map((r) => r.skill_name as string).filter((name) => !keep.has(name.toLowerCase()));
  if (stale.length) await supabase.from('roadmap_skills').delete().eq('user_id', userId).in('skill_name', stale);
}

// Regenerates the whole roadmap from a fresh skill set — used after both a
// new resume analysis AND a resume comparison, so the roadmap always
// reflects the most recently uploaded resume rather than going stale after
// Compare (which previously never touched roadmap_skills at all).
async function syncRoadmap(skills: string[], role: string, userId: string) {
  // A new resume means skills need to be re-verified against what THIS
  // resume shows — carrying old done-checkmarks forward would leave
  // Aptitude/Compare unlocked on stale progress. Reset first, so the
  // roadmap (and everything gated behind it) has to be earned again.
  await supabase.from('roadmap_skills').delete().eq('user_id', userId);
  const roadmapItems = isKnownRole(role)
    ? await fetchRoadmap(role, skills).then((res) => res.roadmap).catch(() => getRoleRoadmap(role, skills))
    : (await fetchAIRole(role))?.roadmap || getRoleRoadmap(role, skills);
  const rows = roadmapItems.map((item) => ({ user_id: userId, skill_name: item.skill, priority: item.priority || 'Must Have' }));
  if (rows.length) {
    const { error } = await supabase.from('roadmap_skills').upsert(rows, { onConflict: 'user_id,skill_name' });
    if (error) console.error('Failed to sync roadmap skills:', error.message);
  }
}

function ResumeAnalysisPage({ go, onProgress }: { go: (module: Module) => void; onProgress?: () => void }) {
  const { user, profile, updateProfile, session } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<ResumeAnalysis[]>([]);
  useEffect(() => { if (user) supabase.from('resume_analyses').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).then(({ data }) => setHistory((data || []) as ResumeAnalysis[])); }, [user]);

  async function analyze() {
    if (!file || !user) return;
    setBusy(true); setError('');
    const [{ text, extracted }, experienceText] = await Promise.all([extractResumeText(file), fetchExperienceText(user.id)]);
    if (!extracted) setError('We could not extract text from that file, so this score reflects no readable content. Try a text-based PDF, DOCX, or TXT file (not a scanned image) for a real scan.');
    const combinedText = [extracted ? text : '', experienceText].filter(Boolean).join('\n\n');
    const result = analyzeResumeText(combinedText, profile?.target_role, history.length + 1);
    // Keeps the actual file, not just its extracted text — so the admin
    // panel (and the student themselves) can open the original resume, not
    // just see the parsed skill list. Best-effort: a storage hiccup
    // shouldn't block the analysis itself, so file_path just stays null.
    const storagePath = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: uploadError } = await supabase.storage.from('resumes').upload(storagePath, file);
    const filePath = uploadError ? null : storagePath;
    const { data, error: saveError } = await supabase.from('resume_analyses').insert({ user_id: user.id, file_name: file.name, ats_score: result.atsScore, skills: result.skills, job_roles: result.jobRoles, raw_text: combinedText, file_path: filePath }).select('*').maybeSingle();
    if (saveError) setError(saveError.message);
    else if (data) {
      const saved = data as ResumeAnalysis;
      setAnalysis(saved);
      setHistory((prev) => [saved, ...prev]);
      await updateProfile({ saved_skills: result.skills });
      await syncRoadmap(result.skills, profile?.target_role || 'Full Stack Developer', user.id);
      if (user.email) await logActivity(user.email, 'resume_analyzed', session?.access_token);
      onProgress?.();
    }
    setBusy(false);
  }

  function roundOf(id: string) {
    const idx = history.findIndex((h) => h.id === id);
    return idx === -1 ? 1 : history.length - idx;
  }

  return <><PageHeader eyebrow="MODULE 02 / RESUME INTELLIGENCE" title="Know your starting point."><div className="header-note"><span className="status-dot" /> Demo analysis available</div></PageHeader><div className="module-intro"><p>Upload your resume and get a clear view of your ATS readiness, strongest skills, and the roles that fit you best.</p></div>{!analysis ? <div className="upload-card"><div className="upload-icon"><Upload size={23} /></div><h2>Drop your resume here</h2><p>PDF or DOCX · Maximum 5 MB</p><label className="file-btn">Choose file<input type="file" accept=".pdf,.docx,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>{file && <div className="selected-file"><FileText size={16} /><span>{file.name}</span><button onClick={() => setFile(null)}><X size={15} /></button></div>}{error && <div className="form-alert error inline">{error}</div>}<button className="primary-btn analyze-btn" disabled={!file || busy} onClick={analyze}>{busy ? 'Reading your resume…' : 'Analyze resume'}<Sparkles size={17} /></button><small className="privacy-note"><ShieldCheck size={13} /> Your resume stays private to your workspace</small></div> : <ResumeResult analysis={analysis} round={roundOf(analysis.id)} onReset={() => setAnalysis(null)} go={go} />}{history.length > 1 && <div className="history-section"><SectionTitle icon={FileText} title="Past analyses" /><div className="history-list">{history.slice(1).map((item) => <button key={item.id} className="history-row" onClick={() => setAnalysis(item)}><FileText size={17} /><span>{item.file_name}</span><small>{new Date(item.created_at).toLocaleDateString()}</small><strong>{item.ats_score}/100</strong><ChevronRight size={15} /></button>)}</div></div>}</>;
}

function ResumeResult({ analysis, round, onReset, go }: { analysis: ResumeAnalysis; round: number; onReset: () => void; go: (module: Module) => void }) {
  const { user, profile, updateProfile, session } = useAuth();
  const targetRole = profile?.target_role || analysis.job_roles[0]?.role || 'Full Stack Developer';
  // For a role typed via "Other" that isn't in our curated datasets, the AI
  // lookup (aiRoleResolver.ts) supplies real skills instead of silently
  // falling back to Full Stack Developer's generic ones.
  const { data: aiRole } = useAIRole(targetRole);
  const missing = useMemo(() => {
    if (aiRole) {
      const has = (s: string) => analysis.skills.some((d) => d.toLowerCase() === s.toLowerCase());
      return aiRole.roadmap.filter((item) => !has(item.skill)).map((item) => ({ skill: item.skill, priority: item.priority, link: item.video }));
    }
    return getMissingSkills(analysis.skills, targetRole);
  }, [analysis.skills, targetRole, aiRole]);
  // Once a target role is set, "roles that fit" should stay in that lane —
  // unfiltered, it ranks across all 40 roles by raw skill overlap, which can
  // surface something like Game Developer for someone targeting Cybersecurity
  // Analyst just because a couple of generic skills happen to overlap.
  const relevantJobRoles = useMemo(() => {
    if (!profile?.target_role) return analysis.job_roles;
    const category = getCategoryForRole(profile.target_role);
    if (!category) return analysis.job_roles;
    const filtered = analysis.job_roles.filter((r) => getCategoryForRole(r.role) === category);
    return filtered.length >= 3 ? filtered : analysis.job_roles;
  }, [analysis.job_roles, profile?.target_role]);
  const [toolCoverage, setToolCoverage] = useState<ToolCheckItem[]>([]);
  const [companyMatches, setCompanyMatches] = useState<CompanyMatch[]>([]);
  const [appliedKeys, setAppliedKeys] = useState<string[]>([]);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [showAllRoles, setShowAllRoles] = useState(false);

  useEffect(() => { if (user) getApplications(user.id).then((apps) => setAppliedKeys(apps.map((a) => `${a.company}::${a.role}`))); }, [user]);

  async function apply(company: string, role: string) {
    if (!user) return;
    const link = buildJobSearchUrl(company, role);
    setAppliedKeys((prev) => Array.from(new Set([...prev, `${company}::${role}`])));
    await recordApplication(user.id, company, role, link, user.email, session?.access_token);
    window.open(link, '_blank', 'noopener');
  }

  useEffect(() => {
    const resumeText = analysis.raw_text || analysis.file_name;
    fetchToolCheck(targetRole, resumeText)
      .then((res) => setToolCoverage(res.tools))
      .catch(() => setToolCoverage(getToolCheck(targetRole, resumeText)));
  }, [targetRole, analysis.raw_text, analysis.file_name]);

  useEffect(() => {
    let cancelled = false;
    fetchCombinedCompanyMatch(analysis.skills, [targetRole, ...(profile?.target_roles || [])])
      .then((res) => { if (!cancelled) setCompanyMatches(res.companies); })
      .catch(() => { if (!cancelled) setCompanyMatches([]); });
    return () => { cancelled = true; };
  }, [analysis.skills, targetRole, profile?.target_roles]);

  // Companies hire under their own job titles (e.g. "Security Engineer"),
  // which rarely match our 40-role curated catalog names 1:1 (e.g.
  // "Cybersecurity Analyst") — so instead of forcing them under a
  // Matched-Job-Role card by exact name (which would silently match almost
  // nothing), every company posting in the same domain is grouped into one
  // unified card per its own role title, shown right alongside Matched Job
  // Roles rather than as scattered, disconnected single-company rows.
  const roleGroupedCompanies = useMemo(() => {
    const map = new Map<string, CompanyMatch[]>();
    for (const c of companyMatches) {
      const key = c.bestMatch.role;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => Math.max(...b[1].map((c) => c.bestMatch.matchPct)) - Math.max(...a[1].map((c) => c.bestMatch.matchPct)));
  }, [companyMatches]);

  function renderHiringRow(c: CompanyMatch) {
    const applied = appliedKeys.includes(`${c.company}::${c.bestMatch.role}`);
    const canApply = c.bestMatch.missing.length === 0;
    const rowKey = `${c.company}::${c.bestMatch.role}`;
    const expanded = expandedCompany === rowKey;
    return <div className="hiring-row" key={rowKey}>
      <div className="hiring-row-top"><strong>{c.company}</strong><TierBadge tier={c.tier} /><span className="matched-role-pct-mini">{c.bestMatch.matchPct}%</span></div>
      <div className="hiring-row-meta"><span>{c.salaryBand}</span></div>
      <div className="hiring-row-foot">
        {canApply ? <button className={applied ? 'apply-btn applied' : 'apply-btn'} onClick={() => apply(c.company, c.bestMatch.role)}>{applied ? <><Check size={13} /> Applied</> : <>Apply <ArrowRight size={13} /></>}</button> :
          <button type="button" className={expanded ? 'role-skill-missing-btn open' : 'role-skill-missing-btn'} onClick={() => setExpandedCompany(expanded ? null : rowKey)}>
            Finish {c.bestMatch.missing.length} skill{c.bestMatch.missing.length === 1 ? '' : 's'} <ChevronDown size={11} />
          </button>}
      </div>
      {expanded && c.bestMatch.missing.length > 0 && <div className="role-skill-detail nested">
        <div className="tag-cloud">{c.bestMatch.missing.map((skill) => <SkillTag red key={skill}>{skill}</SkillTag>)}</div>
        <p className="role-skill-detail-note">Complete these on your <button type="button" className="text-link" onClick={() => go('roadmap')}>Skill Roadmap</button>, then come back here to apply.</p>
      </div>}
    </div>;
  }

  // Condensed card for every role beyond the top 6 full cards above — same
  // tier/match%/missing-skills scan pattern as the company hiring rows, so
  // the full role catalog stays reachable without a wall of large cards.
  function renderRoleRow(role: (typeof relevantJobRoles)[number]) {
    const req = ROLE_SKILLS[role.role];
    const allReq = req ? [...req.must, ...req.nice, ...req.advanced] : [];
    const missingForRole = allReq.filter((skill) => !analysis.skills.includes(skill));
    const tier = roleTierFromSalary(role.salary_avg);
    const expanded = expandedRole === role.role;
    return <div className="hiring-row" key={role.role}>
      <div className="hiring-row-top"><strong>{role.role}</strong><span className={`tier-badge ${tier.badgeClass}`}>{tier.label}</span><span className="matched-role-pct-mini">{role.match}%</span></div>
      <div className="hiring-row-meta"><span>₹{role.salary_min}–{role.salary_max} LPA</span></div>
      <div className="hiring-row-foot">
        <button type="button" className={expanded ? 'role-skill-missing-btn open' : 'role-skill-missing-btn'} onClick={() => setExpandedRole(expanded ? null : role.role)}>
          {missingForRole.length} missing <ChevronDown size={11} />
        </button>
      </div>
      {expanded && <div className="role-skill-detail nested">
        <div className="tag-cloud">{missingForRole.length ? missingForRole.map((skill) => <SkillTag red key={skill}>{skill}</SkillTag>) : <span className="muted-label">You already have every skill for this role.</span>}</div>
        <button type="button" className="primary-btn full" onClick={async () => { await updateProfile({ target_role: role.role }); go('roadmap'); }}><Target size={15} /> Set as Target &amp; View Roadmap</button>
      </div>}
    </div>;
  }

  return <>
    <div className="result-top">
      <div>
        <div className="eyebrow success-text"><CheckCircle2 size={14} /> ANALYSIS COMPLETE{round > 1 ? ` · ROUND ${round}` : ''}</div>
        <h2>{analysis.file_name}</h2>
        <p>Your resume has a solid foundation. Here’s where you can focus next.</p>
      </div>
      <button className="secondary-btn" onClick={onReset}><Plus size={16} /> Analyze another</button>
    </div>

    <div className="result-grid">
      <div className="content-card score-card">
        <SectionTitle icon={Sparkles} title="ATS readiness score" />
        <div className="score-display">
          <ProgressRing score={analysis.ats_score} />
          <div className="score-copy">
            <strong>{analysis.ats_score >= 75 ? 'Strong foundation' : 'Room to grow'}</strong>
            <p>{analysis.ats_score >= 75 ? 'Your resume is positioned well for screening systems.' : 'A few focused improvements can make your resume more competitive.'}</p>
          </div>
        </div>
        <div className="score-breakdown">
          <div><span>Skills detected</span><strong>{analysis.skills.length}</strong></div>
          <div><span>Role matches</span><strong>{analysis.job_roles.length}</strong></div>
          <div><span>Missing skills</span><strong>{missing.length}</strong></div>
        </div>
        <button className="text-btn" onClick={() => go('roadmap')}>See your skill roadmap <ArrowRight size={15} /></button>
      </div>

      <div className="content-card skills-card">
        <SectionTitle icon={Zap} title="Detected skills" />
        <div className="tag-cloud">{analysis.skills.map((skill) => <SkillTag key={skill} green>{skill}</SkillTag>)}</div>
        <button className="text-btn" onClick={() => go('roadmap')}>See your skill gaps <ArrowRight size={15} /></button>
      </div>
    </div>

    <div className="content-card roles-card">
      <SectionTitle icon={Target} title="Matched Job Roles" action={<span className="muted-label">Based on your detected skills</span>} />
      <div className="matched-roles-grid">
        {relevantJobRoles.slice(0, 6).map((role) => {
          const req = ROLE_SKILLS[role.role];
          const allReq = req ? [...req.must, ...req.nice, ...req.advanced] : [];
          const owned = allReq.filter((skill) => analysis.skills.includes(skill));
          const missingForRole = allReq.filter((skill) => !analysis.skills.includes(skill));
          const tier = roleTierFromSalary(role.salary_avg);
          const level = matchLevel(role.match);
          return <div className="matched-role-card" key={role.role}>
            <div className="matched-role-head">
              <div><strong>{role.role}</strong><span className={`tier-badge ${tier.badgeClass}`}>{tier.label}</span></div>
              <div className={`matched-role-pct ${level}`}>{role.match}%<small>match</small></div>
            </div>
            <div className="matched-role-salary">₹{role.salary_min}–{role.salary_max} LPA</div>
            <div className={`match-track ${level}`}><div style={{ width: `${role.match}%` }} /></div>
            {owned.length > 0 && <div><span className="matched-role-skills-label">You have ({owned.length})</span><div className="tag-cloud">{owned.slice(0, 5).map((skill) => <SkillTag green key={skill}>{skill}</SkillTag>)}{owned.length > 5 && <span className="muted-label">+{owned.length - 5} more</span>}</div></div>}
            {missingForRole.length > 0 && <div><span className="matched-role-skills-label missing">Missing ({missingForRole.length})</span><div className="tag-cloud">{missingForRole.slice(0, 5).map((skill) => <SkillTag red key={skill}>{skill}</SkillTag>)}{missingForRole.length > 5 && <span className="muted-label">+{missingForRole.length - 5} more</span>}</div></div>}
            <button type="button" className="primary-btn full" onClick={async () => { await updateProfile({ target_role: role.role }); go('roadmap'); }}><Target size={15} /> Set as Target &amp; View Roadmap</button>
          </div>;
        })}
      </div>
      {relevantJobRoles.length > 6 && <div className="matched-roles-extra">
        <button type="button" className="text-link" onClick={() => setShowAllRoles(!showAllRoles)}>{showAllRoles ? 'Show fewer roles' : `Show all ${relevantJobRoles.length} matched roles`} <ChevronDown size={12} /></button>
        {showAllRoles && <div className="hiring-grid">{relevantJobRoles.slice(6).map(renderRoleRow)}</div>}
      </div>}
      <div className="roles-footer">
        <p>Set a role as your target to open its full roadmap with exact missing skills.</p>
      </div>
    </div>

    <div className="content-card tools-card">
      <SectionTitle icon={ShieldCheck} title="Tool coverage" action={<span className="muted-label">{targetRole}</span>} />
      <p className="missing-intro">Green means the tool appears in your resume text. Red means it is a strong skill to add next.</p>
      <div className="missing-skills-list">
        {toolCoverage.map((item) => <div className="missing-skill-row" key={item.tool}><div className="missing-skill-info"><strong>{item.tool}</strong><span className={item.present ? 'priority' : 'priority advanced'}>{item.present ? 'Present' : 'Missing'}</span></div>{item.present ? <span className="skill-tag green">Matched</span> : <span className="skill-tag">Add it</span>}</div>)}
      </div>
    </div>

    {roleGroupedCompanies.length > 0 && <div className="content-card company-match-card">
      <SectionTitle icon={BriefcaseBusiness} title="Companies you can target" action={<span className="muted-label">Grouped by role</span>} />
      <p className="missing-intro">Salary shown is that company's full range for the role, not a guaranteed offer at your match%. <TierBadge tier="Mass recruiter" /> / Tier-1 are realistic near-term targets — <TierBadge tier="Dream" /> tiers are stretch goals worth aiming for once you're truly interview-ready.</p>
      <div className="role-group-list">
        {roleGroupedCompanies.map(([roleName, companies]) => <div className="role-group" key={roleName}>
          <div className="role-group-head"><strong>{roleName}</strong><span className="muted-label">{companies.length} compan{companies.length === 1 ? 'y' : 'ies'} hiring</span></div>
          <div className="hiring-grid">{companies.map(renderHiringRow)}</div>
        </div>)}
      </div>
    </div>}
    <div className="next-banner"><div className="banner-icon"><Target size={20} /></div><div><strong>Know your gaps? Time to close them.</strong><p>Head to your skill roadmap to see exactly what to learn next, with a video for each skill.</p></div><button onClick={() => go('roadmap')}>Go to Skill Roadmap <ArrowRight size={16} /></button></div>
  </>;
}

function RoadmapPage({ go, onProgress }: { go: (module: Module) => void; onProgress?: () => void }) {
  const { user, profile } = useAuth();
  const [skills, setSkills] = useState<Array<RoadmapSkill & { video?: string }>>([]);
  const [companyMatches, setCompanyMatches] = useState<CompanyMatch[]>([]);
  const role = profile?.target_role || 'Full Stack Developer';
  // For a role typed via "Other" that isn't in our curated datasets, the AI
  // lookup (aiRoleResolver.ts) supplies real must/nice/advanced skills and a
  // matching roadmap instead of silently defaulting to Full Stack Developer's.
  const { data: aiRole, loading: aiLoading } = useAIRole(role);

  useEffect(() => {
    if (!user) return;
    if (aiLoading) { setSkills([]); return; }
    const knownSkills = profile?.saved_skills || [];
    const apply = async (roadmapItems: Array<{ skill: string; video: string; priority?: 'Must Have' | 'Nice to Have' | 'Advanced' }>, requiredSkills: string[]) => {
      await pruneStaleRoadmapSkills(user.id, requiredSkills);
      const { data: existingRows } = await supabase.from('roadmap_skills').select('skill_name, done').eq('user_id', user.id);
      const doneMap = new Map((existingRows || []).map((r: { skill_name: string; done: boolean }) => [r.skill_name, r.done]));

      // Once every current-tier item is checked off, unlock the role's growth
      // tier so the roadmap has somewhere to go instead of sitting at "done"
      // forever — this is what "Grow further" actually surfaces. AI-inferred
      // roles have no separate growth tier, so this stays base-only for them.
      const baseAllDone = roadmapItems.length > 0 && roadmapItems.every((item) => doneMap.get(item.skill));
      const growthItems = (!aiRole && baseAllDone) ? getRoleGrowthSkills(role, knownSkills) : [];
      const combined = [
        ...roadmapItems.map((item) => ({ ...item, tier: 'base' as const })),
        ...growthItems.map((item) => ({ ...item, priority: 'Advanced' as const, tier: 'growth' as const })),
      ];

      setSkills(combined.map((item, index) => ({
        id: `${role}-${item.tier}-${index}`,
        skill_name: item.skill,
        priority: item.priority || 'Must Have',
        done: doneMap.get(item.skill) || false,
        video: item.video,
      })));
      onProgress?.();
    };

    if (aiRole) {
      apply(aiRole.roadmap, [...aiRole.must, ...aiRole.nice, ...aiRole.advanced]);
      return;
    }
    fetchRoadmap(role, knownSkills)
      .then((res) => apply(res.roadmap, getRoleRequiredSkills(role)))
      .catch(() => apply(getRoleRoadmap(role, knownSkills), getRoleRequiredSkills(role)));
  }, [user, role, profile?.saved_skills, onProgress, aiRole, aiLoading]);

  useEffect(() => {
    if (!user) return;
    // Skills checked off on this roadmap count immediately, not just skills the
    // resume text happens to mention — so ticking off e.g. "OSCP" here updates
    // your company matches right away instead of requiring a resume re-upload.
    let cancelled = false;
    const doneRoadmapSkills = skills.filter((s) => s.done).map((s) => s.skill_name);
    const combinedSkills = Array.from(new Set([...(profile?.saved_skills || []), ...doneRoadmapSkills]));
    fetchCompanyMatch(combinedSkills, profile?.target_role)
      .then((res) => { if (!cancelled) setCompanyMatches(res.companies); })
      .catch(() => { if (!cancelled) setCompanyMatches([]); });
    return () => { cancelled = true; };
  }, [user, profile?.saved_skills, profile?.target_role, skills]);

  // Powers "Generate updated resume" below — the original resume's own
  // detected skills are the baseline everything else gets diffed against, so
  // the generated doc can call out which skills are newly learned instead of
  // silently blending them in.
  const [latestResume, setLatestResume] = useState<{ file_name: string; raw_text: string | null; skills: string[] } | null>(null);
  useEffect(() => {
    if (!user) { setLatestResume(null); return; }
    let cancelled = false;
    supabase.from('resume_analyses').select('file_name, raw_text, skills').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (!cancelled) setLatestResume(data as typeof latestResume); });
    return () => { cancelled = true; };
  }, [user]);

  function generateResume() {
    if (!user) return;
    const doneRoadmapSkills = skills.filter((s) => s.done).map((s) => s.skill_name);
    const originalSkills = latestResume?.skills || [];
    const allSkills = Array.from(new Set([...(profile?.saved_skills || originalSkills), ...doneRoadmapSkills]));
    const originalSet = new Set(originalSkills);
    const newlyLearned = allSkills.filter((s) => !originalSet.has(s));
    const existingSkills = allSkills.filter((s) => originalSet.has(s));

    const lines: string[] = [];
    lines.push(profile?.full_name || 'Your Name');
    lines.push([role, profile?.college, profile?.course].filter(Boolean).join(' | '));
    if (user.email) lines.push(user.email);
    lines.push('');
    lines.push('SKILLS');
    lines.push('-'.repeat(40));
    if (existingSkills.length) lines.push(existingSkills.join(', '));
    if (newlyLearned.length) {
      lines.push('');
      lines.push(`Recently learned via PathPilot roadmap: ${newlyLearned.join(', ')}`);
    }
    if (!existingSkills.length && !newlyLearned.length) lines.push('No skills detected yet.');
    if (latestResume?.raw_text) {
      lines.push('');
      lines.push('ORIGINAL RESUME CONTENT');
      lines.push('-'.repeat(40));
      lines.push(latestResume.raw_text);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(profile?.full_name || 'pathpilot').replace(/\s+/g, '_')}_updated_resume.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const done = skills.filter((x) => x.done).length;
  async function toggle(skill: RoadmapSkill & { video?: string }) {
    const next = !skill.done;
    setSkills((prev) => prev.map((x) => x.id === skill.id ? { ...x, done: next } : x));
    if (!user) return;
    const { error } = await supabase
      .from('roadmap_skills')
      .upsert(
        { user_id: user.id, skill_name: skill.skill_name, priority: skill.priority, done: next },
        { onConflict: 'user_id,skill_name' }
      );
    if (error) {
      console.error('Failed to save roadmap progress:', error.message);
      setSkills((prev) => prev.map((x) => x.id === skill.id ? { ...x, done: !next } : x));
      return;
    }
    onProgress?.();
  }

  return <><PageHeader eyebrow="MODULE 03 / SKILL DIRECTION" title="Close the gap with intention."><div className="role-pill"><Target size={15} /> {role}{aiRole && <span className="ai-badge">AI-matched</span>}</div></PageHeader><div className="roadmap-hero"><div><div className="eyebrow light">YOUR ROADMAP</div><h2>{done} of {skills.length || 0} skills covered</h2><p>Progress is not about knowing everything. It’s about knowing what’s next.</p></div><ProgressRing score={skills.length ? Math.round(done / skills.length * 100) : 0} size={124} /></div>{!skills.length ? <div className="empty-state">{aiLoading ? `Looking up skills for "${role}" with AI…` : 'Preparing your personalized roadmap…'}</div> : <div className="roadmap-groups">{(['Must Have', 'Nice to Have', 'Advanced'] as const).map((tier) => { const items = skills.filter((s) => s.priority === tier); if (!items.length) return null; const doneInTier = items.filter((s) => s.done).length; return <div key={tier}><div className="roadmap-tier-head"><span className={`priority ${tier.toLowerCase().replace(' ', '-')}`}>{tier}</span><span className="roadmap-tier-count">({doneInTier}/{items.length})</span></div><div className="roadmap-tier-grid">{items.map((skill) => <div className={skill.done ? 'roadmap-row completed' : 'roadmap-row'} key={skill.id}><button className="check-toggle" onClick={() => toggle(skill)}>{skill.done ? <Check size={15} /> : <Circle size={17} />}</button><div className="roadmap-skill"><strong>{skill.skill_name}</strong></div><a className="watch-link" href={skill.video || `https://www.youtube.com/results?search_query=${encodeURIComponent(skill.skill_name + ' tutorial')}`} target="_blank" rel="noreferrer"><Play size={13} /> Watch</a><button className="mark-btn" onClick={() => toggle(skill)}>{skill.done ? 'Completed' : 'Mark done'}</button></div>)}</div></div>; })}</div>}{!skills.length && <div className="empty-state"><Target size={28} /><strong>Your roadmap will appear after your first resume analysis.</strong><button className="primary-btn" onClick={() => go('resume')}>Analyze resume <ArrowRight size={16} /></button></div>}{skills.length > 0 && <div className="content-card resume-generate-card"><SectionTitle icon={FileText} title="Updated resume" action={<span className="muted-label">{done} of {skills.length} skills covered</span>} /><p className="missing-intro">{done === skills.length ? "You've completed every skill on this roadmap — generate a fresh resume with everything you've learned, ready to send out." : "Generate a resume any time — it folds in every roadmap skill you've completed so far, layered on top of your original resume."}</p><button type="button" className="primary-btn" onClick={generateResume} disabled={!latestResume}><Download size={16} /> Generate updated resume</button></div>}<div className="content-card company-card"><SectionTitle icon={BriefcaseBusiness} title="Companies you can target" action={<span className="muted-label">Based on your current skills</span>} /><p className="company-card-copy">Ranked by how much of each company's role you already match — not a generic list.</p>{companyMatches.length ? <div className="company-grid">{companyMatches.slice(0, 12).map((c) => <div className="company-pill" key={c.company}><strong>{c.company}</strong><span>{c.category}</span><small>{c.bestMatch.role} · {c.bestMatch.matchPct}% match</small></div>)}</div> : <div className="empty-state">{(profile?.saved_skills || []).length ? 'No company data loaded yet — add pathpilot_companies.json to server/data/.' : 'Analyze your resume first so we know which skills to match against companies.'}</div>}</div><div className="next-banner"><div className="banner-icon"><GraduationCap size={20} /></div><div><strong>Ready to test your knowledge?</strong><p>Put your skills under a little pressure with a focused aptitude test.</p></div><button onClick={() => go('aptitude')}>Take a test <ArrowRight size={16} /></button></div></>;
}

const questions = QUESTIONS;
const TEST_QUESTION_COUNT = 20;
const TEST_DURATION_SECONDS = 15 * 60;

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function shuffleOptions(q: Question): Question {
  const opts = q.options.map((text, idx) => ({ text, isAnswer: idx === q.answer }));
  const shuffled = shuffle(opts);
  return { q: q.q, options: shuffled.map((o) => o.text), answer: shuffled.findIndex((o) => o.isAnswer), difficulty: q.difficulty };
}

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Round 1 draws from the easy/medium pool; clearing a category once bumps every
// retake into the medium/hard pool, so "round 2" is a genuinely tougher test.
function difficultyPoolForRound(round: number): QuestionDifficulty[] {
  return round <= 1 ? ['easy', 'medium'] : ['medium', 'hard'];
}

function AptitudePage({ go, onProgress }: { go: (module: Module) => void; onProgress?: () => void }) {
  const { user, profile, session } = useAuth();
  const [category, setCategory] = useState<string | null>(null);
  const [round, setRound] = useState(1);
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState<AptitudeResult[]>([]);
  const [autoSubmitReason, setAutoSubmitReason] = useState('');
  const submittedRef = useRef(false);

  // "Technical MCQs" stays the stored category key everywhere (results,
  // radar chart, dashboard) so progress tracking keeps working across role
  // changes — only which question bank feeds it changes with the target role.
  // A role typed via "Other" that isn't in our curated datasets gets its own
  // AI-generated quiz (aiRoleResolver.ts) instead of a guessed domain's bank.
  const { data: aiRole } = useAIRole(profile?.target_role);
  const technicalDomain = aiRole ? profile?.target_role : getTechnicalDomain(profile?.target_role);
  function bankFor(cat: string): Question[] {
    if (cat !== 'Technical MCQs') return questions[cat];
    if (aiRole?.technicalMcqs?.length) return aiRole.technicalMcqs;
    return getTechnicalBank(profile?.target_role);
  }

  useEffect(() => { if (user) supabase.from('aptitude_results').select('*').eq('user_id', user.id).then(({ data }) => setResults((data || []) as AptitudeResult[])); }, [user]);

  function start(cat: string) {
    const nextRound = results.filter((r) => r.category === cat).length + 1;
    const allowedDifficulties = difficultyPoolForRound(nextRound);
    const fullBank = bankFor(cat);
    const tiered = fullBank.filter((q) => allowedDifficulties.includes(q.difficulty));
    const bank = tiered.length >= 6 ? tiered : fullBank;
    const pool = shuffle(bank).slice(0, Math.min(TEST_QUESTION_COUNT, bank.length)).map(shuffleOptions);
    submittedRef.current = false;
    setCategory(cat);
    setRound(nextRound);
    setActiveQuestions(pool);
    setAnswers([]);
    setSubmitted(false);
    setScore(0);
    setAutoSubmitReason('');
  }

  async function submit(reason?: string) {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const result = activeQuestions.reduce((sum, q, i) => sum + (answers[i] === q.answer ? 1 : 0), 0);
    setScore(result);
    setSubmitted(true);
    if (reason) setAutoSubmitReason(reason);
    if (user && category) {
      const { data } = await supabase.from('aptitude_results').insert({ user_id: user.id, category, score: result, total: activeQuestions.length }).select('*').maybeSingle();
      if (data) setResults((prev) => [...prev, data as AptitudeResult]);
      if (user.email) await logActivity(user.email, 'aptitude_completed', session?.access_token);
      onProgress?.();
    }
  }

  if (category) return <TestView category={category} round={round} questions={activeQuestions} answers={answers} setAnswers={setAnswers} submitted={submitted} score={score} autoSubmitReason={autoSubmitReason} onSubmit={submit} onBack={() => setCategory(null)} go={go} />;
  return <><PageHeader eyebrow="MODULE 04 / KNOWLEDGE CHECK" title="Practice with purpose." /><div className="module-intro"><p>Short, focused tests to help you turn learning into confidence. Choose a category and see where you stand. Each attempt pulls a fresh, shuffled set of questions — clear a category once and the next attempt gets harder.</p></div><div className="test-grid">{Object.keys(questions).map((cat, index) => { const attempts = results.filter((r) => r.category === cat).length; const best = results.filter((r) => r.category === cat).reduce((max, r) => Math.max(max, Math.round(r.score / r.total * 100)), 0); const icons = [BarChart3, Target, BookOpen, Zap]; const Icon = icons[index]; const bank = bankFor(cat); const tailored = cat === 'Technical MCQs' && technicalDomain; return <button className="test-card" key={cat} onClick={() => start(cat)}><div className={`test-icon icon-${index}`}><Icon size={22} /></div><div className="test-card-head"><strong>{tailored ? `${technicalDomain} MCQs` : cat}</strong><p>{Math.min(TEST_QUESTION_COUNT, bank.length)} questions · 15 min{tailored ? ' · tailored to your target role' : ''}{attempts > 0 ? ` · Round ${attempts + 1} next (harder)` : ''}</p></div><div className="test-card-foot"><span>Best score {best || '—'}%</span><ArrowRight size={15} /></div></button>; })}</div><div className="next-banner"><div className="banner-icon"><FileSearch size={20} /></div><div><strong>Want to sharpen your resume further?</strong><p>Re-analyze your resume anytime to catch newly missing skills and start a tougher round.</p></div><button onClick={() => go('resume')}>Go to Resume Analysis <ArrowRight size={16} /></button></div></>;
}

function TestView({ category, round, questions: qs, answers, setAnswers, submitted, score, autoSubmitReason, onSubmit, onBack, go }: { category: string; round: number; questions: Question[]; answers: number[]; setAnswers: (a: number[]) => void; submitted: boolean; score: number; autoSubmitReason: string; onSubmit: (reason?: string) => void; onBack: () => void; go: (module: Module) => void }) {
  const [timeLeft, setTimeLeft] = useState(TEST_DURATION_SECONDS);

  useEffect(() => {
    if (submitted) return;
    if (timeLeft <= 0) { onSubmit('Time ran out.'); return; }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, submitted, onSubmit]);

  useEffect(() => {
    if (submitted) return;
    function handleVisibility() { if (document.hidden) onSubmit('You switched tabs or minimized the window.'); }
    function handleBlur() { onSubmit('You switched to another window or application.'); }
    function handleCopy(e: ClipboardEvent) { e.preventDefault(); onSubmit('Copying was detected during the test.'); }
    // The PrintScreen key captures to the clipboard without ever blurring or
    // hiding the page, so it's invisible to the three listeners above — this
    // is the one screenshot path a plain "switched away" check can't catch.
    // Windows' own Snip & Sketch (Win+Shift+S) still hands focus to its
    // overlay first, so that path is already covered by handleBlur.
    function handleKeyDown(e: KeyboardEvent) { if (e.key === 'PrintScreen') onSubmit('A screenshot was attempted during the test.'); }
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('copy', handleCopy);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('copy', handleCopy);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [submitted, onSubmit]);

  const answeredCount = answers.filter((a) => a !== undefined).length;

  return <><PageHeader eyebrow={`APTITUDE TEST · ROUND ${round}${round > 1 ? ' (HARDER)' : ''}`} title={category}><div className="test-header-actions">{!submitted && <span className={timeLeft <= 60 ? 'timer-pill low' : 'timer-pill'}>{formatTime(timeLeft)}</span>}<button className="secondary-btn" onClick={onBack}><ArrowRight size={15} className="back-icon" /> All categories</button></div></PageHeader>{!submitted && <p className="anti-cheat-notice"><ShieldCheck size={13} /> Stay on this tab and don't copy answers — switching tabs, windows, or copying auto-submits your test.</p>}{submitted ? <div className="test-result"><div className="result-trophy"><Trophy size={28} /></div><div className="eyebrow">TEST COMPLETE</div>{autoSubmitReason && <p className="auto-submit-note">Auto-submitted — {autoSubmitReason}</p>}<h2>You scored {score} out of {qs.length}</h2><p>{score / qs.length >= .7 ? `Excellent work. You are building real interview momentum. Round ${round + 1} will pull tougher questions.` : 'Good attempt. Review the gaps and give it another shot.'}</p><ProgressRing score={Math.round(score / qs.length * 100)} size={130} />{score / qs.length >= .7 && <button className="primary-btn" onClick={() => go('roadmap')}>Back to Skill Roadmap <ArrowRight size={16} /></button>}<button className={score / qs.length >= .7 ? 'secondary-btn' : 'primary-btn'} onClick={() => { setAnswers([]); onBack(); }}>Back to categories <ArrowRight size={16} /></button></div> : <div className="question-list no-select" onContextMenu={(e) => e.preventDefault()}>{qs.map((q, i) => <div className="question-card" key={q.q}><div className="question-number">0{i + 1}</div><h2>{q.q}</h2><div className="options">{q.options.map((option, oi) => <button className={answers[i] === oi ? 'option selected' : 'option'} onClick={() => { const next = [...answers]; next[i] = oi; setAnswers(next); }} key={option}><span>{String.fromCharCode(65 + oi)}</span>{option}{answers[i] === oi && <Check size={16} />}</button>)}</div></div>)}<button className="primary-btn submit-test" onClick={() => onSubmit()}>Submit answers ({answeredCount}/{qs.length} answered) <ArrowRight size={17} /></button></div>}</>;
}

function ComparePage({ roadmap, onProgress, go }: { roadmap: RoadmapSkill[]; onProgress?: () => void; go: (module: Module) => void }) { const { user, profile, updateProfile, session } = useAuth(); const [oldFile, setOldFile] = useState<File | null>(null); const [newFile, setNewFile] = useState<File | null>(null); const [result, setResult] = useState<{ old: ReturnType<typeof analyzeResumeText>; next: ReturnType<typeof analyzeResumeText> } | null>(null); const [busy, setBusy] = useState(false); async function compare() { if (!oldFile || !newFile || !user) return; setBusy(true); const [{ text: oldText }, { text: newText }, experienceText] = await Promise.all([extractResumeText(oldFile), extractResumeText(newFile), fetchExperienceText(user.id)]); const old = analyzeResumeText(oldText || oldFile.name); const oldCombinedText = oldText || oldFile.name; const newCombinedText = [newText || newFile.name, experienceText].filter(Boolean).join('\n\n'); const next = analyzeResumeText(newCombinedText); setResult({ old, next }); await supabase.from('resume_comparisons').insert({ user_id: user.id, old_score: old.atsScore, new_score: next.atsScore, skills_gained: next.skills.filter((s) => !old.skills.includes(s)), new_roles: next.jobRoles.filter((r) => !old.jobRoles.some((x) => x.role === r.role)).map((r) => r.role) }); await Promise.all([oldFile, newFile].map(async (f, i) => { const isOld = i === 0; const a = isOld ? old : next; const text = isOld ? oldCombinedText : newCombinedText; const storagePath = `${user.id}/${Date.now()}-${i}-${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`; const { error: uploadError } = await supabase.storage.from('resumes').upload(storagePath, f); await supabase.from('resume_analyses').insert({ user_id: user.id, file_name: f.name, ats_score: a.atsScore, skills: a.skills, job_roles: a.jobRoles, raw_text: text, file_path: uploadError ? null : storagePath }); })); await updateProfile({ saved_skills: next.skills }); await syncRoadmap(next.skills, profile?.target_role || 'Full Stack Developer', user.id); if (user.email) await logActivity(user.email, 'resume_compared', session?.access_token); onProgress?.(); setBusy(false); } return <><PageHeader eyebrow="MODULE 05 / BEFORE & AFTER" title="See your progress clearly." /><div className="module-intro"><p>Compare two versions of your resume to see what changed, what improved, and which new roles opened up.</p></div>{!result ? <><div className="compare-upload"><ResumeDrop label="OLD RESUME" file={oldFile} setFile={setOldFile} /><div className="vs-badge">VS</div><ResumeDrop label="NEW RESUME" file={newFile} setFile={setNewFile} /></div><button className="primary-btn compare-btn" disabled={!oldFile || !newFile || busy} onClick={compare}>{busy ? 'Comparing resumes…' : 'Compare resumes'}<Sparkles size={17} /></button></> : <CompareResult result={result} roadmap={roadmap} reset={() => setResult(null)} profile={profile} go={go} />}</>; }
function ResumeDrop({ label, file, setFile }: { label: string; file: File | null; setFile: (f: File | null) => void }) { return <div className="resume-drop"><div className="eyebrow">{label}</div><label className="drop-inner"><div className="upload-icon small"><Upload size={19} /></div><strong>{file ? file.name : 'Choose a resume'}</strong><span>PDF, DOCX or TXT</span><input type="file" accept=".pdf,.docx,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label></div>; }
function CompareResult({ result, roadmap, reset, profile, go }: { result: { old: ReturnType<typeof analyzeResumeText>; next: ReturnType<typeof analyzeResumeText> }; roadmap: RoadmapSkill[]; reset: () => void; profile: Profile | null; go: (module: Module) => void }) {
  const { user, session, updateProfile } = useAuth();
  const gained = result.next.skills.filter((s) => !result.old.skills.includes(s));
  const unlockedRoles = result.next.jobRoles.filter((r) => !result.old.jobRoles.some((x) => x.role === r.role));
  // Same fix as Resume Analysis's Matched Job Roles: once a target role is
  // set, stay in that lane instead of surfacing an unrelated role just
  // because it crossed the 20% match threshold on this resume.
  const roles = useMemo(() => {
    if (!profile?.target_role) return unlockedRoles;
    const category = getCategoryForRole(profile.target_role);
    if (!category) return unlockedRoles;
    const filtered = unlockedRoles.filter((r) => getCategoryForRole(r.role) === category);
    return filtered.length > 0 ? filtered : unlockedRoles;
  }, [unlockedRoles, profile?.target_role]);
  const [companyMatches, setCompanyMatches] = useState<CompanyMatch[]>([]);
  const [appliedKeys, setAppliedKeys] = useState<string[]>([]);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [showAllRoles, setShowAllRoles] = useState(false);
  // Same lane-filtering as Resume Analysis's Matched Job Roles, but over the
  // full current role list (not just the diff), so companies below have a
  // broad, relevant set of role cards to nest under.
  const relevantJobRoles = useMemo(() => {
    if (!profile?.target_role) return result.next.jobRoles;
    const category = getCategoryForRole(profile.target_role);
    if (!category) return result.next.jobRoles;
    const filtered = result.next.jobRoles.filter((r) => getCategoryForRole(r.role) === category);
    return filtered.length >= 3 ? filtered : result.next.jobRoles;
  }, [result.next.jobRoles, profile?.target_role]);
  const targetRoles = useMemo(
    () => [profile?.target_role, ...(profile?.target_roles || [])].filter((r): r is string => Boolean(r)),
    [profile?.target_role, profile?.target_roles],
  );
  // Roadmap skills you've actually checked off count toward company matches too —
  // otherwise this list only reflects resume-keyword detection, which misses
  // most tool/cert names (Kali Linux, OSCP, Burp Suite, ...) that were never
  // meant to be auto-extracted from resume text in the first place.
  const skillsWithRoadmap = useMemo(
    () => Array.from(new Set([...result.next.skills, ...roadmap.filter((r) => r.done).map((r) => r.skill_name)])),
    [result.next.skills, roadmap],
  );

  useEffect(() => {
    // Guards against a stale, late-resolving request (StrictMode's dev-only
    // double-effect, or a prop change mid-flight) overwriting fresher state —
    // without this, results could flash in and then get clobbered back to
    // empty by an earlier request finishing last.
    let cancelled = false;
    fetchCombinedCompanyMatch(skillsWithRoadmap, targetRoles.length ? targetRoles : [roles[0]?.role || result.next.jobRoles[0]?.role].filter((r): r is string => Boolean(r)))
      .then((res) => { if (!cancelled) setCompanyMatches(res.companies); })
      .catch(() => { if (!cancelled) setCompanyMatches([]); });
    return () => { cancelled = true; };
  }, [skillsWithRoadmap, roles, targetRoles, result.next.jobRoles]);

  useEffect(() => { if (user) getApplications(user.id).then((apps) => setAppliedKeys(apps.map((a) => `${a.company}::${a.role}`))); }, [user]);

  async function apply(company: string, role: string) {
    if (!user) return;
    const link = buildJobSearchUrl(company, role);
    setAppliedKeys((prev) => Array.from(new Set([...prev, `${company}::${role}`])));
    await recordApplication(user.id, company, role, link, user.email, session?.access_token);
    window.open(link, '_blank', 'noopener');
  }

  // See ResumeResult's identical comment: company job titles (e.g. "Security
  // Engineer") don't line up with the curated 40-role catalog names (e.g.
  // "Cybersecurity Analyst"), so companies are grouped by their own role
  // title into one unified card per title rather than forced under a
  // same-named Matched Job Role card.
  const roleGroupedCompanies = useMemo(() => {
    const map = new Map<string, CompanyMatch[]>();
    for (const c of companyMatches) {
      const key = c.bestMatch.role;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => Math.max(...b[1].map((c) => c.bestMatch.matchPct)) - Math.max(...a[1].map((c) => c.bestMatch.matchPct)));
  }, [companyMatches]);

  function renderHiringRow(c: CompanyMatch) {
    const applied = appliedKeys.includes(`${c.company}::${c.bestMatch.role}`);
    const canApply = c.bestMatch.missing.length === 0;
    const rowKey = `${c.company}::${c.bestMatch.role}`;
    const expanded = expandedCompany === rowKey;
    return <div className="hiring-row" key={rowKey}>
      <div className="hiring-row-top"><strong>{c.company}</strong><TierBadge tier={c.tier} /><span className="matched-role-pct-mini">{c.bestMatch.matchPct}%</span></div>
      <div className="hiring-row-meta"><span>{c.salaryBand}</span></div>
      <div className="hiring-row-foot">
        {canApply ? <button className={applied ? 'apply-btn applied' : 'apply-btn'} onClick={() => apply(c.company, c.bestMatch.role)}>{applied ? <><Check size={13} /> Applied</> : <>Apply <ArrowRight size={13} /></>}</button> :
          <button type="button" className={expanded ? 'role-skill-missing-btn open' : 'role-skill-missing-btn'} onClick={() => setExpandedCompany(expanded ? null : rowKey)}>
            Finish {c.bestMatch.missing.length} skill{c.bestMatch.missing.length === 1 ? '' : 's'} <ChevronDown size={11} />
          </button>}
      </div>
      {expanded && c.bestMatch.missing.length > 0 && <div className="role-skill-detail nested">
        <div className="tag-cloud">{c.bestMatch.missing.map((skill) => <SkillTag red key={skill}>{skill}</SkillTag>)}</div>
        <p className="role-skill-detail-note">Complete these on your <button type="button" className="text-link" onClick={() => go('roadmap')}>Skill Roadmap</button>, then come back here to apply.</p>
      </div>}
    </div>;
  }

  // Condensed card for every role beyond the top 6 full cards above — same
  // tier/match%/missing-skills scan pattern as the company hiring rows, so
  // the full role catalog stays reachable without a wall of large cards.
  function renderRoleRow(role: (typeof relevantJobRoles)[number]) {
    const req = ROLE_SKILLS[role.role];
    const allReq = req ? [...req.must, ...req.nice, ...req.advanced] : [];
    const missingForRole = allReq.filter((skill) => !result.next.skills.includes(skill));
    const tier = roleTierFromSalary(role.salary_avg);
    const expanded = expandedRole === role.role;
    return <div className="hiring-row" key={role.role}>
      <div className="hiring-row-top"><strong>{role.role}</strong><span className={`tier-badge ${tier.badgeClass}`}>{tier.label}</span><span className="matched-role-pct-mini">{role.match}%</span></div>
      <div className="hiring-row-meta"><span>₹{role.salary_min}–{role.salary_max} LPA</span></div>
      <div className="hiring-row-foot">
        <button type="button" className={expanded ? 'role-skill-missing-btn open' : 'role-skill-missing-btn'} onClick={() => setExpandedRole(expanded ? null : role.role)}>
          {missingForRole.length} missing <ChevronDown size={11} />
        </button>
      </div>
      {expanded && <div className="role-skill-detail nested">
        <div className="tag-cloud">{missingForRole.length ? missingForRole.map((skill) => <SkillTag red key={skill}>{skill}</SkillTag>) : <span className="muted-label">You already have every skill for this role.</span>}</div>
        <button type="button" className="primary-btn full" onClick={async () => { await updateProfile({ target_role: role.role }); go('roadmap'); }}><Target size={15} /> Set as Target &amp; View Roadmap</button>
      </div>}
    </div>;
  }

  return <>
    <div className="compare-result-head"><div><div className="eyebrow success-text"><CheckCircle2 size={14} /> COMPARISON COMPLETE</div><h2>Your growth, side by side.</h2></div><button className="secondary-btn" onClick={reset}><Plus size={16} /> New comparison</button></div>
    <div className="compare-score-grid"><div className="compare-score"><span>Before</span><ProgressRing score={result.old.atsScore} size={128} /></div><div className="compare-arrow"><ArrowRight size={24} /><strong>+{result.next.atsScore - result.old.atsScore} pts</strong></div><div className="compare-score improved"><span>After</span><ProgressRing score={result.next.atsScore} size={128} /></div></div>
    <div className="content-card comparison-details">
      <SectionTitle icon={TrendingUp} title="What changed" />
      <div className="comparison-columns">
        <div><h3>Skills gained <span title={gained.length ? gained.join(', ') : undefined}>{gained.length}</span></h3><div className="tag-cloud">{(gained.length ? gained : ['Keep learning to unlock more']).map((x) => <SkillTag green key={x}>{x}</SkillTag>)}</div></div>
        <div><h3>New roles unlocked <span>{roles.length}</span></h3>{roles.length ? roles.map((x) => <div className="unlocked-role" key={x.role}><CheckCircle2 size={16} /><div><strong>{x.role}</strong><span>{x.match}% match · ₹{x.salary_min}–{x.salary_max} LPA</span></div></div>) : <p className="muted">Your current matches are still strengthening.</p>}</div>
      </div>
    </div>
    {relevantJobRoles.length > 0 && <div className="content-card roles-card">
      <SectionTitle icon={Target} title="Matched Job Roles" action={<span className="muted-label">Based on your updated resume</span>} />
      <div className="matched-roles-grid">
        {relevantJobRoles.slice(0, 6).map((role) => {
          const req = ROLE_SKILLS[role.role];
          const allReq = req ? [...req.must, ...req.nice, ...req.advanced] : [];
          const owned = allReq.filter((skill) => result.next.skills.includes(skill));
          const missingForRole = allReq.filter((skill) => !result.next.skills.includes(skill));
          const tier = roleTierFromSalary(role.salary_avg);
          const level = matchLevel(role.match);
          return <div className="matched-role-card" key={role.role}>
            <div className="matched-role-head">
              <div><strong>{role.role}</strong><span className={`tier-badge ${tier.badgeClass}`}>{tier.label}</span></div>
              <div className={`matched-role-pct ${level}`}>{role.match}%<small>match</small></div>
            </div>
            <div className="matched-role-salary">₹{role.salary_min}–{role.salary_max} LPA</div>
            <div className={`match-track ${level}`}><div style={{ width: `${role.match}%` }} /></div>
            {owned.length > 0 && <div><span className="matched-role-skills-label">You have ({owned.length})</span><div className="tag-cloud">{owned.slice(0, 5).map((skill) => <SkillTag green key={skill}>{skill}</SkillTag>)}{owned.length > 5 && <span className="muted-label">+{owned.length - 5} more</span>}</div></div>}
            {missingForRole.length > 0 && <div><span className="matched-role-skills-label missing">Missing ({missingForRole.length})</span><div className="tag-cloud">{missingForRole.slice(0, 5).map((skill) => <SkillTag red key={skill}>{skill}</SkillTag>)}{missingForRole.length > 5 && <span className="muted-label">+{missingForRole.length - 5} more</span>}</div></div>}
            <button type="button" className="primary-btn full" onClick={async () => { await updateProfile({ target_role: role.role }); go('roadmap'); }}><Target size={15} /> Set as Target &amp; View Roadmap</button>
          </div>;
        })}
      </div>
      {relevantJobRoles.length > 6 && <div className="matched-roles-extra">
        <button type="button" className="text-link" onClick={() => setShowAllRoles(!showAllRoles)}>{showAllRoles ? 'Show fewer roles' : `Show all ${relevantJobRoles.length} matched roles`} <ChevronDown size={12} /></button>
        {showAllRoles && <div className="hiring-grid">{relevantJobRoles.slice(6).map(renderRoleRow)}</div>}
      </div>}
    </div>}
    {roleGroupedCompanies.length > 0 && <div className="content-card company-match-card">
      <SectionTitle icon={BriefcaseBusiness} title="Job offers you can go for now" action={<span className="muted-label">Grouped by role</span>} />
      <p className="missing-intro">Salary shown is that company's full range for the role, not a guaranteed offer at your match%. <TierBadge tier="Mass recruiter" /> / Tier-1 are realistic near-term targets — <TierBadge tier="Dream" /> tiers are stretch goals worth aiming for once you're truly interview-ready.</p>
      <div className="role-group-list">
        {roleGroupedCompanies.map(([roleName, companies]) => <div className="role-group" key={roleName}>
          <div className="role-group-head"><strong>{roleName}</strong><span className="muted-label">{companies.length} compan{companies.length === 1 ? 'y' : 'ies'} hiring</span></div>
          <div className="hiring-grid">{companies.map(renderHiringRow)}</div>
        </div>)}
      </div>
    </div>}
    <div className="next-banner"><div className="banner-icon"><LayoutDashboard size={20} /></div><div><strong>You're all caught up here.</strong><p>Head to your dashboard to see this progress reflected everywhere.</p></div><button onClick={() => go('dashboard')}>Continue to Dashboard <ArrowRight size={16} /></button></div>
  </>;
}

interface AdminUserRow {
  id: string;
  full_name: string;
  email: string;
  college: string;
  course: string;
  target_role: string;
  state: string;
  district: string;
  is_admin: boolean;
}

interface AdminAggregate {
  atsScore: number | null;
  skillsDetected: number;
  roadmapDone: number;
  roadmapTotal: number;
  aptitudeAvg: number | null;
  aptitudeAttempts: number;
  comparisons: number;
  milestonesDone: number;
}

interface EmailLogRow {
  id: string;
  email: string;
  type: string;
  success: boolean;
  created_at: string;
}

interface AdminAuditLogRow {
  id: string;
  admin_email: string;
  action: 'view_user' | 'delete_user';
  target_email: string;
  ip_address: string;
  created_at: string;
}

interface UserActivityLogRow {
  id: string;
  email: string;
  event: 'login_success' | 'login_failed' | 'signup' | 'logout';
  ip_address: string;
  user_agent: string;
  created_at: string;
}

const EMAIL_TYPE_LABELS: Record<string, string> = { signup: 'Signup confirmation', password_reset: 'Password reset', otp_code: 'Email OTP code' };
const AUDIT_ACTION_LABELS: Record<string, string> = { view_user: 'Viewed user', delete_user: 'Deleted user' };
const ACTIVITY_EVENT_LABELS: Record<string, string> = { login_success: 'Login', login_failed: 'Login failed', signup: 'Signup', logout: 'Logout' };

function AdminPage() {
  const { profile, session, user } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [aggregates, setAggregates] = useState<Record<string, AdminAggregate>>({});
  const [emailLog, setEmailLog] = useState<EmailLogRow[]>([]);
  const [auditLog, setAuditLog] = useState<AdminAuditLogRow[]>([]);
  const [activityLog, setActivityLog] = useState<UserActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);

  async function refreshAuditLog() {
    const { data } = await supabase.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(200);
    setAuditLog((data || []) as AdminAuditLogRow[]);
  }

  async function refreshActivityLog() {
    const { data } = await supabase.from('user_activity_log').select('*').order('created_at', { ascending: false }).limit(200);
    setActivityLog((data || []) as UserActivityLogRow[]);
  }

  // Full account deletion needs Supabase's Admin API (service_role key),
  // which can never live in the browser — this calls a protected backend
  // route instead, authenticated with the admin's own session token so the
  // server can independently verify admin status before deleting anything.
  async function deleteUser(row: AdminUserRow) {
    if (row.id === user?.id) { window.alert("You can't delete your own account from here."); return; }
    if (row.is_admin) { window.alert('Admin accounts cannot be deleted from the panel.'); return; }
    const confirmed = window.confirm(`Permanently delete ${row.full_name || row.email}'s account and all their data? This cannot be undone.`);
    if (!confirmed) return;
    setDeletingId(row.id);
    try {
      const res = await fetch(`/api/admin/users/${row.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Failed to delete user');
      setUsers((prev) => prev.filter((u) => u.id !== row.id));
      await refreshAuditLog();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    if (!profile?.is_admin) return;
    (async () => {
      setLoading(true);
      setError('');
      const [profilesRes, resumesRes, roadmapRes, aptitudeRes, emailLogRes, comparisonsRes, milestonesRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, college, course, target_role, state, district, is_admin').order('full_name'),
        supabase.from('resume_analyses').select('user_id, ats_score, skills, created_at').order('created_at', { ascending: false }),
        supabase.from('roadmap_skills').select('user_id, done'),
        supabase.from('aptitude_results').select('user_id, category, score, total'),
        supabase.from('email_log').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('resume_comparisons').select('user_id'),
        supabase.from('milestones').select('user_id, completed'),
      ]);
      if (profilesRes.error) { setError(profilesRes.error.message); setLoading(false); return; }
      setEmailLog((emailLogRes.data || []) as EmailLogRow[]);
      await refreshAuditLog();
      await refreshActivityLog();

      const rows = (profilesRes.data || []) as AdminUserRow[];
      setUsers(rows);

      const agg: Record<string, AdminAggregate> = {};
      for (const row of rows) agg[row.id] = { atsScore: null, skillsDetected: 0, roadmapDone: 0, roadmapTotal: 0, aptitudeAvg: null, aptitudeAttempts: 0, comparisons: 0, milestonesDone: 0 };

      for (const c of (comparisonsRes.data || []) as { user_id: string }[]) {
        if (agg[c.user_id]) agg[c.user_id].comparisons += 1;
      }
      for (const m of (milestonesRes.data || []) as { user_id: string; completed: boolean }[]) {
        if (agg[m.user_id] && m.completed) agg[m.user_id].milestonesDone += 1;
      }

      const seenResume = new Set<string>();
      for (const r of (resumesRes.data || []) as { user_id: string; ats_score: number; skills: string[] }[]) {
        if (seenResume.has(r.user_id) || !agg[r.user_id]) continue;
        seenResume.add(r.user_id);
        agg[r.user_id].atsScore = r.ats_score;
        agg[r.user_id].skillsDetected = (r.skills || []).length;
      }

      for (const rs of (roadmapRes.data || []) as { user_id: string; done: boolean }[]) {
        if (!agg[rs.user_id]) continue;
        agg[rs.user_id].roadmapTotal += 1;
        if (rs.done) agg[rs.user_id].roadmapDone += 1;
      }

      // Best attempt per (user, category) — a category is only as good as the
      // student's best shot at it, not diluted by repeated weak attempts.
      const bestByUserCategory: Record<string, Record<string, number>> = {};
      const attemptCounts: Record<string, number> = {};
      for (const a of (aptitudeRes.data || []) as { user_id: string; category: string; score: number; total: number }[]) {
        if (!agg[a.user_id]) continue;
        const pct = a.total ? (a.score / a.total) * 100 : 0;
        bestByUserCategory[a.user_id] = bestByUserCategory[a.user_id] || {};
        bestByUserCategory[a.user_id][a.category] = Math.max(bestByUserCategory[a.user_id][a.category] || 0, pct);
        attemptCounts[a.user_id] = (attemptCounts[a.user_id] || 0) + 1;
      }
      for (const [uid, byCategory] of Object.entries(bestByUserCategory)) {
        const bests = Object.values(byCategory);
        agg[uid].aptitudeAvg = Math.round(bests.reduce((sum, v) => sum + v, 0) / bests.length);
        agg[uid].aptitudeAttempts = attemptCounts[uid];
      }

      setAggregates(agg);
      setLoading(false);
    })();
  }, [profile?.is_admin]);

  // Keeps both logs live while the panel is open — a new row (an admin
  // viewing/deleting a user, or anyone logging in anywhere) appears without
  // needing a manual refresh.
  useEffect(() => {
    if (!profile?.is_admin) return;
    const channel = supabase
      .channel('admin-panel-logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_audit_log' }, () => refreshAuditLog())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_activity_log' }, () => refreshActivityLog())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.is_admin]);

  if (!profile?.is_admin) return <div className="empty-state"><Shield size={28} /><strong>Admin access only.</strong></div>;

  if (selectedUser) return <AdminUserDetailPage user={selectedUser} onBack={() => setSelectedUser(null)} onViewLogged={refreshAuditLog} />;

  return <>
    <PageHeader eyebrow="ADMIN" title="All learners, at a glance." />
    {error && <div className="form-alert error inline">{error}</div>}
    {loading ? <div className="empty-state">Loading learner data…</div> : <div className="content-card">
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Name</th><th>Email</th><th>College</th><th>Course</th><th>Target role</th><th>Location</th><th>Resume score</th><th>Skills detected</th><th>Roadmap progress</th><th>Aptitude avg</th><th>Comparisons</th><th>Milestones</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => {
              const a = aggregates[u.id];
              const isSelf = u.id === user?.id;
              return <tr key={u.id} className="admin-row-clickable" onClick={() => setSelectedUser(u)}>
                <td>{u.full_name || '—'}{u.is_admin && <span className="tier-badge tier-dream" style={{ marginLeft: 6 }}>Admin</span>}</td>
                <td>{u.email}</td>
                <td>{u.college || '—'}</td>
                <td>{u.course || '—'}</td>
                <td>{u.target_role || '—'}</td>
                <td>{[u.district, u.state].filter(Boolean).join(', ') || '—'}</td>
                <td>{a?.atsScore != null ? `${a.atsScore}/100` : '—'}</td>
                <td>{a?.skillsDetected || 0}</td>
                <td>{a && a.roadmapTotal ? `${a.roadmapDone}/${a.roadmapTotal}` : '—'}</td>
                <td>{a?.aptitudeAvg != null ? `${a.aptitudeAvg}% (${a.aptitudeAttempts})` : '—'}</td>
                <td>{a?.comparisons || 0}</td>
                <td>{a?.milestonesDone || 0}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button className="admin-view-btn" onClick={() => setSelectedUser(u)} title={`View ${u.full_name || u.email}`}><Eye size={14} /></button>
                  {!u.is_admin && !isSelf && (
                    <button className="admin-delete-btn" disabled={deletingId === u.id} onClick={() => deleteUser(u)} title={`Delete ${u.full_name || u.email}`}>
                      {deletingId === u.id ? '…' : <Trash2 size={14} />}
                    </button>
                  )}
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      {!users.length && <p className="muted">No users yet.</p>}
    </div>}
    {!loading && <div className="content-card">
      <SectionTitle icon={Shield} title="Admin Activity Log" action={<span className="muted-label">Last {auditLog.length} actions — who viewed or deleted which account, and from where</span>} />
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>IP address</th></tr></thead>
          <tbody>
            {auditLog.map((a) => <tr key={a.id}>
              <td>{new Date(a.created_at).toLocaleString()}</td>
              <td>{a.admin_email}</td>
              <td>{AUDIT_ACTION_LABELS[a.action] || a.action}</td>
              <td>{a.target_email || '—'}</td>
              <td>{a.ip_address || '—'}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {!auditLog.length && <p className="muted">No admin activity recorded yet.</p>}
    </div>}
    {!loading && <div className="content-card">
      <SectionTitle icon={KeyRound} title="User Activity Log" action={<span className="muted-label">Last {activityLog.length} logins/signups/logouts, every account — IP + browser included</span>} />
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>When</th><th>Email</th><th>Event</th><th>IP address</th><th>Browser</th></tr></thead>
          <tbody>
            {activityLog.map((a) => <tr key={a.id}>
              <td>{new Date(a.created_at).toLocaleString()}</td>
              <td>{a.email}</td>
              <td>{a.event === 'login_failed' ? <span className="skill-tag">{ACTIVITY_EVENT_LABELS[a.event]}</span> : ACTIVITY_EVENT_LABELS[a.event] || a.event}</td>
              <td>{a.ip_address || '—'}</td>
              <td className="admin-ua-cell" title={a.user_agent}>{a.user_agent || '—'}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {!activityLog.length && <p className="muted">No login activity recorded yet.</p>}
    </div>}
    {!loading && <div className="content-card">
      <SectionTitle icon={Mail} title="Email Activity" action={<span className="muted-label">Last {emailLog.length} requests — Supabase/Brevo confirms the send, not inbox delivery</span>} />
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>When</th><th>Email</th><th>Type</th><th>Status</th></tr></thead>
          <tbody>
            {emailLog.map((e) => <tr key={e.id}>
              <td>{new Date(e.created_at).toLocaleString()}</td>
              <td>{e.email}</td>
              <td>{EMAIL_TYPE_LABELS[e.type] || e.type}</td>
              <td>{e.success ? <span className="skill-tag green">Sent</span> : <span className="skill-tag">Failed</span>}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {!emailLog.length && <p className="muted">No email activity recorded yet.</p>}
    </div>}
  </>;
}

// Read-only per-user drill-down for the admin panel — every open is recorded
// server-side (worker/index.ts logUserView, with the real client IP) since
// the browser reads this data through the admin's own RLS-gated session,
// same as the summary table, just scoped to one user and unaggregated.
function AdminUserDetailPage({ user: targetUser, onBack, onViewLogged }: { user: AdminUserRow; onBack: () => void; onViewLogged: () => void }) {
  const { session } = useAuth();
  const [resumes, setResumes] = useState<ResumeAnalysis[]>([]);
  const [roadmap, setRoadmap] = useState<RoadmapSkill[]>([]);
  const [aptitude, setAptitude] = useState<AptitudeResult[]>([]);
  const [comparisons, setComparisons] = useState<ResumeComparison[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingResumeId, setOpeningResumeId] = useState<string | null>(null);

  // Signed URL, not a public link — the "resumes" bucket is private, so
  // this only works because admin_select_all_resumes (storage RLS) allows
  // this admin's own session to read any user's file, for 10 minutes.
  async function viewResume(resumeId: string, filePath: string) {
    setOpeningResumeId(resumeId);
    const { data, error } = await supabase.storage.from('resumes').createSignedUrl(filePath, 600);
    setOpeningResumeId(null);
    if (error || !data) { window.alert('Could not open this resume: ' + (error?.message || 'unknown error')); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  // For resumes analyzed before file storage existed, the original PDF/DOCX
  // bytes were genuinely never kept — only the extracted text was. This is
  // the most useful thing that can actually be shown for those, built
  // entirely client-side from data already fetched (no extra request).
  function viewExtractedText(fileName: string, rawText: string) {
    const blob = new Blob([`${fileName}\n${'='.repeat(fileName.length)}\n\n${rawText}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  useEffect(() => {
    fetch('/api/admin/log-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ targetUserId: targetUser.id, targetEmail: targetUser.email }),
    }).then(() => onViewLogged()).catch(() => {});

    let cancelled = false;
    (async () => {
      setLoading(true);
      const [resumesRes, roadmapRes, aptitudeRes, comparisonsRes, milestonesRes, applicationsRes] = await Promise.all([
        supabase.from('resume_analyses').select('*').eq('user_id', targetUser.id).order('created_at', { ascending: false }),
        supabase.from('roadmap_skills').select('*').eq('user_id', targetUser.id),
        supabase.from('aptitude_results').select('*').eq('user_id', targetUser.id).order('created_at', { ascending: false }),
        supabase.from('resume_comparisons').select('*').eq('user_id', targetUser.id).order('created_at', { ascending: false }),
        supabase.from('milestones').select('*').eq('user_id', targetUser.id),
        supabase.from('job_applications').select('*').eq('user_id', targetUser.id),
      ]);
      if (cancelled) return;
      setResumes((resumesRes.data || []) as ResumeAnalysis[]);
      setRoadmap((roadmapRes.data || []) as RoadmapSkill[]);
      setAptitude((aptitudeRes.data || []) as AptitudeResult[]);
      setComparisons((comparisonsRes.data || []) as ResumeComparison[]);
      setMilestones((milestonesRes.data || []) as Milestone[]);
      setApplications((applicationsRes.data || []) as JobApplication[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUser.id]);

  const radarData = APTITUDE_CATEGORIES.map((cat) => ({ label: cat, value: bestAttemptPct(aptitude, cat) }));
  const roadmapDoneCount = roadmap.filter((r) => r.done).length;
  // Same derivation Dashboard uses (isMilestoneDone) — a milestone can be
  // "done" either because its own DB row was explicitly flagged, or because
  // the underlying condition it represents is already true. Using only the
  // raw completed flag (as this page did before) under-reports real
  // progress, since the app itself relies on this same derived check rather
  // than always writing the flag directly.
  const roadmapAllDone = roadmap.length > 0 && roadmap.every((x) => x.done);
  const aptitudePassed = aptitude.some((r) => r.score / Math.max(r.total, 1) >= .7);
  const profileComplete = Boolean(targetUser.full_name && targetUser.college && targetUser.target_role);
  const displayMilestones = milestones.length ? milestones : DEFAULT_MILESTONES.map((m) => ({ ...m, id: m.key, completed: false }));
  const isMilestoneDone = (m: { key: string; completed: boolean }) => m.completed
    || (m.key === 'complete_profile' && profileComplete)
    || (m.key === 'analyze_resume' && resumes.length > 0)
    || (m.key === 'complete_roadmap' && roadmapAllDone)
    || (m.key === 'aptitude_70' && aptitudePassed)
    || (m.key === 'apply_10' && applications.length >= 10);
  const milestonesDone = displayMilestones.filter(isMilestoneDone).length;

  return <>
    <PageHeader eyebrow="ADMIN / USER DETAIL" title={targetUser.full_name || targetUser.email}>
      <button className="secondary-btn" onClick={onBack}><ChevronRight size={15} style={{ transform: 'rotate(180deg)' }} /> Back to all learners</button>
    </PageHeader>

    <div className="content-card">
      <SectionTitle icon={UserRound} title="Profile" />
      <div className="admin-detail-grid">
        <div><span className="muted-label">Email</span><strong>{targetUser.email}</strong></div>
        <div><span className="muted-label">College</span><strong>{targetUser.college || '—'}</strong></div>
        <div><span className="muted-label">Course</span><strong>{targetUser.course || '—'}</strong></div>
        <div><span className="muted-label">Target role</span><strong>{targetUser.target_role || '—'}</strong></div>
        <div><span className="muted-label">Location</span><strong>{[targetUser.district, targetUser.state].filter(Boolean).join(', ') || '—'}</strong></div>
      </div>
    </div>

    {loading ? <div className="empty-state">Loading user data…</div> : <>
      <div className="content-card">
        <SectionTitle icon={FileText} title="Resume history" action={<span className="muted-label">{resumes.length} analysis{resumes.length === 1 ? '' : 'es'}</span>} />
        {resumes.length > 1 && <SkillGrowthChart points={[...resumes].reverse().map((r) => ({ label: new Date(r.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), value: r.skills.length, detail: `${r.file_name} · ${new Date(r.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}` }))} />}
        {resumes.length ? <div className="admin-resume-history">
          {resumes.map((r, i) => <div className="admin-resume-entry" key={r.id}>
            <div className="admin-resume-entry-head">
              <div>
                <strong>{r.file_name}</strong>
                <span className="muted-label">{new Date(r.created_at).toLocaleString()}{i === 0 ? ' · Latest' : ''}</span>
                {r.file_path ? <button type="button" className="text-btn" disabled={openingResumeId === r.id} onClick={() => viewResume(r.id, r.file_path as string)}>{openingResumeId === r.id ? 'Opening…' : 'View resume file'} <ArrowRight size={12} /></button> : r.raw_text ? <button type="button" className="text-btn" onClick={() => viewExtractedText(r.file_name, r.raw_text)}>View extracted text (original file wasn't kept) <ArrowRight size={12} /></button> : <span className="muted-label">Original file not stored (uploaded before this feature)</span>}
              </div>
              <ProgressRing score={r.ats_score} size={64} />
            </div>
            <div className="tag-cloud">{r.skills.map((s) => <SkillTag green key={s}>{s}</SkillTag>)}</div>
            {r.job_roles?.length > 0 && <div className="admin-resume-roles">{r.job_roles.slice(0, 5).map((jr) => <span className="muted-label" key={jr.role}>{jr.role} · {jr.match}%</span>)}</div>}
          </div>)}
        </div> : <p className="muted">No resumes analyzed yet.</p>}
      </div>

      <div className="content-card">
        <SectionTitle icon={Target} title="Skill roadmap" action={<span className="muted-label">{roadmapDoneCount}/{roadmap.length} complete</span>} />
        {roadmap.length ? <div className="roadmap-groups">
          {(['Must Have', 'Nice to Have', 'Advanced'] as const).map((tier) => {
            const items = roadmap.filter((r) => r.priority === tier);
            if (!items.length) return null;
            const doneInTier = items.filter((r) => r.done).length;
            return <div key={tier}>
              <div className="roadmap-tier-head"><span className={`priority ${tier.toLowerCase().replace(' ', '-')}`}>{tier}</span><span className="roadmap-tier-count">({doneInTier}/{items.length})</span></div>
              <div className="tag-cloud">{items.map((s) => <SkillTag green={s.done} key={s.id}>{s.skill_name}</SkillTag>)}</div>
            </div>;
          })}
        </div> : <p className="muted">No roadmap generated yet.</p>}
      </div>

      <div className="content-card">
        <SectionTitle icon={GraduationCap} title="Aptitude performance" action={<span className="muted-label">{aptitude.length} attempt{aptitude.length === 1 ? '' : 's'}</span>} />
        {aptitude.length ? <>
          <div className="radar-wrap"><RadarChart data={radarData} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>When</th><th>Category</th><th>Score</th></tr></thead>
              <tbody>{aptitude.map((a) => <tr key={a.id}><td>{new Date(a.created_at).toLocaleString()}</td><td>{a.category}</td><td>{a.score}/{a.total} ({a.total ? Math.round((a.score / a.total) * 100) : 0}%)</td></tr>)}</tbody>
            </table>
          </div>
        </> : <p className="muted">No aptitude tests taken yet.</p>}
      </div>

      <div className="content-card">
        <SectionTitle icon={TrendingUp} title="Resume comparisons" action={<span className="muted-label">{comparisons.length} comparison{comparisons.length === 1 ? '' : 's'}</span>} />
        {comparisons.length ? <div className="admin-resume-history">
          {comparisons.map((c) => <div className="admin-resume-entry" key={c.id}>
            <div className="admin-resume-entry-head"><div><strong>{c.old_score} → {c.new_score}</strong><span className="muted-label">{new Date(c.created_at).toLocaleString()}</span></div></div>
            {c.skills_gained?.length > 0 && <div><span className="matched-role-skills-label">Skills gained</span><div className="tag-cloud">{c.skills_gained.map((s) => <SkillTag green key={s}>{s}</SkillTag>)}</div></div>}
            {c.new_roles?.length > 0 && <div><span className="matched-role-skills-label">New roles unlocked</span><div className="tag-cloud">{c.new_roles.map((r) => <SkillTag key={r}>{r}</SkillTag>)}</div></div>}
          </div>)}
        </div> : <p className="muted">No resume comparisons yet.</p>}
      </div>

      <div className="content-card">
        <SectionTitle icon={CheckCircle2} title="Milestones" action={<span className="muted-label">{milestonesDone}/{displayMilestones.length} complete</span>} />
        <div className="milestone-list">
          {displayMilestones.map((m) => { const done = isMilestoneDone(m); return <div className={done ? 'milestone-row completed' : 'milestone-row'} key={m.id}><div className="milestone-dot" /><div><strong>{m.label}</strong><p>{done ? 'Completed' : 'Not yet'}</p></div></div>; })}
        </div>
      </div>
    </>}
  </>;
}

function buildProfileForm(profile: Profile | null, collegeGroups: GroupedOptions, roleGroups: GroupedOptions, courseGroups: GroupedOptions): ProfileFormState {
  const allColleges = Object.values(collegeGroups).flat();
  const allRoles = Object.values(roleGroups).flat();
  const allCourses = Object.values(courseGroups).flat();
  const college = profile?.college || '';
  const role = profile?.target_role || '';
  const course = profile?.course || '';
  const knownCollege = allColleges.includes(college);
  const knownRole = allRoles.includes(role);
  const knownCourse = allCourses.includes(course);
  return {
    full_name: profile?.full_name || '',
    college: knownCollege ? college : 'Other (type your university)',
    college_other: knownCollege ? '' : college,
    course: knownCourse ? course : 'Other (type your course)',
    course_other: knownCourse ? '' : course,
    year: profile?.year || '',
    state: profile?.state || '',
    district: profile?.district || '',
    city: (profile?.city && getCitiesForDistrict(profile.district || '').includes(profile.city)) ? profile.city : (profile?.city ? 'Other (type your city)' : ''),
    city_other: (profile?.city && getCitiesForDistrict(profile.district || '').includes(profile.city)) ? '' : (profile?.city || ''),
    phone: profile?.phone || '',
    target_role: knownRole ? role : 'Other (type your role)',
    role_other: knownRole ? '' : role,
    target_roles: profile?.target_roles || [],
  };
}

function AdditionalRolesPicker({ form, setForm }: { form: ProfileFormState; setForm: (f: ProfileFormState) => void }) {
  const primaryRole = form.target_role === 'Other (type your role)' ? form.role_other : form.target_role;
  const category = getCategoryForRole(primaryRole);
  const siblings = category ? getRolesInCategory(category).filter((r) => r.toLowerCase() !== primaryRole.toLowerCase()) : [];
  if (!siblings.length) return null;
  function toggle(role: string) {
    const has = form.target_roles.includes(role);
    setForm({ ...form, target_roles: has ? form.target_roles.filter((r) => r !== role) : [...form.target_roles, role] });
  }
  return <div className="additional-roles">
    <label>Also interested in <span className="muted-label">(same domain: {category})</span></label>
    <div className="role-chip-list">
      {siblings.map((role) => <button type="button" key={role} className={form.target_roles.includes(role) ? 'role-chip active' : 'role-chip'} onClick={() => toggle(role)}>{form.target_roles.includes(role) && <Check size={11} />}{role}</button>)}
    </div>
  </div>;
}

function GroupedSelect({ label, value, onChange, options, placeholder, otherLabel, otherValue, onOtherChange }: { label: string; value: string; onChange: (value: string) => void; options: Record<string, string[]>; placeholder: string; otherLabel: string; otherValue: string; onOtherChange: (value: string) => void }) {
  const showOther = value === otherLabel;
  return <div className="form-field">
    <label>{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {Object.entries(options).map(([category, items]) => <optgroup key={category} label={category}>{items.map((item) => <option value={item} key={item}>{item}</option>)}</optgroup>)}
      <option value={otherLabel}>{otherLabel}</option>
    </select>
    {showOther && <input value={otherValue} onChange={(e) => onOtherChange(e.target.value)} placeholder={`Type your ${label.toLowerCase()}`} />}
  </div>;
}

type ProfileTab = 'modules' | 'target' | 'experience';

const MODULE_DETAILS: { id: Module; title: string; icon: typeof Target; color: string }[] = [
  { id: 'profile', title: 'User Login & Authentication', icon: UserRound, color: 'navy' },
  { id: 'resume', title: 'Resume Analysis & Job Match', icon: FileSearch, color: 'blue' },
  { id: 'roadmap', title: 'Skill Gap & Learning Roadmap', icon: Target, color: 'green' },
  { id: 'aptitude', title: 'Aptitude Test', icon: GraduationCap, color: 'orange' },
];

function ModuleLauncher({ go, progression }: { go: (module: Module) => void; progression: ProgressionState }) {
  const doneMap: Partial<Record<Module, boolean>> = { profile: progression.profile, resume: progression.resume, roadmap: progression.roadmap, aptitude: progression.aptitude, compare: progression.compare };
  return <div className="module-launcher">
    <SectionTitle icon={LayoutDashboard} title="Modules" />
    <div className="launcher-grid">
      {MODULE_DETAILS.map((m, i) => {
        const access = canAccess(m.id, progression);
        const done = Boolean(doneMap[m.id]);
        const Icon = m.icon;
        return <button key={m.id} className="launcher-card" disabled={!access.allowed} onClick={() => go(m.id)}>
          <div className={`launcher-icon ${m.color}`}><Icon size={18} /></div>
          <span className="muted-label">MODULE 0{i + 1}</span>
          <strong>{m.title}</strong>
          {done ? <p>Complete</p> : access.allowed ? <span className="launcher-cta">Open <ArrowRight size={12} /></span> : <span className="launcher-cta locked"><Lock size={11} /> Locked</span>}
        </button>;
      })}
    </div>
  </div>;
}

function TargetJobPanel() {
  const { user } = useAuth();
  const [form, setForm] = useState<TargetJob>({ user_id: '', job_title: '', company_name: '', location: '', work_type: '', salary_min: null, salary_max: null, required_skills: [], job_description: '' });
  const [skillInput, setSkillInput] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from('target_jobs').select('*').eq('user_id', user.id).maybeSingle().then(({ data, error: fetchError }) => {
      if (data) setForm(data as TargetJob);
      if (fetchError && fetchError.code !== 'PGRST116') setError('Target job data isn’t set up yet — ask your admin to run the latest database migration.');
      setLoading(false);
    });
  }, [user]);

  function addSkill() {
    const skill = skillInput.trim();
    if (skill && !form.required_skills.includes(skill)) setForm((f) => ({ ...f, required_skills: [...f.required_skills, skill] }));
    setSkillInput('');
  }
  function removeSkill(skill: string) { setForm((f) => ({ ...f, required_skills: f.required_skills.filter((s) => s !== skill) })); }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setSaved(false); setError('');
    const { error: saveError } = await supabase.from('target_jobs').upsert({ ...form, user_id: user.id }, { onConflict: 'user_id' });
    if (saveError) setError(saveError.message); else setSaved(true);
  }

  if (loading) return <div className="empty-state">Loading…</div>;

  return <div className="content-card target-job-card">
    <SectionTitle icon={Target} title="Target Job Description" action={<span className="muted-label">Helps refine your roadmap and match score</span>} />
    <form onSubmit={save} className="target-job-form">
      <div className="form-grid">
        <label>Job title<input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} placeholder="e.g. Full Stack Developer" /></label>
        <label>Company name<input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="e.g. Infosys, Wipro, Startup" /></label>
        <label>Location<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Ahmedabad, Gujarat" /></label>
        <label>Work type
          <div className="work-type-picker">
            {(['Remote', 'Hybrid', 'On-Site'] as const).map((w) => <button type="button" key={w} className={form.work_type === w ? 'work-type-btn active' : 'work-type-btn'} onClick={() => setForm({ ...form, work_type: w })}>{w}</button>)}
          </div>
        </label>
        <label>Expected salary (LPA)
          <div className="salary-range-input">
            <input type="number" min={0} value={form.salary_min ?? ''} onChange={(e) => setForm({ ...form, salary_min: e.target.value ? Number(e.target.value) : null })} placeholder="Min" />
            <span>to</span>
            <input type="number" min={0} value={form.salary_max ?? ''} onChange={(e) => setForm({ ...form, salary_max: e.target.value ? Number(e.target.value) : null })} placeholder="Max" />
          </div>
        </label>
      </div>
      <label className="required-skills-label">Required skills
        <div className="skill-input-row"><input value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }} placeholder="React, Node.js, MongoDB, SQL, Docker" /><button type="button" className="secondary-btn" onClick={addSkill}>Add</button></div>
      </label>
      {form.required_skills.length > 0 && <div className="tag-cloud">{form.required_skills.map((s) => <SkillTag key={s}>{s}<button type="button" onClick={() => removeSkill(s)}><X size={11} /></button></SkillTag>)}</div>}
      <label className="job-description-label">Job description<textarea value={form.job_description} onChange={(e) => setForm({ ...form, job_description: e.target.value })} placeholder="Paste the job description here — responsibilities, qualifications, tech stack, etc." rows={5} /></label>
      {error && <div className="form-alert error"><X size={16} />{error}</div>}
      {saved && <div className="form-alert success"><CheckCircle2 size={16} /> Target job saved.</div>}
      <button className="primary-btn" type="submit">Save target job <ArrowRight size={16} /></button>
    </form>
  </div>;
}

function formatMonthYear(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function ExperienceFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [employmentType, setEmploymentType] = useState('Internship');
  const [companyName, setCompanyName] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!user || !title || !companyName) return;
    setBusy(true); setError('');
    const { error: saveError } = await supabase.from('work_experiences').insert({ user_id: user.id, title, employment_type: employmentType, company_name: companyName, location, start_date: startDate ? `${startDate}-01` : null, end_date: endDate ? `${endDate}-01` : null, description });
    setBusy(false);
    if (saveError) setError(saveError.message); else onSaved();
  }

  return <div className="modal-backdrop" onClick={onClose}>
    <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-head"><h2>Add work experience</h2><button onClick={onClose}><X size={16} /></button></div>
      <form onSubmit={save} className="profile-edit-form">
        <div className="form-grid">
          <label>Job title<input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Frontend Intern" /></label>
          <label>Employment type<select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}><option>Internship</option><option>Full-time</option><option>Part-time</option><option>Freelance</option></select></label>
          <label>Company name<input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. TechSolutions Pvt. Ltd." /></label>
          <label>Location<input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Ahmedabad" /></label>
          <label>Start date<input type="month" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
          <label>End date<input type="month" value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="Leave blank if current" /></label>
        </div>
        <label>Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="What did you build or contribute?" /></label>
        {error && <div className="form-alert error"><X size={16} />{error}</div>}
        <button className="primary-btn full" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save experience'}</button>
      </form>
    </div>
  </div>;
}

function ExperiencePanel() {
  const { user } = useAuth();
  const [items, setItems] = useState<WorkExperience[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('work_experiences').select('*').eq('user_id', user.id).order('start_date', { ascending: false });
    setItems((data || []) as WorkExperience[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    if (!user) return;
    await supabase.from('work_experiences').delete().eq('id', id).eq('user_id', user.id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  return <div className="content-card experience-card">
    <SectionTitle icon={BriefcaseBusiness} title="Work Experience" action={<button className="primary-btn" onClick={() => setShowForm(true)}><Plus size={15} /> Add Experience</button>} />
    <p className="experience-subtitle">Previous jobs, internships & freelance work</p>
    {loading ? <div className="empty-state">Loading…</div> : items.length === 0 ? <div className="empty-state"><BriefcaseBusiness size={26} /><strong>No work experience added yet.</strong></div> : <div className="experience-list">
      {items.map((exp) => <div className="experience-row" key={exp.id}>
        <div className="experience-avatar">{exp.company_name.charAt(0).toUpperCase()}</div>
        <div className="experience-body">
          <div className="experience-head"><strong>{exp.title}</strong>{exp.employment_type && <span className="skill-tag">{exp.employment_type}</span>}</div>
          <div className="experience-company">{exp.company_name}</div>
          <div className="experience-meta">{(exp.start_date || exp.end_date) && <span>{exp.start_date ? formatMonthYear(exp.start_date) : '?'} – {exp.end_date ? formatMonthYear(exp.end_date) : 'Present'}</span>}{exp.location && <span>{exp.location}</span>}</div>
          {exp.description && <p className="experience-desc">{exp.description}</p>}
        </div>
        <button className="experience-remove" onClick={() => remove(exp.id)}><X size={14} /></button>
      </div>)}
    </div>}
    {showForm && <ExperienceFormModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
  </div>;
}

function ProfilePage({ go, progression }: { go: (module: Module) => void; progression: ProgressionState }) {
  const { profile, updateProfile } = useAuth();
  const [tab, setTab] = useState<ProfileTab>('modules');
  const { collegeGroups, roleGroups, courseGroups, courseYears } = usePathpilotData();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileFormState>(() => buildProfileForm(profile, collegeGroups, roleGroups, courseGroups));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setForm(buildProfileForm(profile, collegeGroups, roleGroups, courseGroups)); }, [profile, collegeGroups, roleGroups, courseGroups]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(''); setSaved(false);
    if (form.phone && !isValidPhone(form.phone)) { setError(`Enter a valid phone number. ${PHONE_HELP_TEXT}`); return; }
    const payload = {
      full_name: form.full_name,
      college: form.college === 'Other (type your university)' ? form.college_other : form.college,
      course: form.course === 'Other (type your course)' ? form.course_other : form.course,
      year: form.year,
      state: form.state,
      district: form.district,
      city: form.city === 'Other (type your city)' ? form.city_other : form.city,
      phone: form.phone,
      target_role: form.target_role === 'Other (type your role)' ? form.role_other : form.target_role,
      target_roles: form.target_roles,
    };
    const result = await updateProfile(payload);
    if (result.error) setError(result.error);
    else { setSaved(true); setEditing(false); }
  }

  const filled = [form.full_name, form.college === 'Other (type your university)' ? form.college_other : form.college, form.course === 'Other (type your course)' ? form.course_other : form.course, form.year, form.state, form.district, form.city === 'Other (type your city)' ? form.city_other : form.city, form.phone, form.target_role === 'Other (type your role)' ? form.role_other : form.target_role].filter(Boolean).length;
  const completion = Math.round(filled / 9 * 100);

  return <><PageHeader eyebrow="MODULE 01 / AUTH & PROFILE" title="Your career profile."><button className="secondary-btn" onClick={() => setEditing(!editing)}><Pencil size={15} /> {editing ? 'Cancel' : 'Edit profile'}</button></PageHeader><div className="profile-completion"><div><strong>Profile completion</strong><span>{completion}% — {completion === 100 ? 'Looking sharp.' : 'Add the rest to unlock your full path.'}</span></div><div className="completion-track"><div style={{ width: `${completion}%` }} /></div></div><div className="profile-page-card"><div className="profile-hero"><div className="large-avatar">{profile?.full_name?.charAt(0) || 'E'}</div><div><div className="verified"><ShieldCheck size={15} /> Verified profile</div><h2>{profile?.full_name || 'Your name'}</h2><p>{profile?.target_role || 'Choose a target role to personalize your path.'}</p></div></div>{editing ? <form onSubmit={save} className="profile-edit-form"><div className="form-grid"><label>Full name<input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label><GroupedSelect label="College / university" value={form.college} onChange={(value) => setForm({ ...form, college: value })} options={collegeGroups} placeholder="Select your university" otherLabel="Other (type your university)" otherValue={form.college_other} onOtherChange={(value) => setForm({ ...form, college_other: value })} /><GroupedSelect label="Course / branch" value={form.course} onChange={(value) => setForm({ ...form, course: value })} options={courseGroups} placeholder="Select your course" otherLabel="Other (type your course)" otherValue={form.course_other} onOtherChange={(value) => setForm({ ...form, course_other: value })} /><label>Year of study<select value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}><option value="">Select year</option>{courseYears.map((yearOption) => <option value={yearOption} key={yearOption}>{yearOption}</option>)}</select></label><label>State<select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value, district: '' })}><option value="">Select state</option>{INDIAN_STATES.map((s) => <option value={s} key={s}>{s}</option>)}</select></label><label>District<select value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value, city: '', city_other: '' })} disabled={!form.state}><option value="">{form.state ? 'Select district' : 'Select a state first'}</option>{getDistrictsForState(form.state).map((d) => <option value={d} key={d}>{d}</option>)}</select></label><label>City / Town<select value={form.city} disabled={!form.district} onChange={(e) => setForm({ ...form, city: e.target.value })}><option value="">{form.district ? 'Select your city/town' : 'Select a district first'}</option>{getCitiesForDistrict(form.district).map((c) => <option value={c} key={c}>{c}</option>)}<option value="Other (type your city)">Other (type your city)</option></select>{form.city === 'Other (type your city)' && <input value={form.city_other} onChange={(e) => setForm({ ...form, city_other: e.target.value })} placeholder="Type your city or town" />}</label><label>Phone<PhoneInput value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} /></label><GroupedSelect label="Target role" value={form.target_role} onChange={(value) => setForm({ ...form, target_role: value, target_roles: [] })} options={roleGroups} placeholder="Choose a role" otherLabel="Other (type your role)" otherValue={form.role_other} onOtherChange={(value) => setForm({ ...form, role_other: value })} /></div><AdditionalRolesPicker form={form} setForm={setForm} />{error && <div className="form-alert error"><X size={16} />{error}</div>}{saved && <div className="form-alert success"><CheckCircle2 size={16} /> Profile saved.</div>}<button className="primary-btn" type="submit">Save profile <ArrowRight size={16} /></button></form> : <ProfileFields profile={profile} />}</div>{!editing && <button className="primary-btn" onClick={() => go('resume')}>Continue to resume analysis <ArrowRight size={16} /></button>}
    <div className="profile-tabs">
      <button className={tab === 'modules' ? 'profile-tab active' : 'profile-tab'} onClick={() => setTab('modules')}><FileText size={15} /> Modules</button>
      <button className={tab === 'target' ? 'profile-tab active' : 'profile-tab'} onClick={() => setTab('target')}><Target size={15} /> Target Job</button>
      <button className={tab === 'experience' ? 'profile-tab active' : 'profile-tab'} onClick={() => setTab('experience')}><BriefcaseBusiness size={15} /> Experience</button>
    </div>
    {tab === 'modules' && <ModuleLauncher go={go} progression={progression} />}
    {tab === 'target' && <TargetJobPanel />}
    {tab === 'experience' && <ExperiencePanel />}
  </>; }

function ProfileModal({ profile, onClose, updateProfile }: { profile: Profile | null; onClose: () => void; updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }> }) {
  const { collegeGroups, roleGroups, courseGroups, courseYears } = usePathpilotData();
  const [form, setForm] = useState<ProfileFormState>(() => buildProfileForm(profile, collegeGroups, roleGroups, courseGroups));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setForm(buildProfileForm(profile, collegeGroups, roleGroups, courseGroups)); }, [profile, collegeGroups, roleGroups, courseGroups]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(''); setSaved(false);
    if (form.phone && !isValidPhone(form.phone)) { setError(`Enter a valid phone number. ${PHONE_HELP_TEXT}`); return; }
    const payload = {
      full_name: form.full_name,
      college: form.college === 'Other (type your university)' ? form.college_other : form.college,
      course: form.course === 'Other (type your course)' ? form.course_other : form.course,
      year: form.year,
      state: form.state,
      district: form.district,
      city: form.city === 'Other (type your city)' ? form.city_other : form.city,
      phone: form.phone,
      target_role: form.target_role === 'Other (type your role)' ? form.role_other : form.target_role,
      target_roles: form.target_roles,
    };
    const result = await updateProfile(payload);
    if (result.error) setError(result.error);
    else setSaved(true);
  }

  return <div className="modal-backdrop" onClick={onClose}><div className="profile-modal" onClick={(e) => e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">YOUR PROFILE</div><h2>Keep it current.</h2></div><button onClick={onClose}><X size={19} /></button></div><form onSubmit={save}><div className="form-grid"><label>Full name<input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label><GroupedSelect label="College / university" value={form.college} onChange={(value) => setForm({ ...form, college: value })} options={collegeGroups} placeholder="Select your university" otherLabel="Other (type your university)" otherValue={form.college_other} onOtherChange={(value) => setForm({ ...form, college_other: value })} /><GroupedSelect label="Course / branch" value={form.course} onChange={(value) => setForm({ ...form, course: value })} options={courseGroups} placeholder="Select your course" otherLabel="Other (type your course)" otherValue={form.course_other} onOtherChange={(value) => setForm({ ...form, course_other: value })} /><label>Year of study<select value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}><option value="">Select year</option>{courseYears.map((yearOption) => <option value={yearOption} key={yearOption}>{yearOption}</option>)}</select></label><label>State<select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value, district: '' })}><option value="">Select state</option>{INDIAN_STATES.map((s) => <option value={s} key={s}>{s}</option>)}</select></label><label>District<select value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value, city: '', city_other: '' })} disabled={!form.state}><option value="">{form.state ? 'Select district' : 'Select a state first'}</option>{getDistrictsForState(form.state).map((d) => <option value={d} key={d}>{d}</option>)}</select></label><label>City / Town<select value={form.city} disabled={!form.district} onChange={(e) => setForm({ ...form, city: e.target.value })}><option value="">{form.district ? 'Select your city/town' : 'Select a district first'}</option>{getCitiesForDistrict(form.district).map((c) => <option value={c} key={c}>{c}</option>)}<option value="Other (type your city)">Other (type your city)</option></select>{form.city === 'Other (type your city)' && <input value={form.city_other} onChange={(e) => setForm({ ...form, city_other: e.target.value })} placeholder="Type your city or town" />}</label><label>Phone<PhoneInput value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} /></label><GroupedSelect label="Target role" value={form.target_role} onChange={(value) => setForm({ ...form, target_role: value, target_roles: [] })} options={roleGroups} placeholder="Choose a role" otherLabel="Other (type your role)" otherValue={form.role_other} onOtherChange={(value) => setForm({ ...form, role_other: value })} /></div><AdditionalRolesPicker form={form} setForm={setForm} />{error && <div className="form-alert error"><X size={16} />{error}</div>}{saved && <div className="form-alert success"><CheckCircle2 size={16} /> Profile saved.</div>}<button className="primary-btn" type="submit">Save profile <ArrowRight size={16} /></button></form></div></div>;
}

function ProfileFields({ profile }: { profile: Profile | null }) {
  const otherRoles = profile?.target_roles || [];
  return <div className="profile-fields"><div><span>Full name</span><strong>{profile?.full_name || 'Not added'}</strong></div><div><span>Email</span><strong>{profile?.email || 'Not added'}</strong></div><div><span>College</span><strong>{profile?.college || 'Not added'}</strong></div><div><span>Course</span><strong>{profile?.course || 'Not added'}</strong></div><div><span>Year</span><strong>{profile?.year || 'Not added'}</strong></div><div><span>State</span><strong>{profile?.state || 'Not added'}</strong></div><div><span>District</span><strong>{profile?.district || 'Not added'}</strong></div><div><span>City</span><strong>{profile?.city || 'Not added'}</strong></div><div><span>Target role</span><strong>{profile?.target_role || 'Not added'}</strong>{otherRoles.length > 0 && <div className="role-chip-list">{otherRoles.map((role) => <span className="role-chip active" key={role}>{role}</span>)}</div>}</div></div>;
}

export default App;
