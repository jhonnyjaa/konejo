import { useEffect, useRef, useCallback, memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, MessageSquare, ChevronDown, FileText,
  Clock, Users, AlignLeft, X, Check,
} from "lucide-react";
import { useAppStore }      from "@/store/appStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useChat }           from "@/hooks/useChat";
import { ChatComposer }      from "@/components/ChatComposer";
import { AIResponseBlock }   from "@/components/AIResponseBlock";
import { getWorkspace, getDocuments } from "@/lib/tauri";
import { formatDuration, formatDate, cn } from "@/lib/utils";
import type { Conversation, Message } from "@/types";

// ── WorkspacePage ──────────────────────────────────────────────────────────────

export function WorkspacePage() {
  const setPage             = useAppStore((s) => s.setPage);
  const activeWorkspaceId   = useAppStore((s) => s.activeWorkspaceId);
  const currentWorkspace    = useWorkspaceStore((s) => s.currentWorkspace);
  const setCurrentWorkspace = useWorkspaceStore((s) => s.setCurrentWorkspace);
  const setDocuments        = useWorkspaceStore((s) => s.setDocuments);

  const [showConvMenu,  setShowConvMenu]  = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const {
    conversations, currentConversationId, messages,
    isSending, activeStreamId,
    loadConversations, selectConversation, newConversation, sendMessage,
  } = useChat(activeWorkspaceId);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-dropdown]")) {
        setShowConvMenu(false);
        setShowInfoPanel(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    getWorkspace(activeWorkspaceId).then((ws) => ws && setCurrentWorkspace(ws));
    getDocuments(activeWorkspaceId).then(setDocuments).catch(console.error);
    loadConversations();
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length, activeStreamId]);

  const handlePrompt = useCallback((text: string) => sendMessage(text), [sendMessage]);

  const activeConv = conversations.find((c) => c.id === currentConversationId);

  // ── Guard states ────────────────────────────────────────────────────────────
  if (!activeWorkspaceId) {
    return (
      <div className="page-content items-center justify-center">
        <p className="text-slate-400 mb-4">No hay workspace seleccionado</p>
        <button onClick={() => setPage("home")}
          className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700">
          Ir al inicio
        </button>
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="page-content items-center justify-center">
        <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-content flex-col overflow-hidden">

      {/* ── Command bar ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 border-b border-slate-100 bg-white/90 backdrop-blur-sm">

        {/* Back */}
        <button
          onClick={() => setPage("home")}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-xs font-medium
                     transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-100"
        >
          <ArrowLeft size={12} /> Inicio
        </button>

        <div className="w-px h-4 bg-slate-200 mx-0.5" />

        {/* Workspace info button + popover */}
        <div className="relative" data-dropdown>
          <button
            onClick={() => { setShowInfoPanel((v) => !v); setShowConvMenu(false); }}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[13px] font-semibold transition-colors max-w-[220px]",
              showInfoPanel ? "bg-violet-50 text-violet-700" : "text-slate-800 hover:bg-slate-100"
            )}
          >
            <span className="truncate">{currentWorkspace.name}</span>
            <ChevronDown size={12} className={cn("flex-shrink-0 transition-transform", showInfoPanel && "rotate-180")} />
          </button>

          {/* Info popover */}
          <AnimatePresence>
            {showInfoPanel && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.14 }}
                className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl border border-slate-200
                           shadow-float z-30 p-4 space-y-3"
              >
                <div>
                  <p className="font-semibold text-slate-800 text-sm leading-snug">
                    {currentWorkspace.name}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDate(currentWorkspace.created_at)}
                  </p>
                </div>

                {(currentWorkspace.duration_seconds || currentWorkspace.participant_count) && (
                  <div className="flex gap-4">
                    {currentWorkspace.duration_seconds && (
                      <span className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock size={11} className="text-violet-400" />
                        {formatDuration(currentWorkspace.duration_seconds)}
                      </span>
                    )}
                    {currentWorkspace.participant_count && (
                      <span className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Users size={11} className="text-violet-400" />
                        {currentWorkspace.participant_count} participantes
                      </span>
                    )}
                  </div>
                )}

                {currentWorkspace.transcript && (
                  <>
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-4">
                        {currentWorkspace.transcript}
                      </p>
                    </div>
                    <button
                      onClick={() => { setShowTranscript(true); setShowInfoPanel(false); }}
                      className="flex items-center gap-1.5 text-xs text-violet-600 font-medium
                                 hover:text-violet-700 transition-colors"
                    >
                      <AlignLeft size={11} /> Ver transcripción completa
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Conversation selector */}
        <div className="relative" data-dropdown>
          <button
            onClick={() => { setShowConvMenu((v) => !v); setShowInfoPanel(false); }}
            disabled={!currentConversationId && conversations.length === 0}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[13px] transition-colors",
              showConvMenu ? "bg-violet-50 text-violet-700" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <MessageSquare size={13} className="opacity-60" />
            <span className="font-medium max-w-[160px] truncate">
              {activeConv?.title ?? "Conversación"}
            </span>
            <ChevronDown size={12} className={cn("transition-transform", showConvMenu && "rotate-180")} />
          </button>

          {/* Conversations dropdown */}
          <AnimatePresence>
            {showConvMenu && (
              <ConversationMenu
                conversations={conversations}
                currentId={currentConversationId}
                onSelect={(id) => { selectConversation(id); setShowConvMenu(false); }}
                onNew={() => { newConversation(); setShowConvMenu(false); }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* New conversation */}
        <button
          onClick={newConversation}
          title="Nueva conversación"
          className="p-2 rounded-xl text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
        >
          <Plus size={14} />
        </button>

        <div className="w-px h-4 bg-slate-200 mx-0.5" />

        {/* Documents */}
        <button
          onClick={() => setPage("documents")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] text-slate-500
                     hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <FileText size={13} className="opacity-70" /> Documentos
        </button>
      </div>

      {/* ── Messages ─────────────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-8 space-y-6">
        {messages.length === 0 ? (
          <EmptyThread workspaceName={currentWorkspace.name} onPrompt={handlePrompt} />
        ) : (
          messages.map((msg) => (
            <MessageRow
              key={msg.id}
              message={msg}
              isStreaming={msg.id === activeStreamId}
            />
          ))
        )}
      </div>

      {/* ── Composer ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-8 pb-6 pt-2">
        <ChatComposer
          onSend={sendMessage}
          isSending={isSending}
          isStreaming={!!activeStreamId}
          disabled={!currentConversationId}
        />
      </div>

      {/* ── Transcript modal ─────────────────────────────────────────────────── */}
      <TranscriptModal
        open={showTranscript}
        onClose={() => setShowTranscript(false)}
        name={currentWorkspace.name}
        transcript={currentWorkspace.transcript ?? ""}
      />
    </div>
  );
}

// ── ConversationMenu ───────────────────────────────────────────────────────────

function ConversationMenu({ conversations, currentId, onSelect, onNew }: {
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.97 }}
      transition={{ duration: 0.14 }}
      className="absolute top-full right-0 mt-2 w-60 bg-white rounded-2xl border border-slate-200
                 shadow-float z-30 py-1.5 overflow-hidden"
    >
      {conversations.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4 px-4">Sin conversaciones</p>
      ) : (
        <div className="max-h-60 overflow-y-auto">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] transition-colors",
                currentId === conv.id
                  ? "bg-violet-50 text-violet-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
              )}
            >
              {currentId === conv.id && <Check size={11} className="flex-shrink-0 text-violet-500" />}
              {currentId !== conv.id && <MessageSquare size={11} className="flex-shrink-0 opacity-40" />}
              <span className="truncate">{conv.title ?? "Conversación"}</span>
            </button>
          ))}
        </div>
      )}
      <div className="border-t border-slate-100 mt-1 pt-1 px-2 pb-1">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[13px]
                     text-violet-600 font-medium hover:bg-violet-50 transition-colors"
        >
          <Plus size={12} /> Nueva conversación
        </button>
      </div>
    </motion.div>
  );
}

