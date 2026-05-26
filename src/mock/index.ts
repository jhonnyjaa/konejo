/**
 * MOCK MODE
 * Cuando VITE_MOCK_MODE=true, todas las llamadas a Tauri se interceptan aquí
 * y devuelven datos simulados en español con delays realistas.
 */

import type {
  AppSettings, Conversation, Document, Message, Workspace,
} from "@/types";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── Datos mock ─────────────────────────────────────────────────────────────────

const now = Date.now() / 1000;

export const MOCK_WORKSPACES: Workspace[] = [
  {
    id: "ws-1",
    name: "Revisión Q4 – Equipo de Producto",
    created_at: now - 86400 * 2,
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
    created_at: now - 86400 * 5,
    audio_path: null,
    transcript: `[00:00] Iniciamos el sprint planning para el sprint 23.
[01:20] Tenemos 47 puntos disponibles este sprint.
[03:00] La historia US-142 sobre el módulo de pagos tiene la mayor prioridad.
[05:30] María asume la tarea de migración de base de datos, estimada en 8 puntos.
[08:00] Identificamos una dependencia bloqueante con el equipo de seguridad.`,
    duration_seconds: 3600,
    status: "ready",
    participant_count: 7,
  },
  {
    id: "ws-3",
    name: "Onboarding Nuevo Cliente – Fintech X",
    created_at: now - 3600,
    audio_path: null,
    transcript: null,
    duration_seconds: null,
    status: "processing",
    participant_count: null,
  },
];

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-1",
    workspace_id: "ws-1",
    title: "Análisis general",
    created_at: now - 86400,
  },
];

export const MOCK_MESSAGES: Message[] = [
  {
    id: "msg-1",
    conversation_id: "conv-1",
    workspace_id: "ws-1",
    role: "user",
    content: "¿Cuáles son los principales logros del Q4 mencionados en la reunión?",
    created_at: now - 3600,
  },
  {
    id: "msg-2",
    conversation_id: "conv-1",
    workspace_id: "ws-1",
    role: "assistant",
    content: `## Logros del Q4

Según la transcripción de la reunión, los principales logros del trimestre fueron:

1. **Métricas de retención**: Incremento del **12%** respecto al Q3, superando el objetivo trimestral.

2. **Optimización de rendimiento**: El equipo de backend redujo la latencia del API en un **35%**, mejorando significativamente la experiencia del usuario.

3. **Aprobación presupuestaria**: Se aprobó el presupuesto para contratar **dos ingenieros adicionales** en Q1, lo que indica confianza en el crecimiento del equipo.

> Estos logros se mencionaron en los primeros 12 minutos de la reunión.`,
    created_at: now - 3590,
  },
];

export const MOCK_DOCUMENTS: Document[] = [
  {
    id: "doc-1",
    workspace_id: "ws-1",
    title: "Resumen Ejecutivo",
    content: `## Resumen Ejecutivo – Revisión Q4

### Resultados Destacados

La reunión de revisión Q4 evidenció un trimestre sólido para el equipo, con métricas de retención al alza (+12%) y mejoras técnicas significativas en rendimiento (-35% latencia).

### Decisiones Principales

- **Roadmap Q1**: Definición antes del 15 de enero.
- **Lanzamiento v2.0**: Pospuesto al 20 de febrero por deuda técnica.
- **Nuevas contrataciones**: Dos ingenieros aprobados para Q1.

### Compromisos

| Responsable | Tarea | Fecha |
|------------|-------|-------|
| Carlos | Prototipo del dashboard | Viernes |
| Equipo | Presentación al board | 8 de enero |

### Riesgos Identificados

⚠️ Integración con proveedor externo con riesgo de fallo en producción.`,
    doc_type: "resumen_ejecutivo",
    created_at: now - 1800,
  },
];

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

// ── Respuestas mock para cada comando ─────────────────────────────────────────

const conversationsByWorkspace: Record<string, Conversation[]> = {
  "ws-1": MOCK_CONVERSATIONS,
  "ws-2": [{ id: "conv-2", workspace_id: "ws-2", title: null, created_at: now - 3600 }],
  "ws-3": [],
};

const messagesByConversation: Record<string, Message[]> = {
  "conv-1": MOCK_MESSAGES,
  "conv-2": [],
};

const documentsByWorkspace: Record<string, Document[]> = {
  "ws-1": MOCK_DOCUMENTS,
  "ws-2": [],
};

let streamCallbacks: Map<string, (token: string, done: boolean) => void> = new Map();

const MOCK_RESPONSE = `## Análisis de la Reunión

Esta es una respuesta simulada en **modo mock**. En la aplicación real, el LLM Phi-4-mini procesaría la transcripción y generaría una respuesta contextual.

### Lo que haría el sistema real:
1. Recuperaría los chunks más relevantes usando embeddings semánticos
2. Construiría el contexto con timestamps en formato MM:SS
3. Generaría una respuesta en español con Markdown estructurado
4. Transmitiría los tokens en tiempo real al frontend

> Activa \`VITE_MOCK_MODE=false\` y carga los modelos para ver la inferencia real.`;

