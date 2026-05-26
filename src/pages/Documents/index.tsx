import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Download, Trash2, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { deleteDocument } from "@/lib/tauri";
import { KonejoEditor } from "@/components/Editor";
import { formatDate } from "@/lib/utils";
import type { Document } from "@/types";

const DOC_LABELS: Record<string, string> = {
  resumen_ejecutivo: "Resumen ejecutivo", acta: "Acta", minuta: "Minuta",
  compromisos: "Compromisos", riesgos: "Riesgos", acuerdos: "Acuerdos",
  proximos_pasos: "Próximos pasos", correo_seguimiento: "Correo seguimiento",
  timeline: "Timeline", tareas: "Tareas", custom: "Documento",
};

export function DocumentsPage() {
  const documents      = useWorkspaceStore((s) => s.documents);
  const removeDocument = useWorkspaceStore((s) => s.removeDocument);
  const [query, setQuery]   = useState("");
  const [editing, setEditing] = useState<Document | null>(null);

  const filtered = documents.filter((d) =>
    query === "" || d.title.toLowerCase().includes(query.toLowerCase()) ||
    d.content.toLowerCase().includes(query.toLowerCase())
  );

  const handleDelete = async (doc: Document) => {
    await deleteDocument(doc.id);
    removeDocument(doc.id);
    toast.success("Documento eliminado");
    if (editing?.id === doc.id) setEditing(null);
  };

  const handleCopy = (doc: Document) => {
    navigator.clipboard.writeText(doc.content);
    toast.success("Copiado al portapapeles");
  };

  const handleExport = (doc: Document) => {
    const blob = new Blob([doc.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${doc.title}.md`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportado como Markdown");
  };

  return (
    <div className="page-content overflow-hidden flex flex-col">
      <div className="px-8 pt-6 pb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Documentos</h1>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar documentos…"
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl
                       text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300
                       transition-all placeholder:text-slate-400" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-4xl mb-3 opacity-30">📄</p>
            <p className="text-slate-400 text-sm">
              {query ? "Sin resultados" : "Genera documentos en el chat de un workspace"}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
            {filtered.map((doc, i) => (
              <motion.div key={doc.id}
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="group relative bg-white rounded-2xl border border-slate-100
                           hover:border-violet-200 hover:shadow-soft p-5 transition-all cursor-pointer"
                onClick={() => setEditing(doc)}
              >
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  {[
                    { icon: <Copy size={12}/>, fn: (e: React.MouseEvent) => { e.stopPropagation(); handleCopy(doc); } },
                    { icon: <Download size={12}/>, fn: (e: React.MouseEvent) => { e.stopPropagation(); handleExport(doc); } },
                    { icon: <Trash2 size={12}/>, fn: (e: React.MouseEvent) => { e.stopPropagation(); handleDelete(doc); } },
                  ].map(({ icon, fn }, idx) => (
                    <button key={idx} onClick={fn}
                      className="p-1.5 bg-white rounded-lg border border-slate-200 text-slate-400 hover:text-violet-500 shadow-soft">
                      {icon}
                    </button>
                  ))}
                </div>
                <div className="text-2xl mb-3">📄</div>
                <p className="font-semibold text-slate-800 text-sm mb-0.5 line-clamp-2">{doc.title}</p>
                <p className="text-[11px] text-violet-600 font-medium mb-2">{DOC_LABELS[doc.doc_type] ?? "Documento"}</p>
                <p className="text-xs text-slate-400 mb-3">{formatDate(doc.created_at)}</p>
                <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-3">
                  {doc.content.replace(/[#*_\[\]`]/g, "")}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-8"
            onClick={() => setEditing(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-float border border-slate-100 w-full max-w-3xl max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <div>
                  <p className="font-semibold text-slate-900">{editing.title}</p>
                  <p className="text-xs text-violet-600 mt-0.5">{DOC_LABELS[editing.doc_type]}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleCopy(editing)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-medium transition-colors">
                    <Copy size={12}/> Copiar
                  </button>
                  <button onClick={() => handleExport(editing)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-medium transition-colors">
                    <Download size={12}/> .md
                  </button>
                  <button onClick={() => setEditing(null)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                    <X size={16}/>
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <KonejoEditor
                  content={editing.content}
                  onChange={(html) => setEditing({ ...editing, content: html })}
                  placeholder="Edita el documento…"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
