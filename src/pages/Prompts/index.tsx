import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, Copy, ChevronRight } from "lucide-react";
import { SUGGESTED_PROMPTS } from "@/types";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "all",       label: "Todos" },
  { id: "documento", label: "Documentos" },
  { id: "análisis",  label: "Análisis" },
  { id: "extracción",label: "Extracción" },
] as const;

export function PromptsPage() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const setPage = useAppStore((s) => s.setPage);

  const filtered = SUGGESTED_PROMPTS.filter(
    (p) => activeCategory === "all" || p.category === activeCategory
  );

  const copy = (prompt: typeof SUGGESTED_PROMPTS[0]) => {
    navigator.clipboard.writeText(prompt.prompt);
    setCopiedId(prompt.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="min-h-screen bg-slate-25 pt-20 px-8 pb-8">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Zap size={24} className="text-indigo-500" />
            Prompts sugeridos
          </h1>
          <p className="text-slate-500 text-sm">
            Úsalos directamente en el chat de cualquier workspace.
          </p>
        </motion.div>

        {/* Filtro de categorías */}
        <div className="flex gap-2 mb-6">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "px-4 py-1.5 rounded-xl text-sm font-medium transition-all",
                activeCategory === cat.id
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-200"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Grid de prompts */}
        <div className="grid gap-3">
          {filtered.map((prompt, i) => (
            <motion.div
              key={prompt.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-soft
                         hover:border-indigo-200 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{prompt.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-800">{prompt.label}</span>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      prompt.category === "documento"  ? "bg-blue-50 text-blue-600" :
                      prompt.category === "análisis"   ? "bg-purple-50 text-purple-600" :
                                                         "bg-green-50 text-green-600"
                    )}>
                      {prompt.category}
                    </span>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">{prompt.prompt}</p>
                </div>
                <button
                  onClick={() => copy(prompt)}
                  className="flex-shrink-0 p-2 rounded-xl opacity-0 group-hover:opacity-100
                             hover:bg-slate-100 text-slate-500 transition-all"
                  title="Copiar prompt"
                >
                  {copiedId === prompt.id ? (
                    <span className="text-green-500 text-xs font-medium">✓</span>
                  ) : (
                    <Copy size={15} />
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
