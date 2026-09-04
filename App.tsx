import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Mic,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  Settings as SettingsIcon,
  Sparkles,
  TrendingUp,
  User as UserIcon,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, type Profile } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth';
import { AuthScreen } from '@/components/AuthScreen';
import { SettingsModal } from '@/components/SettingsModal';
import { OperatorView } from '@/components/OperatorView';

type NavItem = { label: string; icon: typeof LayoutDashboard; badge?: number; section?: string };
type Message = { id: number; role: 'user' | 'assistant'; text: string; time: string };
type DocumentItem = { id: string; title: string; kind: 'Devis' | 'Facture'; client: string; amount: number; status: string; date: string };
type RevenuePoint = { month: string; amount: number };
type WorkspaceRow = { id: string; kind: string; title: string; payload: Record<string, unknown> };

const navItems: NavItem[] = [
  { label: 'Vue d’ensemble', icon: LayoutDashboard },
  { label: 'IA Operator', icon: Sparkles, section: 'Assistant' },
  { label: 'Conversations', icon: Inbox, badge: 4 },
  { label: 'Contacts', icon: Users },
  { label: 'Calendrier', icon: CalendarDays },
  { label: 'Documents', icon: FileText, badge: 2, section: 'Opérations' },
  { label: 'Finances', icon: CircleDollarSign },
  { label: 'Tâches', icon: ClipboardList },
];

const defaultDocuments: DocumentItem[] = [
  { id: 'D-2408', title: 'Refonte identité visuelle', kind: 'Devis', client: 'Maison Rivière', amount: 4800, status: 'À envoyer', date: 'Aujourd’hui' },
  { id: 'F-1032', title: 'Accompagnement mensuel', kind: 'Facture', client: 'Atelier Martin', amount: 2100, status: 'En attente', date: '28 août 2024' },
  { id: 'F-1031', title: 'Direction artistique', kind: 'Facture', client: 'Studio Néon', amount: 3600, status: 'Payée', date: '24 août 2024' },
];

const formatCurrency = (amount: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);

const getInitials = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '??';

