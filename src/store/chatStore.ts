import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Message, Conversation } from "@/types";

/** IDs de mensajes ya procesados — previene duplicados */
const processedIds = new Set<string>();

interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Message[];

  /** Contenido acumulado durante streaming */
  streamingMessages: Record<string, string>;
  activeStreamId: string | null;
  isSending: boolean;

  setConversations: (convs: Conversation[]) => void;
  addConversation: (conv: Conversation) => void;
  setCurrentConversation: (id: string | null) => void;

  setMessages: (msgs: Message[]) => void;
  addMessage: (msg: Message) => void;

  /** Inicia streaming de un mensaje del asistente */
  startStream: (messageId: string) => void;
  /** Acumula un token */
  appendToken: (messageId: string, token: string) => void;
  /** Finaliza el stream y persiste el contenido como mensaje */
  finishStream: (messageId: string) => void;

  setSending: (v: boolean) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>()(
  immer((set, get) => ({
    conversations: [],
    currentConversationId: null,
    messages: [],
    streamingMessages: {},
    activeStreamId: null,
    isSending: false,

    setConversations: (convs) => set((s) => { s.conversations = convs; }),
    addConversation: (conv) =>
      set((s) => {
        if (!s.conversations.find((c) => c.id === conv.id)) {
          s.conversations.unshift(conv);
        }
      }),
    setCurrentConversation: (id) =>
      set((s) => {
        s.currentConversationId = id;
        s.messages = [];
        s.streamingMessages = {};
      }),

    setMessages: (msgs) =>
      set((s) => {
        s.messages = msgs;
        msgs.forEach((m) => processedIds.add(m.id));
      }),

    addMessage: (msg) =>
      set((s) => {
        if (!processedIds.has(msg.id)) {
          processedIds.add(msg.id);
          s.messages.push(msg);
        }
      }),

    startStream: (messageId) =>
      set((s) => {
        s.activeStreamId = messageId;
        s.streamingMessages[messageId] = "";
        // Añadir placeholder al thread
        if (!processedIds.has(messageId)) {
          processedIds.add(messageId);
          s.messages.push({
            id: messageId,
            conversation_id: s.currentConversationId ?? "",
            workspace_id: "",
            role: "assistant",
            content: "",
            created_at: Date.now() / 1000,
            isStreaming: true,
          });
        }
      }),

    appendToken: (messageId, token) =>
      set((s) => {
        if (!s.streamingMessages[messageId]) {
          s.streamingMessages[messageId] = "";
        }
        s.streamingMessages[messageId] += token;

        // Actualizar mensaje en el thread
        const idx = s.messages.findIndex((m) => m.id === messageId);
        if (idx !== -1) {
          s.messages[idx].content = s.streamingMessages[messageId];
        }
      }),

    finishStream: (messageId) =>
      set((s) => {
        const content = s.streamingMessages[messageId] ?? "";
        const idx = s.messages.findIndex((m) => m.id === messageId);
        if (idx !== -1) {
          s.messages[idx].content = content;
          s.messages[idx].isStreaming = false;
        }
        delete s.streamingMessages[messageId];
        s.activeStreamId = null;
        s.isSending = false;
      }),

    setSending: (v) => set((s) => { s.isSending = v; }),

    reset: () =>
      set((s) => {
        s.conversations = [];
        s.currentConversationId = null;
        s.messages = [];
        s.streamingMessages = {};
        s.activeStreamId = null;
        s.isSending = false;
      }),
  }))
);
