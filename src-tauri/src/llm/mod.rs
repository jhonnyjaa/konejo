use crate::error::{AppError, AppResult};
use crate::state::LlmInstance;
use std::num::NonZeroU32;
use std::path::Path;

use llama_cpp_2::{
    context::params::LlamaContextParams,
    llama_backend::LlamaBackend,
    llama_batch::LlamaBatch,
    model::{params::LlamaModelParams, AddBos, LlamaModel, Special},
    token::data_array::LlamaTokenDataArray,
};

/// Carga el modelo GGUF desde disco y devuelve un LlmInstance.
pub fn load_model(
    model_path: &Path,
    n_ctx: u32,
) -> AppResult<LlmInstance> {
    tracing::info!("Cargando LLM desde {:?}", model_path);

    let backend = LlamaBackend::init()
        .map_err(|e| AppError::Inference(format!("Backend error: {e}")))?;

    let model_params = LlamaModelParams::default();
    let model = LlamaModel::load_from_file(&backend, model_path, &model_params)
        .map_err(|e| AppError::Inference(format!("No se pudo cargar el modelo: {e}")))?;

    let n_threads = num_threads();
    tracing::info!("LLM cargado. Hilos: {n_threads}, n_ctx: {n_ctx}");

    Ok(LlmInstance { backend, model, n_ctx, n_threads })
}

/// Calcula el número de hilos óptimo para inferencia.
pub fn num_threads() -> i32 {
    let total = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);
    // Usa la mitad de los cores disponibles, mínimo 2
    ((total / 2) as i32).max(2)
}

/// Genera texto con streaming de tokens vía callback.
/// `on_token` recibe cada token string y devuelve `false` para detener.
pub fn generate_streaming<F>(
    instance: &LlmInstance,
    prompt: &str,
    temperature: f32,
    repeat_penalty: f32,
    max_tokens: u32,
    mut on_token: F,
) -> AppResult<String>
where
    F: FnMut(&str) -> bool,
{
    let ctx_params = LlamaContextParams::default()
        .with_n_ctx(NonZeroU32::new(instance.n_ctx).unwrap())
        .with_n_threads(instance.n_threads)
        .with_n_threads_batch(instance.n_threads);

    let mut ctx = instance.model
        .new_context(&instance.backend, ctx_params)
        .map_err(|e| AppError::Inference(format!("Error al crear contexto: {e}")))?;

    // Tokenizar el prompt
    let tokens = instance.model
        .str_to_token(prompt, AddBos::Always)
        .map_err(|e| AppError::Inference(format!("Error tokenizando: {e}")))?;

    if tokens.is_empty() {
        return Err(AppError::Inference("Prompt vacío tras tokenización".into()));
    }

    // Verificar que cabe en el contexto
    let n_ctx = instance.n_ctx as usize;
    if tokens.len() + max_tokens as usize > n_ctx {
        tracing::warn!(
            "Prompt ({} tokens) + max_tokens ({}) excede n_ctx ({})",
            tokens.len(), max_tokens, n_ctx
        );
    }

    // Crear batch inicial con todo el prompt
    let mut batch = LlamaBatch::new(tokens.len().max(1), 1);
    let last_idx = tokens.len() - 1;
    for (i, &token) in tokens.iter().enumerate() {
        batch
            .add(token, i as i32, &[0], i == last_idx)
            .map_err(|e| AppError::Inference(e.to_string()))?;
    }

    ctx.decode(&mut batch)
        .map_err(|e| AppError::Inference(format!("Error en decode inicial: {e}")))?;

    let mut n_cur = tokens.len() as i32;
    let mut output = String::new();
    let mut last_tokens: Vec<llama_cpp_2::token::LlamaToken> = tokens.clone();

    loop {
        if n_cur >= (tokens.len() + max_tokens as usize) as i32 { break; }

        // Muestrear siguiente token
        let candidates = ctx
            .candidates_ith(batch.n_tokens() - 1)
            .collect::<Vec<_>>();
        let mut candidates_p = LlamaTokenDataArray::from_iter(candidates, false);

        // Penalización por repetición
        ctx.sample_repetition_penalties(
            &mut candidates_p,
            &last_tokens,
            64,            // ventana de contexto para penalización
            repeat_penalty,
            0.0, // alpha_frequency
            0.0, // alpha_presence
        );

        // Temperatura
        ctx.sample_temp(&mut candidates_p, temperature);

        // Muestreo top-p + top-k
        ctx.sample_top_k(&mut candidates_p, 40, 1);
        ctx.sample_top_p(&mut candidates_p, 0.95, 1);

        let new_token = ctx.sample_token_greedy(&mut candidates_p);

        // Fin de secuencia
        if new_token == instance.model.token_eos() {
            break;
        }

        // Convertir a string
        let token_str = instance.model
            .token_to_str(new_token, Special::Tokenize)
            .unwrap_or_default();

        output.push_str(&token_str);
        last_tokens.push(new_token);

        // Callback al consumidor — si devuelve false, detener
        if !on_token(&token_str) { break; }

        // Siguiente batch
        batch.clear();
        batch
            .add(new_token, n_cur, &[0], true)
            .map_err(|e| AppError::Inference(e.to_string()))?;

        ctx.decode(&mut batch)
            .map_err(|e| AppError::Inference(format!("Error decode token: {e}")))?;

        n_cur += 1;
    }

    Ok(output)
}
