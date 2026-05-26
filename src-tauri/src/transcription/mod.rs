use crate::error::{AppError, AppResult};
use std::path::Path;
use std::sync::atomic::{AtomicI32, Ordering};
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct TranscriptSegment {
    pub text:       String,
    pub start_time: f64, // segundos
    pub end_time:   f64,
}

pub struct TranscriptResult {
    pub segments:         Vec<TranscriptSegment>,
    pub full_text:        String,
    pub duration_seconds: f64,
}

/// Carga el modelo de Whisper desde disco.
pub fn load_whisper(model_path: &Path) -> AppResult<whisper_rs::WhisperContext> {
    tracing::info!("Cargando Whisper desde {:?}", model_path);
    let mut params = whisper_rs::WhisperContextParameters::default();
    params.use_gpu(false); // OpenVINO se activa via feature flag de compilación

    let ctx = whisper_rs::WhisperContext::new_with_params(
        model_path.to_str().ok_or_else(|| AppError::Custom("Ruta inválida".into()))?,
        params,
    ).map_err(|e| AppError::Transcription(format!("No se pudo cargar Whisper: {e}")))?;

    tracing::info!("Whisper cargado correctamente");
    Ok(ctx)
}

/// Transcribe muestras de audio f32 @ 16kHz mono.
/// Emite progreso en `progress_counter` (0–100).
pub fn transcribe(
    ctx: &whisper_rs::WhisperContext,
    samples: &[f32],
    progress_counter: Arc<AtomicI32>,
) -> AppResult<TranscriptResult> {
    let mut state = ctx.create_state()
        .map_err(|e| AppError::Transcription(e.to_string()))?;

    let mut params = whisper_rs::FullParams::new(
        whisper_rs::SamplingStrategy::Greedy { best_of: 1 },
    );

    params.set_language(Some("es"));
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_token_timestamps(false); // más rápido
    params.set_no_context(true);

    // VAD para ignorar silencio (disponible en whisper-rs >= 0.12)
    // params.set_no_speech_thold(0.6);  // umbral de probabilidad de silencio

    // Callback de progreso
    let counter = progress_counter.clone();
    params.set_progress_callback_safe(move |p| {
        counter.store(p, Ordering::Relaxed);
    });

    progress_counter.store(0, Ordering::Relaxed);

    state
        .full(params, samples)
        .map_err(|e| AppError::Transcription(format!("Error en transcripción: {e}")))?;

    progress_counter.store(100, Ordering::Relaxed);

    let n_segments = state.full_n_segments()
        .map_err(|e| AppError::Transcription(e.to_string()))?;

    let mut segments = Vec::new();
    let mut full_text = String::new();

    for i in 0..n_segments {
        let text = state.full_get_segment_text(i)
            .map_err(|e| AppError::Transcription(e.to_string()))?;
        let t0 = state.full_get_segment_t0(i)
            .map_err(|e| AppError::Transcription(e.to_string()))?;
        let t1 = state.full_get_segment_t1(i)
            .map_err(|e| AppError::Transcription(e.to_string()))?;

        let text = text.trim().to_string();
        if text.is_empty() { continue; }

        full_text.push_str(&text);
        full_text.push(' ');

        segments.push(TranscriptSegment {
            text,
            start_time: t0 as f64 / 100.0, // whisper usa centisegundos
            end_time:   t1 as f64 / 100.0,
        });
    }

    let duration = segments.last().map(|s| s.end_time).unwrap_or(0.0);

    tracing::info!(
        "Transcripción completa: {} segmentos, {:.1}s, {} chars",
        segments.len(), duration, full_text.len()
    );

    Ok(TranscriptResult {
        segments,
        full_text: full_text.trim().to_string(),
        duration_seconds: duration,
    })
}
