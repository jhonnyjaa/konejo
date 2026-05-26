import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { AppPage, ProcessingStage, ProcessingEvent, RecordingState } from "@/types";

interface AppState {
  currentPage: AppPage;
  setPage: (p: AppPage) => void;

  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;

  // Processing overlay
  isProcessing: boolean;
  processingStage: ProcessingStage | null;
  processingProgress: number;
  processingMessage: string;
  processingWorkspaceId: string | null;
  setProcessingEvent: (e: ProcessingEvent, workspaceId: string) => void;
  clearProcessing: () => void;

  // Recording
  recordingState: RecordingState;
  setRecordingState: (s: RecordingState) => void;

  // Models
  modelsLoaded: { whisper: boolean; llm: boolean; embeddings: boolean };
  setModelsLoaded: (m: { whisper: boolean; llm: boolean; embeddings: boolean }) => void;

  // Onboarding
  onboardingComplete: boolean;
  setOnboardingComplete: (v: boolean) => void;
}

export const useAppStore = create<AppState>()(
  immer((set) => ({
    currentPage: "home",
    setPage: (p) => set((s) => { s.currentPage = p; }),

    activeWorkspaceId: null,
    setActiveWorkspaceId: (id) => set((s) => { s.activeWorkspaceId = id; }),

    isProcessing: false,
    processingStage: null,
    processingProgress: 0,
    processingMessage: "",
    processingWorkspaceId: null,
    setProcessingEvent: (e, workspaceId) =>
      set((s) => {
        s.isProcessing        = e.stage !== "done";
        s.processingStage     = e.stage;
        s.processingProgress  = e.progress;
        s.processingMessage   = e.message;
        s.processingWorkspaceId = workspaceId;
      }),
    clearProcessing: () =>
      set((s) => {
        s.isProcessing = false;
        s.processingStage = null;
        s.processingProgress = 0;
        s.processingMessage = "";
        s.processingWorkspaceId = null;
      }),

    recordingState: "idle",
    setRecordingState: (rs) => set((s) => { s.recordingState = rs; }),

    modelsLoaded: { whisper: false, llm: false, embeddings: false },
    setModelsLoaded: (m) => set((s) => { s.modelsLoaded = m; }),

    onboardingComplete: false,
    setOnboardingComplete: (v) => set((s) => { s.onboardingComplete = v; }),
  }))
);
