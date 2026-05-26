import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Workspace, Conversation, Message, Document } from "@/types";

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Record<string, Message[]>; // keyed by conversation_id
  documents: Document[];
  activeStreamId: string | null;

  setWorkspaces: (ws: Workspace[]) => void;
  upsertWorkspace: (ws: Workspace) => void;
  updateWorkspace: (id: string, patch: Partial<Workspace>) => void;
  removeWorkspace: (id: string) => void;
  setCurrentWorkspace: (ws: Workspace | null) => void;

  setConversations: (cs: Conversation[]) => void;
  addConversation: (c: Conversation) => void;
  setCurrentConversationId: (id: string | null) => void;

  setMessages: (conversationId: string, msgs: Message[]) => void;
  appendMessage: (conversationId: string, msg: Message) => void;
  updateMessage: (conversationId: string, id: string, patch: Partial<Message>) => void;
  appendToken: (conversationId: string, msgId: string, token: string) => void;
  setActiveStreamId: (id: string | null) => void;

  setDocuments: (docs: Document[]) => void;
  upsertDocument: (doc: Document) => void;
  removeDocument: (id: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  immer((set) => ({
    workspaces: [],
    currentWorkspace: null,
    conversations: [],
    currentConversationId: null,
    messages: {},
    documents: [],
    activeStreamId: null,

    setWorkspaces: (ws) => set((s) => { s.workspaces = ws; }),
    upsertWorkspace: (ws) =>
      set((s) => {
        const idx = s.workspaces.findIndex((w) => w.id === ws.id);
        if (idx !== -1) s.workspaces[idx] = ws;
        else s.workspaces.unshift(ws);
      }),
    updateWorkspace: (id, patch) =>
      set((s) => {
        const idx = s.workspaces.findIndex((w) => w.id === id);
        if (idx !== -1) Object.assign(s.workspaces[idx], patch);
        if (s.currentWorkspace?.id === id) Object.assign(s.currentWorkspace, patch);
      }),
    removeWorkspace: (id) =>
      set((s) => {
        s.workspaces = s.workspaces.filter((w) => w.id !== id);
        if (s.currentWorkspace?.id === id) s.currentWorkspace = null;
      }),
    setCurrentWorkspace: (ws) => set((s) => { s.currentWorkspace = ws; }),

    setConversations: (cs) => set((s) => { s.conversations = cs; }),
    addConversation: (c) =>
      set((s) => {
        if (!s.conversations.find((x) => x.id === c.id)) s.conversations.unshift(c);
      }),
    setCurrentConversationId: (id) => set((s) => { s.currentConversationId = id; }),

    setMessages: (cid, msgs) => set((s) => { s.messages[cid] = msgs; }),
    appendMessage: (cid, msg) =>
      set((s) => {
        const msgs = (s.messages[cid] ??= []);
        if (!msgs.find((m) => m.id === msg.id)) msgs.push(msg);
      }),
    updateMessage: (cid, id, patch) =>
      set((s) => {
        const msgs = s.messages[cid];
        if (!msgs) return;
        const idx = msgs.findIndex((m) => m.id === id);
        if (idx !== -1) Object.assign(msgs[idx], patch);
      }),
    appendToken: (cid, msgId, token) =>
      set((s) => {
        const msgs = s.messages[cid];
        if (!msgs) return;
        const msg = msgs.find((m) => m.id === msgId);
        if (msg) msg.content = (msg.content ?? "") + token;
      }),
    setActiveStreamId: (id) => set((s) => { s.activeStreamId = id; }),

    setDocuments: (docs) => set((s) => { s.documents = docs; }),
    upsertDocument: (doc) =>
      set((s) => {
        const idx = s.documents.findIndex((d) => d.id === doc.id);
        if (idx !== -1) s.documents[idx] = doc;
        else s.documents.unshift(doc);
      }),
    removeDocument: (id) => set((s) => { s.documents = s.documents.filter((d) => d.id !== id); }),
  }))
);
