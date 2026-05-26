// ── Tipos de dominio (espejo de los structs Rust) ─────────────────────────────

export type WorkspaceStatus = "processing" | "ready" | "error";

export interface Workspace {
  id: string;
  name: string;
  created_at: number; // Unix timestamp
  audio_path: string | null;
  transcript: string | null;
  duration_seconds: number | null;
  status: WorkspaceStatus;
  participant_count: number | null;
}

export interface Conversation {
  id: string;
  workspace_id: string;
  title: string | null;
  created_at: number;
}

export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  conversation_id: string;
  workspace_id: string;
  role: MessageRole;
  content: string;
  created_at: number;
  /** Solo en mensajes de asistente durante streaming */
  isStreaming?: boolean;
  streamingContent?: string;
}

export interface Document {
  id: string;
  workspace_id: string;
  title: string;
  content: string;
  doc_type: DocumentType;
  created_at: number;
}

export type DocumentType =
  | "resumen_ejecutivo"
  | "acta"
  | "minuta"
  | "compromisos"
  | "riesgos"
  | "acuerdos"
  | "proximos_pasos"
  | "correo_seguimiento"
  | "timeline"
  | "tareas"
  | "custom";

export interface AppSettings {
  whisper_model_path: string;
  llm_model_path: string;
  llm_n_ctx: number;
  llm_temperature: number;
  llm_repeat_penalty: number;
  llm_max_tokens: number;
  rag_top_k: number;
  onboarding_complete: boolean;
}

// ── Eventos Tauri ─────────────────────────────────────────────────────────────

export interface ProcessingEvent {
  stage: ProcessingStage;
  progress: number; // 0–1
  message: string;
}

export type ProcessingStage =
  | "prepare"
  | "audio"
  | "transcription"
  | "embeddings"
  | "indexing"
  | "done";

export interface TokenEvent {
  message_id: string;
  token: string;
  done: boolean;
  doc_type: DocumentType | null;
}

// ── UI State ──────────────────────────────────────────────────────────────────

export type AppPage =
  | "onboarding"
  | "home"
  | "workspace"
  | "processing"
  | "documents"
  | "prompts"
  | "settings";

export interface SuggestedPrompt {
  id: string;
  label: string;
  prompt: string;
  category: "documento" | "análisis" | "extracción";
  icon: string;
}

export const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  { id: "1", label: "Resumen ejecutivo", prompt: "Genera un resumen ejecutivo de la reunión", category: "documento", icon: "📋" },
  { id: "2", label: "Action items", prompt: "Lista todos los action items y tareas asignadas", category: "extracción", icon: "✅" },
  { id: "3", label: "Acta formal", prompt: "Genera el acta formal de la reunión", category: "documento", icon: "📄" },
  { id: "4", label: "Próximos pasos", prompt: "¿Cuáles son los próximos pasos acordados?", category: "extracción", icon: "🚀" },
  { id: "5", label: "Riesgos", prompt: "Identifica los riesgos mencionados en la reunión", category: "análisis", icon: "⚠️" },
  { id: "6", label: "Acuerdos", prompt: "Lista todos los acuerdos alcanzados", category: "extracción", icon: "🤝" },
  { id: "7", label: "Correo seguimiento", prompt: "Redacta un correo de seguimiento post-reunión", category: "documento", icon: "✉️" },
  { id: "8", label: "Timeline", prompt: "Crea un timeline de los eventos y decisiones de la reunión", category: "análisis", icon: "📅" },
];
