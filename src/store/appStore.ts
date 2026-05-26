import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { AppPage, ProcessingStage, ProcessingEvent } from "@/types";

interface AppState {
  // Página actual
  currentPage: AppPage;
  setPage: (page: AppPage) => void;

  // Workspace activo
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;

  // Procesamiento en curso
  isProcessing: boolean;
  processingWorkspaceId: string | null;
  processingStage: ProcessingStage | null;
  processingProgress: number;
  processingMessage: string;
  setProcessingEvent: (event: ProcessingEvent, workspaceId: string) => void;
  clearProcessing: () => void;

  // Grabación
  isRecording: boolean;
  setRecording: (v: boolean) => void;

  // Modelos
  modelsLoaded: { whisper: boolean; llm: boolean; embeddings: boolean };
  setModelsLoaded: (m: { whisper: boolean; llm: boolean; embeddings: boolean }) => void;

  // Onboarding
  onboardingComplete: boolean;
  setOnboardingComplete: (v: boolean) => void;

  // Sidebar collapsed
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
}

export const useAppStore = create<AppState>()(
  immer((set) => ({
    currentPage: "home",
    setPage: (page) => set((s) => { s.currentPage = page; }),

    activeWorkspaceId: null,
    setActiveWorkspaceId: (id) => set((s) => { s.activeWorkspaceId = id; }),

    isProcessing: false,
    processingWorkspaceId: null,
    processingStage: null,
    processingProgress: 0,
    processingMessage: "",
    setProcessingEvent: (event, workspaceId) =>
      set((s) => {
        s.isProcessing = event.stage !== "done";
        s.processingWorkspaceId = workspaceId;
        s.processingStage = event.stage;
        s.processingProgress = event.progress;
        s.processingMessage = event.message;
      }),
    clearProcessing: () =>
      set((s) => {
        s.isProcessing = false;
        s.processingWorkspaceId = null;
        s.processingStage = null;
        s.processingProgress = 0;
        s.processingMessage = "";
      }),

    isRecording: false,
    setRecording: (v) => set((s) => { s.isRecording = v; }),

    modelsLoaded: { whisper: false, llm: false, embeddings: false },
    setModelsLoaded: (m) => set((s) => { s.modelsLoaded = m; }),

    onboardingComplete: false,
    setOnboardingComplete: (v) => set((s) => { s.onboardingComplete = v; }),

    sidebarOpen: true,
    setSidebarOpen: (v) => set((s) => { s.sidebarOpen = v; }),
  }))
);
