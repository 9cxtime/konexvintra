import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Bell, CalendarDays, Check, ChevronDown, ChevronRight, CircleDollarSign, ClipboardList, Clock3, FileText, Inbox, LayoutDashboard, LogOut, Menu, MoveHorizontal as MoreHorizontal, Plus, Search, Settings as SettingsIcon, Sparkles, TrendingUp, Users, WalletCards, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth';
import { AuthScreen } from '@/components/AuthScreen';
import { SettingsModal } from '@/components/SettingsModal';
import { OperatorView } from '@/components/OperatorView';

type NavItem = { label: string; icon: typeof LayoutDashboard; badge?: number; section?: string };
type DocumentItem = { id: string; title: string; kind: 'Devis' | 'Facture'; client: string; amount: number; status: string; date: string };
type RevenuePoint = { month: string; amount: number };

const navItems: NavItem[] = [
  { label: 'Vue d\u2019ensemble', icon: LayoutDashboard },
  { label: 'IA Operator', icon: Sparkles, section: 'Assistant' },
  { label: 'Conversations', icon: Inbox },
  { label: 'Contacts', icon: Users },
  { label: 'Calendrier', icon: CalendarDays },
  { label: 'Documents', icon: FileText, section: 'Op\u00e9rations' },
  { label: 'Finances', icon: CircleDollarSign },
  { label: 'T\u00e2ches', icon: ClipboardList },
];

const formatCurrency = (amount: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);

const getInitials = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '??';

