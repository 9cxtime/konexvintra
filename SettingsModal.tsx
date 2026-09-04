import { useState } from 'react';
import { X, User as UserIcon, Mail, Building2, Check, MailCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export function SettingsModal({ onClose, onToast }: { onClose: () => void; onToast: (msg: string) => void }) {
  const { user, profile, updateProfile, signOut } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [company, setCompany] = useState(profile?.company || '');
  const [saving, setSaving] = useState(false);
  const [connectingEmail, setConnectingEmail] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await updateProfile({ full_name: fullName, company });
    setSaving(false);
    if (error) onToast('Erreur lors de la mise à jour.');
    else onToast('Profil mis à jour.');
  };

  const handleConnectEmail = async () => {
    setConnectingEmail(true);
    const { error } = await updateProfile({ email_connected: true });
    setConnectingEmail(false);
    if (error) onToast('Erreur lors de la connexion email.');
    else onToast('Adresse email connectée avec succès.');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-modal anim-pop" onClick={(e) => e.stopPropagation()}>
        <div className="modal-heading">
          <div><span className="eyebrow">RÉGLAGES</span><h2>Paramètres du compte</h2></div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="settings-section">
          <div className="settings-section-title"><UserIcon size={15} /> Profil</div>
          <form onSubmit={handleSave} className="settings-form">
            <label>Nom complet<input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Votre nom" /></label>
            <label>Entreprise / Studio<input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nom de votre entreprise" /></label>
            <label>Email du compte<input value={user?.email || ''} disabled /></label>
            <button type="submit" className="primary-action" disabled={saving}><Check size={16} /> {saving ? 'Sauvegarde...' : 'Enregistrer'}</button>
          </form>
        </div>
        <div className="settings-section">
          <div className="settings-section-title"><Mail size={15} /> Connexion email</div>
          <div className="email-connect-card">
            {profile?.email_connected ? (
              <>
                <div className="email-connected-badge"><MailCheck size={18} /> Email connecté</div>
                <p>Votre boîte mail est connectée. L'opérateur IA peut lire, trier et préparer vos réponses.</p>
              </>
            ) : (
              <>
                <p>Connectez votre adresse email pour permettre à l'opérateur IA de lire vos messages, détecter les urgents et préparer vos réponses.</p>
                <button className="secondary-action" onClick={handleConnectEmail} disabled={connectingEmail}>
                  <Mail size={15} /> {connectingEmail ? 'Connexion...' : 'Connecter mon email'}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="settings-section">
          <div className="settings-section-title"><Building2 size={15} /> Compte</div>
          <button className="settings-danger" onClick={signOut}>Se déconnecter</button>
        </div>
      </div>
    </div>
  );
}
