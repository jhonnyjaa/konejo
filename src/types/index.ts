// ── Domain types (mirrors Rust structs) ───────────────────────────────────────

export type WorkspaceStatus = "processing" | "ready" | "error";

export interface Workspace {
  id: string;
  name: string;
  created_at: number; // Unix timestamp (seconds)
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
  isStreaming?: boolean;
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

// ── Tauri events ──────────────────────────────────────────────────────────────

export type ProcessingStage =
  | "prepare"
  | "audio"
  | "transcription"
  | "embeddings"
  | "indexing"
  | "done";

export interface ProcessingEvent {
  stage: ProcessingStage;
  progress: number; // 0–1
  message: string;
}

export interface TokenEvent {
  message_id: string;
  token: string;
  done: boolean;
  doc_type: DocumentType | null;
}

// ── UI ────────────────────────────────────────────────────────────────────────

export type AppPage =
  | "onboarding"
  | "home"
  | "workspaces"
  | "workspace"
  | "documents"
  | "prompts"
  | "settings";

// ── Prompt Library ────────────────────────────────────────────────────────────

export type PromptCategory =
  | "analysis"
  | "document"
  | "extraction"
  | "communication"
  | "custom";

export interface Prompt {
  id: string;
  name: string;
  description: string;
  prompt: string;
  tags: string[];
  category: PromptCategory;
  favorite: boolean;
  created_at: number;
  used_at?: number;
}

// ── Recording ─────────────────────────────────────────────────────────────────

export type RecordingState = "idle" | "recording" | "paused" | "stopped";

// ── Model info ────────────────────────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  name: string;
  type: "whisper" | "llm";
  size_gb: number;
  description: string;
  url: string;
  filename: string;
  isInstalled: boolean;
  isActive: boolean;
}
