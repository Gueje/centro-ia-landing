import React, { useEffect, useMemo, useState } from "react";

// -------------------- Helpers & Hooks --------------------
const HEADER_OFFSET = 96;
function scrollToAnchor(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
  window.scrollTo({ top: y, behavior: "smooth" });
  try { window.history.replaceState(null, "", `#${id}`); } catch (e) { console.error(e); }
}

function useLocalBool(key, initial = false) {
  const init = () => {
    try {
      const s = localStorage.getItem(key);
      return s === null ? initial : s === "true";
    } catch {
      return initial;
    }
  };
  const [v, setV] = useState(init);
  const setValue = (newValue) => {
    try {
      localStorage.setItem(key, String(newValue));
      setV(newValue);
      window.dispatchEvent(new CustomEvent('progressUpdated'));
    } catch (e) {
      console.error(e);
    }
  };
  return [v, setValue];
}

function useDarkMode() {
  const [enabled, setEnabled] = useLocalBool("theme-dark", false);
  useEffect(() => {
    const root = document.documentElement;
    if (enabled) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [enabled]);
  return [enabled, setEnabled];
}

function extractText(node) {
  if (node == null) return "";
  const t = typeof node;
  if (t === "string" || t === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join(" ");
  if (t === "object" && node.props?.children) {
    return extractText(node.props.children);
  }
  return "";
}

function makeSnippet(full, lower, k) {
  if (!k) return full.slice(0, 160);
  const idx = lower.indexOf(k);
  const start = Math.max(0, idx === -1 ? 0 : idx - 60);
  const end = Math.min(full.length, idx === -1 ? 160 : idx + k.length + 80);
  const pre = start > 0 ? "…" : "";
  const post = end < full.length ? "…" : "";
  return pre + full.slice(start, end) + post;
}

// -------------------- Download helpers (PDF/.md) --------------------
function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function ensureJsPDF() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
  script.async = true;
  const p = new Promise((resolve, reject) => {
    script.onload = () => resolve(window.jspdf.jsPDF);
    script.onerror = reject;
  });
  document.body.appendChild(script);
  return p;
}

function mdToPlain(md) {
  const NL = "\n";
  let out = md;
  out = out.replace(/\*\*/g, "").replace(/`/g, "");
  out = out.replace(/\r\n/g, NL).replace(/\r/g, NL);
  out = out.replace(/^>\s?/gm, "");
  out = out.replace(/^\-\s+/gm, "• ");
  out = out.replace(/\[(.*?)\]\((.*?)\)/g, "$1");
  return out;
}

async function downloadPDF(filename, title, markdown) {
  try {
    const jsPDF = await ensureJsPDF();
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 15;
    const width = 210 - margin * 2;
    let y = margin;
    doc.setFont("helvetica", "bold"); doc.setFontSize(20);
    doc.text(title, margin, y); y += 8;
    doc.setDrawColor(60); doc.line(margin, y, 210 - margin, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    const paragraphs = mdToPlain(markdown).split(/\n\n+/);
    for (const para of paragraphs) {
      const lines = doc.splitTextToSize(para.trim(), width);
      for (const line of lines) {
        if (y > 297 - margin) { doc.addPage(); y = margin; }
        doc.text(line, margin, y); y += 6;
      }
      y += 2;
    }
    doc.save(filename);
  } catch (error) {
    console.error("Failed to generate PDF:", error);
  }
}

// -------------------- Content data --------------------
const external = {
  cursos: [
    { title: "Elements of AI (ES)", href: "https://www.elementsofai.com/es/" },
    { title: "AI for Everyone (Coursera)", href: "https://www.coursera.org/learn/ai-for-everyone-es" },
    { title: "Google: Introducción a IA Generativa", href: "https://www.cloudskillsboost.google/course_templates/536?locale=es" }
  ],
  docs: [
    { title: "OpenAI · Prompting", href: "https://help.openai.com/en/articles/10032626-prompt-engineering-best-practices-for-chatgpt" },
    { title: "Azure OpenAI · Prompting", href: "https://learn.microsoft.com/en/us/azure/ai-foundry/openai/concepts/prompt-engineering" }
  ],
  etica: [
    { title: "NIST AI RMF 1.0 (PDF)", href: "https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.100-1.pdf" },
    { title: "UNESCO · Guía IA generativa en educación", href: "https://unesdoc.unesco.org/ark:/48223/pf0000386693" },
    { title: "AEPD · RGPD e IA (PDF)", href: "https://www.aepd.es/guias/adecuacion-rgpd-ia.pdf" },
    { title: "OECD AI Principles", href: "https://oecd.ai/en/ai-principles" }
  ],
  videosES: [
    { title: "Xavier Mitjana", href: "https://www.youtube.com/@XavierMitjana" },
    { title: "Alejavi Rivera", href: "https://www.youtube.com/@alejavirivera" },
    { title: "Dot CSV", href: "https://www.youtube.com/@DotCSV" }
  ],
  fuentes: [
    { title: "Stanford HAI", href: "https://hai.stanford.edu/research" },
    { title: "MIT CSAIL", href: "https://www.csail.mit.edu/research" },
    { title: "Partnership on AI", href: "https://partnershiponai.org/" }
  ]
};

const PROMPTS_MD = "# Guía rápida de prompts\n\n- **Rol:** ¿Quién quieres que sea la IA? (un experto, un poeta...)\n- **Tarea:** ¿Qué quieres que haga? (resume, crea, compara...)\n- **Contexto:** ¿Qué información necesita saber?\n- **Formato:** ¿Cómo quieres la respuesta? (una tabla, una lista, un email...)\n- **Criterios:** ¿Qué define un buen resultado? (tono, longitud...).";
const GLOSARIO_MD = "# Glosario de IA (resumen)\n\n**IA:** Enseñar a las máquinas a hacer tareas humanas.\n**ML:** El 'entrenamiento' de la IA con muchos ejemplos.\n**LLM:** IA especializada en conversar y escribir.\n**Prompt:** La instrucción que le das a la IA.\n**Tokens y Contexto:** La 'memoria a corto plazo' de la IA.\n**Alucinación:** Cuando la IA inventa información.\n**RAG:** Técnica para que la IA responda usando TUS documentos.";
const RUTA_MD = "# Ruta de aprendizaje en 4 semanas\n\n**Semana 1: ¡Hola, IA!**\n- ¿Qué es y qué no es la IA?\n- Aprende a 'hablarle': tu primer prompt claro.\n- Juega con una herramienta de chat (ChatGPT, Gemini...).\n\n**Semana 2: Herramientas y trucos**\n- Descubre IAs que crean imágenes.\n- Usa una IA para organizar tus notas o resumir un video.\n- Entiende por qué es clave verificar la información.\n\n**Semana 3: La IA en tu día a día**\n- Úsala para escribir un email de trabajo.\n- Pídele ideas para planificar un viaje o una cena.\n- Explora cómo te puede ayudar en tu hobby favorito.\n\n**Semana 4: Uso responsable**\n- ¿Qué datos personales no deberías compartir nunca?\n- Aprende a detectar posibles sesgos en las respuestas.\n- Reflexiona: ¿cuándo es útil la IA y cuándo es mejor no usarla?";

// -------------------- UI Components (New, Updated, and Restored) --------------------

function SectionTitle({ id, children, meta, icon, color }) {
  return (
    <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
            <span className={`text-2xl ${color}`}>{icon}</span>
            <h2 id={id} className="scroll-mt-40 text-2xl md:text-3xl font-bold">{children}</h2>
        </div>
      {meta && <div className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{meta}</div>}
    </div>
  );
}

function KnowledgeCheck({ question, answer }) {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="mt-4 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/30 text-sm">
            <button onClick={() => setIsOpen(!isOpen)} className="flex justify-between items-center w-full p-3 font-semibold text-sky-800 dark:text-sky-200">
                <span>Comprueba tu comprensión</span>
                <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {isOpen && (
                <div className="p-3 border-t border-sky-200 dark:border-sky-800">
                    <p className="font-semibold">{question}</p>
                    <p className="mt-2 text-slate-700 dark:text-slate-300">{answer}</p>
                </div>
            )}
        </div>
    );
}

function Article({ id, title, summary, example, pitfalls, why, children, color, knowledgeCheck }) {
  const [done, setDone] = useLocalBool(`done-${id}`, false);
  const copyExample = () => {
    if (example) {
      const textArea = document.createElement("textarea");
      textArea.value = example;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };
  const accentColorClass = color ? `border-l-4 ${color.replace('text-', 'border-')}` : '';

  return (
    <article id={id} className={`rounded-2xl p-5 bg-white/80 dark:bg-slate-800/70 border dark:border-slate-700 shadow-sm scroll-mt-32 md:scroll-mt-40 ${accentColorClass}`}>
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <label className="flex items-center gap-2 text-sm cursor-pointer flex-shrink-0">
          <input type="checkbox" className="h-4 w-4" checked={done} onChange={(e) => setDone(e.target.checked)} />
          <span>Leído</span>
        </label>
      </div>
      {summary && <p className="mt-2 text-slate-700 dark:text-slate-200">{summary}</p>}
      {why && (
        <div className="mt-3 rounded-xl border border-amber-300 dark:border-amber-600/60 bg-amber-50 dark:bg-amber-900/20 p-4">
          <div className="text-xs font-semibold">¿Por qué es importante entender esto?</div>
          <p className="text-sm mt-1 text-slate-800 dark:text-slate-100">{why}</p>
        </div>
      )}
      <div className="prose prose-sm dark:prose-invert max-w-none mt-3">{children}</div>
      {example && (
        <div className="mt-4 rounded-xl border bg-slate-50 dark:bg-slate-900/40 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold">Ejemplo para probar</div>
            <button onClick={copyExample} className="text-xs underline">Copiar</button>
          </div>
          <pre className="whitespace-pre-wrap font-mono text-xs mt-2">{example}</pre>
        </div>
      )}
      {pitfalls && (
        <div className="mt-3 text-xs text-slate-600 dark:text-slate-300">
          <div className="font-semibold">Errores comunes a evitar</div>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            {pitfalls.map((p, i) => (<li key={i}>{p}</li>))}
          </ul>
        </div>
      )}
      {knowledgeCheck && <KnowledgeCheck question={knowledgeCheck.q} answer={knowledgeCheck.a} />}
    </article>
  );
}

function ProgressTracker({ allArticles }) {
    const total = allArticles.length;
    const [completed, setCompleted] = useState(0);

    const calculateProgress = () => {
        let count = 0;
        allArticles.forEach(article => {
            if (localStorage.getItem(`done-${article.id}`) === 'true') {
                count++;
            }
        });
        return count;
    };

    useEffect(() => {
        setCompleted(calculateProgress());
        const handleProgressUpdate = () => setCompleted(calculateProgress());
        window.addEventListener('progressUpdated', handleProgressUpdate);
        return () => window.removeEventListener('progressUpdated', handleProgressUpdate);
    }, [allArticles]);

    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
        <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-800/70 border dark:border-slate-700 shadow-sm mb-8">
            <div className="flex justify-between items-center text-sm font-semibold mb-2">
                <span className="text-slate-800 dark:text-slate-100">Tu Progreso</span>
                <span className="text-blue-600 dark:text-blue-400">{completed} de {total} leídos ({percentage}%)</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${percentage}%`, transition: 'width 0.5s ease-in-out' }}></div>
            </div>
        </div>
    );
}

