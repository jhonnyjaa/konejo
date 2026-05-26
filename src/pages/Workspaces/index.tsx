import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, Clock, Users, Pin, LayoutGrid, List, Trash2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/appStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { getWorkspaces, deleteWorkspace } from "@/lib/tauri";
import { formatDate, formatDuration, groupByDate, cn } from "@/lib/utils";
import type { Workspace } from "@/types";

type ViewMode = "list" | "grid";

export function WorkspacesPage() {
  const setPage            = useAppStore((s) => s.setPage);
  const setActiveWorkspace = useAppStore((s) => s.setActiveWorkspaceId);
  const workspaces         = useWorkspaceStore((s) => s.workspaces);
  const setWorkspaces      = useWorkspaceStore((s) => s.setWorkspaces);
  const removeWorkspace    = useWorkspaceStore((s) => s.removeWorkspace);

  const [query,    setQuery]    = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filter,   setFilter]   = useState<"all" | "ready" | "processing">("all");

  useEffect(() => {
    getWorkspaces().then(setWorkspaces).catch(console.error);
  }, []);

  const filtered = workspaces.filter((ws) => {
    const matchQ = ws.name.toLowerCase().includes(query.toLowerCase());
    const matchF = filter === "all" || ws.status === filter;
    return matchQ && matchF;
  });

  const groups = groupByDate(filtered, (w) => w.created_at);

  const openWorkspace = (ws: Workspace) => {
    if (ws.status !== "ready") return;
    setActiveWorkspace(ws.id);
    setPage("workspace");
  };

  const handleDelete = async (ws: Workspace, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteWorkspace(ws.id);
      removeWorkspace(ws.id);
      toast.success("Workspace eliminado");
    } catch {
      toast.error("No se pudo eliminar el workspace");
    }
  };

  return (
    <div className="page-content overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-8 pt-6 pb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Workspaces</h1>

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex-1 relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar workspace…"
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl
                         text-sm text-slate-800 outline-none focus:ring-2 focus:ring-violet-200
                         focus:border-violet-300 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            {(["all", "ready", "processing"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  filter === f ? "bg-white shadow-soft text-slate-800" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {f === "all" ? "Todos" : f === "ready" ? "Listos" : "Procesando"}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            <button onClick={() => setViewMode("list")}
              className={cn("p-1.5 rounded-lg transition-all", viewMode === "list" ? "bg-white shadow-soft text-slate-800" : "text-slate-400 hover:text-slate-600")}>
              <List size={14} />
            </button>
            <button onClick={() => setViewMode("grid")}
              className={cn("p-1.5 rounded-lg transition-all", viewMode === "grid" ? "bg-white shadow-soft text-slate-800" : "text-slate-400 hover:text-slate-600")}>
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-4xl mb-3 opacity-30">📂</p>
            <p className="text-slate-400 text-sm">
              {query ? "No hay resultados para esa búsqueda" : "Sin workspaces todavía"}
            </p>
          </div>
        ) : viewMode === "list" ? (
          <div>
            {Object.entries(groups).map(([label, wsList]) => (
              <div key={label} className="mb-6">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
                <div className="space-y-1.5">
                  {wsList.map((ws, i) => (
                    <ListItem key={ws.id} ws={ws} delay={i * 0.03}
                      onClick={() => openWorkspace(ws)}
                      onDelete={(e) => handleDelete(ws, e)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {filtered.map((ws, i) => (
              <GridItem key={ws.id} ws={ws} delay={i * 0.04}
                onClick={() => openWorkspace(ws)}
                onDelete={(e) => handleDelete(ws, e)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── List item ──────────────────────────────────────────────────────────────────

function ListItem({ ws, delay, onClick, onDelete }: {
  ws: Workspace; delay: number;
  onClick: () => void; onDelete: (e: React.MouseEvent) => void;
}) {
  const ready = ws.status === "ready";
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 bg-white rounded-xl border p-3.5 transition-all",
        ready ? "border-slate-100 hover:border-violet-200 hover:shadow-soft cursor-pointer" : "border-slate-100 cursor-default"
      )}
    >
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0",
        ready ? "bg-violet-50" : ws.status === "processing" ? "bg-amber-50" : "bg-red-50")}>
        {ready ? "📋" : ws.status === "processing" ? (
          <motion.span animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>⚙️</motion.span>
        ) : "⚠️"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 text-sm truncate">{ws.name}</p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
          <span>{formatDate(ws.created_at)}</span>
          {ws.duration_seconds && <><span>·</span><span className="flex items-center gap-0.5"><Clock size={10}/>{formatDuration(ws.duration_seconds)}</span></>}
          {ws.participant_count && <><span>·</span><span className="flex items-center gap-0.5"><Users size={10}/>{ws.participant_count}p</span></>}
        </div>
      </div>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300
                   hover:text-red-400 hover:bg-red-50 rounded-lg transition-all"
      >
        <Trash2 size={13} />
      </button>
      {ready && <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-400 transition-colors" />}
    </motion.div>
  );
}

// ── Grid item ──────────────────────────────────────────────────────────────────

function GridItem({ ws, delay, onClick, onDelete }: {
  ws: Workspace; delay: number;
  onClick: () => void; onDelete: (e: React.MouseEvent) => void;
}) {
  const ready = ws.status === "ready";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
      onClick={onClick}
      className={cn(
        "group relative bg-white rounded-2xl border p-5 transition-all",
        ready ? "border-slate-100 hover:border-violet-200 hover:shadow-medium cursor-pointer" : "border-slate-100"
      )}
    >
      <button onClick={onDelete}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5
                   text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all">
        <Trash2 size={13} />
      </button>
      <div className="text-2xl mb-3">{ready ? "📋" : ws.status === "processing" ? "⚙️" : "⚠️"}</div>
      <p className="font-semibold text-slate-800 text-sm mb-1 leading-snug line-clamp-2">{ws.name}</p>
      <p className="text-xs text-slate-400 mb-3">{formatDate(ws.created_at)}</p>
      {(ws.duration_seconds || ws.participant_count) && (
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {ws.duration_seconds && <span className="flex items-center gap-1"><Clock size={10}/>{formatDuration(ws.duration_seconds)}</span>}
          {ws.participant_count && <span className="flex items-center gap-1"><Users size={10}/>{ws.participant_count}p</span>}
        </div>
      )}
    </motion.div>
  );
}
