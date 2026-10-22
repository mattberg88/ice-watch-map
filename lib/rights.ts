import type { Lang } from "./i18n";

/**
 * Know-your-rights content and the phone card text. General information, not legal advice; it's based on
 * U.S. constitutional rights, California SB 54, AB 450 and AB 668, and ACILEP's guidance. Keep English and
 * Spanish in step, and have a legal aid group review any substantive change.
 */
export interface Right {
  title: string;
  say?: string;
  body: string;
}

export interface RightsContent {
  title: string;
  intro: string;
  rightsTitle: string;
  rights: Right[];
  dontTitle: string;
  donts: string[];
  witnessTitle: string;
  witness: string[];
  sanctuaryTitle: string;
  sanctuary: string;
  placesTitle: string;
  places: { title: string; body: string }[];
  disclaimer: string;
  cardTitle: string;
  cardIntro: string;
  save: string;
  saving: string;
  saved: string;
  back: string;
}

export const RIGHTS: Record<Lang, RightsContent> = {
  en: {
    title: "Know your rights",
    intro: "These rights apply to everyone in the U.S., whatever their immigration status, and anywhere in the country.",
    rightsTitle: "If ICE stops you or comes to your door",
    rights: [
      {
        title: "Stay silent",
        say: "I am exercising my right to remain silent.",
        body: "You don't have to answer questions about where you were born, your status or how you entered the U.S.",
      },
      {
        title: "Keep the door closed",
        say: "Please slide the warrant under the door.",
        body: "ICE can only enter with a warrant signed by a judge that has your correct name and address. An ICE form (I-200 or I-205) is not enough.",
      },
      { title: "Refuse searches", say: "I do not consent to a search.", body: "This covers you, your belongings, your car and your home." },
      { title: "Ask if you can leave", say: "Am I free to go?", body: "If they say yes, walk away calmly." },
      { title: "Ask for a lawyer", say: "I want to speak to a lawyer.", body: "Don't sign anything until you've talked to one." },
    ],
    dontTitle: "Don't",
    donts: ["Run, physically resist or block agents", "Lie, or carry false documents", "Sign papers you don't understand"],
    witnessTitle: "If you see ICE",
    witness: [
      "Call your county's rapid response hotline (see How to report).",
      "You can record from a safe distance. Don't block or interfere: that's a federal crime.",
      "Share only what you saw yourself. Unconfirmed sightings and fake photos spread fast.",
    ],
    sanctuaryTitle: "What \"sanctuary\" means",
    sanctuary:
      "In Oakland and across California (state law SB 54), local police and city staff don't help ICE with civil immigration enforcement or share your information with it. These rules limit local government only. They don't stop ICE agents from making arrests.",
    placesTitle: "California protections in specific places",
    places: [
      { title: "At work (AB 450)", body: "Your employer can't let ICE into private areas without a judicial warrant, and must tell workers before an I-9 document inspection." },
      { title: "At court (AB 668)", body: "Civil immigration arrests of people going to, attending or leaving court are prohibited in California. Federal agents dispute how far this applies to them." },
    ],
    disclaimer: "General information, not legal advice. For help, call ACILEP at (510) 241-4011 (daily, 6 AM–6 PM).",
    cardTitle: "Rights card for your phone",
    cardIntro: "Save this card to your photos. If ICE stops you, you can show it instead of talking.",
    save: "Save card to phone",
    saving: "Preparing…",
    saved: "Card saved",
    back: "Back to map",
  },
  es: {
    title: "Conozca sus derechos",
    intro: "Estos derechos son para todas las personas en EE. UU., sin importar su estatus migratorio, en cualquier parte del país.",
    rightsTitle: "Si ICE lo detiene o llega a su puerta",
    rights: [
      {
        title: "Guarde silencio",
        say: "Estoy ejerciendo mi derecho a guardar silencio.",
        body: "No tiene que contestar preguntas sobre dónde nació, su estatus o cómo entró a EE. UU.",
      },
      {
        title: "Mantenga la puerta cerrada",
        say: "Por favor, pase la orden por debajo de la puerta.",
        body: "ICE solo puede entrar con una orden firmada por un juez que tenga su nombre y dirección correctos. Un formulario de ICE (I-200 o I-205) no es suficiente.",
      },
      { title: "No permita registros", say: "No doy permiso para un registro.", body: "Esto incluye a usted, sus pertenencias, su carro y su casa." },
      { title: "Pregunte si se puede ir", say: "¿Me puedo ir?", body: "Si le dicen que sí, retírese con calma." },
      { title: "Pida un abogado", say: "Quiero hablar con un abogado.", body: "No firme nada hasta hablar con uno." },
    ],
    dontTitle: "No",
    donts: ["Corra, se resista físicamente ni bloquee a los agentes", "Mienta ni lleve documentos falsos", "Firme papeles que no entienda"],
    witnessTitle: "Si ve a ICE",
    witness: [
      "Llame a la línea de respuesta rápida de su condado (vea Cómo reportar).",
      "Puede grabar desde una distancia segura. No bloquee ni interfiera: es un delito federal.",
      "Comparta solo lo que usted vio. Los avistamientos sin confirmar y las fotos falsas se difunden rápido.",
    ],
    sanctuaryTitle: "Qué significa \"santuario\"",
    sanctuary:
      "En Oakland y en todo California (ley estatal SB 54), la policía local y el personal de la ciudad no ayudan a ICE con la aplicación de leyes migratorias civiles ni le comparten su información. Estas reglas solo limitan al gobierno local. No impiden que los agentes de ICE hagan arrestos.",
    placesTitle: "Protecciones de California en ciertos lugares",
    places: [
      { title: "En el trabajo (AB 450)", body: "Su empleador no puede dejar entrar a ICE a áreas privadas sin una orden judicial, y debe avisar a los trabajadores antes de una inspección de documentos I-9." },
      { title: "En la corte (AB 668)", body: "En California se prohíben los arrestos migratorios civiles de personas que van a la corte, están en ella o salen de ella. Los agentes federales disputan hasta dónde les aplica." },
    ],
    disclaimer: "Información general, no asesoría legal. Para ayuda, llame a ACILEP al (510) 241-4011 (todos los días, 6 a. m.–6 p. m.).",
    cardTitle: "Tarjeta de derechos para su teléfono",
    cardIntro: "Guarde esta tarjeta en sus fotos. Si ICE lo detiene, puede mostrarla en lugar de hablar.",
    save: "Guardar tarjeta en el teléfono",
    saving: "Preparando…",
    saved: "Tarjeta guardada",
    back: "Volver al mapa",
  },
};

