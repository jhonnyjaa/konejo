import { useEffect, useRef, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, MessageSquare, Clock, Users } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useChatStore } from "@/store/chatStore";
import { useChat } from "@/hooks/useChat";
import { ChatComposer } from "@/components/ChatComposer";
import { MarkdownRenderer } from "@/components/BlockNoteEditor";
import { getWorkspace, getDocuments } from "@/lib/tauri";
import { SUGGESTED_PROMPTS as ALL_SUGGESTED } from "@/types";
import { formatDuration, formatDate } from "@/lib/utils";
import type { Message } from "@/types";
import { cn } from "@/lib/utils";

export function WorkspacePage() {
  const setPage            = useAppStore((s) => s.setPage);
  const activeWorkspaceId  = useAppStore((s) => s.activeWorkspaceId);
  const currentWorkspace   = useWorkspaceStore((s) => s.currentWorkspace);
  const setCurrentWorkspace = useWorkspaceStore((s) => s.setCurrentWorkspace);
  const setDocuments       = useWorkspaceStore((s) => s.setDocuments);
  const addDocument        = useWorkspaceStore((s) => s.addDocument);

  const {
    conversations, currentConversationId, messages,
    isSending, activeStreamId,
    loadConversations, selectConversation, newConversation, sendMessage,
  } = useChat(activeWorkspaceId);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Cargar workspace
  useEffect(() => {
    if (!activeWorkspaceId) return;
    getWorkspace(activeWorkspaceId).then((ws) => ws && setCurrentWorkspace(ws));
    getDocuments(activeWorkspaceId).then(setDocuments).catch(console.error);
    loadConversations();
  }, [activeWorkspaceId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, activeStreamId]);

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white pt-16">
      {/* Sidebar de conversaciones */}
      <div className="w-56 border-r border-slate-100 flex flex-col bg-slate-25 flex-shrink-0">
        <div className="p-3 border-b border-slate-100">
          <button
            onClick={() => setPage("home")}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700
                       text-sm transition-colors mb-3"
          >
            <ArrowLeft size={14} /> Inicio
          </button>

          {/* Info workspace */}
          <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-soft">
            <p className="font-semibold text-slate-800 text-sm truncate">{currentWorkspace.name}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
              {currentWorkspace.duration_seconds !== null && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock size={10} />
                  {formatDuration(currentWorkspace.duration_seconds)}
                </span>
              )}
              {currentWorkspace.participant_count !== null && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Users size={10} />
                  {currentWorkspace.participant_count} personas
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Lista de conversaciones */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Chats</span>
            <button
              onClick={newConversation}
              className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              title="Nueva conversación"
            >
              <Plus size={13} />
            </button>
          </div>

          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => selectConversation(conv.id)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-2 rounded-xl text-left transition-colors text-sm",
                currentConversationId === conv.id
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <MessageSquare size={13} className="flex-shrink-0" />
              <span className="truncate">{conv.title ?? "Conversación"}</span>
            </button>
          ))}

          {conversations.length === 0 && (
            <p className="text-xs text-slate-400 text-center px-3 py-4">
              Sin conversaciones aún
            </p>
          )}
        </div>
      </div>

      {/* Panel de chat principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Thread de mensajes */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-8 py-6 space-y-6"
        >
          {messages.length === 0 && (
            <EmptyThread workspaceName={currentWorkspace.name} />
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} isStreaming={msg.id === activeStreamId} />
          ))}
        </div>

        {/* Composer */}
        <div className="flex-shrink-0 px-8 pb-6">
          <ChatComposer
            onSend={sendMessage}
            isSending={isSending}
            isStreaming={!!activeStreamId}
            disabled={!currentConversationId}
          />
        </div>
      </div>
    </div>
  );
}

// ── Mensaje individual ────────────────────────────────────────────────────────

const MessageBubble = memo(function MessageBubble({
  message,
  isStreaming,
}: { message: Message; isStreaming: boolean }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("flex gap-4", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {/* Avatar */}
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-1",
        isUser ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
      )}>
        {isUser ? "T" : "🐰"}
      </div>

      {/* Contenido */}
      <div className={cn("max-w-2xl flex-1", isUser && "flex justify-end")}>
        {isUser ? (
          <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm selectable">
            {message.content}
          </div>
        ) : (
          <div className={cn(
            "bg-white rounded-2xl rounded-tl-sm border border-slate-100 px-5 py-4 shadow-soft",
            isStreaming && "streaming-cursor"
          )}>
            {message.content ? (
              <MarkdownRenderer content={message.content} />
            ) : isStreaming ? (
              <div className="flex gap-1 py-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 bg-slate-300 rounded-full"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </motion.div>
  );
});

// ── Estado vacío ──────────────────────────────────────────────────────────────

function EmptyThread({ workspaceName }: { workspaceName: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center h-full text-center pt-12"
    >
      <div className="text-5xl mb-4 opacity-60">🐰</div>
      <h3 className="text-xl font-semibold text-slate-700 mb-2">
        ¿Qué quieres saber sobre "{workspaceName}"?
      </h3>
      <p className="text-slate-400 text-sm mb-8 max-w-sm">
        Haz preguntas, solicita documentos o extrae información clave de la reunión.
      </p>

      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        {ALL_SUGGESTED.slice(0, 4).map((p) => (
          <div
            key={p.id}
            className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-xl text-sm border border-slate-100"
          >
            {p.icon} {p.label}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
