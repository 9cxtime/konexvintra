import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Mic, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';

type OperatorAction = { type: string; label: string };

type SpeechRecognitionEvent = { results: { [key: number]: { [key: number]: { transcript: string } } } };
type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: () => void;
  onend: () => void;
};

export function OperatorView({ onAction }: { onAction: (action: OperatorAction) => void }) {
  const { profile, session } = useAuth();
  const [mode, setMode] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const firstName = (profile?.full_name || 'Nathan').split(' ')[0];

  useEffect(() => () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) {
      setMode('idle');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.04;
    utterance.pitch = 1;
    utterance.onstart = () => setMode('speaking');
    utterance.onend = () => setMode('idle');
    utterance.onerror = () => setMode('idle');
    window.speechSynthesis.speak(utterance);
  };

  const stopSession = () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    setMode('idle');
  };

  const askOperator = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setTranscript(trimmed);
    setTextInput('');
    setError(null);
    setMode('thinking');
    try {
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('no-session');
      const responseData = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-operator`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: trimmed, history: [] }),
      });
      if (!responseData.ok) throw new Error('request-failed');
      const data: { response?: string; action?: OperatorAction } = await responseData.json();
      if (!data.response) throw new Error('invalid-response');
      setResponse(data.response);
      speak(data.response);
      if (data.action) window.setTimeout(() => onAction(data.action as OperatorAction), 500);
    } catch {
      setMode('idle');
      setError("Je n'ai pas pu joindre l'opérateur. Vérifiez votre connexion puis réessayez.");
    }
  };

  const startListening = () => {
    if (mode === 'speaking') {
      stopSession();
      return;
    }
    const SpeechRecognition = (window as Window & { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("La commande vocale n'est pas disponible dans ce navigateur. Vous pouvez utiliser l'écriture ci-dessous.");
      setShowTextInput(true);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      setMode('thinking');
      void askOperator(event.results[0][0].transcript);
    };
    recognition.onerror = () => {
      setMode('idle');
      setError("Je n'ai pas bien entendu. Appuyez sur le bouton et réessayez.");
    };
    recognition.onend = () => {
      if (mode === 'listening') setMode('idle');
    };
    recognitionRef.current = recognition;
    setError(null);
    setMode('listening');
    recognition.start();
  };

  const statusText = mode === 'listening' ? 'Je vous écoute...' : mode === 'thinking' ? 'Je réfléchis...' : mode === 'speaking' ? 'Je vous réponds...' : 'Appuyez pour parler';
  const subtitle = mode === 'idle' ? `Bonjour ${firstName}, qu'est-ce que je peux faire pour vous aujourd'hui ?` : mode === 'listening' ? 'Dites-moi ce que vous souhaitez organiser.' : mode === 'thinking' ? 'Je prépare une réponse pour vous.' : response || 'Voici ce que j’ai trouvé pour vous.';
  const quickActions = ['Quels sont mes mails non lus ?', 'Montre-moi mon CA', 'Crée un devis'];

  return (
    <div className="voice-operator anim-fade-in">
      <div className="voice-topbar">
        <div className="voice-brand"><div className="operator-logo"><Sparkles size={17} /></div><div><strong>IA Operator</strong><span><i className="status-dot" /> En ligne</span></div></div>
        <span className="voice-privacy"><Check size={12} /> Session privée</span>
      </div>
      <div className="voice-stage">
        <div className="voice-copy"><span className="eyebrow">VOTRE ASSISTANT PERSONNEL</span><h1>{subtitle}</h1>{transcript && <p className="heard-text">« {transcript} »</p>}</div>
        <button className={`voice-orb orb-${mode}`} onClick={startListening} aria-label={statusText}>
          <span className="orb-halo halo-one" /><span className="orb-halo halo-two" /><span className="orb-core"><Sparkles size={34} /></span>
        </button>
        <div className={`voice-status status-${mode}`}><span className="voice-status-dot" /> {statusText}</div>
        {error && <div className="voice-error"><X size={14} /> {error}</div>}
        <div className="quick-actions"><span>Suggestions</span>{quickActions.map((action) => <button key={action} onClick={() => void askOperator(action)}>{action}<ArrowRight size={13} /></button>)}</div>
      </div>
      <div className="voice-controls">
        <button className="text-toggle" onClick={() => setShowTextInput((value) => !value)}>{showTextInput ? 'Fermer l’écriture' : 'Ou écrire une demande'}</button>
        {mode === 'speaking' && <button className="stop-voice" onClick={stopSession}>Arrêter la réponse</button>}
        {showTextInput && <form className="voice-text-form" onSubmit={(event) => { event.preventDefault(); void askOperator(textInput); }}><input autoFocus value={textInput} onChange={(event) => setTextInput(event.target.value)} placeholder="Écrivez votre demande ici..." /><button type="submit"><ArrowRight size={16} /></button></form>}
        <div className="voice-hint"><Mic size={14} /> {mode === 'listening' ? 'Parlez naturellement, je m’occupe du reste.' : 'Votre voix reste privée et n’est pas enregistrée.'}</div>
      </div>
    </div>
  );
}
