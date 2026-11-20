import { useState, type FormEvent } from 'react';
import { Droplets, Lock, Mail, ShieldCheck, User } from 'lucide-react';
import { api, setStoredToken } from '../lib/api.ts';
import type { PublicUser } from '../../shared/urinalysis.ts';

interface AuthScreenProps {
  onAuthenticated: (user: PublicUser) => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Clinical Laboratory Specialist');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res =
        tab === 'login'
          ? await api.login(email, password)
          : await api.register({ name, email, password, role });
      setStoredToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin() {
    setError(null);
    setLoading(true);
    try {
      const res = await api.demoLogin();
      setStoredToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#EAF5FF]/45 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-4xl bg-white rounded-2xl border border-[#D6E4F0] shadow-[0_8px_30px_rgba(22,75,120,0.08)] overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Left Clinical Intro Panel */}
        <div className="bg-[#EAF5FF] p-8 sm:p-10 flex flex-col justify-between border-b md:border-b-0 md:border-r border-[#D6E4F0]">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-[#2685D8] flex items-center justify-center text-white">
                <Droplets className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <div className="font-semibold text-lg text-[#164B78] leading-tight">UriSense AI</div>
                <div className="text-xs text-[#24364B]">Smart AIoT Urinalysis System</div>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-[#164B78] leading-snug mb-3">
              Connected urinalysis monitoring and patient care
            </h2>
            <p className="text-sm text-[#24364B] leading-relaxed mb-6">
              Connect your ESP32 optical strip analyzer over Wi-Fi, inspect 10 clinical urine parameters, export PDF
              reports, and consult the UriSense Assistant in simple English.
            </p>

            <div className="rounded-xl overflow-hidden border border-[#D6E4F0] bg-white">
              <img
                src="/src/assets/images/urisense_iot_analyzer_1795067621014.jpg"
                alt="UriSense AI Smart Urinalysis Analyzer"
                referrerPolicy="no-referrer"
                className="w-full h-44 object-cover"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2 text-xs text-[#164B78] font-medium">
            <ShieldCheck className="w-4 h-4 text-[#2685D8] shrink-0" aria-hidden="true" />
            <span>Protected patient records with clear Demo vs. Real IoT data separation</span>
          </div>
        </div>

        {/* Right Sign-in / Registration Form */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          <div className="flex items-center gap-1 p-1 bg-[#EAF5FF] rounded-lg mb-6 w-fit">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setError(null);
              }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                tab === 'login' ? 'bg-white text-[#164B78] shadow-xs' : 'text-[#24364B] hover:text-[#2685D8]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setError(null);
              }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                tab === 'register' ? 'bg-white text-[#164B78] shadow-xs' : 'text-[#24364B] hover:text-[#2685D8]'
              }`}
            >
              Create Account
            </button>
          </div>

          <h1 className="text-xl font-bold text-[#164B78] mb-1">
            {tab === 'login' ? 'Clinician Sign In' : 'Create Clinician Account'}
          </h1>
          <p className="text-xs text-[#64748B] mb-5">
            {tab === 'login'
              ? 'Access patient records, live IoT analyzer data, and AI consultations.'
              : 'Register a clinician account to manage patients and urinalysis reports.'}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#DC2626]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-[#24364B] mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" aria-hidden="true" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Dr. Alex Rivera"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-[#D6E4F0] rounded-lg focus:outline-none focus:border-[#2685D8]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#24364B] mb-1">Clinical Role</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Medical Technologist"
                    className="w-full px-3 py-2 text-sm border border-[#D6E4F0] rounded-lg focus:outline-none focus:border-[#2685D8]"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-[#24364B] mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" aria-hidden="true" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="clinician@urisense.ai"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-[#D6E4F0] rounded-lg focus:outline-none focus:border-[#2685D8]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#24364B] mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" aria-hidden="true" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-[#D6E4F0] rounded-lg focus:outline-none focus:border-[#2685D8]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#2685D8] hover:bg-[#164B78] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
            >
              {loading ? 'Please wait...' : tab === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-[#D6E4F0]">
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#EAF5FF] hover:bg-[#DCEEFF] text-[#164B78] text-xs font-semibold rounded-lg border border-[#D6E4F0] transition-colors cursor-pointer"
            >
              Quick Access: Sign In as Demo Clinician
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