// ── TranscriptModal ────────────────────────────────────────────────────────────

function TranscriptModal({ open, onClose, name, transcript }: {
  open: boolean; onClose: () => void; name: string; transcript: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-4 top-[10%] bottom-[10%] max-w-2xl mx-auto z-50
                       bg-white rounded-2xl shadow-float border border-slate-200 flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <div>
                <p className="font-semibold text-slate-800 text-sm">Transcripción</p>
                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{name}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-400"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="text-[13px] text-slate-700 leading-relaxed selectable whitespace-pre-wrap font-mono">
                {transcript}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── MessageRow ─────────────────────────────────────────────────────────────────

const MessageRow = memo(function MessageRow({
  message, isStreaming,
}: { message: Message; isStreaming: boolean }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {/* Avatar */}
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-1 font-bold",
        isUser ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500"
      )}>
        {isUser ? "T" : "🐰"}
      </div>

      {/* Content */}
      <div className={cn("max-w-2xl", isUser ? "flex justify-end" : "flex-1")}>
        {isUser ? (
          <div className="bg-violet-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-[14px] leading-relaxed selectable">
            {message.content}
          </div>
        ) : (
          <AIResponseBlock
            messageId={message.id}
            content={message.content}
            isStreaming={isStreaming}
            thinkingSlot={<ThinkingState />}
          />
        )}
      </div>
    </motion.div>
  );
});

// ── ThinkingState ──────────────────────────────────────────────────────────────

function ThinkingState() {
  const states = ["Entendiendo la reunión…", "Recuperando contexto…", "Generando respuesta…"];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % states.length), 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-violet-300 rounded-full"
            animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.span
          key={idx}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="text-sm text-slate-400"
        >
          {states[idx]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

// ── EmptyThread ────────────────────────────────────────────────────────────────

function EmptyThread({ workspaceName, onPrompt }: { workspaceName: string; onPrompt: (t: string) => void }) {
  const suggestions = [
    { label: "Resumen ejecutivo",     prompt: "Genera un resumen ejecutivo de la reunión" },
    { label: "Action items",          prompt: "Lista todos los action items y responsables" },
    { label: "Decisiones clave",      prompt: "¿Cuáles fueron las decisiones más importantes?" },
    { label: "Identificar riesgos",   prompt: "Identifica todos los riesgos mencionados" },
    { label: "Próximos pasos",        prompt: "¿Cuáles son los próximos pasos acordados?" },
    { label: "Correo de seguimiento", prompt: "Redacta un correo de seguimiento post-reunión" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center h-full text-center py-12"
    >
      <div className="text-5xl mb-4 opacity-40">🐰</div>
      <h3 className="text-lg font-semibold text-slate-700 mb-1">
        ¿Qué quieres saber sobre esta reunión?
      </h3>
      <p className="text-slate-400 text-sm mb-8 max-w-xs leading-relaxed">
        Haz preguntas, genera documentos o extrae información clave de{" "}
        <span className="text-slate-600 font-medium">"{workspaceName}"</span>
      </p>

      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        {suggestions.map((s) => (
          <motion.button
            key={s.label}
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onPrompt(s.prompt)}
            className="px-3.5 py-2 bg-white text-slate-600 rounded-xl text-sm border border-slate-200
                       hover:border-violet-200 hover:text-violet-700 hover:bg-violet-50/50
                       transition-all shadow-soft cursor-pointer"
          >
            {s.label}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
