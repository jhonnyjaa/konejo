import { motion } from "framer-motion";
import {
  Home, FolderOpen, Zap, FileText, Settings
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import type { AppPage } from "@/types";
import { cn } from "@/lib/utils";
import { MOCK_MODE } from "@/lib/tauri";

interface NavItem {
  id: AppPage;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: "home",       label: "Inicio",       icon: <Home size={17} /> },
  { id: "workspace",  label: "Workspaces",   icon: <FolderOpen size={17} /> },
  { id: "prompts",    label: "Prompts",      icon: <Zap size={17} /> },
  { id: "documents",  label: "Documentos",   icon: <FileText size={17} /> },
  { id: "settings",   label: "Configuración",icon: <Settings size={17} /> },
];

export function Navigation() {
  const currentPage  = useAppStore((s) => s.currentPage);
  const setPage      = useAppStore((s) => s.setPage);
  const onboarding   = useAppStore((s) => s.onboardingComplete);

  if (!onboarding && currentPage === "onboarding") return null;

  return (
    <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2">
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 24 }}
        className="flex items-center gap-1 bg-white/95 backdrop-blur-md
                   rounded-2xl px-2 py-1.5 shadow-nav border border-slate-200/80"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium",
                "transition-all duration-200",
                isActive
                  ? "text-indigo-700"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 bg-indigo-50 rounded-xl"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10">{item.icon}</span>
              <span className="relative z-10">{item.label}</span>
            </button>
          );
        })}

        {MOCK_MODE && (
          <div className="ml-1 mr-1 px-2 py-0.5 bg-amber-100 text-amber-700
                          text-xs font-semibold rounded-lg border border-amber-200">
            MOCK
          </div>
        )}
      </motion.nav>
    </div>
  );
}