function AppInner() {
  const { user, profile, loading, signOut } = useAuth();
  const [activeNav, setActiveNav] = useState('Vue d’ensemble');
  const [showComposer, setShowComposer] = useState(false);
  const [composerKind, setComposerKind] = useState<'Devis' | 'Facture'>('Devis');
  const [toast, setToast] = useState('');
  const [documentList, setDocumentList] = useState<DocumentItem[]>(defaultDocuments);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const displayName = profile?.full_name || 'Nathan Morel';
  const firstName = displayName.split(' ')[0];
  const initials = getInitials(displayName);
  const company = profile?.company || 'Studio indépendant';

  useEffect(() => {
    const loadData = async () => {
      if (!supabase || !user) return;
      const [docsRes, revRes] = await Promise.all([
        supabase.from('operator_items').select('payload').eq('kind', 'document').order('updated_at', { ascending: false }),
        supabase.from('revenue_series').select('month, amount').order('created_at', { ascending: true }),
      ]);
      const savedDocs = (docsRes.data || []).map((r) => r.payload as DocumentItem).filter((d) => d && d.id);
      if (savedDocs.length > 0) setDocumentList(savedDocs);
      if (revRes.data && revRes.data.length > 0) setRevenue(revRes.data as RevenuePoint[]);
    };
    void loadData();
  }, [user]);

  const createDocument = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const client = String(form.get('client') || 'Nouveau client');
    const amount = Number(form.get('amount') || 0);
    const next: DocumentItem = { id: `${composerKind === 'Devis' ? 'D' : 'F'}-${Math.floor(1000 + Math.random() * 8999)}`, title: String(form.get('title') || 'Nouvelle prestation'), kind: composerKind, client, amount, status: composerKind === 'Devis' ? 'À envoyer' : 'Brouillon', date: 'À l’instant' };
    setDocumentList((current) => [next, ...current]);
    setShowComposer(false);
    setToast(`${composerKind} créé pour ${client}`);
    if (supabase) void supabase.from('operator_items').insert({ kind: 'document', title: next.title, payload: next });
  };

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"><Sparkles size={32} /></div></div>;
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand"><div className="brand-mark"><Sparkles size={16} /></div><span>pilotage</span><button className="mobile-close" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>
        <div className="workspace-switcher"><div className="avatar avatar-violet">{initials[0] || 'N'}</div><div><strong>{displayName}</strong><span>{company}</span></div><ChevronDown size={14} /></div>
        <nav>
          {navItems.map((item) => <div key={item.label} className="nav-group">{item.section && <p className="nav-section">{item.section}</p>}<button className={`nav-item ${activeNav === item.label ? 'nav-active' : ''}`} onClick={() => { setActiveNav(item.label); setMobileOpen(false); }}><item.icon size={17} /><span>{item.label}</span>{item.badge && <b>{item.badge}</b>}</button></div>)}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setShowSettings(true)}><SettingsIcon size={17} /><span>Réglages</span></button>
          <div className="plan-card"><div className="plan-top"><span>Plan pro</span><span className="plan-dot" /></div><strong>Votre espace est à jour</strong><div className="plan-line"><span /><span /></div><small>2,4 Go sur 10 Go utilisés</small></div>
          <div className="profile"><div className="avatar avatar-orange">{initials}</div><div><strong>{displayName}</strong><span>{profile?.email_connected ? 'Email connecté' : 'Compte standard'}</span></div><button className="icon-btn" onClick={signOut} title="Déconnexion"><LogOut size={15} /></button></div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={21} /></button>
          <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{activeNav}</strong></div>
          <div className="top-actions">
            <button className="icon-btn"><Search size={18} /></button>
            <button className="icon-btn notification"><Bell size={18} /><i /></button>
            <button className="top-avatar" onClick={() => setShowSettings(true)} title="Réglages">{initials}</button>
          </div>
        </header>
        {activeNav === 'IA Operator' ? (
          <OperatorView onAction={(action) => {
            if (action.type === 'create_quote') { setComposerKind('Devis'); setShowComposer(true); setActiveNav('Documents'); }
            else if (action.type === 'create_invoice') { setComposerKind('Facture'); setShowComposer(true); setActiveNav('Documents'); }
            else if (action.type === 'settings') setShowSettings(true);
          }} />
        ) : activeNav === 'Vue d’ensemble' ? (
          <Dashboard firstName={firstName} messages={documentList} revenue={revenue} onNewAction={() => { setComposerKind('Devis'); setShowComposer(true); }} />
        ) : (
          <SectionView activeNav={activeNav} documentList={documentList} onCreate={(kind) => { setComposerKind(kind); setShowComposer(true); }} />
        )}
      </main>
      {showComposer && (
        <div className="modal-backdrop" onClick={() => setShowComposer(false)}>
          <form className="document-modal anim-pop" onSubmit={createDocument} onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading"><div><span className="eyebrow">NOUVEAU DOCUMENT</span><h2>Créer un {composerKind.toLowerCase()}</h2></div><button type="button" className="icon-btn" onClick={() => setShowComposer(false)}><X size={18} /></button></div>
            <div className="kind-switch"><button type="button" className={composerKind === 'Devis' ? 'selected' : ''} onClick={() => setComposerKind('Devis')}>Devis</button><button type="button" className={composerKind === 'Facture' ? 'selected' : ''} onClick={() => setComposerKind('Facture')}>Facture</button></div>
            <label>Client<input name="client" required placeholder="Ex. Maison Rivière" /></label>
            <label>Intitulé<input name="title" required placeholder="Ex. Accompagnement mensuel" /></label>
            <label>Montant HT<input name="amount" type="number" min="0" required placeholder="0" /></label>
            <button className="primary-action" type="submit"><Check size={16} /> Créer le document</button>
          </form>
        </div>
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onToast={setToast} />}
      {toast && <button className="toast anim-slide-up" onClick={() => setToast('')}><Check size={15} /> {toast}</button>}
    </div>
  );
}

