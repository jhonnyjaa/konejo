import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Settings, Save, RefreshCw, FolderOpen, Info } from "lucide-react";
import { getSettings, saveSettings, initializeModels, checkModelsExist } from "@/lib/tauri";
import { useAppStore } from "@/store/appStore";
import type { AppSettings } from "@/types";
import { cn } from "@/lib/utils";

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelStatus, setModelStatus] = useState({ whisper: false, llm: false });
  const [saved, setSaved] = useState(false);
  const setModelsLoaded = useAppStore((s) => s.setModelsLoaded);

  useEffect(() => {
    getSettings().then(setSettings).catch(console.error);
    checkModelsExist().then((r) => setModelStatus({ whisper: r.whisper, llm: r.llm })).catch(console.error);
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      await saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadModels = async () => {
    setIsLoadingModels(true);
    try {
      const result = await initializeModels();
      setModelsLoaded({
        whisper: result.loaded.whisper ?? false,
        llm: result.loaded.llm ?? false,
        embeddings: result.loaded.embeddings ?? false,
      });
      await checkModelsExist().then((r) => setModelStatus({ whisper: r.whisper, llm: r.llm }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);

  return (
    <div className="min-h-screen bg-slate-25 pt-20 px-8 pb-16">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Settings size={22} className="text-slate-600" />
            Configuración
          </h1>
          <p className="text-slate-500 text-sm">Ajusta los modelos y parámetros de Konejo.</p>
        </motion.div>

        <div className="space-y-4">
          {/* Modelos */}
          <Section title="Modelos locales" icon="🧠">
            <Field label="Ruta Whisper Small (.bin)">
              <input
                value={settings.whisper_model_path}
                onChange={(e) => update("whisper_model_path", e.target.value)}
                className="input-field font-mono text-sm"
              />
              <StatusBadge ok={modelStatus.whisper} label={modelStatus.whisper ? "Encontrado" : "No encontrado"} />
            </Field>

            <Field label="Ruta Phi-4-mini (.gguf)">
              <input
                value={settings.llm_model_path}
                onChange={(e) => update("llm_model_path", e.target.value)}
                className="input-field font-mono text-sm"
              />
              <StatusBadge ok={modelStatus.llm} label={modelStatus.llm ? "Encontrado" : "No encontrado"} />
            </Field>

            <button
              onClick={handleLoadModels}
              disabled={isLoadingModels}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100
                         text-indigo-700 rounded-xl text-sm font-medium transition-colors
                         disabled:opacity-60 mt-2"
            >
              {isLoadingModels ? (
                <span className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              Cargar modelos ahora
            </button>
          </Section>

          {/* Inferencia LLM */}
          <Section title="Inferencia LLM" icon="⚙️">
            <Field label="Contexto (n_ctx)">
              <NumberInput
                value={settings.llm_n_ctx}
                min={512} max={65536} step={512}
                onChange={(v) => update("llm_n_ctx", v)}
              />
              <p className="text-xs text-slate-400 mt-1">Tokens máximos de contexto. Phi-4-mini soporta hasta 16384.</p>
            </Field>

            <Field label="Temperatura">
              <div className="flex items-center gap-3">
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={settings.llm_temperature}
                  onChange={(e) => update("llm_temperature", parseFloat(e.target.value))}
                  className="flex-1 accent-indigo-600"
                />
                <span className="text-sm font-mono text-slate-700 w-10 text-right">
                  {settings.llm_temperature.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">0 = determinístico, 1 = muy creativo. Recomendado: 0.3</p>
            </Field>

            <Field label="Penalización por repetición">
              <div className="flex items-center gap-3">
                <input
                  type="range" min={1} max={1.5} step={0.05}
                  value={settings.llm_repeat_penalty}
                  onChange={(e) => update("llm_repeat_penalty", parseFloat(e.target.value))}
                  className="flex-1 accent-indigo-600"
                />
                <span className="text-sm font-mono text-slate-700 w-10 text-right">
                  {settings.llm_repeat_penalty.toFixed(2)}
                </span>
              </div>
            </Field>

            <Field label="Tokens máximos por respuesta">
              <NumberInput
                value={settings.llm_max_tokens}
                min={256} max={8192} step={128}
                onChange={(v) => update("llm_max_tokens", v)}
              />
            </Field>
          </Section>

          {/* RAG */}
          <Section title="Retrieval (RAG)" icon="🔍">
            <Field label="Chunks recuperados por query (top-k)">
              <NumberInput
                value={settings.rag_top_k}
                min={2} max={20} step={1}
                onChange={(v) => update("rag_top_k", v)}
              />
              <p className="text-xs text-slate-400 mt-1">
                Para documentos se usa automáticamente top-k 12. Para chat: este valor.
              </p>
            </Field>
          </Section>

          {/* Guardar */}
          <motion.button
            onClick={handleSave}
            disabled={isSaving}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold",
              "transition-all duration-200",
              saved
                ? "bg-green-500 text-white"
                : "bg-indigo-600 hover:bg-indigo-700 text-white",
              isSaving && "opacity-60"
            )}
          >
            {isSaving ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : saved ? (
              <><span>✓</span> Guardado</>
            ) : (
              <><Save size={16} /> Guardar configuración</>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden"
    >
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
        <span>{icon}</span>
        <span className="font-semibold text-slate-800 text-sm">{title}</span>
      </div>
      <div className="p-5 space-y-5">{children}</div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function NumberInput({
  value, min, max, step, onChange,
}: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      min={min} max={max} step={step}
      onChange={(e) => onChange(parseInt(e.target.value) || min)}
      className="input-field w-40 font-mono"
    />
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1.5",
      ok ? "bg-green-50 text-green-700 border border-green-200"
         : "bg-red-50 text-red-600 border border-red-200"
    )}>
      {ok ? "●" : "○"} {label}
    </span>
  );
}
