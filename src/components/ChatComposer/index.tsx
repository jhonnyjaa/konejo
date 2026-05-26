import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Zap, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePromptStore } from "@/store/promptStore";
import type { Prompt } from "@/types";

interface ChatComposerProps {
  onSend: (content: string) => void;
  isSending?: boolean;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatComposer({
  onSend, isSending, isStreaming, disabled, placeholder = "Ask anything about this meeting…"
}: ChatComposerProps) {
  const [draft, setDraft]      = useState("");
  const [showPrompts, setShow] = useState(false);
  const [query, setQuery]      = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);

  const prompts     = usePromptStore((s) => s.prompts);
  const loadPrompts = usePromptStore((s) => s.load);
  const markUsed    = usePromptStore((s) => s.markUsed);
  const loaded      = usePromptStore((s) => s.loaded);

  useEffect(() => { if (!loaded) loadPrompts(); }, []);

  // Auto-resize textarea
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  const submit = useCallback(() => {
    if (!draft.trim() || isSending || disabled) return;
    onSend(draft.trim());
    setDraft("");
  }, [draft, isSending, disabled, onSend]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const insertPrompt = (p: Prompt) => {
    setDraft(p.prompt);
    markUsed(p.id);
    setShow(false);
    setTimeout(() => textRef.current?.focus(), 50);
  };

  const filteredPrompts = prompts.filter((p) =>
    query === "" || p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.description.toLowerCase().includes(query.toLowerCase())
  );
  const favorites = filteredPrompts.filter((p) => p.favorite);
  const others    = filteredPrompts.filter((p) => !p.favorite);

  return (
    <div className="relative">
      {/* Prompt picker */}
      <AnimatePresence>
        {showPrompts && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-full mb-3 left-0 right-0 bg-white rounded-2xl
                       border border-slate-200 shadow-float overflow-hidden z-10"
          >
            <div className="p-3 border-b border-slate-100">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar prompt…"
                className="w-full px-3 py-2 bg-slate-50 rounded-xl text-sm outline-none
                           focus:ring-2 focus:ring-violet-200 border border-transparent
                           focus:border-violet-200 transition-all"
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {favorites.length > 0 && (
                <>
                  <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    ⭐ Favoritos
                  </p>
                  {favorites.map((p) => <PromptItem key={p.id} prompt={p} onSelect={insertPrompt} />)}
                </>
              )}
              {others.length > 0 && (
                <>
                  {favorites.length > 0 && <div className="h-px bg-slate-100 my-1" />}
                  <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Todos
                  </p>
                  {others.map((p) => <PromptItem key={p.id} prompt={p} onSelect={insertPrompt} />)}
                </>
              )}
              {filteredPrompts.length === 0 && (
                <p className="text-center text-slate-400 text-sm py-8">Sin resultados</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input box */}
      <div className={cn(
        "flex items-end gap-2 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200",
        "shadow-soft transition-all",
        !disabled && "focus-within:border-violet-300 focus-within:shadow-glass"
      )}>
        <button
          onClick={() => setShow(!showPrompts)}
          disabled={disabled}
          className={cn(
            "flex-shrink-0 p-3 mb-1 ml-1 rounded-xl transition-colors",
            showPrompts ? "text-violet-600 bg-violet-50" : "text-slate-400 hover:text-violet-500 hover:bg-violet-50",
            disabled && "opacity-40 cursor-not-allowed"
          )}
        >
          <Zap size={16} />
        </button>

        <textarea
          ref={textRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none bg-transparent py-3.5 text-[14px] text-slate-800
                     placeholder:text-slate-400 outline-none leading-relaxed
                     disabled:cursor-not-allowed disabled:opacity-50 selectable"
          style={{ maxHeight: "200px" }}
        />

        <div className="flex-shrink-0 p-2 mb-1 mr-1">
          {isStreaming ? (
            <button className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={submit}
              disabled={!draft.trim() || isSending || disabled}
              className={cn(
                "p-2 rounded-xl transition-all",
                draft.trim() && !disabled
                  ? "bg-violet-600 text-white hover:bg-violet-700 shadow-soft"
                  : "bg-slate-100 text-slate-300 cursor-not-allowed"
              )}
            >
              <Send size={14} />
            </motion.button>
          )}
        </div>
      </div>

      {/* Suggestion chips */}
      {!isSending && !draft && !showPrompts && (
        <div className="flex gap-2 mt-2 flex-wrap">
          {["Resumen ejecutivo", "Action items", "Riesgos", "Decisiones clave"].map((chip) => (
            <button
              key={chip}
              onClick={() => { setDraft(chip); textRef.current?.focus(); }}
              disabled={disabled}
              className="px-3 py-1.5 text-xs text-slate-500 bg-white border border-slate-200
                         rounded-full hover:border-violet-200 hover:text-violet-600 hover:bg-violet-50
                         transition-all disabled:opacity-40"
            >
              {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PromptItem({ prompt: p, onSelect }: { prompt: Prompt; onSelect: (p: Prompt) => void }) {
  const icon = p.category === "document" ? "📄" : p.category === "analysis" ? "🔍"
    : p.category === "extraction" ? "✂️" : p.category === "communication" ? "✉️" : "⚡";
  return (
    <button
      onClick={() => onSelect(p)}
      className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
    >
      <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800 leading-tight">{p.name}</p>
        <p className="text-xs text-slate-400 mt-0.5 leading-snug line-clamp-1">{p.description}</p>
      </div>
    </button>
  );
}