function Dashboard({ firstName, messages, revenue, onNewAction }: { firstName: string; messages: DocumentItem[]; revenue: RevenuePoint[]; onNewAction: () => void }) {
  const unread = 4;
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
  return (
    <div className="content anim-fade-in">
      <div className="page-heading">
        <div><p className="eyebrow">{today}</p><h1>Bonjour {firstName} <span>✦</span></h1><p>Voici ce qui mérite votre attention aujourd’hui.</p></div>
        <div className="heading-actions"><button className="primary-action" onClick={onNewAction}><Plus size={16} /> Nouvelle action</button></div>
      </div>
      <div className="metric-grid">
        <Metric label="Chiffre d’affaires" value="12 500 €" meta="+ 14,2 %" sub="vs. mois dernier" icon={CircleDollarSign} tone="green" />
        <Metric label="En attente" value="8" meta="3 urgents" sub="actions à traiter" icon={Clock3} tone="orange" />
        <Metric label="À encaisser" value="5 700 €" meta="4 factures" sub="sur les 30 prochains jours" icon={WalletCards} tone="blue" />
        <Metric label="Temps économisé" value="6h 20" meta="+ 2h" sub="grâce à l’opérateur" icon={Sparkles} tone="violet" />
      </div>
      <div className="dashboard-grid">
        <div className="left-column">
          <div className="section-card revenue-chart-card">
            <div className="card-heading"><div><h3>Évolution du CA</h3><p>Chiffre d’affaires mensuel sur 8 mois</p></div><div className="chart-trend"><TrendingUp size={14} /> +102 %</div></div>
            <RevenueChart data={revenue} />
          </div>
          <div className="section-card agenda-card">
            <div className="card-heading"><div><h3>Votre journée</h3><p>3 rendez-vous et 4 actions prioritaires</p></div><button className="text-action">Voir le calendrier <ArrowUpRight size={13} /></button></div>
            <div className="agenda-item"><span className="agenda-time">09:30</span><div className="agenda-line"><i /></div><div className="agenda-content"><div><strong>Point stratégie</strong><span>avec Camille Laurent</span></div><b className="tag tag-blue">Dans 25 min</b></div></div>
            <div className="agenda-item"><span className="agenda-time">13:00</span><div className="agenda-line"><i /></div><div className="agenda-content"><div><strong>Validation du devis</strong><span>avec Maison Rivière</span></div><b className="tag tag-grey">Google Meet</b></div></div>
            <div className="agenda-item"><span className="agenda-time">16:30</span><div className="agenda-line"><i /></div><div className="agenda-content"><div><strong>Focus création</strong><span>Bloc de temps personnel</span></div><b className="tag tag-grey">2h</b></div></div>
          </div>
          <div className="section-card attention-card">
            <div className="card-heading"><div><h3>À traiter maintenant <span className="counter">{unread}</span></h3><p>L’opérateur a détecté ces priorités</p></div><button className="text-action">Tout voir <ArrowUpRight size={13} /></button></div>
            <Attention icon="mail" title="Répondre à Marc Dubois" detail="Il attend votre validation du devis depuis 2h" action="Préparer une réponse" />
            <Attention icon="file" title="Relancer 2 factures" detail="Échéance dépassée depuis 3 jours" action="Voir les factures" />
            <Attention icon="spark" title="Préparer votre réunion" detail="Brief disponible pour le point de 13:00" action="Ouvrir le brief" />
          </div>
        </div>
        <div className="right-column">
          <div className="section-card pipeline-card">
            <div className="card-heading"><div><h3>Pipeline commercial</h3><p>18 opportunités actives</p></div><button className="icon-btn"><MoreHorizontal size={17} /></button></div>
            <div className="pipeline-total"><strong>42 800 €</strong><span>potentiel total</span></div>
            <div className="pipeline-bars"><Bar label="Nouveaux" value="8 400 €" width="31%" color="blue" /><Bar label="Proposition" value="19 200 €" width="67%" color="violet" /><Bar label="Négociation" value="15 200 €" width="53%" color="orange" /></div>
            <button className="wide-action">Ouvrir le pipeline <ArrowUpRight size={14} /></button>
          </div>
          <div className="section-card activity-card">
            <div className="card-heading"><div><h3>Activité récente</h3><p>Les dernières actions de l’équipe</p></div><button className="text-action">Tout voir <ArrowUpRight size={13} /></button></div>
            <div className="activity-row"><div className="activity-icon activity-0"><Sparkles size={13} /></div><div><strong>AI Operator</strong><span>a préparé une recommandation</span></div><small>09:42</small></div>
            <div className="activity-row"><div className="activity-icon activity-1"><FileText size={13} /></div><div><strong>Devis D-2408</strong><span>créé pour Maison Rivière</span></div><small>08:15</small></div>
            <div className="activity-row"><div className="activity-icon activity-2"><CircleDollarSign size={13} /></div><div><strong>Facture F-1031</strong><span>payée par Studio Néon</span></div><small>Hier</small></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const chartData = useMemo(() => data.length > 0 ? data : [
    { month: 'Jan', amount: 6200 }, { month: 'Fév', amount: 7100 }, { month: 'Mar', amount: 6800 },
    { month: 'Avr', amount: 8300 }, { month: 'Mai', amount: 9100 }, { month: 'Juin', amount: 8700 },
    { month: 'Juil', amount: 10200 }, { month: 'Août', amount: 12500 },
  ], [data]);

  const max = Math.max(...chartData.map((d) => d.amount), 1);
  const width = 100;
  const height = 100;
  const step = width / (chartData.length - 1);
  const points = chartData.map((d, i) => ({ x: i * step, y: height - (d.amount / max) * (height - 10) - 5 }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className="revenue-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="chart-svg">
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9b72e8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#9b72e8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#revGrad)" className="chart-area" />
        <path d={linePath} fill="none" stroke="#9b72e8" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" className="chart-line" />
        {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="1.2" fill="#9b72e8" className="chart-dot" style={{ animationDelay: `${i * 80}ms` }} />)}
      </svg>
      <div className="chart-labels">{chartData.map((d) => <span key={d.month}>{d.month}</span>)}</div>
    </div>
  );
}

function Metric({ label, value, meta, sub, icon: Icon, tone }: { label: string; value: string; meta: string; sub: string; icon: typeof CircleDollarSign; tone: string }) {
  return <div className="metric-card anim-card"><div className={`metric-icon ${tone}`}><Icon size={17} /></div><span className="metric-label">{label}</span><strong>{value}</strong><div className="metric-meta"><b className={tone}>{meta}</b><span>{sub}</span></div></div>;
}
function Attention({ icon, title, detail, action }: { icon: string; title: string; detail: string; action: string }) {
  return <div className="attention-row"><div className={`attention-icon ${icon}`}>{icon === 'mail' ? <Inbox size={15} /> : icon === 'file' ? <FileText size={15} /> : <Sparkles size={15} />}</div><div className="attention-copy"><strong>{title}</strong><span>{detail}</span></div><button>{action}<ChevronRight size={13} /></button></div>;
}
function Bar({ label, value, width, color }: { label: string; value: string; width: string; color: string }) {
  return <div className="bar-row"><div><span>{label}</span><b>{value}</b></div><div className="bar-track"><i className={color} style={{ width }} /></div></div>;
}
function SectionView({ activeNav, documentList, onCreate }: { activeNav: string; documentList: DocumentItem[]; onCreate: (kind: 'Devis' | 'Facture') => void }) {
  const isDocs = activeNav === 'Documents' || activeNav === 'Finances';
  return <div className="content anim-fade-in"><div className="page-heading"><div><p className="eyebrow">ESPACE DE TRAVAIL</p><h1>{activeNav}</h1><p>Centralisez les informations et laissez l’opérateur vous aider.</p></div><div className="heading-actions">{isDocs && <><button className="secondary-action" onClick={() => onCreate('Facture')}><FileText size={15} /> Nouvelle facture</button><button className="primary-action" onClick={() => onCreate('Devis')}><Plus size={16} /> Nouveau devis</button></>}</div></div><div className="section-card full-list"><div className="card-heading"><div><h3>{isDocs ? 'Documents récents' : 'Vue de ' + activeNav.toLowerCase()}</h3><p>{isDocs ? 'Suivez vos devis et factures en un seul endroit.' : 'Cette vue sera pilotée par vos prochaines demandes.'}</p></div><button className="text-action"><Search size={14} /> Rechercher</button></div>{isDocs ? documentList.map((document) => <div className="document-row" key={document.id}><div className={`document-icon ${document.kind === 'Devis' ? 'doc-blue' : 'doc-orange'}`}><FileText size={18} /></div><div className="document-name"><strong>{document.title}</strong><span>{document.id} · {document.client}</span></div><span className="document-kind">{document.kind}</span><strong className="document-amount">{formatCurrency(document.amount)}</strong><span className={`status ${document.status === 'Payée' ? 'status-paid' : document.status === 'À envoyer' ? 'status-ready' : 'status-pending'}`}>{document.status}</span><button className="icon-btn"><MoreHorizontal size={17} /></button></div>) : <div className="empty-state"><div className="empty-icon"><Sparkles size={24} /></div><h2>Demandez à l’opérateur</h2><p>Il peut retrouver une information, préparer une réponse ou lancer une action pour vous.</p></div>}</div></div>;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  return <AppInner />;
}
