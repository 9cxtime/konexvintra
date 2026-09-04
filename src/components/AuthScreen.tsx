import { useState, useEffect } from 'react';
import { Sparkles, Mail, Lock, User as UserIcon, ArrowRight, Eye, EyeOff, Check, Zap } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const orbs = document.querySelectorAll('.auth-orb');
      orbs.forEach((orb) => {
        orb.classList.toggle('auth-orb-shift');
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

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

  const switchMode = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
    setError(null);
  };

  return (
    <div className="auth-screen">
      <div className="auth-bg-grid" />
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />
      <div className="auth-left-panel">
        <div className="auth-left-content anim-fade-in-up">
          <div className="auth-left-brand">
            <div className="brand-mark large"><Sparkles size={24} /></div>
            <h1>Connex</h1>
          </div>
          <h2 className="auth-left-title">Votre opérateur IA<br />pour piloter votre activité</h2>
          <p className="auth-left-subtitle">Gérez vos devis, factures, emails et rendez-vous avec l'aide d'une IA conversationnelle qui agit pour vous.</p>
          <div className="auth-features">
            <div className="auth-feature anim-fade-in-up" style={{ animationDelay: '100ms' }}>
              <div className="auth-feature-icon"><Zap size={16} /></div>
              <div><strong>Création instantanée</strong><span>Devis et factures par la voix ou le texte</span></div>
            </div>
            <div className="auth-feature anim-fade-in-up" style={{ animationDelay: '200ms' }}>
              <div className="auth-feature-icon"><Mail size={16} /></div>
              <div><strong>Email connecté</strong><span>L'IA lit, trie et prépare vos réponses</span></div>
            </div>
            <div className="auth-feature anim-fade-in-up" style={{ animationDelay: '300ms' }}>
              <div className="auth-feature-icon"><Sparkles size={16} /></div>
              <div><strong>Assistant vocal</strong><span>Parlez naturellement, l'IA s'occupe du reste</span></div>
            </div>
          </div>
        </div>
      </div>
      <div className="auth-right-panel">
        <div className="auth-card anim-pop">
          <div className="auth-card-brand">
            <div className="brand-mark"><Sparkles size={18} /></div>
            <span>Connex</span>
          </div>
          <div className="auth-tabs">
            <button className={`auth-tab ${mode === 'signin' ? 'selected' : ''}`} onClick={() => switchMode('signin')}>
              Connexion
              {mode === 'signin' && <span className="auth-tab-indicator" />}
            </button>
            <button className={`auth-tab ${mode === 'signup' ? 'selected' : ''}`} onClick={() => switchMode('signup')}>
              Inscription
              {mode === 'signup' && <span className="auth-tab-indicator" />}
            </button>
          </div>
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field-group">
              {mode === 'signup' && (
                <label className="auth-field anim-field-in">
                  <UserIcon size={16} />
                  <input type="text" placeholder="Nom complet" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </label>
              )}
              <label className="auth-field anim-field-in" style={{ animationDelay: mode === 'signup' ? '60ms' : '0ms' }}>
                <Mail size={16} />
                <input type="email" placeholder="Adresse email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label className="auth-field anim-field-in" style={{ animationDelay: mode === 'signup' ? '120ms' : '60ms' }}>
                <Lock size={16} />
                <input type={showPassword ? 'text' : 'password'} placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((v) => !v)} tabIndex={-1}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </label>
            </div>
            {error && <p className="auth-error anim-shake">{error}</p>}
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? (
                <><span className="auth-spinner" /> Chargement...</>
              ) : (
                <>{mode === 'signin' ? 'Se connecter' : 'Créer mon compte'} <ArrowRight size={16} /></>
              )}
            </button>
          </form>
          <p className="auth-hint">
            {mode === 'signin' ? 'Pas encore de compte ? ' : 'Déjà inscrit ? '}
            <button onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
              {mode === 'signin' ? 'Créer un compte' : 'Se connecter'}
            </button>
          </p>
          <div className="auth-footer">
            <Check size={11} /> Données chiffrées &middot; Session privée
          </div>
        </div>
      </div>
    </div>
  );
}
