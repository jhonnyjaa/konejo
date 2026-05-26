import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";
import type { ProcessingStage } from "@/types";

interface ProcessingScreenProps {
  stage: ProcessingStage | null;
  progress: number;
  message: string;
  workspaceName?: string;
  onComplete?: () => void;
  onError?: (err: string) => void;
}

const STAGE_CONFIG: Record<ProcessingStage, { label: string; emoji: string; color: string }> = {
  prepare:       { label: "Preparación",     emoji: "📁", color: "#6366f1" },
  audio:         { label: "Audio",           emoji: "🎵", color: "#8b5cf6" },
  transcription: { label: "Transcripción",   emoji: "🎙️", color: "#06b6d4" },
  embeddings:    { label: "Semántica",       emoji: "🧠", color: "#10b981" },
  indexing:      { label: "Indexación",      emoji: "🔍", color: "#f59e0b" },
  done:          { label: "Completado",      emoji: "✨", color: "#6366f1" },
};

const ALL_STAGES: ProcessingStage[] = [
  "prepare", "audio", "transcription", "embeddings", "indexing", "done"
];

export function ProcessingScreen({
  stage,
  progress,
  message,
  workspaceName,
}: ProcessingScreenProps) {
  const currentStageIndex = stage ? ALL_STAGES.indexOf(stage) : -1;
  const isDone = stage === "done";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white px-8">
      {/* Logo animado */}
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center
                   text-4xl mb-8 shadow-medium"
      >
        🐰
      </motion.div>

      {/* Título */}
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-semibold text-slate-900 mb-2"
      >
        {isDone ? "¡Listo!" : "Procesando tu reunión"}
      </motion.h2>

      {workspaceName && (
        <p className="text-slate-500 text-sm mb-10 text-center max-w-sm">
          {isDone ? `"${workspaceName}" está lista para explorar` : `"${workspaceName}"`}
        </p>
      )}

      {/* Etapas */}
      <div className="flex gap-6 mb-10">
        {ALL_STAGES.filter((s) => s !== "done").map((s, i) => {
          const config = STAGE_CONFIG[s];
          const isCompleted = currentStageIndex > i;
          const isCurrent   = currentStageIndex === i;

          return (
            <motion.div
              key={s}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex flex-col items-center gap-2"
            >
              <motion.div
                animate={isCurrent ? { scale: [1, 1.12, 1] } : {}}
                transition={{ duration: 1.2, repeat: Infinity }}
                className={`
                  w-12 h-12 rounded-2xl flex items-center justify-center text-xl
                  transition-all duration-500
                  ${isCompleted ? "bg-green-100" : isCurrent ? "bg-indigo-100" : "bg-slate-100"}
                `}
              >
                {isCompleted ? (
                  <CheckCircle size={20} className="text-green-500" />
                ) : isCurrent ? (
                  <motion.span
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    {config.emoji}
                  </motion.span>
                ) : (
                  <span className="opacity-30">{config.emoji}</span>
                )}
              </motion.div>
              <span className={`text-xs font-medium ${
                isCompleted ? "text-green-600" : isCurrent ? "text-indigo-600" : "text-slate-400"
              }`}>
                {config.label}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Barra de progreso */}
      <div className="w-80 h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
        <motion.div
          className="h-full bg-indigo-500 rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: `${Math.round(progress * 100)}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {/* Mensaje */}
      <AnimatePresence mode="wait">
        <motion.p
          key={message}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3 }}
          className="text-sm text-slate-500 text-center"
        >
          {message || "Iniciando…"}
        </motion.p>
      </AnimatePresence>

      {/* Orbes de fondo */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        {[
          { x: "10%",  y: "20%", size: 300, color: "#e0e9ff", delay: 0 },
          { x: "80%",  y: "60%", size: 200, color: "#f0fdf4", delay: 1 },
          { x: "50%",  y: "80%", size: 250, color: "#fef3c7", delay: 2 },
        ].map((orb, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full opacity-60 blur-3xl"
            style={{
              left: orb.x, top: orb.y,
              width: orb.size, height: orb.size,
              background: orb.color,
            }}
            animate={{
              scale: [1, 1.2, 1],
              x: [-20, 20, -20],
              y: [-20, 20, -20],
            }}
            transition={{
              duration: 6 + i * 2,
              repeat: Infinity,
              delay: orb.delay,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
}
