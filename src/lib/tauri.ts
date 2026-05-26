/// <reference types="vite/client" />
import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen, type EventCallback, type UnlistenFn } from "@tauri-apps/api/event";
import { mockInvoke, mockListen } from "@/services/mock";

export const MOCK_MODE = import.meta.env.VITE_MOCK_MODE === "true";

export async function invoke<T = unknown>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (MOCK_MODE) return mockInvoke(command, args) as Promise<T>;
  return tauriInvoke<T>(command, args);
}

export function onEvent<T>(
  event: string,
  callback: EventCallback<T>
): Promise<UnlistenFn> {
  if (MOCK_MODE) return mockListen<T>(event, callback);
  return listen<T>(event, callback);
}

import type {
  Workspace, Conversation, Message, Document,
  AppSettings, ProcessingEvent, TokenEvent,
} from "@/types";

// Workspaces
export const getWorkspaces    = () => invoke<Workspace[]>("get_workspaces");
export const getWorkspace     = (id: string) => invoke<Workspace | null>("get_workspace", { id });
export const deleteWorkspace  = (id: string) => invoke<void>("delete_workspace", { id });
export const importFile       = (path: string) => invoke<string>("import_file", { path });
export const checkModelsExist = () => invoke<{ whisper: boolean; llm: boolean; whisper_path: string; llm_path: string }>("check_models_exist");
export const initializeModels = () => invoke<{ loaded: Record<string, boolean>; errors: string[] }>("initialize_models");

// Documents
export const getDocuments   = (workspace_id: string) => invoke<Document[]>("get_documents", { workspace_id });
export const saveDocument   = (id: string, title: string, content: string) => invoke<void>("save_document", { id, title, content });
export const deleteDocument = (id: string) => invoke<void>("delete_document", { id });
export const exportDocument = (document_id: string, format: string, output_path: string) =>
  invoke<void>("export_document", { document_id, format, output_path });

// Conversations & Chat
export const getConversations   = (workspace_id: string) => invoke<Conversation[]>("get_conversations", { workspace_id });
export const createConversation = (workspace_id: string, title?: string) => invoke<Conversation>("create_conversation", { workspace_id, title });
export const getMessages        = (conversation_id: string) => invoke<Message[]>("get_messages", { conversation_id });
export const sendChatMessage    = (workspace_id: string, conversation_id: string, content: string) =>
  invoke<string>("send_chat_message", { workspace_id, conversation_id, content });

// Recording
export const startRecording     = () => invoke<void>("start_recording");
export const stopRecording      = (name?: string) => invoke<string>("stop_recording", { name });
export const getRecordingStatus = () => invoke<boolean>("get_recording_status");

// Settings
export const getSettings            = () => invoke<AppSettings>("get_settings");
export const saveSettings           = (settings: AppSettings) => invoke<void>("save_settings", { settings });
export const markOnboardingComplete = () => invoke<void>("mark_onboarding_complete");
export const getModelsDir           = () => invoke<string>("get_models_dir");

// Typed event helpers
export const onProcessingProgress = (cb: EventCallback<ProcessingEvent>) => onEvent<ProcessingEvent>("processing-progress", cb);
export const onProcessingComplete = (cb: EventCallback<string>) => onEvent<string>("processing-complete", cb);
export const onProcessingError    = (cb: EventCallback<string>) => onEvent<string>("processing-error", cb);
export const onTokenStream        = (cb: EventCallback<TokenEvent>) => onEvent<TokenEvent>("token-stream", cb);
export const onTranscriptionProgress = (cb: EventCallback<number>) => onEvent<number>("transcription-progress", cb);
export const onDocumentCreated    = (cb: EventCallback<Document>) => onEvent<Document>("document-created", cb);
