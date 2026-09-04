import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowRight, Check, Mic, Sparkles, X, Send } from 'lucide-react';
import { useAuth } from '@/lib/auth';

type OperatorAction = { type: string; label: string; data?: Record<string, unknown> };

type ChatMessage = { role: 'user' | 'assistant'; text: string; time: string };

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

function getTime() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function OperatorView({ onAction }: { onAction: (action: OperatorAction) => void }) {
  const { profile, session } = useAuth();
  const [mode, setMode] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const firstName = (profile?.full_name || 'Nathan').split(' ')[0];
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis?.getVoices() || [];
      voicesRef.current = voices;
    };
    loadVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      setMode('idle');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = voicesRef.current.length > 0
      ? voicesRef.current
      : window.speechSynthesis?.getVoices() || [];

    const frVoices = voices.filter((v) => v.lang.startsWith('fr'));
    const preferred = frVoices.find((v) => /google/i.test(v.name))
      || frVoices.find((v) => /natural|amelie|audrey|marie|celine|thomas|julie/i.test(v.name))
      || frVoices.find((v) => v.lang === 'fr-FR')
      || frVoices[0];
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setMode('speaking');
    utterance.onend = () => setMode('idle');
    utterance.onerror = () => setMode('idle');
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSession = () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    setMode('idle');
  };

  const askOperator = useCallback(async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setTranscript(trimmed);
    setTextInput('');
    setError(null);
    setMode('thinking');
    const userMsg: ChatMessage = { role: 'user', text: trimmed, time: getTime() };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('no-session');
      const responseData = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-operator`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: trimmed, history: messages }),
      });
      if (!responseData.ok) throw new Error('request-failed');
      const data: { response?: string; action?: OperatorAction } = await responseData.json();
      if (!data.response) throw new Error('invalid-response');
      const aiMsg: ChatMessage = { role: 'assistant', text: data.response, time: getTime() };
      setMessages((prev) => [...prev, aiMsg]);
      speak(data.response);
      if (data.action) {
        window.setTimeout(() => onAction(data.action as OperatorAction), 600);
      }
    } catch {
      setMode('idle');
      setError("Je n'ai pas pu joindre l'opérateur. Vérifiez votre connexion puis réessayez.");
    }
  }, [session, messages, speak, onAction]);

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
  const subtitle = messages.length === 0
    ? `Bonjour ${firstName}, qu'est-ce que je peux faire pour vous aujourd'hui ?`
    : '';
  const quickActions = ['Crée un devis', 'Crée une facture', 'Quels sont mes mails non lus ?', 'Montre-moi mon CA'];

  return (
    <div className="voice-operator anim-fade-in">
      <div className="voice-topbar">
        <div className="voice-brand"><div className="operator-logo"><Sparkles size={17} /></div><div><strong>IA Operator</strong><span><i className="status-dot" /> En ligne</span></div></div>
        <span className="voice-privacy"><Check size={12} /> Session privée</span>
      </div>
      <div className="voice-stage">
        {messages.length === 0 ? (
          <>
            <div className="voice-copy"><span className="eyebrow">VOTRE ASSISTANT PERSONNEL</span><h1>{subtitle}</h1>{transcript && <p className="heard-text">« {transcript} »</p>}</div>
            <button className={`voice-orb orb-${mode}`} onClick={startListening} aria-label={statusText}>
              <span className="orb-halo halo-one" /><span className="orb-halo halo-two" /><span className="orb-core"><Sparkles size={34} /></span>
            </button>
            <div className={`voice-status status-${mode}`}><span className="voice-status-dot" /> {statusText}</div>
          </>
        ) : (
          <div className="voice-chat">
            {messages.map((msg, i) => (
              <div key={i} className={`voice-chat-msg ${msg.role} anim-msg-in`}>
                <div className="voice-chat-bubble">
                  {msg.role === 'assistant' && <div className="voice-chat-avatar"><Sparkles size={12} /></div>}
                  <p>{msg.text}</p>
                  <small>{msg.time}</small>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}
        {error && <div className="voice-error"><X size={14} /> {error}</div>}
        {messages.length === 0 && (
          <div className="quick-actions"><span>Suggestions</span>{quickActions.map((action) => <button key={action} onClick={() => void askOperator(action)}>{action}<ArrowRight size={13} /></button>)}</div>
        )}
      </div>
      <div className="voice-controls">
        <div className="voice-control-row">
          <button className="voice-mic-btn" onClick={startListening} aria-label={statusText}>
            <Mic size={18} />
          </button>
          <form className="voice-text-form" onSubmit={(event) => { event.preventDefault(); if (textInput.trim()) void askOperator(textInput); }}>
            <input value={textInput} onChange={(event) => setTextInput(event.target.value)} placeholder="Écrivez votre demande ici..." />
            <button type="submit"><Send size={16} /></button>
          </form>
          {mode === 'speaking' && <button className="stop-voice" onClick={stopSession}>Arrêter</button>}
        </div>
        <div className="voice-hint"><Mic size={14} /> {mode === 'listening' ? 'Parlez naturellement, je m\'occupe du reste.' : \'Votre voix reste privée et n'est pas enregistrée.'}</div>
      </div>
    </div>
  );
}