function MobileNav({ sections }) {
    const [isOpen, setIsOpen] = useState(false);
    const handleLinkClick = (id) => {
        setIsOpen(false);
        scrollToAnchor(id);
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="lg:hidden fixed bottom-24 right-6 h-14 w-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center z-50 text-2xl"
                aria-label="Abrir navegación"
            >
                ☰
            </button>
            {isOpen && (
                <div className="lg:hidden fixed inset-0 bg-black/60 z-50" onClick={() => setIsOpen(false)}>
                    <div className="fixed inset-y-0 left-0 w-4/5 max-w-sm bg-slate-50 dark:bg-slate-900 p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 text-2xl">&times;</button>
                        <h3 className="font-bold text-lg mb-4">Índice</h3>
                        <nav className="space-y-4 text-sm">
                            {sections.map((s) => (
                                <div key={s.key}>
                                    <div className="uppercase tracking-wide text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
                                        <span>{s.icon}</span> {s.title}
                                    </div>
                                    <ul className="space-y-2 ml-2 border-l dark:border-slate-700 pl-4">
                                        {s.data.map((a) => (
                                            <li key={a.id}>
                                                <a onClick={() => handleLinkClick(a.id)} className="cursor-pointer hover:underline">{a.title}</a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </nav>
                    </div>
                </div>
            )}
        </>
    );
}

function ScrollTopButton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!visible) return null;
  return (
    <button
      aria-label="Volver arriba"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 flex items-center justify-center text-2xl z-50"
    >↑</button>
  );
}

function ResourceList({ title, items }) {
  return (
    <div>
      <h4 className="font-semibold mb-2">{title}</h4>
      <div className="grid gap-2">
        {items.map((r) => (
          <a key={r.href} href={r.href} target="_blank" rel="noreferrer" className="rounded-xl border bg-white/80 dark:bg-slate-800/70 dark:border-slate-700 p-3 hover:shadow text-sm">
            {r.title}
          </a>
        ))}
      </div>
    </div>
  );
}


// -------------------- Restored Static Components --------------------
const PROMPT_CHIPS = {
  ROLES: [ "Actúa como estratega de marketing digital.", "Actúa como chef profesional.", "Actúa como guionista de cine.", "Actúa como profesor de matemáticas.", "Actúa como reclutador de talento." ],
  TAREAS: [ "Crea 5 ideas de post para Instagram.", "Escribe una receta de cena rápida para 2 personas.", "Genera un resumen de una escena en 150 palabras.", "Redacta un email profesional solicitando una reunión.", "Convierte este texto en una tabla de 3 columnas." ],
  CONTEXTOS: [ "sobre el lanzamiento de un nuevo producto tecnológico.", "que use pollo y brócoli como ingredientes principales.", "donde dos personajes se encuentran por primera vez en un tren.", "para una audiencia en América Latina.", "con enfoque en sostenibilidad y bajo presupuesto." ],
  FORMATOS: [ "Preséntalo en una tabla con columnas: Idea, Visual y Copy.", "En lista numerada de pasos.", "En formato de guion estándar, con diálogos y acciones.", "Devuelve un JSON válido con claves: titulo, pasos, duracion." ],
  CRITERIOS: [ "Longitud: 120–160 palabras; tono directo y claro; audiencia: principiantes.", "Incluye 3 riesgos con mitigaciones y 2 fuentes primarias.", "Evita jerga; usa ejemplos concretos y verificables." ]
};

function PromptBuilder() {
  const [state, setState] = useState({ rol: "", tarea: "", contexto: "", formato: "", criterios: "" });
  const toggle = (type, value) => setState((s) => ({ ...s, [type]: s[type] === value ? "" : value }));
  const prompt = useMemo(() => {
    const parts = [state.rol, state.tarea, state.contexto, state.formato];
    if (state.criterios) parts.push("Criterios: " + state.criterios);
    return parts.filter(Boolean).join(" ");
  }, [state]);
  
  const copy = () => {
    const textArea = document.createElement("textarea");
    textArea.value = prompt;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  };
  const reset = () => setState({ rol: "", tarea: "", contexto: "", criterios: "" });

  const Chip = ({ type, value }) => (
    <button
      onClick={() => toggle(type, value)}
      className={`bg-white dark:bg-slate-800 border text-sm px-3 py-1 rounded-full transition ${state[type] === value ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-200"}`}
      aria-pressed={state[type] === value}
    >
      {value}
    </button>
  );

  return (
    <div className="rounded-2xl p-6 bg-white/80 dark:bg-slate-800/70 border dark:border-slate-700 shadow-sm mt-4">
      <h3 className="text-xl font-semibold mb-4">Constructor de Prompts</h3>
      <div className="space-y-4">
        <div>
          <p className="font-bold text-blue-600 mb-2">1. Rol (¿Quién es la IA?)</p>
          <div className="flex flex-wrap gap-2">{PROMPT_CHIPS.ROLES.map((v) => <Chip key={v} type="rol" value={v} />)}</div>
        </div>
        <div>
          <p className="font-bold text-green-600 mb-2">2. Tarea (¿Qué hace?)</p>
          <div className="flex flex-wrap gap-2">{PROMPT_CHIPS.TAREAS.map((v) => <Chip key={v} type="tarea" value={v} />)}</div>
        </div>
        <div>
          <p className="font-bold text-yellow-600 mb-2">3. Contexto (¿Qué necesita saber?)</p>
          <div className="flex flex-wrap gap-2">{PROMPT_CHIPS.CONTEXTOS.map((v) => <Chip key={v} type="contexto" value={v} />)}</div>
        </div>
        <div>
          <p className="font-bold text-purple-600 mb-2">4. Formato (¿Cómo lo entrega?)</p>
          <div className="flex flex-wrap gap-2">{PROMPT_CHIPS.FORMATOS.map((v) => <Chip key={v} type="formato" value={v} />)}</div>
        </div>
        <div>
          <p className="font-bold text-pink-600 mb-2">5. Criterios (¿Reglas extra?)</p>
          <div className="flex flex-wrap gap-2">{PROMPT_CHIPS.CRITERIOS.map((v) => <Chip key={v} type="criterios" value={v} />)}</div>
        </div>
        <div className="grid lg:grid-cols-2 gap-4 items-start">
          <div className="bg-gray-900 text-white p-4 rounded-xl font-mono text-xs leading-relaxed min-h-[80px]">
            <p className="text-gray-400 mb-2">// Tu prompt combinado</p>
            <p>{prompt || "Selecciona elementos de arriba para construir tu instrucción..."}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={copy} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold">Copiar</button>
            <button onClick={reset} className="px-4 py-2 rounded-lg border dark:border-slate-600 font-semibold">Reset</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const TOOLS = [
  { name: "ChatGPT (modelo reciente)", category: "escribir", ideal: "Conversación compleja y escritura.", howto: "Define rol, adjunta imagen/voz si aplica, añade criterios.", link: "https://chat.openai.com/" },
  { name: "Claude 3.5 (Anthropic)", category: "escribir", ideal: "Lectura larga y redacción profesional.", howto: "Sube documento, pide resumen/tabla y solicita citas.", link: "https://claude.ai/" },
  { name: "Gemini / AI Studio", category: "escribir", ideal: "Integración con Google e imagen.", howto: "Crea prompt, prueba variantes y exporta a app.", link: "https://ai.google.dev/aistudio" },
  { name: "Perplexity", category: "investigar", ideal: "Búsqueda con citas y respuestas breves.", howto: "Pregunta concreta, filtra por fuente y compara resultados.", link: "https://www.perplexity.ai/" },
  { name: "NotebookLM (Google)", category: "organizar", ideal: "Estudiar/consultar tus fuentes.", howto: "Crea cuaderno, sube PDFs/links y haz preguntas.", link: "https://notebooklm.google/" },
  { name: "Krea AI", category: "imagenes", ideal: "Generación creativa en tiempo real.", howto: "Escribe idea, ajusta y descarga.", link: "https://www.krea.ai/" },
  { name: "FLUX Playground", category: "imagenes", ideal: "Imagen generativa accesible.", howto: "Describe, cambia estilo y exporta.", link: "https://playground.bfl.ai/" },
  { name: "Ideogram", category: "imagenes", ideal: "Imágenes con texto integrado.", howto: "Indica el texto exacto entre comillas, elige estilo y revisa legibilidad.", link: "https://ideogram.ai/" }
];

function ToolGrid() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const list = TOOLS.filter(t => (filter === "all" || t.category === filter) && (t.name + " " + t.ideal).toLowerCase().includes(search.toLowerCase()));
  const Btn = ({ tag, label }) => (
    <button onClick={() => setFilter(tag)} className={`font-semibold py-2 px-4 rounded-full border ${filter === tag ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 dark:border-slate-700"}`}>{label}</button>
  );
  return (
    <div className="rounded-2xl p-6 bg-white/80 dark:bg-slate-800/70 border dark:border-slate-700 shadow-sm">
      <h3 className="text-xl font-semibold mb-2">Caja de herramientas (filtrable)</h3>
      <div className="flex flex-wrap gap-2 mb-4">
        <Btn tag="all" label="Todas" />
        <Btn tag="escribir" label="Texto/Chat" />
        <Btn tag="imagenes" label="Imágenes" />
        <Btn tag="organizar" label="Productividad" />
        <Btn tag="investigar" label="Investigar" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="ml-auto px-3 py-2 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-800" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map(t => (
          <div key={t.name} className="bg-white dark:bg-slate-800 p-5 rounded-xl border dark:border-slate-700 flex flex-col">
            <h4 className="font-bold text-lg">{t.name}</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 my-2"><span className="font-semibold">Ideal para:</span> {t.ideal}</p>
            <div className="text-sm text-gray-700 dark:text-gray-200 flex-grow">
              <p className="font-semibold mb-1">Cómo empezar:</p>
              <p>{t.howto}</p>
            </div>
            <a href={t.link} target="_blank" rel="noreferrer" className="mt-4 inline-block font-semibold text-blue-600 hover:underline self-start">Ir a la herramienta →</a>
          </div>
        ))}
        {!list.length && <div className="text-sm text-gray-600 col-span-full">Sin resultados para tu búsqueda.</div>}
      </div>
    </div>
  );
}

function WhenToUseTools() {
  const cases = [
    { title: "Resumir un PDF largo con citas", rec: "Claude 3.5 o el modelo más reciente de ChatGPT", desc: "Gran ventana de contexto. Pide citar páginas de origen." },
    { title: "Investigar un tema con enlaces fiables", rec: "Perplexity AI", desc: "Respuestas con fuentes citadas. Ideal para contrastar rápido." },
    { title: "Crear un póster o logo con texto legible", rec: "Ideogram", desc: "Integra tipografía y texto con alta fidelidad." },
    { title: "Chatear con tus propios documentos", rec: "NotebookLM de Google", desc: "Carga PDFs, webs y notas; responde con tu información." },
    { title: "Exploración visual y creativa rápida", rec: "Krea AI", desc: "Iteración en tiempo real sobre un boceto o idea." },
    { title: "Editar una imagen usando lenguaje natural", rec: "Gemini / AI Studio", desc: "Sube imagen y pide cambios como a un diseñador." }
  ];
  return (
    <div className="rounded-2xl p-6 bg-white/80 dark:bg-slate-800/70 border dark:border-slate-700 shadow-sm">
      <h3 className="text-xl font-semibold mb-1">¿Cuándo Usar Cada Herramienta?</h3>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">En lugar de listar herramientas, mostramos la mejor para cada tarea.</p>
      <div className="grid md:grid-cols-2 gap-4">
        {cases.map((c, i) => (
          <div key={i} className="rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Caso de uso</div>
            <div className="font-semibold">{c.title}</div>
            <div className="mt-2 text-sm"><span className="font-semibold">Recomendada:</span> {c.rec}</div>
            <p className="text-sm text-gray-700 dark:text-gray-200 mt-1">{c.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// -------------------- Domain content (REVISED FOR UNIVERSAL SPANISH & UX FEATURES) --------------------
const conceptos = [
  { id: "que-es-ia", title: "¿Qué es la IA? (Inteligencia Artificial)", summary: "Es enseñarle a las máquinas a hacer tareas que antes solo podíamos hacer los humanos, como reconocer una foto, traducir o conversar.", why: "Para saber qué puedes pedirle y qué no. La IA es una herramienta potente, pero no es mágica ni tiene conciencia propia.", example: "Sugiéreme 3 ideas de nombres para una pastelería.", pitfalls: ["Creer que 'piensa' o 'siente' como una persona.", "Pensar que siempre tiene la razón."], knowledgeCheck: { q: "¿La IA 'entiende' realmente lo que escribe?", a: "No. Solo predice la siguiente palabra más probable basándose en patrones que ha aprendido de muchísimos textos." }, body: (
    <p>
      Imagina que le enseñas a una máquina a hacer cosas que antes eran exclusivas de los humanos. Por ejemplo, a reconocer a tu gato en una foto, a traducir un texto a otro idioma o a sugerirte la ruta más corta a casa. Eso es la IA. No es que la máquina "piense" por sí misma, sino que ha sido entrenada con muchísimos ejemplos (fotos, textos, mapas) para encontrar patrones y darnos una respuesta útil. Es como un chef que ha estudiado miles de recetas y, aunque no inventa ingredientes, sabe combinarlos para crear platos increíbles.
    </p>) },
  { id: "ml-vs-ia", title: "IA vs. Machine Learning (ML)", summary: "La IA es el automóvil completo. El Machine Learning (ML) es el motor que hace que el auto ande, aprendiendo del camino.", why: "Porque la calidad del 'combustible' (los datos con que se entrena) define qué tan bien funcionará la IA.", example: "Clasifica estos emails en 'Importante' y 'Promoción'.", pitfalls: ["Usar los términos como si fueran lo mismo.", "No pensar en la calidad de los datos de entrenamiento."], body: (
    <p>
      La IA es el concepto general, como la idea de tener un automóvil. El Machine Learning (o "Aprendizaje Automático") es la técnica principal que usamos para construir esa IA. Es el motor. El ML consiste en "entrenar" a la máquina con muchísimos ejemplos. Le mostramos miles de correos marcados como "spam" hasta que aprende a reconocerlos sola. Es como enseñarle a un niño a distinguir frutas: si solo le enseñas manzanas rojas, se confundirá al ver una verde. Por eso, la calidad y variedad de los ejemplos son fundamentales.
    </p>) },
  { id: "llm", title: "¿Qué es un LLM? (Modelo Grande de Lenguaje)", summary: "Es un tipo de IA experta en lenguaje. Funciona como el 'autocompletar' de tu teléfono celular, pero a una escala gigantesca y más creativa.", why: "Para usarlo como una herramienta creativa increíble, pero no como una fuente infalible de verdad.", example: "Escribe un poema corto sobre la lluvia.", pitfalls: ["Creer ciegamente todo lo que escribe.", "Esperar que conozca eventos muy recientes."], body: (
    <p>
      Un LLM es una IA que ha sido entrenada con una cantidad masiva de texto (libros, webs, artículos...). Su única misión es predecir cuál es la siguiente palabra más lógica en una frase. Al hacer esto millones de veces, se vuelve capaz de escribir emails, poemas, resúmenes o código. Pero es crucial recordar que no "entiende" lo que dice, solo calcula probabilidades. Por eso a veces puede inventar datos ("alucinar"), como un amigo que prefiere dar una respuesta que suene bien a decir "no lo sé".
    </p>) },
  { id: "prompt", title: "¿Qué es un 'prompt'?", summary: "Es simplemente la instrucción o pregunta que le escribes a la IA. Es tu forma de dirigirla para obtener lo que necesitas.", why: "Porque la calidad de tu pregunta determina la calidad de la respuesta. Un buen prompt es la clave para un buen resultado.", example: "Actúa como un guía turístico y descríbeme Roma en 3 párrafos para alguien que nunca ha estado allí.", pitfalls: ["Dar instrucciones vagas como 'escribe algo'.", "Pedirle demasiadas cosas a la vez."], knowledgeCheck: { q: "¿Cuál es la fórmula más simple para un buen prompt?", a: "Rol + Tarea + Contexto. (¿Quién es?, ¿Qué hace?, ¿Qué necesita saber?)." }, body: (
    <p>
      Un prompt es como darle una dirección a un GPS. Si solo dices "llévame a París", puede que no te lleve al lugar exacto que querías. Pero si dices "llévame a la Torre Eiffel en París, evitando los peajes", el resultado será perfecto. Con la IA es igual. En lugar de "haz un resumen", prueba con "resume este texto en 5 puntos clave, con un lenguaje sencillo para principiantes". Cuanto más claro seas sobre el rol, la tarea, el contexto y el formato, mejor será la respuesta.
    </p>) },
  { id: "tokens-contexto", title: "Tokens y Ventana de Contexto", summary: "Es la 'memoria a corto plazo' de la IA. Tiene un límite de cuánta información puede 'recordar' en una misma conversación.", why: "Para no frustrarte si la IA 'olvida' algo que le dijiste al principio de una larga charla y aprender a darle la información por partes.", example: "Basándote en nuestro chat anterior sobre marketing, dame 5 ideas.", pitfalls: ["Pegar un libro entero y esperar que lo recuerde todo.", "Asumir que su memoria es infinita."], body: (
    <p>
      Imagina que hablas con alguien que solo puede recordar las últimas 10 frases. Esa es la "ventana de contexto". La IA divide tu texto en piezas llamadas 'tokens' (que pueden ser palabras o sílabas) y solo puede procesar un número limitado de ellas a la vez. Si le das un documento muy largo, es como hablarle sin parar durante una hora; es probable que olvide lo primero que dijiste. Por eso, para tareas grandes, es mejor dividir la información o resumir los puntos clave periódicamente.
    </p>) },
  { id: "alucinacion", title: "Alucinación (Inventar datos)", summary: "Ocurre cuando la IA te da una respuesta que suena muy convincente pero es falsa o imprecisa. No lo hace con mala intención.", why: "Es el mayor riesgo al usar la IA. Siempre debes verificar la información importante, especialmente datos, fechas o nombres.", example: "Dame la biografía de [persona real] y cita tus fuentes.", pitfalls: ["Publicar o usar datos de la IA sin contrastarlos.", "Confiar en ella para temas médicos o legales."], knowledgeCheck: { q: "¿Por qué 'alucina' una IA?", a: "Porque su objetivo principal no es ser veraz, sino coherente. Prefiere 'completar la frase' de una forma que suene lógica, aunque tenga que inventar los datos." }, body: (
    <p>
      Una alucinación sucede porque el objetivo de la IA no es "decir la verdad", sino "completar la frase" de la forma más probable y coherente posible. Es como un estudiante que, en un examen, prefiere inventar una fecha con tal de no dejar la pregunta en blanco. La respuesta puede parecer muy bien escrita y segura, pero los datos pueden ser incorrectos. La mejor defensa es el pensamiento crítico: pide siempre fuentes y verifica los datos clave en buscadores fiables.
    </p>) },
  { id: "rag", title: "RAG (Generación Aumentada por Recuperación)", summary: "Es una técnica para que la IA responda usando TUS documentos como fuente, en lugar de basarse solo en su conocimiento general.", why: "Para obtener respuestas precisas y confiables basadas en tu propia información (un manual de tu empresa, tus apuntes de clase, etc.).", example: "Usando el PDF que te subí, resume el capítulo 3.", pitfalls: ["Usar documentos desordenados o mal escaneados.", "Esperar que entienda tablas muy complejas sin ayuda."], body: (
    <p>
      Normalmente, una IA te responde usando la gigantesca biblioteca de información con la que fue entrenada. RAG es como si le dieras un libro de texto específico y le dijeras: "Para esta pregunta, responde usando ÚNICAMENTE este libro". Primero, la IA busca el fragmento más relevante dentro de tu documento y luego usa esa información para construir la respuesta. Esto reduce drásticamente las alucinaciones y te da respuestas basadas en fuentes que tú controlas.
    </p>) }
];

const guias = [
  { id: "prompting-basico", title: "Cómo escribir un buen Prompt", summary: "La fórmula más simple es: Rol + Tarea + Contexto. Define quién quieres que sea, qué quieres que haga y qué necesita saber.", example: "Actúa como un nutricionista (Rol). Crea un plan de cena para 5 días (Tarea). Debe ser vegetariano y bajo en carbohidratos (Contexto).", pitfalls: ["Ser ambiguo ('hazlo mejor').", "No darle un formato de salida ('en una tabla')."], body: (
    <p>Escribir un buen prompt es un arte que se aprende practicando. Una estructura muy útil es pensar en estos elementos: <ul><li><b>Rol:</b> ¿Quién quieres que sea la IA? "Actúa como un experto en marketing digital".</li><li><b>Tarea:</b> ¿Qué quieres que haga? "Genera 10 ideas para un post de Instagram".</li><li><b>Contexto:</b> ¿Qué información de fondo necesita? "Es para una marca de café artesanal de Colombia".</li><li><b>Formato:</b> ¿Cómo quieres la respuesta? "Preséntalo en una tabla con columnas para 'Idea', 'Texto' y 'Hashtags'".</li></ul> No necesitas usarlos todos siempre, pero cuantos más detalles des, mejor será el resultado.</p>) },
  { id: "verificacion", title: "Verificar la información", summary: "Desarrolla el hábito de dudar. Antes de usar una respuesta, hazte estas preguntas: ¿Esto suena lógico? ¿Puedo confirmarlo con una búsqueda rápida?", why: "Para usar la IA como un copiloto inteligente y no como un conductor ciego. La responsabilidad final de la información es tuya.", example: "Dame 5 beneficios del té verde, con enlaces a estudios científicos que lo respalden.", pitfalls: ["Aceptar ciegamente estadísticas o cifras.", "Confiar en las URL que genera, a veces también las inventa."], body: (
    <p>Usar la IA sin verificar es como copiar y pegar de la Wikipedia sin mirar las fuentes. Es una herramienta increíble para generar borradores, ideas y resúmenes, pero no es una fuente de verdad absoluta. Un buen método es el "chequeo cruzado": si la IA te da un dato importante, tómate 15 segundos para buscarlo en Google y ver si fuentes fiables (universidades, medios de comunicación reconocidos, etc.) dicen lo mismo. Trátala como un asistente muy listo pero a veces despistado.</p>) }
];

const casos = [
  { id: "productividad", title: "Para tu productividad personal", summary: "Úsala como tu asistente personal para organizar ideas, resumir textos largos o superar el bloqueo de la 'página en blanco'.", why: "Te ahorra horas de trabajo mental repetitivo, permitiéndote concentrarte en las partes más creativas y estratégicas de tus tareas.", example: "Tengo estas notas de una reunión [pegar notas]. Transfórmalas en una lista de tareas con responsables.", pitfalls: ["Pedirle que gestione tu calendario directamente.", "Darle información muy personal o contraseñas."], body: (
    <p>La IA puede ser un increíble acelerador para tu día a día. ¿Tienes un email largo que no te apetece leer? Pídele que te lo resuma en tres puntos. ¿No sabes cómo empezar a escribir un informe? Pídele que te genere un borrador o un esquema. ¿Tienes un montón de ideas desordenadas? Pídele que las organice en categorías. Es una herramienta fantástica para convertir el caos en estructura.</p>) },
  { id: "trabajo", title: "Para el trabajo y documentos", summary: "Es como tener un asistente en formación muy capaz a tu disposición. Puede redactar borradores de emails, comparar documentos o preparar presentaciones.", why: "Acelera tareas que consumen mucho tiempo, como la redacción y la síntesis, pero siempre requiriendo tu supervisión y criterio final.", example: "Escribe un email profesional para pedir una reunión con un cliente sobre el proyecto X.", pitfalls: ["Pegar información confidencial de la empresa o clientes.", "Usar sus textos sin revisarlos ni adaptarlos a tu estilo."], body: (
    <p>En un entorno profesional, la IA es una gran aliada. Puede ayudarte a redactar el primer borrador de un informe, crear una tabla comparando dos productos, o generar el guion para una presentación. La clave es verla como un punto de partida. Usa su borrador, pero luego añade tu conocimiento, tu tono y el contexto específico de tu empresa. Recuerda: tú eres el experto, la IA es tu asistente.</p>) }
];

const etica = [
  { id: "datos-personales", title: "Cuidado con los datos personales", summary: "Regla de oro: no escribas en un chat de IA nada que no escribirías en una postal que todo el mundo pudiera leer. Anonimiza siempre.", why: "Para evitar riesgos de privacidad. Muchas empresas usan las conversaciones para entrenar sus modelos, y no quieres que tus datos privados formen parte de ellos.", example: "Tengo un cliente descontento [describir problema sin nombres]. Dame 3 posibles respuestas.", pitfalls: ["Pegar un email de un cliente con su nombre y dirección.", "Subir un documento con datos de empleados."], body: (
    <p>Imagina que el chat de la IA es un lugar público. Nunca compartas nombres completos, números de identificación personal, direcciones, teléfonos, emails o cualquier información sensible tuya o de otras personas. Si necesitas analizar un texto que contiene estos datos, reemplázalos primero por información genérica (ej. "CLIENTE_A" en lugar de "Juan Pérez"). Proteger la privacidad es fundamental.</p>) },
  { id: "sesgos", title: "Entendiendo los sesgos", summary: "La IA aprende de los datos creados por humanos, y si esos datos contienen prejuicios (raciales, de género, etc.), la IA los aprenderá y repetirá.", why: "Para ser conscientes de que la IA puede dar respuestas injustas o perpetuar estereotipos. Es nuestro trabajo detectarlos y no amplificarlos.", example: "Describe las cualidades de un buen líder. Ahora, evalúa si tu respuesta contiene algún sesgo de género.", pitfalls: ["Asumir que la IA es objetiva y neutral.", "No cuestionar respuestas que parecen reforzar un estereotipo."], body: (
    <p>Un sesgo en la IA funciona como un espejo del mundo real, con sus cosas buenas y malas. Si la IA ha sido entrenada con textos donde históricamente ciertas profesiones se asocian más a un género, es probable que sus respuestas reflejen ese sesgo. Ser un usuario responsable significa estar alerta. Si una respuesta te parece extraña o estereotipada, cuestiónala. Pídele que reconsidere su respuesta desde una perspectiva más inclusiva.</p>) }
];

const sections = [
  { key: "conceptos", title: "Conceptos Base", data: conceptos, icon: '💡', color: 'text-blue-500' },
  { key: "guias", title: "Guías Prácticas", data: guias, icon: '✍️', color: 'text-green-500' },
  { key: "casos", title: "Casos de Uso", data: casos, icon: '🚀', color: 'text-purple-500' },
  { key: "etica", title: "Uso Responsable", data: etica, icon: '🛡️', color: 'text-amber-500' }
];

// -------------------- Main App Component --------------------
export default function App() {
  const [dark, setDark] = useDarkMode();
  const [q, setQ] = useState("");

  const allArticles = useMemo(() => sections.flatMap(s => s.data), []);

  const results = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return [];
    return sections.flatMap(s => s.data.map(a => ({...a, sectionTitle: s.title})))
      .map((a) => {
        const hay = [a.title, a.summary, a.example, extractText(a.body)].join(" \n ");
        const lower = hay.toLowerCase();
        if (lower.includes(k)) {
          return { id: a.id, title: a.title, snippet: makeSnippet(hay, lower, k), sectionTitle: a.sectionTitle };
        }
        return null;
      })
      .filter(Boolean);
  }, [q]);
  
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 dark:text-slate-100 font-sans">
        <header className="bg-white/80 dark:bg-slate-900/70 backdrop-blur-lg sticky top-0 z-40 border-b border-gray-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="font-bold text-lg">Centro de IA</div>
          <nav className="hidden md:flex items-center gap-4 text-sm">
            <a href="#conceptos" onClick={(e) => { e.preventDefault(); scrollToAnchor("conceptos"); }} className="hover:underline">Conceptos</a>
            <a href="#guias" onClick={(e) => { e.preventDefault(); scrollToAnchor("guias"); }} className="hover:underline">Guías</a>
            <a href="#herramientas" onClick={(e) => { e.preventDefault(); scrollToAnchor("herramientas"); }} className="hover:underline">Herramientas</a>
            <a href="#recursos" onClick={(e) => { e.preventDefault(); scrollToAnchor("recursos"); }} className="hover:underline">Recursos</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en el Centro…" className="px-3 py-2 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-800 w-32 md:w-64" />
            <button onClick={() => setDark(!dark)} className="px-3 py-2 rounded-lg border dark:border-slate-600 text-sm">
              {dark ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
      </header>

      <section className="bg-white/80 dark:bg-slate-800/70 border-b dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <h1 className="text-3xl md:text-4xl font-bold">Tu Centro de IA para Empezar de Cero</h1>
          <p className="mt-3 max-w-3xl text-slate-700 dark:text-slate-200">
            ¡Bienvenido/a! Este es tu punto de partida para entender y usar la IA, explicado de la forma más sencilla. Explora los conceptos, aprende a darle instrucciones y descubre herramientas útiles. ¡Sin necesidad de saber nada antes!
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-[280px_1fr] gap-8">
        <aside className="hidden lg:block lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)] lg:overflow-auto pr-4">
            <ProgressTracker allArticles={allArticles} />
            <nav className="space-y-4 text-sm">
                {sections.map((s) => (
                <div key={s.key}>
                    <div className="uppercase tracking-wide text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2"><span>{s.icon}</span> {s.title}</div>
                    <ul className="space-y-1 ml-2 border-l dark:border-slate-700 pl-4">
                    {s.data.map((a) => (
                        <li key={a.id}><a href={`#${a.id}`} onClick={(e) => { e.preventDefault(); scrollToAnchor(a.id); }} className="hover:underline cursor-pointer">{a.title}</a></li>
                    ))}
                    </ul>
                </div>
                ))}
            </nav>
        </aside>

        <div className="space-y-8">
          {!!q && (
            <section className="rounded-2xl p-5 bg-white/80 dark:bg-slate-800/70 border dark:border-slate-700 shadow-sm">
              <SectionTitle id="resultados" icon="🔍" meta={<span className="inline-block text-xs px-2 py-0.5 rounded-full border bg-white/70 dark:bg-slate-800/70 dark:border-slate-700">{results.length} resultados</span>}>Resultados</SectionTitle>
              <div className="mt-3 divide-y dark:divide-slate-700">
                {results.map((r) => (
                  <a key={r.id} href={`#${r.id}`} onClick={(e) => { e.preventDefault(); scrollToAnchor(r.id); }} className="block py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-2 -mx-2">
                    <div className="text-sm text-gray-500 dark:text-gray-400">{r.sectionTitle}</div>
                    <div className="font-semibold">{r.title}</div>
                    <div className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{r.snippet}</div>
                  </a>
                ))}
                {!results.length && <div className="text-sm text-gray-600 py-3">No se encontraron coincidencias.</div>}
              </div>
            </section>
          )}

          {sections.map(section => (
              <section key={section.key} id={section.key}>
                <SectionTitle id={`${section.key}-title`} icon={section.icon} color={section.color}>{section.title}</SectionTitle>
                <div className="mt-4 grid gap-4">
                    {section.data.map((a) => (
                        <Article key={a.id} {...a} color={section.color}>{a.body}</Article>
                    ))}
                </div>
                {section.key === 'conceptos' && (
                    <div className="mt-6 text-center">
                        <a href="Glosario de IA - Versión para Principiantes.pdf" download className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold">Descargar Glosario Sencillo</a>
                    </div>
                )}
                 {section.key === 'guias' && (
                    <>
                        <PromptBuilder />
                        <div className="mt-4 flex flex-wrap justify-center gap-4">
                            <a href="Guía Rápida de Prompts RTCCF.pdf" download className="inline-flex items-center justify-center px-5 py-2 rounded-lg border border-blue-600 text-blue-600 dark:text-white dark:border-white font-semibold">Descargar Guía de Prompts</a>
                            <a href="Ruta de 4 Semanas para Dominar IA Práctica.pdf" download className="inline-flex items-center justify-center px-5 py-2 rounded-lg border border-blue-600 text-blue-600 dark:text-white dark:border-white font-semibold">Descargar Ruta de Aprendizaje</a>
                        </div>
                    </>
                )}
              </section>
          ))}
          
          <section id="herramientas">
            <SectionTitle id="herramientas-title" icon="🛠️" color="text-slate-500">Herramientas</SectionTitle>
            <div className="mt-4"><ToolGrid /></div>
          </section>

          <section id="cuando-usar">
            <SectionTitle id="cuando-usar-title" icon="🤔" color="text-slate-500">¿Cuándo Usar Cada Herramienta?</SectionTitle>
            <div className="mt-4"><WhenToUseTools /></div>
          </section>

          <section id="recursos">
            <SectionTitle id="recursos-title" icon="📚" color="text-slate-500">Para Seguir Aprendiendo</SectionTitle>
            <div className="mt-4 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ResourceList title="Cursos recomendados" items={external.cursos} />
                <ResourceList title="Documentación oficial" items={external.docs} />
                <ResourceList title="Guías de ética" items={external.etica} />
                <ResourceList title="Divulgadores (YouTube)" items={external.videosES} />
                <ResourceList title="Fuentes de investigación" items={external.fuentes} />
            </div>
          </section>
        </div>
      </main>

      <MobileNav sections={sections} />
      <ScrollTopButton />
    </div>
  );
}
