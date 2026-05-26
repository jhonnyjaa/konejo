use crate::db::Chunk;
use crate::transcription::TranscriptSegment;

const WINDOW_SECS: f64  = 60.0;  // ventana de 60 segundos
const OVERLAP_SECS: f64 = 10.0;  // overlap de 10 segundos
const MAX_WORDS: usize  = 384;   // ≈ 512 tokens (words / 0.75)

/// Divide la transcripción en chunks temporales con overlap.
/// Criterio principal: ventanas de 60s con 10s de overlap.
/// Criterio secundario: límite de palabras (~512 tokens).
pub fn chunk_transcript(segments: &[TranscriptSegment], workspace_id: &str) -> Vec<Chunk> {
    if segments.is_empty() { return vec![]; }

    let total_duration = segments.last().unwrap().end_time;
    let mut chunks: Vec<Chunk> = Vec::new();
    let mut chunk_index = 0i32;
    let mut window_start = 0.0f64;

    while window_start < total_duration {
        let window_end = window_start + WINDOW_SECS;

        // Segmentos que se solapan con esta ventana
        let window_segs: Vec<&TranscriptSegment> = segments
            .iter()
            .filter(|s| s.start_time < window_end && s.end_time > window_start)
            .collect();

        if window_segs.is_empty() {
            window_start += WINDOW_SECS - OVERLAP_SECS;
            continue;
        }

        // Unir texto
        let raw_text = window_segs
            .iter()
            .map(|s| s.text.trim())
            .collect::<Vec<_>>()
            .join(" ");

        // Aplicar límite de palabras
        let words: Vec<&str> = raw_text.split_whitespace().collect();
        let text = if words.len() > MAX_WORDS {
            words[..MAX_WORDS].join(" ")
        } else {
            raw_text
        };

        let actual_start = window_segs.first().unwrap().start_time;
        let actual_end   = window_segs.last().unwrap().end_time.min(window_end);

        chunks.push(Chunk {
            id:           uuid::Uuid::new_v4().to_string(),
            workspace_id: workspace_id.to_string(),
            text,
            start_time:   actual_start,
            end_time:     actual_end,
            chunk_index,
            embedding:    None,
        });

        chunk_index += 1;
        window_start += WINDOW_SECS - OVERLAP_SECS;
    }

    tracing::info!(
        "Chunking completado: {} chunks para workspace {}",
        chunks.len(), workspace_id
    );
    chunks
}

/// Formatea chunks como contexto para el LLM con timestamps MM:SS.
pub fn format_context(chunks: &[Chunk]) -> String {
    chunks
        .iter()
        .map(|c| {
            let ts = format_ts(c.start_time);
            format!("[{ts}] {}", c.text.trim())
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

/// Convierte segundos a formato MM:SS.
pub fn format_ts(secs: f64) -> String {
    let total = secs as u64;
    format!("{:02}:{:02}", total / 60, total % 60)
}
