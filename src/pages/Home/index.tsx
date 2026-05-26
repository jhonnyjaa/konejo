import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Mic, MicOff, Clock, FolderOpen, ChevronRight, AlertCircle } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
  getWorkspaces, importFile, startRecording, stopRecording,
  onProcessingProgress, onProcessingComplete, onProcessingError,
  deleteWorkspace, MOCK_MODE,
} from "@/lib/tauri";
import { open } from "@tauri-apps/plugin-dialog";
import { formatDate as _formatDate, formatDuration as _formatDuration, cn } from "@/lib/utils";
import type { Workspace } from "@/types";
import { useTauriEvent } from "@/hooks/useTauriEvent";

export function HomePage() {
  const setPage            = useAppStore((s) => s.setPage);
  const setActiveWorkspace = useAppStore((s) => s.setActiveWorkspaceId);
  const isProcessing       = useAppStore((s) => s.isProcessing);
  const processingProgress = useAppStore((s) => s.processingProgress);
  const processingMessage  = useAppStore((s) => s.processingMessage);
  const setProcessingEvent = useAppStore((s) => s.setProcessingEvent);
  const clearProcessing    = useAppStore((s) => s.clearProcessing);
  const isRecording        = useAppStore((s) => s.isRecording);
  const setRecording       = useAppStore((s) => s.setRecording);

  const workspaces    = useWorkspaceStore((s) => s.workspaces);
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const updateWs      = useWorkspaceStore((s) => s.updateWorkspace);

  const [isDragging, setIsDragging] = useState(false);
  const [processingName, setProcessingName] = useState<string | null>(null);
  const dragCounter = useRef(0);

  // Cargar workspaces
  useEffect(() => {
    getWorkspaces().then(setWorkspaces).catch(console.error);
  }, []);

  // Eventos de procesamiento
  useTauriEvent<{ stage: string; progress: number; message: string }>(
    "processing-progress",
    (e) => {
      setProcessingEvent(e.payload as any, "");
    }
  );

  useTauriEvent<string>("processing-complete", (e) => {
    clearProcessing();
    const id = e.payload;
    updateWs(id, { status: "ready" });
    getWorkspaces().then(setWorkspaces).catch(console.error);
  });

  useTauriEvent<string>("processing-error", (e) => {
    clearProcessing();
    console.error("Processing error:", e.payload);
  });

  const handleImportFile = async (filePath?: string) => {
    try {
      let path = filePath;
      if (!path) {
        if (MOCK_MODE) {
          path = "C:\\Users\\user\\reuniones\\ejemplo.mp4";
        } else {
          const result = await open({
            multiple: false,
            filters: [{ name: "Audio/Video", extensions: ["mp4", "mkv", "mov", "wav", "mp3", "m4a", "ogg", "flac", "webm", "avi"] }],
          });
          if (!result) return;
          path = result as string;
        }
      }
      const name = path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") ?? "Reunión";
      setProcessingName(name);
      await importFile(path);
      await getWorkspaces().then(setWorkspaces);
    } catch (err) {
      console.error("Error importando archivo:", err);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    dragCounter.current = 0;
    const file = e.dataTransfer.files[0];
    if (file) handleImportFile(file.path as string);
  };

  const handleRecording = async () => {
    if (isRecording) {
      setRecording(false);
      const wsId = await stopRecording();
      await getWorkspaces().then(setWorkspaces);
    } else {
      await startRecording();
      setRecording(true);
    }
  };

  const openWorkspace = (ws: Workspace) => {
    setActiveWorkspace(ws.id);
    setPage("workspace");
  };

  const recentWorkspaces = workspaces.slice(0, 8);

  return (
    <div
      className="min-h-screen bg-slate-25 pt-20 px-8 pb-8"
      onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current === 0) setIsDragging(false); }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="drop-overlay"
          >
            <div className="text-center">
              <div className="text-6xl mb-4">📂</div>
              <p className="text-2xl font-semibold text-indigo-700">Suelta para importar</p>
              <p className="text-indigo-500 text-sm mt-1">Audio o video de la reunión</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Processing banner */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-40
                       bg-white rounded-2xl shadow-medium border border-indigo-100
                       px-5 py-3 flex items-center gap-4 min-w-80"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-lg flex-shrink-0">
              🔄
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">
                {processingMessage || "Procesando…"}
              </p>
              <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-indigo-500 rounded-full"
                  animate={{ width: `${Math.round(processingProgress * 100)}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-3xl font-bold text-slate-900 mb-1">
            Buenos días 👋
          </h1>
          <p className="text-slate-500">¿Qué reunión quieres analizar hoy?</p>
        </motion.div>

        {/* Acciones principales */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleImportFile()}
            className="flex flex-col items-center justify-center gap-3
                       bg-white rounded-2xl border border-slate-200 shadow-soft
                       p-8 hover:border-indigo-200 hover:shadow-medium transition-all group"
          >
            <div className="w-14 h-14 bg-indigo-50 group-hover:bg-indigo-100
                            rounded-2xl flex items-center justify-center transition-colors">
              <Upload size={24} className="text-indigo-500" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-800">Importar archivo</p>
              <p className="text-slate-500 text-sm mt-0.5">MP4, MKV, WAV, MP3…</p>
            </div>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRecording}
            className={`flex flex-col items-center justify-center gap-3
                        bg-white rounded-2xl border shadow-soft p-8
                        hover:shadow-medium transition-all group
                        ${isRecording
                          ? "border-red-200 bg-red-50"
                          : "border-slate-200 hover:border-red-200"
                        }`}
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors
                             ${isRecording ? "bg-red-100" : "bg-slate-50 group-hover:bg-red-50"}`}>
              {isRecording ? (
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
                  <MicOff size={24} className="text-red-500" />
                </motion.div>
              ) : (
                <Mic size={24} className="text-slate-500 group-hover:text-red-400 transition-colors" />
              )}
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-800">
                {isRecording ? "Detener grabación" : "Grabar reunión"}
              </p>
              <p className="text-slate-500 text-sm mt-0.5">
                {isRecording ? "Haz clic para finalizar" : "Desde el micrófono"}
              </p>
            </div>
          </motion.button>
        </div>

        {/* Workspaces recientes */}
        {recentWorkspaces.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Reuniones recientes</h2>
              {workspaces.length > 8 && (
                <button
                  onClick={() => setPage("workspace")}
                  className="text-indigo-600 text-sm font-medium hover:text-indigo-700 flex items-center gap-1"
                >
                  Ver todas <ChevronRight size={14} />
                </button>
              )}
            </div>

            <div className="grid gap-2">
              {recentWorkspaces.map((ws, i) => (
                <WorkspaceCard
                  key={ws.id}
                  workspace={ws}
                  delay={i * 0.04}
                  onClick={() => ws.status === "ready" && openWorkspace(ws)}
                />
              ))}
            </div>
          </motion.div>
        )}

        {workspaces.length === 0 && !isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center py-16 text-slate-400"
          >
            <div className="text-5xl mb-4 opacity-50">🐰</div>
            <p className="text-slate-500 font-medium mb-1">Sin reuniones aún</p>
            <p className="text-sm">Importa un archivo o graba tu primera reunión</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function WorkspaceCard({
  workspace: ws,
  delay,
  onClick,
}: { workspace: Workspace; delay: number; onClick: () => void }) {
  const isReady      = ws.status === "ready";
  const isProcessing = ws.status === "processing";
  const isError      = ws.status === "error";

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className={`flex items-center gap-4 bg-white rounded-xl border p-4
                  transition-all duration-200
                  ${isReady
                    ? "border-slate-200 hover:border-indigo-200 hover:shadow-soft cursor-pointer"
                    : "border-slate-100 cursor-default"
                  }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0
                       ${isReady ? "bg-indigo-50" : isProcessing ? "bg-amber-50" : "bg-red-50"}`}>
        {isReady ? "📋" : isProcessing ? (
          <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
            ⚙️
          </motion.span>
        ) : "⚠️"}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 truncate">{ws.name}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-slate-400 text-xs">{_formatDate(ws.created_at)}</span>
          {ws.duration_seconds !== null && (
            <>
              <span className="text-slate-200">·</span>
              <span className="text-slate-400 text-xs">{_formatDuration(ws.duration_seconds)}</span>
            </>
          )}
          {isProcessing && (
            <span className="text-amber-500 text-xs font-medium">Procesando…</span>
          )}
          {isError && (
            <span className="text-red-400 text-xs font-medium flex items-center gap-1">
              <AlertCircle size={11} /> Error
            </span>
          )}
        </div>
      </div>

      {isReady && <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />}
    </motion.div>
  );
}
