import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, CheckCircle, ArrowRight } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { markOnboardingComplete, MOCK_MODE } from "@/lib/tauri";
import { cn } from "@/lib/utils";

// ── Steps ─────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    emoji: "🐰",
    title: "Welcome to Konejo",
    subtitle: "Your local-first AI meeting assistant. Everything runs on your device — no cloud, no data leaks.",
    features: [
      { emoji: "🔒", text: "100% local — no data leaves your device" },
      { emoji: "🎙️", text: "Automatic transcription with Whisper" },
      { emoji: "🧠", text: "AI that understands your meetings" },
      { emoji: "📄", text: "Generates editable documents instantly" },
    ],
  },
  {
    emoji: "🎙️",
    title: "Transcription Engine",
    subtitle: "Konejo uses Whisper to transcribe meetings with high accuracy — offline, no API key required.",
    model: {
      name: "Whisper ggml-small",
      size: "~244 MB",
      description: "High accuracy transcription in Spanish and English",
      hint: "Download from Hugging Face and set the path in Settings → General.",
      url: "https://huggingface.co/ggerganov/whisper.cpp",
    },
  },
  {
    emoji: "🧠",
    title: "Language Model",
    subtitle: "A local LLM analyses your meeting and generates intelligent, editable documents.",
    model: {
      name: "Phi-4 Mini Instruct Q4_K_M",
      size: "~2.5 GB",
      description: "Fast, high-quality reasoning for meeting analysis",
      hint: "Download from Hugging Face and set the path in Settings → General.",
      url: "https://huggingface.co/microsoft/Phi-4-mini-instruct-gguf",
    },
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function OnboardingPage() {
  const setPage               = useAppStore((s) => s.setPage);
  const setOnboardingComplete = useAppStore((s) => s.setOnboardingComplete);

  const [step,    setStep]    = useState(0);
  const [loading, setLoading] = useState(false);

  const isLast = step === STEPS.length - 1;

  // Complete onboarding — do NOT call initializeModels() here.
  // Models are lazy-loaded when the user actually uses transcription / chat.
  const handleComplete = async () => {
    setLoading(true);
    try {
      await markOnboardingComplete();
    } catch (err) {
      console.error("markOnboardingComplete error:", err);
      // Don't block navigation — DB might not be ready in dev, or mock mode
    }
    // Always navigate, even if the Tauri call fails
    setOnboardingComplete(true);
    setPage("home");
    setLoading(false);
  };

  const handleNext = () => {
    if (isLast) { handleComplete(); return; }
    setStep((s) => s + 1);
  };

  const s = STEPS[step];

  return (
    <div className="h-screen flex items-center justify-center bg-white px-6">
      <div className="w-full max-w-md">

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-12">
          {STEPS.map((_, i) => (
            <motion.div
              key={i}
              animate={{ width: i === step ? 28 : 8, opacity: i <= step ? 1 : 0.25 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="h-2 rounded-full bg-violet-500"
            />
          ))}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="text-center mb-8">
              <div className="text-5xl mb-5">{s.emoji}</div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">{s.title}</h1>
              <p className="text-slate-500 text-[14px] leading-relaxed max-w-sm mx-auto">{s.subtitle}</p>
            </div>

            {/* Step 0 — features */}
            {step === 0 && s.features && (
              <div className="space-y-2.5">
                {s.features.map((f) => (
                  <motion.div
                    key={f.text}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + s.features!.indexOf(f) * 0.07 }}
                    className="flex items-center gap-3 bg-slate-50 rounded-2xl px-4 py-3.5 border border-slate-100"
                  >
                    <span className="text-xl flex-shrink-0">{f.emoji}</span>
                    <span className="text-[13px] text-slate-700 font-medium">{f.text}</span>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Steps 1 & 2 — model info */}
            {s.model && (
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0 text-lg">
                    {step === 1 ? "🎙️" : "🧠"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{s.model.name}</p>
                    <p className="text-xs text-violet-600 font-medium mt-0.5">{s.model.size}</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{s.model.description}</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">{s.model.hint}</p>
                  <a
                    href={s.model.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-violet-600 font-medium
                               hover:text-violet-700 transition-colors"
                  >
                    Ver en Hugging Face <ArrowRight size={11} />
                  </a>
                </div>
              </div>
            )}

            {/* Skip note on model steps */}
            {step > 0 && (
              <p className="text-xs text-slate-400 text-center mt-4 leading-relaxed">
                Puedes continuar sin los modelos y configurarlos después en{" "}
                <span className="text-violet-500 font-medium">Settings</span>
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-10">
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors font-medium"
            >
              ← Back
            </button>
          ) : (
            <div />
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleNext}
            disabled={loading}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-2xl text-[13px] font-semibold",
              "transition-all shadow-soft",
              loading
                ? "bg-violet-400 text-white cursor-not-allowed"
                : "bg-violet-600 text-white hover:bg-violet-700"
            )}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : isLast ? (
              <><CheckCircle size={15} /> Get started</>
            ) : (
              <>Continue <ChevronRight size={15} /></>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
