import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "sonner";

import { Navigation } from "@/components/Navigation";
import { OnboardingPage } from "@/pages/Onboarding";
import { HomePage } from "@/pages/Home";
import { WorkspacePage } from "@/pages/Workspace";
import { DocumentsPage } from "@/pages/Documents";
import { PromptsPage } from "@/pages/Prompts";
import { SettingsPage } from "@/pages/Settings";

import { useAppStore } from "@/store/appStore";
import { getSettings, initializeModels, MOCK_MODE } from "@/lib/tauri";

const PAGE_TRANSITION = {
  initial:  { opacity: 0, y: 8 },
  animate:  { opacity: 1, y: 0 },
  exit:     { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: "easeOut" },
};

export default function App() {
  const currentPage          = useAppStore((s) => s.currentPage);
  const setPage              = useAppStore((s) => s.setPage);
  const onboardingComplete   = useAppStore((s) => s.onboardingComplete);
  const setOnboardingComplete = useAppStore((s) => s.setOnboardingComplete);
  const setModelsLoaded      = useAppStore((s) => s.setModelsLoaded);

  // Inicialización al arrancar
  useEffect(() => {
    const init = async () => {
      try {
        const settings = await getSettings();
        setOnboardingComplete(settings.onboarding_complete);

        if (!settings.onboarding_complete) {
          setPage("onboarding");
          return;
        }

        // Intentar cargar modelos silenciosamente
        if (!MOCK_MODE) {
          const result = await initializeModels();
          setModelsLoaded({
            whisper:    result.loaded.whisper ?? false,
            llm:        result.loaded.llm ?? false,
            embeddings: result.loaded.embeddings ?? false,
          });
        } else {
          // En mock mode, onboarding siempre completo
          setOnboardingComplete(true);
        }
      } catch (err) {
        console.error("Error de inicialización:", err);
      }
    };

    init();
  }, []);

  // Mostrar onboarding si no está completo
  if (!onboardingComplete && currentPage === "onboarding") {
    return (
      <>
        <OnboardingPage />
        <Toaster position="bottom-right" richColors />
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      <Navigation />

      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {currentPage === "home" && (
            <motion.div key="home" {...PAGE_TRANSITION} className="h-full overflow-auto">
              <HomePage />
            </motion.div>
          )}

          {currentPage === "workspace" && (
            <motion.div key="workspace" {...PAGE_TRANSITION} className="h-full">
              <WorkspacePage />
            </motion.div>
          )}

          {currentPage === "documents" && (
            <motion.div key="documents" {...PAGE_TRANSITION} className="h-full">
              <DocumentsPage />
            </motion.div>
          )}

          {currentPage === "prompts" && (
            <motion.div key="prompts" {...PAGE_TRANSITION} className="h-full overflow-auto">
              <PromptsPage />
            </motion.div>
          )}

          {currentPage === "settings" && (
            <motion.div key="settings" {...PAGE_TRANSITION} className="h-full overflow-auto">
              <SettingsPage />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Toaster position="bottom-right" richColors />
    </div>
  );
}