export async function mockInvoke(command: string, args?: Record<string, unknown>): Promise<unknown> {
  await delay(200 + Math.random() * 300);

  switch (command) {
    case "get_workspaces": return [...MOCK_WORKSPACES];
    case "get_workspace": return MOCK_WORKSPACES.find((w) => w.id === args?.id) ?? null;
    case "delete_workspace": return null;

    case "import_file": {
      const id = `ws-${Date.now()}`;
      const path = (args?.path as string) ?? "archivo.mp4";
      const name = path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") ?? "Reunión";
      const ws: Workspace = {
        id, name, created_at: now, audio_path: path,
        transcript: null, duration_seconds: null,
        status: "processing", participant_count: null,
      };
      MOCK_WORKSPACES.unshift(ws);
      // Simular procesamiento
      simulateProcessing(id);
      return id;
    }

    case "get_conversations": {
      const wid = args?.workspace_id as string;
      return conversationsByWorkspace[wid] ?? [];
    }

    case "create_conversation": {
      const conv: Conversation = {
        id: `conv-${Date.now()}`,
        workspace_id: args?.workspace_id as string,
        title: (args?.title as string) ?? null,
        created_at: Date.now() / 1000,
      };
      return conv;
    }

    case "get_messages": {
      const cid = args?.conversation_id as string;
      return messagesByConversation[cid] ?? [];
    }

    case "send_chat_message": {
      const msgId = `msg-${Date.now()}`;
      // El streaming se simula vía callbacks registrados
      setTimeout(() => simulateStreaming(msgId), 100);
      return msgId;
    }

    case "get_documents": {
      const wid = args?.workspace_id as string;
      return documentsByWorkspace[wid] ?? [];
    }

    case "save_document": return null;
    case "delete_document": return null;
    case "export_document": return null;

    case "get_settings": return { ...MOCK_SETTINGS };
    case "save_settings": return null;
    case "mark_onboarding_complete": return null;
    case "get_models_dir": return "C:\\Users\\user\\.konejo\\models";

    case "check_models_exist":
      return { whisper: false, llm: false, whisper_path: MOCK_SETTINGS.whisper_model_path, llm_path: MOCK_SETTINGS.llm_model_path };

    case "initialize_models":
      return { loaded: { whisper: false, llm: false, embeddings: false }, errors: ["Mock mode activo — modelos no cargados"] };

    case "start_recording": return null;
    case "stop_recording": return `ws-${Date.now()}`;
    case "get_recording_status": return false;

    default:
      console.warn(`[Mock] Comando no implementado: ${command}`);
      return null;
  }
}

// ── Simulaciones de eventos ───────────────────────────────────────────────────

function simulateProcessing(workspaceId: string) {
  const stages = [
    { stage: "prepare",       progress: 0.05, message: "Preparando archivo…" },
    { stage: "audio",         progress: 0.2,  message: "Procesando audio…" },
    { stage: "transcription", progress: 0.5,  message: "Transcribiendo con Whisper…" },
    { stage: "embeddings",    progress: 0.7,  message: "Generando embeddings semánticos…" },
    { stage: "indexing",      progress: 0.85, message: "Indexando en base de datos…" },
    { stage: "done",          progress: 1.0,  message: "¡Listo! Tu reunión está lista." },
  ];

  let delay_ms = 0;
  stages.forEach(({ stage, progress, message }) => {
    delay_ms += 800 + Math.random() * 400;
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("tauri://processing-progress", {
        detail: { stage, progress, message, workspace_id: workspaceId }
      }));
      if (stage === "done") {
        // Actualizar estado del workspace
        const ws = MOCK_WORKSPACES.find((w) => w.id === workspaceId);
        if (ws) {
          ws.status = "ready";
          ws.transcript = "Transcripción simulada de la reunión importada.";
          ws.duration_seconds = 1800;
        }
        window.dispatchEvent(new CustomEvent("tauri://processing-complete", {
          detail: workspaceId
        }));
      }
    }, delay_ms);
  });
}

function simulateStreaming(messageId: string) {
  const tokens = MOCK_RESPONSE.split(/(?<=\s)/);
  let idx = 0;

  const tick = () => {
    if (idx >= tokens.length) {
      window.dispatchEvent(new CustomEvent("tauri://token-stream", {
        detail: { message_id: messageId, token: "", done: true, doc_type: null }
      }));
      return;
    }
    const token = tokens[idx++];
    window.dispatchEvent(new CustomEvent("tauri://token-stream", {
      detail: { message_id: messageId, token, done: false, doc_type: null }
    }));
    setTimeout(tick, 25 + Math.random() * 20);
  };

  setTimeout(tick, 300);
}
