import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, FolderOpen, ChevronRight, AlertTriangle } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { checkModelsExist, initializeModels, markOnboardingComplete, getModelsDir } from "@/lib/tauri";

type Step = "welcome" | "whisper" | "llm" | "done";

export function OnboardingPage() {
  const [step, setStep] = useState<Step>("welcome");
  const [modelsDir, setModelsDir] = useState("~/.konejo/models");
  const [modelStatus, setModelStatus] = useState({ whisper: false, llm: false });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setOnboardingComplete = useAppStore((s) => s.setOnboardingComplete);
  const setPage = useAppStore((s) => s.setPage);
  const setModelsLoaded = useAppStore((s) => s.setModelsLoaded);

  useEffect(() => {
    getModelsDir().then(setModelsDir).catch(() => {});
    checkModelsExist().then((r) => setModelStatus({ whisper: r.whisper, llm: r.llm })).catch(() => {});
  }, []);

  const handleComplete = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await initializeModels();
      setModelsLoaded({
        whisper: result.loaded.whisper ?? false,
        llm: result.loaded.llm ?? false,
        embeddings: result.loaded.embeddings ?? false,
      });
      await markOnboardingComplete();
      setOnboardingComplete(true);
      setStep("done");
      setTimeout(() => setPage("home"), 1500);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center overflow-hidden">
      {/* Fondo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-50 rounded-full blur-3xl opacity-60" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-violet-50 rounded-full blur-3xl opacity-60" />
      </div>

      <div className="relative w-full max-w-lg px-8">
        <AnimatePresence mode="wait">
          {step === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="text-7xl mb-6 select-none"
              >
                🐰
              </motion.div>
              <h1 className="text-4xl font-bold text-slate-900 mb-3">Bienvenido a Konejo</h1>
              <p className="text-slate-500 text-lg mb-2 leading-relaxed">
                Tu asistente de reuniones completamente local.
              </p>
              <p className="text-slate-400 text-sm mb-10 leading-relaxed max-w-sm mx-auto">
                Transcribe, indexa y consulta tus reuniones con IA.
                Todo ocurre en tu dispositivo — sin internet, sin nube, sin compromisos de privacidad.
              </p>

              <div className="flex flex-col gap-3 mb-8">
                {[
                  { icon: "🎙️", text: "Transcripción local con Whisper" },
                  { icon: "🧠", text: "Inferencia con Phi-4-mini en tu CPU/iGPU" },
                  { icon: "🔍", text: "Búsqueda semántica con embeddings multilingual" },
                  { icon: "🔒", text: "100% privado — sin telemetría ni conexión a internet" },
                ].map((f) => (
                  <div key={f.text} className="flex items-center gap-3 text-left bg-slate-50 rounded-xl px-4 py-3">
                    <span className="text-xl">{f.icon}</span>
                    <span className="text-slate-700 text-sm font-medium">{f.text}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setStep("whisper")}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold
                           py-3.5 rounded-2xl transition-colors flex items-center justify-center gap-2"
              >
                Comenzar configuración
                <ChevronRight size={18} />
              </button>
            </motion.div>
          )}

          {(step === "whisper" || step === "llm") && (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="text-center"
            >
              <div className="text-5xl mb-5">
                {step === "whisper" ? "🎙️" : "🧠"}
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {step === "whisper" ? "Modelo Whisper Small" : "Modelo Phi-4-mini"}
              </h2>
              <p className="text-slate-500 text-sm mb-6">
                {step === "whisper"
                  ? "Para transcripción de audio en español (244 MB)"
                  : "Para inferencia LLM local (≈2.4 GB)"}
              </p>

              {/* Instrucción de ruta */}
              <div className="bg-slate-900 rounded-xl p-4 mb-6 text-left">
                <p className="text-slate-400 text-xs mb-2 font-mono">Coloca el archivo en:</p>
                <p className="text-green-400 font-mono text-sm break-all">
                  {modelsDir}\{step === "whisper" ? "ggml-small.bin" : "phi-4-mini-instruct-q4_k_m.gguf"}
                </p>
                <p className="text-slate-500 text-xs mt-3">
                  {step === "whisper"
                    ? "Descarga desde: huggingface.co/ggerganov/whisper.cpp"
                    : "Descarga desde: huggingface.co/microsoft/Phi-4-mini-instruct-gguf"}
                </p>
              </div>

              {/* Estado actual */}
              <div className={`flex items-center gap-3 rounded-xl p-3 mb-6 ${
                (step === "whisper" ? modelStatus.whisper : modelStatus.llm)
                  ? "bg-green-50 border border-green-200"
                  : "bg-amber-50 border border-amber-200"
              }`}>
                {(step === "whisper" ? modelStatus.whisper : modelStatus.llm) ? (
                  <>
                    <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                    <span className="text-green-700 text-sm font-medium">Modelo encontrado ✓</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
                    <span className="text-amber-700 text-sm">
                      Modelo no encontrado — puedes continuar y agregarlo después
                    </span>
                  </>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(step === "whisper" ? "welcome" : "whisper")}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700
                             font-medium py-3 rounded-xl transition-colors"
                >
                  Atrás
                </button>
                <button
                  onClick={() => step === "whisper" ? setStep("llm") : handleComplete()}
                  disabled={isLoading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold
                             py-3 rounded-xl transition-colors flex items-center justify-center gap-2
                             disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : step === "whisper" ? (
                    <>Siguiente <ChevronRight size={16} /></>
                  ) : (
                    <>Empezar a usar Konejo <ChevronRight size={16} /></>
                  )}
                </button>
              </div>

              {error && (
                <p className="text-red-500 text-xs mt-3 text-center">{error}</p>
              )}
            </motion.div>
          )}

          {step === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                className="text-6xl mb-4"
              >
                🎉
              </motion.div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">¡Todo listo!</h2>
              <p className="text-slate-500">Iniciando Konejo…</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Indicador de paso */}
        {step !== "done" && (
          <div className="flex justify-center gap-2 mt-8">
            {(["welcome", "whisper", "llm"] as Step[]).map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step ? "w-6 bg-indigo-500" : "w-2 bg-slate-200"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
