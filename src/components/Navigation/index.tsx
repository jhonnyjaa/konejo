import { motion } from "framer-motion";
import { Home, Layers, Zap, FileText, Settings } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import type { AppPage } from "@/types";
import { cn } from "@/lib/utils";
import { MOCK_MODE } from "@/lib/tauri";

interface NavItem { id: AppPage; label: string; icon: React.ReactNode; }

const ITEMS: NavItem[] = [
  { id: "home",       label: "Home",        icon: <Home size={15} /> },
  { id: "workspaces", label: "Workspaces",  icon: <Layers size={15} /> },
  { id: "prompts",    label: "Prompts",     icon: <Zap size={15} /> },
  { id: "documents",  label: "Documents",   icon: <FileText size={15} /> },
  { id: "settings",   label: "Settings",    icon: <Settings size={15} /> },
];

export function Navigation() {
  const currentPage = useAppStore((s) => s.currentPage);
  const setPage     = useAppStore((s) => s.setPage);
  const onboarding  = useAppStore((s) => s.onboardingComplete);

  if (!onboarding || currentPage === "onboarding") return null;

  return (
    <div className="fixed top-3 left-1/2 z-50 -translate-x-1/2 pointer-events-none">
      <motion.nav
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.1 }}
        className="pointer-events-auto flex items-center gap-0.5 px-2 py-1.5
                   bg-white/90 backdrop-blur-md rounded-2xl shadow-nav border border-slate-200/70"
      >
        {ITEMS.map((item) => {
          const active = currentPage === item.id ||
            (item.id === "workspace" && currentPage === "workspace");
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={cn(
                "relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium",
                "transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-violet-400",
                active ? "text-violet-700" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/80"
              )}
            >
              {active && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 bg-violet-50 rounded-xl"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10">{item.icon}</span>
              <span className="relative z-10">{item.label}</span>
            </button>
          );
        })}

        {MOCK_MODE && (
          <span className="ml-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[11px]
                           font-semibold rounded-lg border border-amber-200/80">
            MOCK
          </span>
        )}
      </motion.nav>
    </div>
  );
}