function AppInner() {
  const { user, profile, loading, signOut } = useAuth();
  const [activeNav, setActiveNav] = useState('Vue d\u2019ensemble');
  const [showComposer, setShowComposer] = useState(false);
  const [composerKind, setComposerKind] = useState<'Devis' | 'Facture'>('Devis');
  const [toast, setToast] = useState('');
  const [documentList, setDocumentList] = useState<DocumentItem[]>([]);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const displayName = profile?.full_name || 'Nathan Morel';
  const firstName = displayName.split(' ')[0];
  const initials = getInitials(displayName);
  const company = profile?.company || 'Studio ind\u00e9pendant';

  const loadData = useCallback(async () => {
    if (!supabase || !user) return;
    const [docsRes, revRes] = await Promise.all([
      supabase.from('operator_items').select('payload').eq('kind', 'document').order('updated_at', { ascending: false }),
      supabase.from('revenue_series').select('month, amount').order('created_at', { ascending: true }),
    ]);
    const savedDocs = (docsRes.data || []).map((r) => r.payload as DocumentItem).filter((d) => d && d.id);
    setDocumentList(savedDocs);
    if (revRes.data && revRes.data.length > 0) setRevenue(revRes.data as RevenuePoint[]);
  }, [user]);

  useEffect(() => { void loadData(); }, [loadData]);

  const createDocument = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const client = String(form.get('client') || 'Nouveau client');
    const amount = Number(form.get('amount') || 0);
    const next: DocumentItem = { id: `${composerKind === 'Devis' ? 'D' : 'F'}-${Math.floor(1000 + Math.random() * 8999)}`, title: String(form.get('title') || 'Nouvelle prestation'), kind: composerKind, client, amount, status: composerKind === 'Devis' ? '\u00c0 envoyer' : 'Brouillon', date: '\u00c0 l\u2019instant' };
    setDocumentList((current) => [next, ...current]);
    setShowComposer(false);
    setToast(`${composerKind} cr\u00e9\u00e9 pour ${client}`);
    if (supabase) void supabase.from('operator_items').insert({ kind: 'document', title: next.title, payload: next });
  };

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"><Sparkles size={32} /></div></div>;
  }

  if (!user) {
    return <AuthScreen />;
  }

  const docCount = documentList.length;
  const factures = documentList.filter((d) => d.kind === 'Facture');
  const devis = documentList.filter((d) => d.kind === 'Devis');
  const pendingFactures = factures.filter((f) => f.status !== 'Pay\u00e9e');
  const totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0);
  const aEncaisser = pendingFactures.reduce((sum, f) => sum + f.amount, 0);

  const navItemsWithBadges = navItems.map((item) => {
    if (item.label === 'Documents') return { ...item, badge: docCount > 0 ? docCount : undefined };
    return item;
  });

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand"><div className="brand-mark"><Sparkles size={16} /></div><span>Connex</span><button className="mobile-close" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>
        <div className="workspace-switcher"><div className="avatar avatar-violet">{initials[0] || 'N'}</div><div><strong>{displayName}</strong><span>{company}</span></div><ChevronDown size={14} /></div>
        <nav>
          {navItemsWithBadges.map((item) => <div key={item.label} className="nav-group">{item.section && <p className="nav-section">{item.section}</p>}<button className={`nav-item ${activeNav === item.label ? 'nav-active' : ''}`} onClick={() => { setActiveNav(item.label); setMobileOpen(false); }}><item.icon size={17} /><span>{item.label}</span>{item.badge && <b>{item.badge}</b>}</button></div>)}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setShowSettings(true)}><SettingsIcon size={17} /><span>R\u00e9glages</span></button>
          <div className="plan-card"><div className="plan-top"><span>Plan pro</span><span className="plan-dot" /></div><strong>Votre espace est \u00e0 jour</strong><div className="plan-line"><span /><span /></div><small>2,4 Go sur 10 Go utilis\u00e9s</small></div>
          <div className="profile"><div className="avatar avatar-orange">{initials}</div><div><strong>{displayName}</strong><span>{profile?.email_connected ? 'Email connect\u00e9' : 'Compte standard'}</span></div><button className="icon-btn" onClick={signOut} title="D\u00e9connexion"><LogOut size={15} /></button></div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={21} /></button>
          <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{activeNav}</strong></div>
          <div className="top-actions">
            <button className="icon-btn" onClick={() => { setActiveNav('IA Operator'); }}><Search size={18} /></button>
            <button className="icon-btn notification" onClick={() => setShowSettings(true)}><Bell size={18} /><i /></button>
            <button className="top-avatar" onClick={() => setShowSettings(true)} title="R\u00e9glages">{initials}</button>
          </div>
        </header>
        {activeNav === 'IA Operator' ? (
          <OperatorView onAction={(action) => {
            if (action.type === 'create_quote') { setComposerKind('Devis'); setShowComposer(true); setActiveNav('Documents'); }
            else if (action.type === 'create_invoice') { setComposerKind('Facture'); setShowComposer(true); setActiveNav('Documents'); }
            else if (action.type === 'document_created') {
              void loadData();
              setActiveNav('Documents');
              if (action.data?.document) {
                const doc = action.data.document as DocumentItem;
                setToast(`${doc.kind} ${doc.id} cr\u00e9\u00e9 pour ${doc.client}`);
              }
            }
            else if (action.type === 'settings') setShowSettings(true);
          }} />
        ) : activeNav === 'Vue d\u2019ensemble' ? (
          <Dashboard
            firstName={firstName}
            documentList={documentList}
            revenue={revenue}
            totalRevenue={totalRevenue}
            aEncaisser={aEncaisser}
            pendingCount={pendingFactures.length}
            docCount={docCount}
            emailConnected={profile?.email_connected || false}
            onNewAction={() => { setComposerKind('Devis'); setShowComposer(true); }}
            onGoOperator={() => setActiveNav('IA Operator')}
            onGoSettings={() => setShowSettings(true)}
            onGoDocuments={() => setActiveNav('Documents')}
            onGoCalendar={() => setActiveNav('Calendrier')}
          />
        ) : (
          <SectionView activeNav={activeNav} documentList={documentList} onCreate={(kind) => { setComposerKind(kind); setShowComposer(true); }} />
        )}
      </main>
      {showComposer && (
        <div className="modal-backdrop" onClick={() => setShowComposer(false)}>
          <form className="document-modal anim-pop" onSubmit={createDocument} onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading"><div><span className="eyebrow">NOUVEAU DOCUMENT</span><h2>Cr\u00e9er un {composerKind.toLowerCase()}</h2></div><button type="button" className="icon-btn" onClick={() => setShowComposer(false)}><X size={18} /></button></div>
            <div className="kind-switch"><button type="button" className={composerKind === 'Devis' ? 'selected' : ''} onClick={() => setComposerKind('Devis')}>Devis</button><button type="button" className={composerKind === 'Facture' ? 'selected' : ''} onClick={() => setComposerKind('Facture')}>Facture</button></div>
            <label>Client<input name="client" required placeholder="Ex. Maison Rivi\u00e8re" /></label>
            <label>Intitul\u00e9<input name="title" required placeholder="Ex. Accompagnement mensuel" /></label>
            <label>Montant HT<input name="amount" type="number" min="0" required placeholder="0" /></label>
            <button className="primary-action" type="submit"><Check size={16} /> Cr\u00e9er le document</button>
          </form>
        </div>
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onToast={setToast} />}
      {toast && <button className="toast anim-slide-up" onClick={() => setToast('')}><Check size={15} /> {toast}</button>}
    </div>
  );
}

