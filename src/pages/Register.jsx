import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      await register(email, password, fullName.trim() || null);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="flex items-center gap-3 mb-12">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg">
          <Phone className="w-6 h-6 text-white" />
        </div>
        <div>
          <span className="font-bold text-white text-2xl block">AGM Voice CRM</span>
          <span className="text-indigo-300 text-xs font-semibold tracking-wider">AI-Powered Call Management</span>
        </div>
      </div>
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-2xl font-bold text-white mb-8">Create account</h1>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="text-sm text-red-200 bg-red-500/20 border border-red-400/50 rounded-lg px-4 py-3 backdrop-blur-sm">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-white mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-4 py-3 bg-white/90 border-2 border-white/30 rounded-lg text-slate-900 placeholder-slate-500 font-medium focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all"
                required
              />
            </div>
            <div>
              <label htmlFor="fullName" className="block text-sm font-semibold text-white mb-2">
                Full name (optional)
              </label>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-3 bg-white/90 border-2 border-white/30 rounded-lg text-slate-900 placeholder-slate-500 font-medium focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-white mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full px-4 py-3 bg-white/90 border-2 border-white/30 rounded-lg text-slate-900 placeholder-slate-500 font-medium focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all"
                required
                minLength={8}
              />
              <p className="mt-2 text-xs text-slate-300 font-medium">At least 8 characters</p>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {submitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>
          <p className="mt-8 text-center text-sm text-slate-300">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-indigo-300 hover:text-indigo-200 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
