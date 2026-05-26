import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Star, Trash2, Edit2, Search, X, Check } from "lucide-react";
import { toast } from "sonner";
import { usePromptStore } from "@/store/promptStore";
import type { Prompt, PromptCategory } from "@/types";
import { cn } from "@/lib/utils";

const CATEGORIES: { id: PromptCategory | "all"; label: string; emoji: string }[] = [
  { id: "all",           label: "Todos",          emoji: "✨" },
  { id: "document",      label: "Documentos",     emoji: "📄" },
  { id: "analysis",      label: "Análisis",       emoji: "🔍" },
  { id: "extraction",    label: "Extracción",     emoji: "✂️" },
  { id: "communication", label: "Comunicación",   emoji: "✉️" },
  { id: "custom",        label: "Personalizados", emoji: "⚡" },
];

export function PromptsPage() {
  const { prompts, loaded, load, create, update, remove } = usePromptStore();
  const [query,    setQuery]    = useState("");
  const [cat,      setCat]      = useState<PromptCategory | "all">("all");
  const [editing,  setEditing]  = useState<Prompt | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (!loaded) load(); }, []);

  const filtered = prompts.filter((p) => {
    const matchQ = query === "" || p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.description.toLowerCase().includes(query.toLowerCase());
    const matchC = cat === "all" || p.category === cat;
    return matchQ && matchC;
  });

  return (
    <div className="page-content overflow-hidden flex flex-col">
      <div className="px-8 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-900">Prompt Library</h1>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white
                       rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors shadow-soft"
          >
            <Plus size={14} /> Nuevo prompt
          </button>
        </div>

        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar prompts…"
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl
                       text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all placeholder:text-slate-400" />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)}
              className={cn("px-3 py-1.5 rounded-xl text-xs font-medium transition-all border",
                cat === c.id
                  ? "bg-violet-100 text-violet-700 border-violet-200"
                  : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-white hover:text-slate-700")}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <p className="text-3xl mb-3 opacity-30">⚡</p>
            <p className="text-slate-400 text-sm">{query ? "Sin resultados" : "Sin prompts"}</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {filtered.map((p, i) => (
              <motion.div key={p.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="group flex items-start gap-3 bg-white rounded-2xl border border-slate-100
                           hover:border-violet-200 hover:shadow-soft p-4 transition-all"
              >
                <span className="text-xl mt-0.5">
                  {p.category === "document" ? "📄" : p.category === "analysis" ? "🔍"
                    : p.category === "extraction" ? "✂️" : p.category === "communication" ? "✉️" : "⚡"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-slate-800 text-sm">{p.name}</p>
                    {p.favorite && <Star size={12} className="text-amber-400 fill-amber-400" />}
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{p.description}</p>
                  <p className="text-[13px] text-slate-600 leading-relaxed line-clamp-2">{p.prompt}</p>
                  {p.tags.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {p.tags.map((t) => (
                        <span key={t} className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => update(p.id, { favorite: !p.favorite })}
                    className={cn("p-1.5 rounded-lg transition-colors",
                      p.favorite ? "text-amber-400 bg-amber-50" : "text-slate-300 hover:text-amber-400 hover:bg-amber-50")}>
                    <Star size={13} fill={p.favorite ? "currentColor" : "none"} />
                  </button>
                  <button onClick={() => setEditing(p)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-violet-500 hover:bg-violet-50 transition-colors">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => { remove(p.id); toast.success("Prompt eliminado"); }}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {(creating || editing) && (
          <PromptModal
            initial={editing ?? undefined}
            onSave={async (data) => {
              if (editing) { await update(editing.id, data); toast.success("Prompt actualizado"); }
              else { await create({ ...data, favorite: false }); toast.success("Prompt creado"); }
              setEditing(null); setCreating(false);
            }}
            onClose={() => { setEditing(null); setCreating(false); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PromptModal({ initial, onSave, onClose }: {
  initial?: Prompt;
  onSave: (d: Omit<Prompt, "id" | "created_at" | "favorite">) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName]       = useState(initial?.name ?? "");
  const [desc, setDesc]       = useState(initial?.description ?? "");
  const [text, setText]       = useState(initial?.prompt ?? "");
  const [cat,  setCat]        = useState<PromptCategory>(initial?.category ?? "custom");
  const [tags, setTags]       = useState(initial?.tags.join(", ") ?? "");
  const [saving, setSaving]   = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !text.trim() || saving) return;
    setSaving(true);
    await onSave({ name: name.trim(), description: desc.trim(), prompt: text.trim(), category: cat, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), used_at: undefined });
    setSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-float border border-slate-100 w-full max-w-lg p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-slate-900">{initial ? "Editar prompt" : "Nuevo prompt"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16}/></button>
        </div>
        <div className="space-y-3">
          {[
            { label: "Nombre *", el: <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="input-field" /> },
            { label: "Descripción", el: <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descripción breve" className="input-field" /> },
            { label: "Categoría", el: (
              <select value={cat} onChange={(e) => setCat(e.target.value as PromptCategory)} className="input-field">
                {CATEGORIES.filter((c) => c.id !== "all").map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            )},
            { label: "Prompt *", el: <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="El prompt…" rows={4} className="input-field resize-none" /> },
            { label: "Tags (coma separados)", el: <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="resumen, análisis…" className="input-field" /> },
          ].map(({ label, el }) => (
            <div key={label}>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
              {el}
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200">Cancelar</button>
          <button onClick={handleSave} disabled={!name.trim() || !text.trim() || saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
            {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/> : <Check size={14}/>}
            {initial ? "Guardar" : "Crear"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
