import { useCallback, useEffect } from "react";
import { useChatStore } from "@/store/chatStore";
import {
  getConversations, createConversation, getMessages,
  sendChatMessage, onTokenStream, onDocumentCreated,
} from "@/lib/tauri";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { Conversation, Document } from "@/types";

export function useChat(workspaceId: string | null) {
  const store = useChatStore();
  const addDocument = useWorkspaceStore((s) => s.addDocument);

  // Suscripción a eventos de streaming
  useEffect(() => {
    let unlistenToken: (() => void) | null = null;
    let unlistenDoc:   (() => void) | null = null;

    onTokenStream((e) => {
      const { message_id, token, done } = e.payload;
      if (done) {
        store.finishStream(message_id);
      } else {
        // Iniciar stream si es el primer token
        if (!store.streamingMessages[message_id]) {
          store.startStream(message_id);
        }
        store.appendToken(message_id, token);
      }
    }).then((fn) => { unlistenToken = fn; });

    onDocumentCreated((e) => {
      addDocument(e.payload as Document);
    }).then((fn) => { unlistenDoc = fn; });

    return () => {
      unlistenToken?.();
      unlistenDoc?.();
    };
  }, []);

  const loadConversations = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const convs = await getConversations(workspaceId);
      store.setConversations(convs);

      // Auto-seleccionar la primera conversación o crear una
      if (convs.length > 0) {
        await selectConversation(convs[0].id);
      } else {
        await newConversation();
      }
    } catch (err) {
      console.error("Error cargando conversaciones:", err);
    }
  }, [workspaceId]);

  const selectConversation = useCallback(async (conversationId: string) => {
    store.setCurrentConversation(conversationId);
    try {
      const msgs = await getMessages(conversationId);
      store.setMessages(msgs);
    } catch (err) {
      console.error("Error cargando mensajes:", err);
    }
  }, []);

  const newConversation = useCallback(async () => {
    if (!workspaceId) return null;
    try {
      const conv = await createConversation(workspaceId);
      store.addConversation(conv);
      store.setCurrentConversation(conv.id);
      store.setMessages([]);
      return conv;
    } catch (err) {
      console.error("Error creando conversación:", err);
      return null;
    }
  }, [workspaceId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!workspaceId || !store.currentConversationId || store.isSending) return;

    const trimmed = content.trim();
    if (!trimmed) return;

    store.setSending(true);

    // Añadir mensaje del usuario optimísticamente
    const userMsg = {
      id: crypto.randomUUID(),
      conversation_id: store.currentConversationId,
      workspace_id: workspaceId,
      role: "user" as const,
      content: trimmed,
      created_at: Date.now() / 1000,
    };
    store.addMessage(userMsg);

    try {
      // El messageId del asistente llega como retorno
      const assistantMessageId = await sendChatMessage(
        workspaceId,
        store.currentConversationId,
        trimmed
      );
      // Iniciar stream inmediatamente
      store.startStream(assistantMessageId);
    } catch (err) {
      console.error("Error enviando mensaje:", err);
      store.setSending(false);
    }
  }, [workspaceId, store.currentConversationId, store.isSending]);

  return {
    conversations:          store.conversations,
    currentConversationId:  store.currentConversationId,
    messages:               store.messages,
    isSending:              store.isSending,
    activeStreamId:         store.activeStreamId,
    loadConversations,
    selectConversation,
    newConversation,
    sendMessage,
  };
}