function Dashboard({ firstName, documentList, revenue, totalRevenue, aEncaisser, pendingCount, docCount, emailConnected, onNewAction, onGoOperator, onGoSettings, onGoDocuments, onGoCalendar }: {
  firstName: string;
  documentList: DocumentItem[];
  revenue: RevenuePoint[];
  totalRevenue: number;
  aEncaisser: number;
  pendingCount: number;
  docCount: number;
  emailConnected: boolean;
  onNewAction: () => void;
  onGoOperator: () => void;
  onGoSettings: () => void;
  onGoDocuments: () => void;
  onGoCalendar: () => void;
}) {
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
  const hasData = docCount > 0 || revenue.length > 0;

  return (
    <div className="content anim-fade-in">
      <div className="page-heading">
        <div><p className="eyebrow">{today}</p><h1>Bonjour {firstName} <span>\u2726</span></h1><p>{hasData ? 'Voici ce qui m\u00e9rite votre attention aujourd\u2019hui.' : 'Bienvenue ! Commencez par cr\u00e9er votre premier document ou demandez \u00e0 l\u2019op\u00e9rateur IA.'}</p></div>
        <div className="heading-actions"><button className="primary-action" onClick={onNewAction}><Plus size={16} /> Nouvelle action</button></div>
      </div>
      <div className="metric-grid">
        <Metric label="Chiffre d\u2019affaires" value={totalRevenue > 0 ? formatCurrency(totalRevenue) : '0 \u20ac'} meta={revenue.length > 0 ? `${revenue.length} mois` : '\u2014'} sub="cumul\u00e9" icon={CircleDollarSign} tone="green" />
        <Metric label="Documents" value={String(docCount)} meta={`${documentList.filter((d) => d.kind === 'Devis').length} devis`} sub={`${documentList.filter((d) => d.kind === 'Facture').length} factures`} icon={FileText} tone="orange" />
        <Metric label="\u00c0 encaisser" value={aEncaisser > 0 ? formatCurrency(aEncaisser) : '0 \u20ac'} meta={pendingCount > 0 ? `${pendingCount} factures` : '\u00e0 jour'} sub="en attente" icon={WalletCards} tone="blue" />
        <Metric label="Email" value={emailConnected ? 'Connect\u00e9' : 'Non'} meta={emailConnected ? 'Actif' : 'D\u00e9connect\u00e9'} sub={emailConnected ? 'op\u00e9rateur actif' : 'voir r\u00e9glages'} icon={Inbox} tone={emailConnected ? 'green' : 'violet'} />
      </div>
      <div className="dashboard-grid">
        <div className="left-column">
          <div className="section-card revenue-chart-card">
            <div className="card-heading"><div><h3>\u00c9volution du CA</h3><p>{revenue.length > 0 ? `Chiffre d\u2019affaires mensuel sur ${revenue.length} mois` : 'Aucune donn\u00e9e pour le moment'}</p></div>{revenue.length > 0 && <div className="chart-trend"><TrendingUp size={14} /> {totalRevenue > 0 ? '+' + Math.round((totalRevenue / Math.max(revenue.length, 1))) + ' \u20ac/mois' : ''}</div>}</div>
            <RevenueChart data={revenue} />
          </div>
          <div className="section-card agenda-card">
            <div className="card-heading"><div><h3>Votre journ\u00e9e</h3><p>3 rendez-vous et 4 actions prioritaires</p></div><button className="text-action" onClick={onGoCalendar}>Voir le calendrier <ArrowUpRight size={13} /></button></div>
            <div className="agenda-item"><span className="agenda-time">09:30</span><div className="agenda-line"><i /></div><div className="agenda-content"><div><strong>Point strat\u00e9gie</strong><span>avec Camille Laurent</span></div><b className="tag tag-blue">Dans 25 min</b></div></div>
            <div className="agenda-item"><span className="agenda-time">13:00</span><div className="agenda-line"><i /></div><div className="agenda-content"><div><strong>Validation du devis</strong><span>avec Maison Rivi\u00e8re</span></div><b className="tag tag-grey">Google Meet</b></div></div>
            <div className="agenda-item"><span className="agenda-time">16:30</span><div className="agenda-line"><i /></div><div className="agenda-content"><div><strong>Focus cr\u00e9ation</strong><span>Bloc de temps personnel</span></div><b className="tag tag-grey">2h</b></div></div>
          </div>
          <div className="section-card attention-card">
            <div className="card-heading"><div><h3>\u00c0 traiter maintenant</h3><p>L\u2019op\u00e9rateur peut vous aider</p></div><button className="text-action" onClick={onGoOperator}>Demander \u00e0 l\u2019IA <ArrowUpRight size={13} /></button></div>
            {emailConnected ? (
              <Attention icon="mail" title="V\u00e9rifier vos emails" detail="L\u2019op\u00e9rateur peut lire et trier vos messages" action="Ouvrir l\u2019op\u00e9rateur" onClick={onGoOperator} />
            ) : (
              <Attention icon="mail" title="Connecter votre email" detail="Permettez \u00e0 l\u2019IA de g\u00e9rer vos emails" action="Voir les r\u00e9glages" onClick={onGoSettings} />
            )}
            {pendingCount > 0 && (
              <Attention icon="file" title={`Relancer ${pendingCount} facture${pendingCount > 1 ? 's' : ''}`} detail="\u00c9ch\u00e9ance d\u00e9pass\u00e9e" action="Voir les factures" onClick={onGoDocuments} />
            )}
            <Attention icon="spark" title="Pr\u00e9parer votre r\u00e9union" detail="Brief disponible pour le point de 13:00" action="Ouvrir le brief" onClick={onGoOperator} />
          </div>
        </div>
        <div className="right-column">
          <div className="section-card pipeline-card">
            <div className="card-heading"><div><h3>Pipeline commercial</h3><p>{docCount > 0 ? `${docCount} document${docCount > 1 ? 's' : ''} actif${docCount > 1 ? 's' : ''}` : 'Aucun document'}</p></div><button className="icon-btn"><MoreHorizontal size={17} /></button></div>
            <div className="pipeline-total"><strong>{docCount > 0 ? formatCurrency(documentList.reduce((s, d) => s + d.amount, 0)) : '0 \u20ac'}</strong><span>valeur totale</span></div>
            <div className="pipeline-bars">
              <Bar label="Devis" value={formatCurrency(devis.reduce((s, d) => s + d.amount, 0))} width={`${devis.length > 0 ? Math.min((devis.length / Math.max(docCount, 1)) * 100, 100) : 0}%`} color="blue" />
              <Bar label="Factures" value={formatCurrency(factures.reduce((s, d) => s + d.amount, 0))} width={`${factures.length > 0 ? Math.min((factures.length / Math.max(docCount, 1)) * 100, 100) : 0}%`} color="orange" />
            </div>
            <button className="wide-action" onClick={onGoDocuments}>Voir les documents <ArrowUpRight size={14} /></button>
          </div>
          <div className="section-card activity-card">
            <div className="card-heading"><div><h3>Activit\u00e9 r\u00e9cente</h3><p>Vos derniers documents</p></div></div>
            {documentList.length > 0 ? documentList.slice(0, 4).map((doc, i) => (
              <div key={doc.id} className="activity-row"><div className={`activity-icon activity-${i % 3}`}>{doc.kind === 'Devis' ? <FileText size={13} /> : <CircleDollarSign size={13} />}</div><div><strong>{doc.id}</strong><span>{doc.kind} pour {doc.client}</span></div><small>{doc.date}</small></div>
            )) : (
              <div className="activity-row"><div className="activity-icon activity-0"><Sparkles size={13} /></div><div><strong>Aucune activit\u00e9</strong><span>Cr\u00e9ez votre premier document</span></div></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const chartData = useMemo(() => data.length > 0 ? data : [], [data]);

  if (chartData.length === 0) {
    return <div className="revenue-chart"><div className="chart-empty"><Sparkles size={20} /><p>Aucune donn\u00e9e de chiffre d\u2019affaires pour le moment</p></div></div>;
  }

  const max = Math.max(...chartData.map((d) => d.amount), 1);
  const width = 100;
  const height = 100;
  const step = width / Math.max(chartData.length - 1, 1);
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
function Attention({ icon, title, detail, action, onClick }: { icon: string; title: string; detail: string; action: string; onClick: () => void }) {
  return <div className="attention-row"><div className={`attention-icon ${icon}`}>{icon === 'mail' ? <Inbox size={15} /> : icon === 'file' ? <FileText size={15} /> : <Sparkles size={15} />}</div><div className="attention-copy"><strong>{title}</strong><span>{detail}</span></div><button onClick={onClick}>{action}<ChevronRight size={13} /></button></div>;
}
function Bar({ label, value, width, color }: { label: string; value: string; width: string; color: string }) {
  return <div className="bar-row"><div><span>{label}</span><b>{value}</b></div><div className="bar-track"><i className={color} style={{ width }} /></div></div>;
}
function SectionView({ activeNav, documentList, onCreate }: { activeNav: string; documentList: DocumentItem[]; onCreate: (kind: 'Devis' | 'Facture') => void }) {
  const isDocs = activeNav === 'Documents' || activeNav === 'Finances';
  return <div className="content anim-fade-in"><div className="page-heading"><div><p className="eyebrow">ESPACE DE TRAVAIL</p><h1>{activeNav}</h1><p>{isDocs ? 'G\u00e9rez vos devis et factures.' : 'Centralisez les informations et laissez l\u2019op\u00e9rateur vous aider.'}</p></div><div className="heading-actions">{isDocs && <><button className="secondary-action" onClick={() => onCreate('Facture')}><FileText size={15} /> Nouvelle facture</button><button className="primary-action" onClick={() => onCreate('Devis')}><Plus size={16} /> Nouveau devis</button></>}</div></div><div className="section-card full-list"><div className="card-heading"><div><h3>{isDocs ? 'Documents' : 'Vue de ' + activeNav.toLowerCase()}</h3><p>{isDocs ? documentList.length > 0 ? `${documentList.length} document${documentList.length > 1 ? 's' : ''}` : 'Aucun document pour le moment' : 'Cette vue sera pilot\u00e9e par vos prochaines demandes.'}</p></div></div>{isDocs ? documentList.length > 0 ? documentList.map((document) => <div className="document-row" key={document.id}><div className={`document-icon ${document.kind === 'Devis' ? 'doc-blue' : 'doc-orange'}`}><FileText size={18} /></div><div className="document-name"><strong>{document.title}</strong><span>{document.id} \u00b7 {document.client}</span></div><span className="document-kind">{document.kind}</span><strong className="document-amount">{formatCurrency(document.amount)}</strong><span className={`status ${document.status === 'Pay\u00e9e' ? 'status-paid' : document.status === '\u00c0 envoyer' ? 'status-ready' : 'status-pending'}`}>{document.status}</span><button className="icon-btn"><MoreHorizontal size={17} /></button></div>) : <div className="empty-state"><div className="empty-icon"><FileText size={24} /></div><h2>Aucun document</h2><p>Cr\u00e9ez votre premier devis ou facture, ou demandez \u00e0 l\u2019op\u00e9rateur IA de le faire pour vous.</p></div> : <div className="empty-state"><div className="empty-icon"><Sparkles size={24} /></div><h2>Demandez \u00e0 l\u2019op\u00e9rateur</h2><p>Il peut retrouver une information, pr\u00e9parer une r\u00e9ponse ou lancer une action pour vous.</p></div>}</div></div>;
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
