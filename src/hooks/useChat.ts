import { useCallback, useEffect, useRef } from "react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
  getConversations, createConversation,
  getMessages, sendChatMessage, onTokenStream,
} from "@/lib/tauri";
import type { Message } from "@/types";

export function useChat(workspaceId: string | null) {
  const store = useWorkspaceStore();
  const sendingRef = useRef(false);

  const conversations        = store.conversations;
  const currentConversationId = store.currentConversationId;
  const messages              = currentConversationId ? (store.messages[currentConversationId] ?? []) : [];
  const isSending             = store.activeStreamId !== null;

  // Load conversations for this workspace
  const loadConversations = useCallback(async () => {
    if (!workspaceId) return;
    const cs = await getConversations(workspaceId);
    store.setConversations(cs);
    if (cs.length > 0) {
      const first = cs[0];
      store.setCurrentConversationId(first.id);
      if (!store.messages[first.id]) {
        const msgs = await getMessages(first.id);
        store.setMessages(first.id, msgs);
      }
    }
  }, [workspaceId]);

  const selectConversation = useCallback(async (id: string) => {
    store.setCurrentConversationId(id);
    if (!store.messages[id]) {
      const msgs = await getMessages(id);
      store.setMessages(id, msgs);
    }
  }, []);

  const newConversation = useCallback(async () => {
    if (!workspaceId) return;
    const conv = await createConversation(workspaceId);
    store.addConversation(conv);
    store.setCurrentConversationId(conv.id);
    store.setMessages(conv.id, []);
  }, [workspaceId]);

  // Token streaming subscription (per-workspace)
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    onTokenStream((e) => {
      const { message_id, token, done } = e.payload;
      const cid = store.currentConversationId;
      if (!cid) return;
      if (done) {
        store.updateMessage(cid, message_id, { isStreaming: false });
        store.setActiveStreamId(null);
        sendingRef.current = false;
      } else {
        store.appendToken(cid, message_id, token);
      }
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [workspaceId]);

  const sendMessage = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || !workspaceId || !currentConversationId || sendingRef.current) return;
    sendingRef.current = true;

    // Optimistic user message
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      conversation_id: currentConversationId,
      workspace_id: workspaceId,
      role: "user",
      content: trimmed,
      created_at: Date.now() / 1000,
    };
    store.appendMessage(currentConversationId, userMsg);

    try {
      const msgId = await sendChatMessage(workspaceId, currentConversationId, trimmed);
      const aiMsg: Message = {
        id: msgId,
        conversation_id: currentConversationId,
        workspace_id: workspaceId,
        role: "assistant",
        content: "",
        created_at: Date.now() / 1000,
        isStreaming: true,
      };
      store.appendMessage(currentConversationId, aiMsg);
      store.setActiveStreamId(msgId);
    } catch (err) {
      console.error("sendMessage error:", err);
      sendingRef.current = false;
    }
  }, [workspaceId, currentConversationId]);

  return {
    conversations,
    currentConversationId,
    messages,
    isSending,
    activeStreamId: store.activeStreamId,
    loadConversations,
    selectConversation,
    newConversation,
    sendMessage,
  };
}
