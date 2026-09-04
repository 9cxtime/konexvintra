import { useState } from 'react';
import { Sparkles, Mail, Lock, User as UserIcon, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password, fullName);
    setLoading(false);
    if (result.error) setError(result.error);
  };

  return (
    <div className="auth-screen">
      <div className="auth-glow" />
      <div className="auth-card anim-pop">
        <div className="auth-brand">
          <div className="brand-mark large"><Sparkles size={24} /></div>
          <h1>Pilotage</h1>
          <p>Votre opérateur IA pour piloter votre activité</p>
        </div>
        <div className="auth-tabs">
          <button className={mode === 'signin' ? 'selected' : ''} onClick={() => { setMode('signin'); setError(null); }}>Connexion</button>
          <button className={mode === 'signup' ? 'selected' : ''} onClick={() => { setMode('signup'); setError(null); }}>Inscription</button>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <label className="auth-field">
              <UserIcon size={16} />
              <input type="text" placeholder="Nom complet" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </label>
          )}
          <label className="auth-field">
            <Mail size={16} />
            <input type="email" placeholder="Adresse email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="auth-field">
            <Lock size={16} />
            <input type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Chargement...' : mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
            <ArrowRight size={16} />
          </button>
        </form>
        <p className="auth-hint">
          {mode === 'signin' ? 'Pas encore de compte ? ' : 'Déjà inscrit ? '}
          <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}>
            {mode === 'signin' ? 'Créer un compte' : 'Se connecter'}
          </button>
        </p>
      </div>
    </div>
  );
}
