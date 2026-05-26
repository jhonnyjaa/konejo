import type { EventCallback, UnlistenFn } from "@tauri-apps/api/event";
import type { Workspace, Conversation, Message, Document, AppSettings, Prompt } from "@/types";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const now = () => Date.now() / 1000;

// ── Mock data ─────────────────────────────────────────────────────────────────

export let MOCK_WORKSPACES: Workspace[] = [
  {
    id: "ws-1",
    name: "Revisión Q4 – Equipo de Producto",
    created_at: now() - 86400 * 2,
    audio_path: null,
    transcript: `[00:01] Buenos días a todos. Vamos a revisar los resultados del Q4.
[00:45] Las métricas de retención subieron un 12% con respecto al Q3.
[02:10] El equipo de backend logró reducir la latencia del API en un 35%.
[03:30] Necesitamos definir el roadmap del Q1 antes del 15 de enero.
[05:00] Carlos se compromete a entregar el prototipo del dashboard el viernes.
[07:15] El lanzamiento de la versión 2.0 se pospone al 20 de febrero por la deuda técnica.
[09:00] Riesgo identificado: la integración con el proveedor externo puede fallar en producción.
[11:30] Se aprobó el presupuesto para contratar dos ingenieros adicionales en Q1.
[14:00] Próximo paso: presentación al board el 8 de enero.`,
    duration_seconds: 2700,
    status: "ready",
    participant_count: 5,
  },
  {
    id: "ws-2",
    name: "Planificación Sprint 23",
    created_at: now() - 86400 * 5,
    audio_path: null,
    transcript: `[00:00] Iniciamos el sprint planning para el sprint 23.
[01:20] Tenemos 47 puntos disponibles este sprint.
[03:00] La historia US-142 sobre el módulo de pagos tiene la mayor prioridad.
[05:30] María asume la tarea de migración de base de datos, estimada en 8 puntos.`,
    duration_seconds: 3600,
    status: "ready",
    participant_count: 7,
  },
  {
    id: "ws-3",
    name: "Onboarding Nuevo Cliente – Fintech X",
    created_at: now() - 3600,
    audio_path: null,
    transcript: null,
    duration_seconds: null,
    status: "processing",
    participant_count: null,
  },
];

export let MOCK_CONVERSATIONS: Record<string, Conversation[]> = {
  "ws-1": [{ id: "conv-1", workspace_id: "ws-1", title: "Análisis general", created_at: now() - 86400 }],
  "ws-2": [{ id: "conv-2", workspace_id: "ws-2", title: null, created_at: now() - 3600 }],
  "ws-3": [],
};

const MOCK_RESPONSE = `## Análisis de la reunión

Basándome en la transcripción de la reunión, aquí están los puntos clave:

### Logros del trimestre
- **Retención**: +12% respecto al Q3
- **Rendimiento API**: Latencia reducida en un 35%
- **Presupuesto**: Aprobado para 2 ingenieros adicionales en Q1

### Compromisos asumidos
| Responsable | Tarea | Fecha límite |
|------------|-------|-------------|
| Carlos | Prototipo del dashboard | Viernes |
| Equipo | Presentación al board | 8 de enero |

### ⚠️ Riesgos identificados
La integración con el proveedor externo puede fallar en producción. Se requiere plan de contingencia.

> Esta respuesta fue generada en modo mock. Con los modelos reales, el análisis será más profundo y contextual.`;

export let MOCK_MESSAGES: Record<string, Message[]> = {
  "conv-1": [
    {
      id: "msg-1", conversation_id: "conv-1", workspace_id: "ws-1",
      role: "user", content: "¿Cuáles son los principales logros del Q4?", created_at: now() - 3600,
    },
    {
      id: "msg-2", conversation_id: "conv-1", workspace_id: "ws-1",
      role: "assistant", content: MOCK_RESPONSE, created_at: now() - 3590,
    },
  ],
  "conv-2": [],
};

export let MOCK_DOCUMENTS: Record<string, Document[]> = {
  "ws-1": [
    {
      id: "doc-1", workspace_id: "ws-1", title: "Resumen Ejecutivo Q4",
      doc_type: "resumen_ejecutivo", created_at: now() - 1800,
      content: `# Resumen Ejecutivo – Revisión Q4\n\n## Resultados Destacados\n\nLa reunión de revisión Q4 evidenció un trimestre sólido con métricas de retención al alza (+12%) y mejoras técnicas significativas.\n\n## Decisiones\n\n- Roadmap Q1: Definición antes del 15 de enero\n- Lanzamiento v2.0: Pospuesto al 20 de febrero\n- Nuevas contrataciones: 2 ingenieros aprobados\n\n## ⚠️ Riesgos\n\nIntegración con proveedor externo con riesgo de fallo en producción.`,
    },
  ],
  "ws-2": [],
};

