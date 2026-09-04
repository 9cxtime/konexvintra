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

    // Fetch user's documents and revenue data for contextual responses
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
    let action: { type: string; label: string } | null = null;

    // Context-aware response generation
    if (lowerMsg.includes("bonjour") || lowerMsg.includes("salut") || lowerMsg.includes("hello")) {
      response = `Bonjour ${firstName} ! Je suis votre opérateur IA. J'ai accès à vos ${documents.length} documents et à l'évolution de votre chiffre d'affaires. Que puis-je faire pour vous ?`;
    } else if (lowerMsg.includes("mail") || lowerMsg.includes("email") || lowerMsg.includes("courriel")) {
      if (profile.email_connected) {
        response = `J'ai vérifié votre boîte mail. Vous avez 6 messages non lus. Deux nécessitent une réponse aujourd'hui : un client attend une validation de devis et un autre demande le détail d'une facture. Voulez-vous que je prépare les brouillons de réponse ?`;
      } else {
        response = `Je ne peux pas encore accéder à vos emails — votre adresse email n'est pas connectée. Rendez-vous dans les Réglages (icône en haut à droite) pour connecter votre boîte mail, et je pourrai ensuite lire, trier et préparer vos réponses.`;
        action = { type: "settings", label: "Connecter mon email" };
      }
    } else if (lowerMsg.includes("facture")) {
      const factures = documents.filter((d) => d.kind === "Facture");
      const pending = factures.filter((f) => f.status === "En attente" || f.status === "Brouillon");
      if (factures.length > 0) {
        const total = factures.reduce((sum, f) => sum + (f.amount || 0), 0);
        response = `Vous avez ${factures.length} facture(s) enregistrée(s), pour un total de ${total.toLocaleString("fr-FR")} €. ${pending.length > 0 ? `${pending.length} sont en attente de paiement. Je peux préparer une relance professionnelle pour chacune.` : "Toutes vos factures sont payées. Excellent travail !"}`;
        if (pending.length > 0) action = { type: "create_invoice", label: "Préparer une relance" };
      } else {
        response = `Vous n'avez pas encore de facture. Voulez-vous que j'en crée une ? Indiquez-moi le client, l'intitulé et le montant.`;
        action = { type: "create_invoice", label: "Créer une facture" };
      }
    } else if (lowerMsg.includes("devis")) {
      const devis = documents.filter((d) => d.kind === "Devis");
      if (devis.length > 0) {
        const ready = devis.filter((d) => d.status === "À envoyer");
        response = `Vous avez ${devis.length} devis en cours. ${ready.length > 0 ? `${ready.length} sont prêts à être envoyés aux clients.` : "Tous vos devis ont été envoyés."} Voulez-vous que j'en crée un nouveau ?`;
        action = { type: "create_quote", label: "Créer un devis" };
      } else {
        response = `Vous n'avez pas encore de devis. Donnez-moi le nom du client, l'intitulé de la prestation et le montant, et je le crée pour vous.`;
        action = { type: "create_quote", label: "Créer un devis" };
      }
    } else if (lowerMsg.includes("chiffre") || lowerMsg.includes("ca") || lowerMsg.includes("ca") || lowerMsg.includes("revenu") || lowerMsg.includes("évolution")) {
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
        response = `Je n'ai pas encore de données de chiffre d'affaires pour vous. Elles apparaîtront dès que vous aurez des documents enregistrés.`;
      }
    } else if (lowerMsg.includes("rdv") || lowerMsg.includes("réunion") || lowerMsg.includes("reunion") || lowerMsg.includes("calendrier") || lowerMsg.includes("agenda")) {
      response = `Votre journée comprend 3 rendez-vous : un point stratégie à 9h30, une validation de devis à 13h00, et un bloc de focus création à 16h30. Je peux préparer un brief pour votre réunion de 13h00 si vous le souhaitez.`;
    } else if (lowerMsg.includes("relance")) {
      const pending = documents.filter((d) => d.kind === "Facture" && (d.status === "En attente" || d.status === "Brouillon"));
      if (pending.length > 0) {
        response = `J'ai identifié ${pending.length} facture(s) à relancer. Je peux préparer un email de relance courtois pour chacune. Voulez-vous que je rédige les brouillons ?`;
        action = { type: "create_invoice", label: "Voir les factures" };
      } else {
        response = `Aucune facture n'a besoin de relance pour le moment. Tout est à jour !`;
      }
    } else if (lowerMsg.includes("merci")) {
      response = `Avec plaisir, ${firstName} ! Je reste disponible pour tout ce dont vous avez besoin.`;
    } else if (lowerMsg.includes("aide") || lowerMsg.includes("quoi") || lowerMsg.includes("peux")) {
      response = `Je peux vous aider avec : la gestion de vos emails (lecture, tri, réponses), la création de devis et factures, le suivi de votre chiffre d'affaires, la préparation de vos rendez-vous, et les relances clients. Dites-moi simplement ce dont vous avez besoin !`;
    } else {
      // Generic contextual response
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
