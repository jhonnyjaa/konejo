import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/store/appStore";
import type { ProcessingStage } from "@/types";

const STAGES: { key: ProcessingStage; label: string; detail: string; emoji: string }[] = [
  { key: "prepare",       label: "Preparando",     detail: "Validating media file",      emoji: "📁" },
  { key: "audio",         label: "Convirtiendo",   detail: "Processing audio track",     emoji: "🎵" },
  { key: "transcription", label: "Transcribiendo", detail: "Whisper AI at work",         emoji: "🎙️" },
  { key: "embeddings",    label: "Embeddings",     detail: "Semantic vectorization",     emoji: "🧠" },
  { key: "indexing",      label: "Indexando",      detail: "Building knowledge base",    emoji: "🗄️" },
];

export function ProcessingOverlay() {
  const isProcessing    = useAppStore((s) => s.isProcessing);
  const stage           = useAppStore((s) => s.processingStage);
  const progress        = useAppStore((s) => s.processingProgress);
  const message         = useAppStore((s) => s.processingMessage);

  const currentIdx = stage ? STAGES.findIndex((s) => s.key === stage) : -1;
  const stageInfo  = stage && stage !== "done" ? STAGES.find((s) => s.key === stage) : null;

  return (
    <AnimatePresence>
      {isProcessing && (
        <motion.div
          key="processing-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[60] flex items-center justify-center
                     bg-white/95 backdrop-blur-lg pointer-events-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{    opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-lg mx-6 bg-white rounded-3xl shadow-float
                       border border-slate-100 p-10 flex flex-col items-center"
          >
            {/* Animated ring */}
            <div className="relative mb-8">
              <svg width="88" height="88" viewBox="0 0 88 88" className="rotate-[-90deg]">
                <circle cx="44" cy="44" r="38" fill="none" stroke="#f1f5f9" strokeWidth="6" />
                <motion.circle
                  cx="44" cy="44" r="38"
                  fill="none" stroke="#7c3aed" strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 38}`}
                  animate={{ strokeDashoffset: `${2 * Math.PI * 38 * (1 - progress)}` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-2xl">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={stage ?? "idle"}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{    opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.2 }}
                  >
                    {stageInfo?.emoji ?? "⏳"}
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>

            {/* Title */}
            <AnimatePresence mode="wait">
              <motion.h2
                key={stage}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{    opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="text-xl font-semibold text-slate-900 mb-1 text-center"
              >
                {stageInfo?.label ?? "Procesando…"}
              </motion.h2>
            </AnimatePresence>
            <AnimatePresence mode="wait">
              <motion.p
                key={message}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{    opacity: 0 }}
                className="text-sm text-slate-400 text-center mb-8 h-5"
              >
                {message || stageInfo?.detail}
              </motion.p>
            </AnimatePresence>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-8">
              <motion.div
                className="h-full bg-violet-500 rounded-full"
                animate={{ width: `${Math.round(progress * 100)}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>

            {/* Stage timeline */}
            <div className="w-full flex items-center justify-between relative">
              <div className="absolute top-3 left-3 right-3 h-px bg-slate-100" />
              {STAGES.map((s, i) => {
                const done    = currentIdx > i;
                const current = currentIdx === i;
                return (
                  <div key={s.key} className="flex flex-col items-center gap-1.5 z-10 flex-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all duration-500
                      ${done    ? "bg-violet-600 text-white"
                      : current ? "bg-violet-50 ring-2 ring-violet-400 ring-offset-1"
                      :           "bg-white border-2 border-slate-200"}`}
                    >
                      {done ? (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : current ? (
                        <motion.div
                          className="w-2 h-2 rounded-full bg-violet-600"
                          animate={{ scale: [1, 1.5, 1] }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                        />
                      ) : null}
                    </div>
                    <span className={`text-[10px] font-medium text-center leading-tight max-w-[52px]
                      ${done ? "text-violet-600" : current ? "text-violet-500" : "text-slate-300"}`}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-slate-300 mt-8">
              La IA está construyendo tu workspace…
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
