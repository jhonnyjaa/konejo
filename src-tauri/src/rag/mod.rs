pub mod chunker;
pub mod prompts;

use crate::db::{Chunk, Document};
use crate::embeddings::cosine_similarity;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

/// Recupera los chunks más relevantes para un query.
pub fn retrieve(
    state: &AppState,
    workspace_id: &str,
    query: &str,
    top_k: usize,
) -> AppResult<Vec<Chunk>> {
    // 1. Generar embedding del query
    let emb_guard = state.embeddings.lock().unwrap();
    let emb_model = emb_guard
        .as_ref()
        .ok_or_else(|| AppError::ModelNotLoaded("Embeddings no cargados".into()))?;

    let query_vec = crate::embeddings::embed_query(emb_model, query)?;
    drop(emb_guard);

    // 2. Cargar todos los chunks del workspace con sus embeddings
    let db = state.db.lock().unwrap();
    let all_chunks = crate::db::get_chunks_with_embeddings(&db, workspace_id)
        .map_err(AppError::Database)?;
    drop(db);

    // 3. Calcular similitud coseno con cada chunk
    let mut scored: Vec<(f32, Chunk)> = all_chunks
        .into_iter()
        .filter_map(|chunk| {
            chunk.embedding.as_ref().map(|emb| {
                let score = cosine_similarity(&query_vec, emb);
                (score, chunk)
            })
        })
        .collect();

    // 4. Ordenar por score descendente
    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(top_k);

    // 5. Reordenar por timestamp ascendente (coherencia narrativa)
    let mut result: Vec<Chunk> = scored.into_iter().map(|(_, c)| c).collect();
    result.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap_or(std::cmp::Ordering::Equal));

    tracing::info!(
        "RAG: {} chunks recuperados para workspace {} (top_k={})",
        result.len(), workspace_id, top_k
    );
    Ok(result)
}

/// Pipeline completo de indexación de un workspace:
/// Chunking → Embeddings → Persistencia en SQLite.
pub fn index_workspace(
    state: &AppState,
    workspace_id: &str,
    segments: &[crate::transcription::TranscriptSegment],
    on_progress: impl Fn(f32) + Send,
) -> AppResult<()> {
    // 1. Chunking temporal
    let mut chunks = chunker::chunk_transcript(segments, workspace_id);
    if chunks.is_empty() {
        tracing::warn!("No se generaron chunks para {workspace_id}");
        return Ok(());
    }

    on_progress(0.1);

    // 2. Generar embeddings en batch
    let texts: Vec<String> = chunks.iter().map(|c| c.text.clone()).collect();
    let emb_guard = state.embeddings.lock().unwrap();
    let emb_model = emb_guard
        .as_ref()
        .ok_or_else(|| AppError::ModelNotLoaded("Embeddings no cargados".into()))?;

    let embeddings = crate::embeddings::embed_passages(emb_model, &texts)?;
    drop(emb_guard);

    on_progress(0.7);

    // 3. Asignar embeddings a chunks
    for (chunk, emb) in chunks.iter_mut().zip(embeddings.into_iter()) {
        chunk.embedding = Some(emb);
    }

    // 4. Persistir en SQLite
    let db = state.db.lock().unwrap();
    for chunk in &chunks {
        crate::db::insert_chunk(&db, chunk).map_err(AppError::Database)?;
    }
    drop(db);

    on_progress(1.0);
    tracing::info!("Indexación completada: {} chunks", chunks.len());
    Ok(())
}

/// Convierte documento a tipo de documento Konejo y lo persiste.
pub fn save_generated_document(
    state: &AppState,
    workspace_id: &str,
    doc_type: &str,
    content: &str,
) -> AppResult<Document> {
    let title = match doc_type {
        "resumen_ejecutivo"   => "Resumen Ejecutivo",
        "acta"                => "Acta de Reunión",
        "minuta"              => "Minuta Ejecutiva",
        "compromisos"         => "Compromisos y Tareas",
        "riesgos"             => "Riesgos Identificados",
        "acuerdos"            => "Acuerdos de la Reunión",
        "proximos_pasos"      => "Próximos Pasos",
        "correo_seguimiento"  => "Correo de Seguimiento",
        "timeline"            => "Timeline de la Reunión",
        "tareas"              => "Action Items",
        _                     => "Documento",
    };

    let doc = Document {
        id:           uuid::Uuid::new_v4().to_string(),
        workspace_id: workspace_id.to_string(),
        title:        title.to_string(),
        content:      content.to_string(),
        doc_type:     doc_type.to_string(),
        created_at:   chrono::Utc::now().timestamp(),
    };

    let db = state.db.lock().unwrap();
    crate::db::insert_document(&db, &doc).map_err(AppError::Database)?;
    Ok(doc)
}
