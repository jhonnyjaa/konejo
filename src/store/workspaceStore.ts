import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Workspace, Document } from "@/types";

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  documents: Document[];
  isLoading: boolean;
  error: string | null;

  setWorkspaces: (ws: Workspace[]) => void;
  addWorkspace: (ws: Workspace) => void;
  updateWorkspace: (id: string, patch: Partial<Workspace>) => void;
  removeWorkspace: (id: string) => void;
  setCurrentWorkspace: (ws: Workspace | null) => void;

  setDocuments: (docs: Document[]) => void;
  addDocument: (doc: Document) => void;
  updateDocument: (id: string, patch: Partial<Document>) => void;
  removeDocument: (id: string) => void;

  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  immer((set) => ({
    workspaces: [],
    currentWorkspace: null,
    documents: [],
    isLoading: false,
    error: null,

    setWorkspaces: (ws) => set((s) => { s.workspaces = ws; }),
    addWorkspace: (ws) => set((s) => { s.workspaces.unshift(ws); }),
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

    setDocuments: (docs) => set((s) => { s.documents = docs; }),
    addDocument: (doc) => set((s) => { s.documents.unshift(doc); }),
    updateDocument: (id, patch) =>
      set((s) => {
        const idx = s.documents.findIndex((d) => d.id === id);
        if (idx !== -1) Object.assign(s.documents[idx], patch);
      }),
    removeDocument: (id) =>
      set((s) => { s.documents = s.documents.filter((d) => d.id !== id); }),

    setLoading: (v) => set((s) => { s.isLoading = v; }),
    setError: (e) => set((s) => { s.error = e; }),
  }))
);
