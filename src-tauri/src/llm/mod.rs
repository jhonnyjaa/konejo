use crate::error::{AppError, AppResult};
use crate::state::LlmInstance;
use std::num::NonZeroU32;
use std::path::Path;

use llama_cpp_2::{
    context::params::LlamaContextParams,
    llama_backend::LlamaBackend,
    llama_batch::LlamaBatch,
    model::{params::LlamaModelParams, AddBos, LlamaModel, Special},
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
/// Usa decodificación greedy (argmax de logits) para salida determinista.
pub fn generate_streaming<F>(
    instance: &LlmInstance,
    prompt: &str,
    _temperature: f32,    // reservado – greedy es determinista
    _repeat_penalty: f32, // reservado – implementación futura con LlamaSampler
    max_tokens: u32,
    mut on_token: F,
) -> AppResult<String>
where
    F: FnMut(&str) -> bool,
{
    // with_n_ctx espera Option<NonZeroU32> en llama-cpp-2 0.1.x
    let ctx_params = LlamaContextParams::default()
        .with_n_ctx(NonZeroU32::new(instance.n_ctx))
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
    let max_pos = (tokens.len() + max_tokens as usize) as i32;

    loop {
        if n_cur >= max_pos { break; }

        // Muestrear siguiente token: greedy argmax sobre logits
        // candidates_ith devuelve un iterador de LlamaTokenData con .id() y .logit()
        let new_token = ctx
            .candidates_ith(batch.n_tokens() - 1)
            .max_by(|a, b| {
                a.logit().partial_cmp(&b.logit()).unwrap_or(std::cmp::Ordering::Equal)
            })
            .map(|d| d.id())
            .ok_or_else(|| AppError::Inference("Sin candidatos de tokens".into()))?;

        // Fin de secuencia
        if new_token == instance.model.token_eos() {
            break;
        }

        // token_to_str está deprecado pero es la API más simple en 0.1.x.
        // token_to_piece requiere &mut encoding_rs::Decoder como tercer argumento.
        #[allow(deprecated)]
        let token_str = instance.model
            .token_to_str(new_token, Special::Tokenize)
            .unwrap_or_default();

        output.push_str(&token_str);

        // Callback al consumidor — si devuelve false, detener
        if !on_token(&token_str) { break; }

        // Siguiente batch con el token recién generado
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