export const MOCK_SETTINGS: AppSettings = {
  whisper_model_path: "C:\\Users\\user\\.konejo\\models\\ggml-small.bin",
  llm_model_path: "C:\\Users\\user\\.konejo\\models\\phi-4-mini-instruct-q4_k_m.gguf",
  llm_n_ctx: 8192,
  llm_temperature: 0.3,
  llm_repeat_penalty: 1.1,
  llm_max_tokens: 1024,
  rag_top_k: 6,
  onboarding_complete: true,
};

export const MOCK_PROMPTS: Prompt[] = [
  { id: "p-1", name: "Resumen ejecutivo", description: "Genera un resumen ejecutivo conciso de la reunión", prompt: "Genera un resumen ejecutivo de la reunión con los puntos más importantes, decisiones clave y próximos pasos.", tags: ["resumen", "ejecutivo"], category: "document", favorite: true, created_at: now() - 86400 * 30 },
  { id: "p-2", name: "Action items", description: "Lista todas las tareas y responsables", prompt: "Lista todos los action items mencionados en la reunión, con el responsable asignado y la fecha límite si se mencionó.", tags: ["tareas", "compromisos"], category: "extraction", favorite: true, created_at: now() - 86400 * 25 },
  { id: "p-3", name: "Identificar riesgos", description: "Analiza y lista los riesgos mencionados", prompt: "Identifica y analiza todos los riesgos mencionados en la reunión. Para cada riesgo indica: descripción, probabilidad percibida e impacto.", tags: ["riesgos", "análisis"], category: "analysis", favorite: false, created_at: now() - 86400 * 20 },
  { id: "p-4", name: "Acta formal", description: "Genera el acta formal de la reunión", prompt: "Genera el acta formal de la reunión con: asistentes, agenda, puntos tratados, decisiones y próximos pasos.", tags: ["acta", "formal"], category: "document", favorite: false, created_at: now() - 86400 * 15 },
  { id: "p-5", name: "Correo de seguimiento", description: "Redacta un correo post-reunión", prompt: "Redacta un correo de seguimiento post-reunión para enviar a los participantes con el resumen de acuerdos y próximos pasos.", tags: ["email", "seguimiento"], category: "communication", favorite: true, created_at: now() - 86400 * 10 },
  { id: "p-6", name: "Decisiones clave", description: "Extrae todas las decisiones tomadas", prompt: "¿Cuáles fueron todas las decisiones tomadas durante esta reunión? Lístalascon contexto y el impacto esperado.", tags: ["decisiones"], category: "extraction", favorite: false, created_at: now() - 86400 * 5 },
  { id: "p-7", name: "Timeline de la reunión", description: "Crea un timeline cronológico", prompt: "Crea un timeline cronológico de los eventos, temas y decisiones de la reunión basándote en los timestamps de la transcripción.", tags: ["timeline", "cronología"], category: "analysis", favorite: false, created_at: now() - 86400 * 3 },
  { id: "p-8", name: "Próximos pasos", description: "¿Qué sigue después de esta reunión?", prompt: "¿Cuáles son los próximos pasos acordados en la reunión? Incluye responsables, fechas y dependencias entre tareas.", tags: ["next-steps", "planning"], category: "extraction", favorite: false, created_at: now() - 86400 },
];

// ── Event system ──────────────────────────────────────────────────────────────

type Listener = { event: string; callback: EventCallback<unknown> };
const listeners: Listener[] = [];

function emit(event: string, payload: unknown) {
  for (const l of listeners) {
    if (l.event === event) {
      l.callback({ event, id: Date.now(), windowLabel: "main", payload } as Parameters<EventCallback<unknown>>[0]);
    }
  }
}

export function mockListen<T>(event: string, callback: EventCallback<T>): Promise<UnlistenFn> {
  const l = { event, callback: callback as EventCallback<unknown> };
  listeners.push(l);
  return Promise.resolve(() => {
    const idx = listeners.indexOf(l);
    if (idx !== -1) listeners.splice(idx, 1);
  });
}

// ── Processing simulation ─────────────────────────────────────────────────────

export function simulateProcessing(workspaceId: string) {
  const stages = [
    { stage: "prepare",       progress: 0.05, message: "Preparando archivo…", delay: 600 },
    { stage: "audio",         progress: 0.2,  message: "Convirtiendo audio…", delay: 900 },
    { stage: "transcription", progress: 0.5,  message: "Transcribiendo con Whisper…", delay: 1200 },
    { stage: "embeddings",    progress: 0.75, message: "Generando embeddings semánticos…", delay: 900 },
    { stage: "indexing",      progress: 0.9,  message: "Indexando contenido…", delay: 600 },
    { stage: "done",          progress: 1.0,  message: "¡Workspace listo!", delay: 400 },
  ];
  let acc = 0;
  for (const s of stages) {
    acc += s.delay + Math.random() * 300;
    const captured = { ...s, acc };
    setTimeout(() => {
      emit("processing-progress", { stage: captured.stage, progress: captured.progress, message: captured.message });
      if (captured.stage === "done") {
        const ws = MOCK_WORKSPACES.find((w) => w.id === workspaceId);
        if (ws) { ws.status = "ready"; ws.duration_seconds = 1800; ws.participant_count = 3; }
        setTimeout(() => emit("processing-complete", workspaceId), 200);
      }
    }, acc);
  }
}