/** Text shown to an agent. Always includes English (what agents read); Spanish is added for Spanish speakers. */
export const CARD_STATEMENT: Record<Lang, { heading: string; lines: string[] }> = {
  en: {
    heading: "KNOW YOUR RIGHTS",
    lines: [
      "I am exercising my right to remain silent under the Fifth Amendment.",
      "I will not answer questions or sign anything without speaking to a lawyer.",
      "I do not consent to a search of me, my belongings, my car or my home under the Fourth Amendment.",
      "Do not enter my home unless you have a warrant signed by a judge. Please slide it under the door.",
      "I want to speak with a lawyer.",
    ],
  },
  es: {
    heading: "CONOZCA SUS DERECHOS",
    lines: [
      "Estoy ejerciendo mi derecho a guardar silencio según la Quinta Enmienda.",
      "No contestaré preguntas ni firmaré nada sin hablar con un abogado.",
      "No doy permiso para un registro de mi persona, mis pertenencias, mi carro o mi casa, según la Cuarta Enmienda.",
      "No entren a mi casa sin una orden firmada por un juez. Por favor, pásenla por debajo de la puerta.",
      "Quiero hablar con un abogado.",
    ],
  },
};

export const CARD_HOTLINES = "ACILEP (Alameda): (510) 241-4011 · SF: (415) 200-1548";
