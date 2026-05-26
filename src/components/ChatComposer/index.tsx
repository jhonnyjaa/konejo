import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Mic, MicOff, Sparkles } from "lucide-react";
import { SUGGESTED_PROMPTS } from "@/types";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  onSend: (content: string) => void;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  isRecording?: boolean;
  isSending?: boolean;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatComposer({
  onSend,
  onStartRecording,
  onStopRecording,
  isRecording = false,
  isSending = false,
  isStreaming = false,
  disabled = false,
  placeholder = "Pregunta algo sobre la reunión…",
}: ChatComposerProps) {
  const [value, setValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isBusy = isSending || isStreaming;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isBusy || disabled) return;
    onSend(trimmed);
    setValue("");
    setShowSuggestions(false);
    textareaRef.current?.focus();
  }, [value, isBusy, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectSuggestion = (prompt: string) => {
    setValue(prompt);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  };

  const isActive = value.length > 0 || isBusy;

  return (
    <div className="relative">
      {/* Sugerencias */}
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-full mb-2 left-0 right-0 bg-white rounded-2xl shadow-float
                       border border-slate-200 p-3 overflow-hidden"
          >
            <p className="text-xs font-medium text-slate-400 mb-2 px-1">Sugerencias rápidas</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectSuggestion(s.prompt)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-indigo-50
                             hover:text-indigo-700 rounded-xl text-sm text-slate-700
                             transition-colors border border-slate-100 hover:border-indigo-200"
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer principal */}
      <div className={cn(
        "flex items-end gap-2 bg-white rounded-2xl border transition-all duration-200",
        "shadow-soft px-3 py-2.5",
        isActive ? "border-indigo-200 shadow-medium" : "border-slate-200",
        disabled && "opacity-60 pointer-events-none"
      )}>
        {/* Botón sugerencias */}
        <button
          onClick={() => setShowSuggestions((v) => !v)}
          className={cn(
            "flex-shrink-0 p-1.5 rounded-xl transition-colors mb-0.5",
            showSuggestions
              ? "bg-indigo-100 text-indigo-600"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          )}
          title="Sugerencias"
        >
          <Sparkles size={16} />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isBusy ? "El modelo está respondiendo…" : placeholder}
          disabled={isBusy}
          rows={1}
          className="flex-1 resize-none bg-transparent text-slate-800 placeholder-slate-400
                     text-sm leading-relaxed outline-none selectable
                     max-h-40 py-1"
        />

        {/* Botón micrófono */}
        {(onStartRecording || onStopRecording) && (
          <button
            onClick={isRecording ? onStopRecording : onStartRecording}
            className={cn(
              "flex-shrink-0 p-1.5 rounded-xl transition-all mb-0.5",
              isRecording
                ? "bg-red-100 text-red-500 animate-pulse"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            )}
            title={isRecording ? "Detener grabación" : "Grabar audio"}
          >
            {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        )}

        {/* Botón enviar */}
        <motion.button
          onClick={handleSend}
          disabled={!value.trim() || isBusy}
          whileTap={{ scale: 0.9 }}
          className={cn(
            "flex-shrink-0 p-1.5 rounded-xl transition-all mb-0.5",
            value.trim() && !isBusy
              ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
              : "bg-slate-100 text-slate-300 cursor-not-allowed"
          )}
        >
          {isBusy ? (
            <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin block" />
          ) : (
            <Send size={15} />
          )}
        </motion.button>
      </div>

      {/* Indicador de carga del LLM */}
      {isStreaming && <ThinkingIndicator />}
    </div>
  );
}

// ── Indicador de "pensando" ───────────────────────────────────────────────────

const THINKING_TEXTS = [
  "Analizando la transcripción…",
  "Buscando fragmentos relevantes…",
  "Construyendo el contexto…",
  "Generando la respuesta…",
  "Revisando los detalles…",
  "Procesando con el modelo…",
];

function ThinkingIndicator() {
  const [textIdx, setTextIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIdx((i) => (i + 1) % THINKING_TEXTS.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 mt-2 px-1"
    >
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 bg-indigo-400 rounded-full"
            animate={{ y: [0, -4, 0] }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.span
          key={textIdx}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.3 }}
          className="text-xs text-slate-400"
        >
          {THINKING_TEXTS[textIdx]}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
}