// ── Streaming simulation ──────────────────────────────────────────────────────

function simulateStreaming(messageId: string) {
  const tokens = MOCK_RESPONSE.split(/(?<=[ ,.\n])/);
  let idx = 0;
  const tick = () => {
    if (idx >= tokens.length) {
      emit("token-stream", { message_id: messageId, token: "", done: true, doc_type: null });
      return;
    }
    emit("token-stream", { message_id: messageId, token: tokens[idx++], done: false, doc_type: null });
    setTimeout(tick, 18 + Math.random() * 22);
  };
  setTimeout(tick, 350);
}

// ── mockInvoke ────────────────────────────────────────────────────────────────

export async function mockInvoke(command: string, args?: Record<string, unknown>): Promise<unknown> {
  await delay(150 + Math.random() * 200);

  switch (command) {
    case "get_workspaces": return [...MOCK_WORKSPACES];
    case "get_workspace":  return MOCK_WORKSPACES.find((w) => w.id === args?.id) ?? null;
    case "delete_workspace": {
      MOCK_WORKSPACES = MOCK_WORKSPACES.filter((w) => w.id !== args?.id);
      return null;
    }

    case "import_file": {
      const path = (args?.path as string) ?? "archivo.mp4";
      const name = path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") ?? "Reunión";
      const id = `ws-${Date.now()}`;
      const ws: Workspace = { id, name, created_at: now(), audio_path: path, transcript: null, duration_seconds: null, status: "processing", participant_count: null };
      MOCK_WORKSPACES.unshift(ws);
      MOCK_CONVERSATIONS[id] = [];
      MOCK_MESSAGES[id] = [];
      MOCK_DOCUMENTS[id] = [];
      simulateProcessing(id);
      return id;
    }

    case "get_conversations": return MOCK_CONVERSATIONS[args?.workspace_id as string] ?? [];
    case "create_conversation": {
      const conv: Conversation = { id: `conv-${Date.now()}`, workspace_id: args?.workspace_id as string, title: (args?.title as string) ?? null, created_at: now() };
      (MOCK_CONVERSATIONS[conv.workspace_id] ??= []).unshift(conv);
      MOCK_MESSAGES[conv.id] = [];
      return conv;
    }
    case "get_messages": return MOCK_MESSAGES[args?.conversation_id as string] ?? [];
    case "send_chat_message": {
      const msgId = `msg-${Date.now()}`;
      setTimeout(() => simulateStreaming(msgId), 50);
      return msgId;
    }

    case "get_documents": return MOCK_DOCUMENTS[args?.workspace_id as string] ?? [];
    case "save_document": return null;
    case "delete_document": return null;
    case "export_document": return null;

    case "get_settings": return { ...MOCK_SETTINGS };
    case "save_settings": Object.assign(MOCK_SETTINGS, (args?.settings ?? {})); return null;
    case "mark_onboarding_complete": MOCK_SETTINGS.onboarding_complete = true; return null;
    case "get_models_dir": return "C:\\Users\\user\\.konejo\\models";

    case "check_models_exist":
      return { whisper: false, llm: false, whisper_path: MOCK_SETTINGS.whisper_model_path, llm_path: MOCK_SETTINGS.llm_model_path };
    case "initialize_models":
      return { loaded: { whisper: false, llm: false, embeddings: false }, errors: ["Mock mode – modelos no cargados"] };

    case "start_recording": return null;
    case "stop_recording": {
      const id = `ws-rec-${Date.now()}`;
      const ws: Workspace = { id, name: (args?.name as string) ?? "Grabación", created_at: now(), audio_path: null, transcript: null, duration_seconds: null, status: "processing", participant_count: null };
      MOCK_WORKSPACES.unshift(ws);
      simulateProcessing(id);
      return id;
    }
    case "get_recording_status": return false;

    default:
      console.warn("[Mock] unhandled:", command);
      return null;
  }
}

// ── Prompt service (in-memory) ────────────────────────────────────────────────

let prompts = [...MOCK_PROMPTS];

export const promptService = {
  getAll: () => Promise.resolve([...prompts]),
  create: (p: Omit<Prompt, "id" | "created_at">) => {
    const created = { ...p, id: `p-${Date.now()}`, created_at: now() };
    prompts.unshift(created);
    return Promise.resolve(created);
  },
  update: (id: string, patch: Partial<Prompt>) => {
    prompts = prompts.map((p) => (p.id === id ? { ...p, ...patch } : p));
    return Promise.resolve();
  },
  delete: (id: string) => {
    prompts = prompts.filter((p) => p.id !== id);
    return Promise.resolve();
  },
  markUsed: (id: string) => {
    prompts = prompts.map((p) => (p.id === id ? { ...p, used_at: now() } : p));
    return Promise.resolve();
  },
};
