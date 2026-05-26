use crate::error::{AppError, AppResult};
use fastembed::{EmbeddingModel, InitOptions, TextEmbedding};
use std::path::PathBuf;

/// Inicializa el modelo de embeddings multilingual-e5-small.
/// FastEmbed lo descarga automáticamente en el primer uso.
pub fn load_embeddings(cache_dir: PathBuf) -> AppResult<TextEmbedding> {
    tracing::info!("Inicializando FastEmbed (multilingual-e5-small)…");

    let model = TextEmbedding::try_new(
        InitOptions::new(EmbeddingModel::MultilingualE5Small)
            .with_show_download_progress(true)
            .with_cache_dir(cache_dir),
    )
    .map_err(|e| AppError::Embedding(format!("Error al inicializar FastEmbed: {e}")))?;

    tracing::info!("FastEmbed listo");
    Ok(model)
}

/// Genera embeddings para indexación (prefijo "passage:").
/// fastembed 5.x requiere &mut TextEmbedding en embed().
pub fn embed_passages(model: &mut TextEmbedding, texts: &[String]) -> AppResult<Vec<Vec<f32>>> {
    let prefixed: Vec<String> = texts.iter()
        .map(|t| format!("passage: {t}"))
        .collect();

    model.embed(prefixed, None)
        .map_err(|e| AppError::Embedding(format!("Error generando embeddings passage: {e}")))
}

/// Genera embedding para query de búsqueda (prefijo "query:").
/// fastembed 5.x requiere &mut TextEmbedding en embed().
pub fn embed_query(model: &mut TextEmbedding, query: &str) -> AppResult<Vec<f32>> {
    let prefixed = vec![format!("query: {query}")];
    let mut results = model
        .embed(prefixed, None)
        .map_err(|e| AppError::Embedding(format!("Error generando embedding query: {e}")))?;

    results.pop().ok_or_else(|| AppError::Embedding("Vector vacío del modelo".into()))
}

/// Similitud coseno entre dos vectores.
#[inline]
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    debug_assert_eq!(a.len(), b.len(), "Dimensiones no coinciden");

    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if norm_a < 1e-8 || norm_b < 1e-8 { return 0.0; }
    (dot / (norm_a * norm_b)).clamp(-1.0, 1.0)
}
