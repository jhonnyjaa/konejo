import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Square, Pause, Play, Mic } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { stopRecording } from "@/lib/tauri";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { getWorkspaces } from "@/lib/tauri";

function pad(n: number) { return String(n).padStart(2, "0"); }

export function RecordingModal() {
  const recordingState    = useAppStore((s) => s.recordingState);
  const setRecordingState = useAppStore((s) => s.setRecordingState);
  const setWorkspaces     = useWorkspaceStore((s) => s.setWorkspaces);

  const [elapsed, setElapsed]   = useState(0);
  const [stopping, setStopping] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isOpen = recordingState === "recording" || recordingState === "paused";

  useEffect(() => {
    if (!isOpen) { setElapsed(0); return; }
    if (recordingState === "recording") {
      intervalRef.current = setInterval(() => setElapsed((n) => n + 1), 1000);
    } else if (recordingState === "paused") {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [recordingState, isOpen]);

  const handleStop = useCallback(async () => {
    if (stopping) return;
    setStopping(true);
    try {
      if (intervalRef.current) clearInterval(intervalRef.current);
      await stopRecording();
      const ws = await getWorkspaces();
      setWorkspaces(ws);
      setRecordingState("idle");
    } catch (err) {
      console.error(err);
      setStopping(false);
    }
  }, [stopping]);

  const togglePause = () =>
    setRecordingState(recordingState === "recording" ? "paused" : "recording");

  const bars = Array.from({ length: 24 }, (_, i) => i);
  const mm = Math.floor(elapsed / 60);
  const ss = elapsed % 60;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="recording-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{    opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[60] flex items-center justify-center
                     bg-slate-900/75 backdrop-blur-sm pointer-events-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{    opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-3xl max-w-sm w-full mx-6 p-10
                       flex flex-col items-center shadow-float"
          >
            {/* REC badge */}
            <div className="flex items-center gap-2 mb-5">
              <motion.div
                className="w-2.5 h-2.5 rounded-full bg-red-500"
                animate={recordingState === "recording"
                  ? { opacity: [1, 0.2, 1] }
                  : { opacity: 0.3 }}
                transition={{ duration: 1.1, repeat: Infinity }}
              />
              <span className="text-[11px] font-semibold text-red-500 tracking-widest uppercase">
                {recordingState === "paused" ? "Paused" : "Rec"}
              </span>
            </div>

            <h2 className="text-lg font-semibold text-slate-900 mb-7">Grabando reunión</h2>

            {/* Waveform */}
            <div className="flex items-center justify-center gap-0.5 h-12 mb-7">
              {bars.map((i) => (
                <motion.div
                  key={i}
                  className={`w-[3px] rounded-full origin-center ${
                    recordingState === "paused" ? "bg-slate-200" : "bg-red-400"
                  }`}
                  style={{ height: "100%" }}
                  animate={recordingState === "recording"
                    ? { scaleY: [0.15, 0.5 + Math.abs(Math.sin(i * 0.8)) * 0.5, 0.15] }
                    : { scaleY: 0.12 }}
                  transition={{
                    duration: 0.75 + i * 0.03,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.035,
                  }}
                />
              ))}
            </div>

            {/* Timer */}
            <div className="text-4xl font-mono font-semibold text-slate-800 mb-8 tabular-nums">
              {pad(mm)}:{pad(ss)}
            </div>

            {/* Controls */}
            <div className="flex gap-3 w-full">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={togglePause}
                className="flex-1 flex items-center justify-center gap-2
                           bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium
                           rounded-2xl py-3.5 text-sm transition-colors"
              >
                {recordingState === "paused"
                  ? <><Play size={15} /> Reanudar</>
                  : <><Pause size={15} /> Pausar</>}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleStop}
                disabled={stopping}
                className="flex-1 flex items-center justify-center gap-2
                           bg-red-500 hover:bg-red-600 disabled:opacity-60
                           text-white font-semibold rounded-2xl py-3.5 text-sm transition-colors"
              >
                {stopping
                  ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Square size={14} fill="white" />}
                {stopping ? "Finalizando…" : "Detener"}
              </motion.button>
            </div>

            <p className="text-[11px] text-slate-300 mt-4">Procesado localmente · Sin envío a la nube</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
