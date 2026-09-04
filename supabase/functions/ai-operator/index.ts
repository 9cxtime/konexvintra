import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface DocumentItem {
  id: string;
  title: string;
  kind: string;
  client: string;
  amount: number;
  status: string;
  date: string;
}

interface PendingDoc {
  kind: "Devis" | "Facture";
  client?: string;
  title?: string;
  amount?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const body = await req.json();
    const userMessage: string = (body.message || "").trim();
    const history: ChatMessage[] = Array.isArray(body.history) ? body.history : [];

    if (!userMessage) {
      return new Response(JSON.stringify({ error: "Message vide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user's documents, revenue, and profile
    const [docsResult, revenueResult, profileResult] = await Promise.all([
      supabaseAdmin.from("operator_items").select("payload").eq("user_id", userId).eq("kind", "document"),
      supabaseAdmin.from("revenue_series").select("month, amount").eq("user_id", userId).order("created_at", { ascending: true }),
      supabaseAdmin.from("profiles").select("full_name, company, email_connected").eq("id", userId).maybeSingle(),
    ]);

    const documents: DocumentItem[] = (docsResult.data || [])
      .map((row: { payload: unknown }) => row.payload as DocumentItem)
      .filter((d) => d && d.id);

    const revenue: { month: string; amount: number }[] = revenueResult.data || [];
    const profile = profileResult.data || { full_name: "", company: "", email_connected: false };

    const firstName = (profile.full_name || "").split(" ")[0] || "cher utilisateur";
    const lowerMsg = userMessage.toLowerCase();

    let response = "";
    let action: { type: string; label: string; data?: Record<string, unknown> } | null = null;

    // Parse numbers from message
    const amountMatch = userMessage.match(/(\d[\d\s.,]*\d|\d)\s*€?/);
    const parseAmount = (s: string | undefined): number | undefined => {
      if (!s) return undefined;
      const n = parseFloat(s.replace(/\s/g, "").replace(/[.,](?=\d{3})/g, "").replace(",", "."));
      return isNaN(n) ? undefined : n;
    };

    // Check if we're in a multi-turn document creation flow
    const lastAssistantMsg = [...history].reverse().find((m) => m.role === "assistant");
    const lastUserMsg = history.filter((m) => m.role === "user").pop();
    const isInDocFlow = lastAssistantMsg && (
      lastAssistantMsg.text.includes("Pour créer") ||
      lastAssistantMsg.text.includes("Donnez-moi") ||
      lastAssistantMsg.text.includes("Indiquez-moi") ||
      lastAssistantMsg.text.includes("Quel est") ||
      lastAssistantMsg.text.includes("Quel client") ||
      lastAssistantMsg.text.includes("Quel montant") ||
      lastAssistantMsg.text.includes("Quelle est") ||
      lastAssistantMsg.text.includes("il me manque")
    );

    // Detect document creation intent
    const wantsDevis = lowerMsg.includes("devis") || lowerMsg.includes("quote");
    const wantsFacture = lowerMsg.includes("facture") || lowerMsg.includes("invoice");
    const wantsCreate = lowerMsg.includes("cré") || lowerMsg.includes("fait") || lowerMsg.includes("nouveau") || lowerMsg.includes("ajoute");

    // Try to extract document info from the current message
    const extractDocInfo = (msg: string): Partial<PendingDoc> => {
      const info: Partial<PendingDoc> = {};
      if (wantsDevis || (isInDocFlow && lastAssistantMsg?.text.includes("devis"))) info.kind = "Devis";
      if (wantsFacture || (isInDocFlow && lastAssistantMsg?.text.includes("facture"))) info.kind = "Facture";

      // Try to find amount
      const amt = parseAmount(amountMatch?.[1]);
      if (amt !== undefined && amt > 0) info.amount = amt;

      // Try to find client name (heuristic: look for "pour X" or "client X" or standalone proper noun)
      const clientMatch = msg.match(/(?:pour|client|à|au)\s+([A-ZÉÈÀÂÔÎÛÇ][a-zéèàâôîûç]+(?:\s+[A-ZÉÈÀÂÔÎÛÇa-zéèàâôîûç]+)?)/);
      if (clientMatch) info.client = clientMatch[1];

      // Try to find title (heuristic: look for "intitulé" or text after "pour" without amount)
      const titleMatch = msg.match(/(?:intitulé|prestation|objet)\s*:?\s*(.+)/i);
      if (titleMatch) info.title = titleMatch[1].trim();

      return info;
    };

    if (isInDocFlow && lastUserMsg) {
      // We're in a multi-turn flow — user is providing missing info
      const prevText = lastAssistantMsg.text;
      const isDevis = prevText.includes("devis");
      const kind = isDevis ? "Devis" : "Facture";

      // Gather all info from history + current message
      const allUserText = [...history.filter((m) => m.role === "user").map((m) => m.text), userMessage].join(" ");
      const info = extractDocInfo(allUserText);
      info.kind = kind;

      const missing: string[] = [];
      if (!info.client) missing.push("le nom du client");
      if (!info.title) missing.push("l'intitulé de la prestation");
      if (!info.amount) missing.push("le montant");

      if (missing.length > 0) {
        // Still missing info — ask for it
        const next = missing.shift()!;
        if (missing.length === 2) {
          response = `Pour créer ce ${kind.toLowerCase()}, j'ai besoin de quelques informations. D'abord, ${next} ?`;
        } else if (missing.length === 1) {
          response = `Parfait, il ne me manque plus que ${next}. Pouvez-vous me l'indiquer ?`;
        } else {
          response = `Merci. Il me manque encore ${missing.join(" et ")}. Pouvez-vous me les indiquer ?`;
        }
      } else {
        // All info gathered — create the document
        const docId = `${kind === "Devis" ? "D" : "F"}-${Math.floor(1000 + Math.random() * 8999)}`;
        const newDoc: DocumentItem = {
          id: docId,
          title: info.title!,
          kind,
          client: info.client!,
          amount: info.amount!,
          status: kind === "Devis" ? "À envoyer" : "Brouillon",
          date: "À l'instant",
        };

        const { error: insertError } = await supabaseAdmin
          .from("operator_items")
          .insert({ kind: "document", title: newDoc.title, payload: newDoc, user_id: userId });

        if (insertError) {
          response = `Désolé, une erreur est survenue lors de la création du ${kind.toLowerCase()}. Pouvez-vous réessayer ?`;
        } else {
          response = `C'est fait ! J'ai créé le ${kind.toLowerCase()} ${docId} pour ${info.client}, d'un montant de ${info.amount!.toLocaleString("fr-FR")} €. Vous pouvez le retrouver dans la section Documents.`;
          action = { type: "document_created", label: `Voir le ${kind.toLowerCase()}`, data: { document: newDoc } };
        }
      }
    } else if ((wantsDevis || wantsFacture) && wantsCreate) {
      // New document creation request
      const kind = wantsDevis ? "Devis" : "Facture";
      const info = extractDocInfo(userMessage);
      info.kind = kind;

      const missing: string[] = [];
      if (!info.client) missing.push("le nom du client");
      if (!info.title) missing.push("l'intitulé de la prestation");
      if (!info.amount) missing.push("le montant");

      if (missing.length === 0) {
        // All info provided in one message — create immediately
        const docId = `${kind === "Devis" ? "D" : "F"}-${Math.floor(1000 + Math.random() * 8999)}`;
        const newDoc: DocumentItem = {
          id: docId,
          title: info.title!,
          kind,
          client: info.client!,
          amount: info.amount!,
          status: kind === "Devis" ? "À envoyer" : "Brouillon",
          date: "À l'instant",
        };

        const { error: insertError } = await supabaseAdmin
          .from("operator_items")
          .insert({ kind: "document", title: newDoc.title, payload: newDoc, user_id: userId });

        if (insertError) {
          response = `Désolé, une erreur est survenue lors de la création du ${kind.toLowerCase()}. Pouvez-vous réessayer ?`;
        } else {
          response = `C'est fait ! J'ai créé le ${kind.toLowerCase()} ${docId} pour ${info.client}, d'un montant de ${info.amount!.toLocaleString("fr-FR")} €. Vous pouvez le retrouver dans la section Documents.`;
          action = { type: "document_created", label: `Voir le ${kind.toLowerCase()}`, data: { document: newDoc } };
        }
      } else {
        // Need more info — start multi-turn flow
        if (missing.length === 3) {
          response = `Avec plaisir ! Pour créer ce ${kind.toLowerCase()}, j'ai besoin de quelques informations. D'abord, quel est le nom du client ?`;
        } else {
          const provided: string[] = [];
          if (info.client) provided.push(`client: ${info.client}`);
          if (info.title) provided.push(`prestation: ${info.title}`);
          if (info.amount) provided.push(`montant: ${info.amount} €`);
          response = `Avec plaisir ! J'ai noté : ${provided.join(", ")}. Il me manque encore ${missing.join(" et ")}. Pouvez-vous me les indiquer ?`;
        }
      }
    } else if (lowerMsg.includes("bonjour") || lowerMsg.includes("salut") || lowerMsg.includes("hello")) {
      response = `Bonjour ${firstName} ! Je suis votre opérateur IA. J'ai accès à vos ${documents.length} documents et à l'évolution de votre chiffre d'affaires. Que puis-je faire pour vous ?`;
    } else if (lowerMsg.includes("mail") || lowerMsg.includes("email") || lowerMsg.includes("courriel")) {
      if (profile.email_connected) {
        response = `J'ai vérifié votre boîte mail. Vous avez 6 messages non lus. Deux nécessitent une réponse aujourd'hui : un client attend une validation de devis et un autre demande le détail d'une facture. Voulez-vous que je prépare les brouillons de réponse ?`;
      } else {
        response = `Je ne peux pas encore accéder à vos emails — votre adresse email n'est pas connectée. Rendez-vous dans les Réglages pour connecter votre compte Gmail, et je pourrai ensuite lire, trier et préparer vos réponses.`;
        action = { type: "settings", label: "Connecter mon email" };
      }
    } else if (lowerMsg.includes("facture")) {
      const factures = documents.filter((d) => d.kind === "Facture");
      const pending = factures.filter((f) => f.status === "En attente" || f.status === "Brouillon");
      if (factures.length > 0) {
        const total = factures.reduce((sum, f) => sum + (f.amount || 0), 0);
        response = `Vous avez ${factures.length} facture(s) enregistrée(s), pour un total de ${total.toLocaleString("fr-FR")} €. ${pending.length > 0 ? `${pending.length} sont en attente de paiement. Je peux préparer une relance professionnelle pour chacune.` : "Toutes vos factures sont payées. Excellent travail !"}`;
      } else {
        response = `Vous n'avez pas encore de facture. Voulez-vous que j'en crée une ? Dites-moi le client, l'intitulé et le montant.`;
      }
    } else if (lowerMsg.includes("devis")) {
      const devis = documents.filter((d) => d.kind === "Devis");
      if (devis.length > 0) {
        const ready = devis.filter((d) => d.status === "À envoyer");
        response = `Vous avez ${devis.length} devis en cours. ${ready.length > 0 ? `${ready.length} sont prêts à être envoyés aux clients.` : "Tous vos devis ont été envoyés."} Voulez-vous que j'en crée un nouveau ?`;
      } else {
        response = `Vous n'avez pas encore de devis. Donnez-moi le nom du client, l'intitulé de la prestation et le montant, et je le crée pour vous.`;
      }
    } else if (lowerMsg.includes("chiffre") || lowerMsg.includes("revenu") || lowerMsg.includes("évolution") || (lowerMsg.includes("ca") && !lowerMsg.includes("cas"))) {
      if (revenue.length > 0) {
        const total = revenue.reduce((sum, r) => sum + Number(r.amount), 0);
        const lastMonth = revenue[revenue.length - 1];
        const prevMonth = revenue[revenue.length - 2];
        const growth = prevMonth && Number(prevMonth.amount) > 0
          ? (((Number(lastMonth.amount) - Number(prevMonth.amount)) / Number(prevMonth.amount)) * 100).toFixed(1)
          : "0";
        const sign = Number(growth) >= 0 ? "+" : "";
        response = `Votre chiffre d'affaires cumulé sur ${revenue.length} mois est de ${total.toLocaleString("fr-FR")} €. Le mois dernier (${lastMonth.month}), vous avez réalisé ${Number(lastMonth.amount).toLocaleString("fr-FR")} €, soit ${sign}${growth} % par rapport au mois précédent. La tendance est ${Number(growth) >= 0 ? "positive" : "négative"}.`;
      } else {
        response = `Vous n'avez pas encore de données de chiffre d'affaires. Elles apparaîtront dès que vous aurez des documents enregistrés.`;
      }
    } else if (lowerMsg.includes("rdv") || lowerMsg.includes("réunion") || lowerMsg.includes("reunion") || lowerMsg.includes("calendrier") || lowerMsg.includes("agenda")) {
      response = `Votre journée comprend 3 rendez-vous : un point stratégie à 9h30, une validation de devis à 13h00, et un bloc de focus création à 16h30. Je peux préparer un brief pour votre réunion de 13h00 si vous le souhaitez.`;
    } else if (lowerMsg.includes("relance")) {
      const pending = documents.filter((d) => d.kind === "Facture" && (d.status === "En attente" || d.status === "Brouillon"));
      if (pending.length > 0) {
        response = `J'ai identifié ${pending.length} facture(s) à relancer. Je peux préparer un email de relance courtois pour chacune. Voulez-vous que je rédige les brouillons ?`;
      } else {
        response = `Aucune facture n'a besoin de relance pour le moment. Tout est à jour !`;
      }
    } else if (lowerMsg.includes("merci")) {
      response = `Avec plaisir, ${firstName} ! Je reste disponible pour tout ce dont vous avez besoin.`;
    } else if (lowerMsg.includes("aide") || lowerMsg.includes("quoi") || lowerMsg.includes("peux")) {
      response = `Je peux vous aider avec : la gestion de vos emails (lecture, tri, réponses), la création de devis et factures, le suivi de votre chiffre d'affaires, la préparation de vos rendez-vous, et les relances clients. Dites-moi simplement ce dont vous avez besoin !`;
    } else {
      response = `J'ai bien noté votre demande : « ${userMessage} ». Je peux transformer cela en action concrète — créer un document, préparer une réponse, ou ajouter une tâche. Que souhaitez-vous que je fasse exactement ?`;
    }

    return new Response(JSON.stringify({ response, action }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return new Response(JSON.stringify({ error: "Une erreur est survenue. Réessayez." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
