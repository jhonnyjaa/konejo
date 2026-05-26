import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "sonner";

import { Navigation }       from "@/components/Navigation";
import { ProcessingOverlay } from "@/components/ProcessingOverlay";
import { RecordingModal }    from "@/components/RecordingModal";

import { OnboardingPage }  from "@/pages/Onboarding";
import { HomePage }        from "@/pages/Home";
import { WorkspacesPage }  from "@/pages/Workspaces";
import { WorkspacePage }   from "@/pages/Workspace";
import { DocumentsPage }   from "@/pages/Documents";
import { PromptsPage }     from "@/pages/Prompts";
import { SettingsPage }    from "@/pages/Settings";

import { useAppStore }  from "@/store/appStore";
import { getSettings, initializeModels, MOCK_MODE } from "@/lib/tauri";

const T = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 }, transition: { duration: 0.2, ease: "easeOut" } };

export default function App() {
  const currentPage           = useAppStore((s) => s.currentPage);
  const setPage               = useAppStore((s) => s.setPage);
  const onboardingComplete    = useAppStore((s) => s.onboardingComplete);
  const setOnboardingComplete = useAppStore((s) => s.setOnboardingComplete);
  const setModelsLoaded       = useAppStore((s) => s.setModelsLoaded);

  useEffect(() => {
    const init = async () => {
      try {
        const settings = await getSettings();
        setOnboardingComplete(settings.onboarding_complete);
        if (!settings.onboarding_complete) { setPage("onboarding"); return; }

        if (!MOCK_MODE) {
          const result = await initializeModels();
          setModelsLoaded({
            whisper:    result.loaded.whisper    ?? false,
            llm:        result.loaded.llm        ?? false,
            embeddings: result.loaded.embeddings ?? false,
          });
        } else {
          setOnboardingComplete(true);
        }
      } catch (err) {
        console.error("Init error:", err);
      }
    };
    init();
  }, []);

  if (!onboardingComplete && currentPage === "onboarding") {
    return (
      <>
        <OnboardingPage />
        <Toaster position="bottom-right" richColors />
      </>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-white">
      <Navigation />

      <AnimatePresence mode="wait">
        {currentPage === "home" && (
          <motion.div key="home" {...T} className="h-screen">
            <HomePage />
          </motion.div>
        )}
        {currentPage === "workspaces" && (
          <motion.div key="workspaces" {...T} className="h-screen">
            <WorkspacesPage />
          </motion.div>
        )}
        {currentPage === "workspace" && (
          <motion.div key="workspace" {...T} className="h-screen">
            <WorkspacePage />
          </motion.div>
        )}
        {currentPage === "documents" && (
          <motion.div key="documents" {...T} className="h-screen">
            <DocumentsPage />
          </motion.div>
        )}
        {currentPage === "prompts" && (
          <motion.div key="prompts" {...T} className="h-screen">
            <PromptsPage />
          </motion.div>
        )}
        {currentPage === "settings" && (
          <motion.div key="settings" {...T} className="h-screen">
            <SettingsPage />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global overlays */}
      <ProcessingOverlay />
      <RecordingModal />

      <Toaster position="bottom-right" richColors />
    </div>
  );
}
