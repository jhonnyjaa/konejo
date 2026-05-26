import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Mic, ChevronRight, Clock, Users, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "@/store/appStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { getWorkspaces, importFile, startRecording, MOCK_MODE } from "@/lib/tauri";
import { useTauriEvent } from "@/hooks/useTauriEvent";
import { formatDate, formatDuration, groupByDate, cn } from "@/lib/utils";
import type { Workspace, ProcessingEvent } from "@/types";

export function HomePage() {
  const setPage             = useAppStore((s) => s.setPage);
  const setActiveWorkspace  = useAppStore((s) => s.setActiveWorkspaceId);
  const setProcessingEvent  = useAppStore((s) => s.setProcessingEvent);
  const clearProcessing     = useAppStore((s) => s.clearProcessing);
  const setRecordingState   = useAppStore((s) => s.setRecordingState);

  const workspaces    = useWorkspaceStore((s) => s.workspaces);
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const updateWs      = useWorkspaceStore((s) => s.updateWorkspace);

  const [isDragging, setIsDragging] = useState(false);
  const dragCnt = useRef(0);

  useEffect(() => {
    getWorkspaces().then(setWorkspaces).catch(console.error);
  }, []);

  useTauriEvent<ProcessingEvent>("processing-progress", (e) => {
    setProcessingEvent(e.payload, "");
  });
  useTauriEvent<string>("processing-complete", (e) => {
    clearProcessing();
    updateWs(e.payload, { status: "ready" });
    getWorkspaces().then(setWorkspaces).catch(console.error);
  });
  useTauriEvent<string>("processing-error", (e) => {
    clearProcessing();
    toast.error("Error procesando archivo", { description: String(e.payload) });
  });

  const handleImport = async (filePath?: string) => {
    try {
      let path = filePath;
      if (!path) {
        if (MOCK_MODE) {
          path = "C:\\reuniones\\ejemplo.mp4";
        } else {
          const result = await open({
            multiple: false,
            filters: [{ name: "Audio / Video", extensions: ["mp4","mkv","mov","avi","webm","mp3","wav","m4a","ogg","flac"] }],
          });
          if (!result) return;
          path = result as string;
        }
      }
      await importFile(path);
      const ws = await getWorkspaces();
      setWorkspaces(ws);
    } catch (err) {
      toast.error("No se pudo importar el archivo", { description: String(err) });
    }
  };

  const handleRecord = async () => {
    try {
      await startRecording();
      setRecordingState("recording");
    } catch (err) {
      toast.error("No se pudo iniciar la grabación", { description: String(err) });
    }
  };

  const openWorkspace = (ws: Workspace) => {
    if (ws.status !== "ready") return;
    setActiveWorkspace(ws.id);
    setPage("workspace");
  };

  const groups = groupByDate(workspaces, (w) => w.created_at);
  const hasWorkspaces = workspaces.length > 0;

  return (
    <div
      className="page-content overflow-y-auto"
      onDragEnter={(e) => { e.preventDefault(); dragCnt.current++; setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); dragCnt.current--; if (dragCnt.current === 0) setIsDragging(false); }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault(); setIsDragging(false); dragCnt.current = 0;
        const f = e.dataTransfer.files[0];
        if (f) handleImport((f as File & { path?: string }).path ?? f.name);
      }}
    >
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="drop-overlay"
          >
            <div className="text-center">
              <div className="text-5xl mb-4">📂</div>
              <p className="text-xl font-semibold text-violet-700">Suelta para importar</p>
              <p className="text-sm text-violet-400 mt-1">Audio o video de la reunión</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero */}
      <div className={cn(
        "flex flex-col items-center px-8 w-full",
        hasWorkspaces ? "pt-16 pb-12" : "flex-1 justify-center py-0"
      )}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
            Start with a meeting
          </h1>
          <p className="text-slate-400 text-[15px] max-w-xs mx-auto">
            Import or record a meeting to create an AI workspace
          </p>
        </motion.div>

        {/* Action cards */}
        <div className="flex gap-4 w-full max-w-xl justify-center">
          {[
            {
              delay: 0.06, label: "Import file", sub: "MP4, MKV, WAV, MP3…",
              icon: <Upload size={24} className="text-violet-500" />,
              bg: "group-hover:bg-violet-100", ibg: "bg-violet-50",
              border: "hover:border-violet-300",
              onClick: () => handleImport(),
            },
            {
              delay: 0.12, label: "Record meeting", sub: "From microphone",
              icon: <Mic size={24} className="text-slate-400 group-hover:text-red-400 transition-colors" />,
              bg: "group-hover:bg-red-50", ibg: "bg-slate-50",
              border: "hover:border-red-200",
              onClick: handleRecord,
            },
          ].map((card) => (
            <motion.button
              key={card.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: card.delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.97 }}
              onClick={card.onClick}
              className={cn(
                "group flex-1 flex flex-col items-center justify-center gap-4",
                "bg-white rounded-2xl border-2 border-dashed border-slate-200",
                "shadow-soft px-8 py-10 transition-all duration-200 cursor-pointer",
                card.border
              )}
            >
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-colors", card.ibg, card.bg)}>
                {card.icon}
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-800 text-[15px]">{card.label}</p>
                <p className="text-slate-400 text-sm mt-0.5">{card.sub}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Recent workspaces */}
      {hasWorkspaces && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="px-8 pb-12 max-w-2xl w-full mx-auto"
        >
          {Object.entries(groups).map(([label, wsList]) => (
            <div key={label} className="mb-6">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                {label}
              </p>
              <div className="space-y-2">
                {wsList.slice(0, 6).map((ws, i) => (
                  <WorkspaceCard key={ws.id} ws={ws} delay={i * 0.04} onClick={() => openWorkspace(ws)} />
                ))}
              </div>
            </div>
          ))}

          {workspaces.length > 6 && (
            <button
              onClick={() => setPage("workspaces")}
              className="flex items-center gap-1.5 text-violet-600 text-sm font-medium
                         hover:text-violet-700 transition-colors mt-2"
            >
              Ver todos los workspaces <ChevronRight size={14} />
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ── Workspace card ─────────────────────────────────────────────────────────────

function WorkspaceCard({ ws, delay, onClick }: { ws: Workspace; delay: number; onClick: () => void }) {
  const ready  = ws.status === "ready";
  const busy   = ws.status === "processing";
  const err    = ws.status === "error";

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 bg-white rounded-xl border p-3.5 transition-all duration-200",
        ready ? "border-slate-100 hover:border-violet-200 hover:shadow-soft cursor-pointer"
               : "border-slate-100 cursor-default"
      )}
    >
      <div className={cn(
        "w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0",
        ready ? "bg-violet-50" : busy ? "bg-amber-50" : "bg-red-50"
      )}>
        {ready ? "📋" : busy ? (
          <motion.span animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>⚙️</motion.span>
        ) : "⚠️"}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 truncate text-sm">{ws.name}</p>
        <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
          <span className="text-slate-400 text-xs">{formatDate(ws.created_at)}</span>
          {ws.duration_seconds !== null && (
            <>
              <span className="text-slate-200 text-xs">·</span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Clock size={10} /> {formatDuration(ws.duration_seconds)}
              </span>
            </>
          )}
          {ws.participant_count !== null && (
            <>
              <span className="text-slate-200 text-xs">·</span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Users size={10} /> {ws.participant_count}p
              </span>
            </>
          )}
          {busy && <span className="text-amber-500 text-xs font-medium">Procesando…</span>}
          {err  && <span className="flex items-center gap-1 text-red-400 text-xs"><AlertCircle size={10}/>Error</span>}
        </div>
      </div>

      {ready && <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />}
    </motion.div>
  );
}
