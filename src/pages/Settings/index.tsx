import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Save, RefreshCw, Info, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { getSettings, saveSettings, initializeModels, checkModelsExist, getModelsDir } from "@/lib/tauri";
import { useAppStore } from "@/store/appStore";
import type { AppSettings } from "@/types";
import { cn } from "@/lib/utils";

type Section = "general" | "models" | "ai" | "storage";

const SECTIONS: { id: Section; label: string; emoji: string }[] = [
  { id: "general",  label: "General",     emoji: "⚙️" },
  { id: "models",   label: "Models",      emoji: "🧠" },
  { id: "ai",       label: "AI",          emoji: "✨" },
  { id: "storage",  label: "Storage",     emoji: "💾" },
];

const DEFAULT_SETTINGS: AppSettings = {
  whisper_model_path: "", llm_model_path: "",
  llm_n_ctx: 4096, llm_temperature: 0.3, llm_repeat_penalty: 1.1,
  llm_max_tokens: 1024, rag_top_k: 6, onboarding_complete: true,
};

export function SettingsPage() {
  const modelsLoaded    = useAppStore((s) => s.modelsLoaded);
  const setModelsLoaded = useAppStore((s) => s.setModelsLoaded);

  const [section,  setSection]  = useState<Section>("general");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saving,   setSaving]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [modelsDir, setModelsDir] = useState("");
  const [modelsStatus, setModelsStatus] = useState({ whisper: false, llm: false, whisper_path: "", llm_path: "" });

  useEffect(() => {
    getSettings().then(setSettings).catch(console.error);
    checkModelsExist().then(setModelsStatus).catch(console.error);
    getModelsDir().then(setModelsDir).catch(console.error);
  }, []);

  const patch = (p: Partial<AppSettings>) => setSettings((s) => ({ ...s, ...p }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(settings);
      toast.success("Configuración guardada");
    } catch { toast.error("Error al guardar"); }
    setSaving(false);
  };

  const handleReloadModels = async () => {
    setLoading(true);
    try {
      const result = await initializeModels();
      setModelsLoaded({
        whisper: result.loaded.whisper ?? false,
        llm: result.loaded.llm ?? false,
        embeddings: result.loaded.embeddings ?? false,
      });
      if (result.errors.length > 0) toast.warning("Algunos modelos no cargaron", { description: result.errors.join(", ") });
      else toast.success("Modelos cargados");
    } catch { toast.error("Error cargando modelos"); }
    setLoading(false);
  };

  return (
    <div className="page-content overflow-hidden flex flex-col">
      <div className="px-8 pt-6 pb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      </div>

      <div className="flex flex-1 overflow-hidden px-8 pb-8 gap-6">
        {/* Sidebar */}
        <div className="w-44 flex-shrink-0 space-y-0.5">
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left transition-all",
                section === s.id
                  ? "bg-violet-50 text-violet-700 font-medium"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              )}
            >
              <span>{s.emoji}</span> {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-xl space-y-4">
            {section === "general" && (
              <>
                <SectionTitle>General</SectionTitle>
                <Card>
                  <label className="settings-label">Modelo Whisper (ruta del archivo)</label>
                  <input value={settings.whisper_model_path}
                    onChange={(e) => patch({ whisper_model_path: e.target.value })}
                    placeholder="C:\models\ggml-small.bin" className="input-field mt-1.5" />
                  <p className="text-xs text-slate-400 mt-1.5">
                    Modelo GGML para transcripción de audio
                  </p>
                </Card>
                <Card>
                  <label className="settings-label">Modelo LLM (ruta del archivo)</label>
                  <input value={settings.llm_model_path}
                    onChange={(e) => patch({ llm_model_path: e.target.value })}
                    placeholder="C:\models\phi-4-mini.gguf" className="input-field mt-1.5" />
                  <p className="text-xs text-slate-400 mt-1.5">
                    Modelo GGUF para generación de texto
                  </p>
                </Card>
                <Card>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Info size={14} className="text-violet-500 flex-shrink-0" />
                    <p className="text-xs leading-relaxed">
                      Directorio de modelos: <code className="bg-slate-100 px-1 rounded text-[11px]">{modelsDir || "…"}</code>
                    </p>
                  </div>
                </Card>
              </>
            )}

            {section === "models" && (
              <>
                <SectionTitle>Modelos instalados</SectionTitle>
                {[
                  { label: "Whisper (transcripción)", ok: modelsStatus.whisper || modelsLoaded.whisper, path: modelsStatus.whisper_path },
                  { label: "LLM (generación)", ok: modelsStatus.llm || modelsLoaded.llm, path: modelsStatus.llm_path },
                  { label: "Embeddings (semántica)", ok: modelsLoaded.embeddings, path: "fastembed (descarga automática)" },
                ].map((m) => (
                  <Card key={m.label}>
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${m.ok ? "bg-emerald-400" : "bg-slate-200"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{m.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{m.path || "No configurado"}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${m.ok ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                        {m.ok ? "Cargado" : "Inactivo"}
                      </span>
                    </div>
                  </Card>
                ))}
                <button onClick={handleReloadModels} disabled={loading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl
                             text-sm font-medium hover:bg-violet-700 disabled:opacity-60 transition-colors shadow-soft">
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                  {loading ? "Cargando modelos…" : "Recargar modelos"}
                </button>
              </>
            )}

            {section === "ai" && (
              <>
                <SectionTitle>Configuración de IA</SectionTitle>
                {[
                  { label: "Contexto (n_ctx)", key: "llm_n_ctx", min: 512, max: 32768, step: 512 },
                  { label: "Temperature", key: "llm_temperature", min: 0, max: 2, step: 0.05 },
                  { label: "Repeat penalty", key: "llm_repeat_penalty", min: 1, max: 2, step: 0.05 },
                  { label: "Máx tokens por respuesta", key: "llm_max_tokens", min: 128, max: 4096, step: 128 },
                  { label: "RAG top-K chunks", key: "rag_top_k", min: 1, max: 20, step: 1 },
                ].map((f) => (
                  <Card key={f.key}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="settings-label">{f.label}</label>
                      <span className="text-sm font-mono text-violet-600">
                        {settings[f.key as keyof AppSettings]}
                      </span>
                    </div>
                    <input type="range" min={f.min} max={f.max} step={f.step}
                      value={settings[f.key as keyof AppSettings] as number}
                      onChange={(e) => patch({ [f.key]: parseFloat(e.target.value) })}
                      className="w-full accent-violet-600" />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>{f.min}</span><span>{f.max}</span>
                    </div>
                  </Card>
                ))}
              </>
            )}

            {section === "storage" && (
              <>
                <SectionTitle>Storage</SectionTitle>
                <Card>
                  <p className="text-sm font-medium text-slate-800 mb-1">Datos locales</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Konejo almacena todo localmente en tu dispositivo. No hay datos en la nube.
                    El directorio de datos incluye la base de datos SQLite, archivos WAV temporales y
                    caché de embeddings.
                  </p>
                </Card>
                <Card>
                  <p className="text-sm font-medium text-slate-800 mb-3">Directorio de modelos</p>
                  <code className="block text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2.5 break-all">
                    {modelsDir || "No disponible"}
                  </code>
                </Card>
              </>
            )}

            {/* Save button */}
            {section !== "models" && (
              <div className="pt-2">
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl
                             text-sm font-medium hover:bg-violet-700 disabled:opacity-60 transition-colors shadow-soft">
                  {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/> : <Save size={14}/>}
                  Guardar cambios
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-slate-800 pb-1">{children}</h2>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-xl border border-slate-100 p-4">{children}</div>;
}
