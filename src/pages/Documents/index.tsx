import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Download, Trash2, Edit3, Copy, X, Save } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useAppStore } from "@/store/appStore";
import { getDocuments, saveDocument, deleteDocument, exportDocument } from "@/lib/tauri";
import { BlockNoteEditor } from "@/components/BlockNoteEditor";
import { formatDate } from "@/lib/utils";
import type { Document } from "@/types";
import { cn } from "@/lib/utils";
import { MOCK_MODE } from "@/lib/tauri";

export function DocumentsPage() {
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);
  const documents  = useWorkspaceStore((s) => s.documents);
  const setDocuments = useWorkspaceStore((s) => s.setDocuments);
  const updateDoc  = useWorkspaceStore((s) => s.updateDocument);
  const removeDoc  = useWorkspaceStore((s) => s.removeDocument);

  const [selected, setSelected] = useState<Document | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    getDocuments(activeWorkspaceId).then(setDocuments).catch(console.error);
  }, [activeWorkspaceId]);

  const openDocument = (doc: Document) => {
    setSelected(doc);
    setEditContent(doc.content);
    setEditTitle(doc.title);
  };

  const handleSave = async () => {
    if (!selected) return;
    setIsSaving(true);
    try {
      await saveDocument(selected.id, editTitle, editContent);
      updateDoc(selected.id, { title: editTitle, content: editContent });
      setSelected((prev) => prev ? { ...prev, title: editTitle, content: editContent } : null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (doc: Document) => {
    await deleteDocument(doc.id);
    removeDoc(doc.id);
    if (selected?.id === doc.id) setSelected(null);
  };

  const handleExport = async (format: "docx" | "pdf") => {
    if (!selected || MOCK_MODE) {
      alert("Exportación no disponible en modo mock");
      return;
    }
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({
        defaultPath: `${selected.title}.${format}`,
        filters: [{ name: format.toUpperCase(), extensions: [format] }],
      });
      if (path) await exportDocument(selected.id, format, path);
    } catch (err) {
      console.error(err);
    }
  };

  if (!activeWorkspaceId) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-400 text-sm">
        Selecciona un workspace para ver sus documentos
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white pt-16">
      {/* Lista de documentos */}
      <div className={cn(
        "border-r border-slate-100 flex flex-col bg-slate-25 transition-all",
        isFocusMode ? "w-0 overflow-hidden" : "w-72"
      )}>
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Documentos</h2>
          <p className="text-xs text-slate-400 mt-0.5">{documents.length} generados</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {documents.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <FileText size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Sin documentos aún</p>
              <p className="text-xs mt-1">Solicita un resumen, acta o cualquier documento al chat</p>
            </div>
          )}

          {documents.map((doc, i) => (
            <motion.button
              key={doc.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => openDocument(doc)}
              className={cn(
                "w-full text-left p-3 rounded-xl border transition-all",
                selected?.id === doc.id
                  ? "bg-indigo-50 border-indigo-200"
                  : "bg-white border-slate-100 hover:border-indigo-100 hover:shadow-soft"
              )}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{DOC_ICONS[doc.doc_type] ?? "📄"}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 text-sm truncate">{doc.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatDate(doc.created_at)}</p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {doc.content.replace(/[#*\[\]`]/g, "").slice(0, 80)}…
                  </p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Editor de documento */}
      <AnimatePresence mode="wait">
        {selected ? (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 bg-white">
              <span className="text-xl">{DOC_ICONS[selected.doc_type] ?? "📄"}</span>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="flex-1 text-lg font-semibold text-slate-900 outline-none bg-transparent"
              />

              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => setIsFocusMode((v) => !v)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  title="Modo enfoque"
                >
                  {isFocusMode ? <X size={16} /> : <Edit3 size={16} />}
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(editContent)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  title="Copiar markdown"
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={() => handleExport("docx")}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  title="Exportar Word"
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={() => handleDelete(selected)}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700
                             text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
                >
                  {isSaving ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  Guardar
                </button>
              </div>
            </div>

            {/* Contenido editable con BlockNote */}
            <div className="flex-1 overflow-y-auto px-12 py-8 max-w-3xl mx-auto w-full">
              <BlockNoteEditor
                content={editContent}
                onChange={setEditContent}
                editable
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex items-center justify-center text-center text-slate-400"
          >
            <div>
              <FileText size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">Selecciona un documento para editarlo</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const DOC_ICONS: Record<string, string> = {
  resumen_ejecutivo:  "📋",
  acta:               "📄",
  minuta:             "📝",
  compromisos:        "✅",
  riesgos:            "⚠️",
  acuerdos:           "🤝",
  proximos_pasos:     "🚀",
  correo_seguimiento: "✉️",
  timeline:           "📅",
  tareas:             "☑️",
  custom:             "📄",
};
