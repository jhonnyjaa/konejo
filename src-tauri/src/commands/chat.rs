use crate::db::{self, Conversation, Message};
use crate::rag::prompts;
use crate::state::AppState;
use serde::Serialize;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Serialize, Clone)]
pub struct TokenEvent {
    pub message_id: String,
    pub token:      String,
    pub done:       bool,
    pub doc_type:   Option<String>,
}

// ── Conversaciones ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_conversations(
    state: State<'_, AppState>,
    workspace_id: String,
) -> Result<Vec<Conversation>, String> {
    let db = state.db.lock().unwrap();
    db::get_conversations(&db, &workspace_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_conversation(
    state: State<'_, AppState>,
    workspace_id: String,
    title: Option<String>,
) -> Result<Conversation, String> {
    let conv = Conversation {
        id:           uuid::Uuid::new_v4().to_string(),
        workspace_id: workspace_id.clone(),
        title,
        created_at:   chrono::Utc::now().timestamp(),
    };
    let db = state.db.lock().unwrap();
    db::insert_conversation(&db, &conv).map_err(|e| e.to_string())?;
    Ok(conv)
}

#[tauri::command]
pub async fn get_messages(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<Vec<Message>, String> {
    let db = state.db.lock().unwrap();
    db::get_messages(&db, &conversation_id).map_err(|e| e.to_string())
}

// ── Inferencia con streaming ──────────────────────────────────────────────────

/// Envía un mensaje, ejecuta el pipeline RAG + LLM y emite tokens vía eventos Tauri.
/// Retorna el message_id del asistente (el streaming ocurre en background).
#[tauri::command]
pub async fn send_chat_message(
    app: AppHandle,
    state: State<'_, AppState>,
    workspace_id: String,
    conversation_id: String,
    content: String,
) -> Result<String, String> {
    // Verificar que el LLM está cargado
    {
        let llm = state.llm.lock().unwrap();
        if llm.is_none() {
            return Err("El modelo LLM no está cargado. Verifica la configuración.".into());
        }
    }

    // Guardar mensaje de usuario
    let user_msg = Message {
        id:              uuid::Uuid::new_v4().to_string(),
        conversation_id: conversation_id.clone(),
        workspace_id:    workspace_id.clone(),
        role:            "user".to_string(),
        content:         content.clone(),
        created_at:      chrono::Utc::now().timestamp(),
    };
    {
        let db = state.db.lock().unwrap();
        db::insert_message(&db, &user_msg).map_err(|e| e.to_string())?;
    }

    // Crear mensaje placeholder para el asistente
    let assistant_id = uuid::Uuid::new_v4().to_string();
    let asst_msg = Message {
        id:              assistant_id.clone(),
        conversation_id: conversation_id.clone(),
        workspace_id:    workspace_id.clone(),
        role:            "assistant".to_string(),
        content:         String::new(),
        created_at:      chrono::Utc::now().timestamp() + 1,
    };
    {
        let db = state.db.lock().unwrap();
        db::insert_message(&db, &asst_msg).map_err(|e| e.to_string())?;
    }

    // Clonar Arcs para el hilo bloqueante
    let db_arc         = state.db.clone();
    let llm_arc        = state.llm.clone();
    let emb_arc        = state.embeddings.clone();
    let is_inf         = state.is_inferring.clone();
    let mid            = assistant_id.clone();
    let app_clone      = app.clone();
    let wid            = workspace_id.clone();

    // Recuperar settings
    let (temperature, repeat_penalty, mut max_tokens, top_k) = {
        let db = state.db.lock().unwrap();
        let s = db::get_settings(&db).unwrap_or_default();
        (s.llm_temperature, s.llm_repeat_penalty, s.llm_max_tokens, s.rag_top_k)
    };

    // Detección de intención
    let intent    = prompts::detect_intent(&content);
    let rag_params = prompts::rag_params_for_intent(&intent);
    let effective_top_k    = rag_params.top_k;
    let effective_max_tokens = rag_params.max_tokens;
    let intent_doc_type: Option<String> = match &intent {
        prompts::IntentType::Document(t) => Some(t.clone()),
        prompts::IntentType::Chat        => None,
    };

    tokio::task::spawn_blocking(move || {
        is_inf.store(true, Ordering::Relaxed);

        let result = run_inference(
            &app_clone, &mid, &wid, &content, &conversation_id,
            &db_arc, &llm_arc, &emb_arc,
            temperature, repeat_penalty, effective_max_tokens,
            effective_top_k, &intent, &intent_doc_type,
        );

        is_inf.store(false, Ordering::Relaxed);

        if let Err(e) = result {
            tracing::error!("Error en inferencia: {e}");
            let _ = app_clone.emit("inference-error", e.to_string());
        }
    });

    Ok(assistant_id)
}

fn run_inference(
    app: &AppHandle,
    message_id: &str,
    workspace_id: &str,
    query: &str,
    conversation_id: &str,
    db:  &std::sync::Arc<std::sync::Mutex<rusqlite::Connection>>,
    llm: &std::sync::Arc<std::sync::Mutex<Option<crate::state::LlmInstance>>>,
    emb: &std::sync::Arc<std::sync::Mutex<Option<fastembed::TextEmbedding>>>,
    temperature: f32,
    repeat_penalty: f32,
    max_tokens: u32,
    top_k: usize,
    intent: &prompts::IntentType,
    doc_type: &Option<String>,
) -> Result<(), String> {
    // 1. RAG retrieval
    let chunks = {
        let query_vec = {
            let emb_guard = emb.lock().unwrap();
            match emb_guard.as_ref() {
                None => {
                    tracing::warn!("Embeddings no cargados, usando transcripción completa");
                    vec![]
                }
                Some(model) => {
                    crate::embeddings::embed_query(model, query)
                        .map(|v| v)
                        .unwrap_or_default()
                }
            }
        };

        if query_vec.is_empty() {
            // Fallback: usar los primeros top_k chunks sin scoring
            let db_g = db.lock().unwrap();
            crate::db::get_chunks_with_embeddings(&db_g, workspace_id)
                .unwrap_or_default()
                .into_iter()
                .take(top_k)
                .collect::<Vec<_>>()
        } else {
            let db_g = db.lock().unwrap();
            let all_chunks = crate::db::get_chunks_with_embeddings(&db_g, workspace_id)
                .unwrap_or_default();
            drop(db_g);

            let mut scored: Vec<(f32, crate::db::Chunk)> = all_chunks
                .into_iter()
                .filter_map(|chunk| {
                    chunk.embedding.as_ref().map(|emb_vec| {
                        let score = crate::embeddings::cosine_similarity(&query_vec, emb_vec);
                        (score, chunk)
                    })
                })
                .collect();

            scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
            scored.truncate(top_k);

            let mut result: Vec<crate::db::Chunk> = scored.into_iter().map(|(_, c)| c).collect();
            result.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap_or(std::cmp::Ordering::Equal));
            result
        }
    };

    let context = crate::rag::chunker::format_context(&chunks);

    // 2. Construir prompt según intención
    let prompt = match intent {
        prompts::IntentType::Document(dt) => {
            prompts::build_document_prompt(dt, &context)
        }
        prompts::IntentType::Chat => {
            prompts::build_chat_prompt(prompts::SYSTEM_BASE, &context, query)
        }
    };

    // 3. Inferencia con streaming de tokens
    let mut full_response = String::new();
    let app_ref = app.clone();
    let mid = message_id.to_string();
    let doc_type_clone = doc_type.clone();

    {
        let llm_guard = llm.lock().unwrap();
        let instance = llm_guard
            .as_ref()
            .ok_or_else(|| "LLM no cargado".to_string())?;

        crate::llm::generate_streaming(
            instance,
            &prompt,
            temperature,
            repeat_penalty,
            max_tokens,
            |token| {
                full_response.push_str(token);
                let _ = app_ref.emit("token-stream", TokenEvent {
                    message_id: mid.clone(),
                    token:      token.to_string(),
                    done:       false,
                    doc_type:   doc_type_clone.clone(),
                });
                true // continuar
            },
        ).map_err(|e| e.to_string())?;
    }

    // 4. Señal de fin
    let _ = app.emit("token-stream", TokenEvent {
        message_id: message_id.to_string(),
        token:      String::new(),
        done:       true,
        doc_type:   doc_type.clone(),
    });

    // 5. Persistir respuesta completa
    {
        let db_g = db.lock().unwrap();
        let _ = crate::db::update_message_content(&db_g, message_id, &full_response);
    }

    // 6. Si es documento, crearlo automáticamente
    if let Some(dt) = doc_type {
        let doc = crate::db::Document {
            id:           uuid::Uuid::new_v4().to_string(),
            workspace_id: workspace_id.to_string(),
            title:        doc_type_to_title(dt),
            content:      full_response.clone(),
            doc_type:     dt.clone(),
            created_at:   chrono::Utc::now().timestamp(),
        };
        let db_g = db.lock().unwrap();
        let _ = crate::db::insert_document(&db_g, &doc);
        let _ = app.emit("document-created", &doc);
    }

    Ok(())
}

fn doc_type_to_title(doc_type: &str) -> String {
    match doc_type {
        "resumen_ejecutivo"  => "Resumen Ejecutivo",
        "acta"               => "Acta de Reunión",
        "minuta"             => "Minuta Ejecutiva",
        "compromisos"        => "Compromisos y Tareas",
        "riesgos"            => "Riesgos Identificados",
        "acuerdos"           => "Acuerdos de la Reunión",
        "proximos_pasos"     => "Próximos Pasos",
        "correo_seguimiento" => "Correo de Seguimiento",
        "timeline"           => "Timeline de la Reunión",
        "tareas"             => "Action Items",
        _                    => "Documento",
    }.to_string()
}
