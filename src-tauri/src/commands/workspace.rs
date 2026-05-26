use crate::db::{self, Workspace, WorkspaceStatus};
use crate::error::AppError;
use crate::state::AppState;
use serde::Serialize;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Serialize, Clone)]
pub struct ProcessingEvent {
    pub stage:    String,
    pub progress: f32,
    pub message:  String,
}

// ── Comandos ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_workspaces(state: State<'_, AppState>) -> Result<Vec<Workspace>, String> {
    let db = state.db.lock().unwrap();
    db::get_workspaces(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_workspace(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<Workspace>, String> {
    let db = state.db.lock().unwrap();
    db::get_workspace(&db, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_workspace(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let db = state.db.lock().unwrap();
    db::delete_workspace(&db, &id).map_err(|e| e.to_string())
}

/// Importa un archivo de audio/video, inicia el pipeline de procesamiento.
/// Retorna el workspace_id inmediatamente; el frontend escucha eventos de progreso.
#[tauri::command]
pub async fn import_file(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<String, String> {
    let workspace_id = uuid::Uuid::new_v4().to_string();
    let file_path    = std::path::Path::new(&path);
    let name         = file_path
        .file_stem()
        .and_then(|n| n.to_str())
        .unwrap_or("Reunión")
        .to_string();

    // Crear workspace en DB con estado 'processing'
    let ws = Workspace {
        id:                workspace_id.clone(),
        name:              name.clone(),
        created_at:        chrono::Utc::now().timestamp(),
        audio_path:        Some(path.clone()),
        transcript:        None,
        duration_seconds:  None,
        status:            WorkspaceStatus::Processing,
        participant_count: None,
    };
    {
        let db = state.db.lock().unwrap();
        db::insert_workspace(&db, &ws).map_err(|e| e.to_string())?;
    }

    // Lanzar pipeline en hilo dedicado
    let state_db         = state.db.clone();
    let state_whisper    = state.whisper.clone();
    let state_embeddings = state.embeddings.clone();
    let state_progress   = state.transcription_progress.clone();
    let data_dir         = state.data_dir.clone();
    let wid              = workspace_id.clone();
    let app_clone        = app.clone();

    tokio::task::spawn_blocking(move || {
        run_processing_pipeline(
            &app_clone, wid, path, name,
            state_db, state_whisper, state_embeddings,
            state_progress, data_dir,
        );
    });

    Ok(workspace_id)
}

// ── Pipeline de procesamiento ─────────────────────────────────────────────────

fn emit(app: &AppHandle, stage: &str, progress: f32, message: &str) {
    let _ = app.emit("processing-progress", ProcessingEvent {
        stage:    stage.to_string(),
        progress,
        message:  message.to_string(),
    });
}

pub fn run_processing_pipeline(
    app: &AppHandle,
    workspace_id: String,
    input_path: String,
    _name: String,
    db:         std::sync::Arc<std::sync::Mutex<rusqlite::Connection>>,
    whisper:    std::sync::Arc<std::sync::Mutex<Option<whisper_rs::WhisperContext>>>,
    embeddings: std::sync::Arc<std::sync::Mutex<Option<fastembed::TextEmbedding>>>,
    trans_progress: std::sync::Arc<std::sync::atomic::AtomicI32>,
    data_dir: std::path::PathBuf,
) {
    let rt = tokio::runtime::Handle::current();

    emit(app, "prepare", 0.05, "Preparando archivo…");

    // 1. Convertir a WAV si es necesario
    let wav_path = data_dir.join(format!("{workspace_id}.wav"));
    let extension = std::path::Path::new(&input_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let (samples, duration) = match extension.as_str() {
        "wav" => {
            emit(app, "audio", 0.1, "Cargando audio WAV…");
            match crate::audio::load_wav_as_f32(std::path::Path::new(&input_path)) {
                Ok(v) => v,
                Err(e) => {
                    tracing::error!("Error cargando WAV: {e}");
                    update_error(&db, &workspace_id);
                    let _ = app.emit("processing-error", e.to_string());
                    return;
                }
            }
        }
        "mp4" | "mkv" | "mov" | "avi" | "webm" | "m4a" | "mp3" | "ogg" => {
            emit(app, "audio", 0.1, "Convirtiendo audio con ffmpeg…");
            if let Err(e) = rt.block_on(crate::audio::convert_with_ffmpeg(
                app, &input_path, wav_path.to_str().unwrap()
            )) {
                tracing::error!("Error ffmpeg: {e}");
                update_error(&db, &workspace_id);
                let _ = app.emit("processing-error", e.to_string());
                return;
            }
            match crate::audio::load_wav_as_f32(&wav_path) {
                Ok(v) => v,
                Err(e) => {
                    update_error(&db, &workspace_id);
                    let _ = app.emit("processing-error", e.to_string());
                    return;
                }
            }
        }
        _ => {
            let err = format!("Formato no soportado: .{extension}");
            update_error(&db, &workspace_id);
            let _ = app.emit("processing-error", err);
            return;
        }
    };

    // 2. Transcripción con Whisper
    emit(app, "transcription", 0.2, "Transcribiendo con Whisper…");

    // Hilo de progreso de transcripción
    let progress_clone = trans_progress.clone();
    let app_for_progress = app.clone();
    let progress_handle = std::thread::spawn(move || {
        loop {
            let p = progress_clone.load(Ordering::Relaxed);
            let _ = app_for_progress.emit("transcription-progress", p);
            if p >= 100 { break; }
            std::thread::sleep(std::time::Duration::from_millis(200));
        }
    });

    let transcript = {
        let guard = whisper.lock().unwrap();
        match guard.as_ref() {
            None => {
                drop(guard);
                tracing::error!("Whisper no cargado");
                update_error(&db, &workspace_id);
                let _ = app.emit("processing-error", "Modelo Whisper no cargado");
                return;
            }
            Some(ctx) => match crate::transcription::transcribe(ctx, &samples, trans_progress.clone()) {
                Ok(r) => r,
                Err(e) => {
                    tracing::error!("Error transcripción: {e}");
                    update_error(&db, &workspace_id);
                    let _ = app.emit("processing-error", e.to_string());
                    return;
                }
            }
        }
    };

    let _ = progress_handle.join();

    // Persistir transcripción
    {
        let db = db.lock().unwrap();
        let _ = crate::db::update_workspace_transcript(&db, &workspace_id, &transcript.full_text, duration);
    }

    emit(app, "embeddings", 0.7, "Generando embeddings semánticos…");

    // 3. Indexación RAG (chunking + embeddings)
    let app_emb = app.clone();
    {
        // Chunking
        let chunks = crate::rag::chunker::chunk_transcript(&transcript.segments, &workspace_id);
        if chunks.is_empty() {
            tracing::warn!("Sin chunks para indexar");
        } else {
            let texts: Vec<String> = chunks.iter().map(|c| c.text.clone()).collect();

            // Embeddings
            let emb_guard = embeddings.lock().unwrap();
            match emb_guard.as_ref() {
                None => {
                    drop(emb_guard);
                    tracing::warn!("Modelo de embeddings no cargado, saltando indexación");
                }
                Some(emb_model) => {
                    match crate::embeddings::embed_passages(emb_model, &texts) {
                        Err(e) => tracing::error!("Error embeddings: {e}"),
                        Ok(embeddings_vec) => {
                            drop(emb_guard);
                            emit(&app_emb, "indexing", 0.85, "Indexando en base de datos…");
                            let db_g = db.lock().unwrap();
                            for (mut chunk, emb) in chunks.into_iter().zip(embeddings_vec.into_iter()) {
                                chunk.embedding = Some(emb);
                                let _ = crate::db::insert_chunk(&db_g, &chunk);
                            }
                        }
                    }
                }
            }
        }
    }

    // 4. Marcar workspace como ready
    {
        let db_g = db.lock().unwrap();
        let _ = crate::db::update_workspace_status(&db_g, &workspace_id, WorkspaceStatus::Ready);
    }

    emit(app, "done", 1.0, "¡Listo! Tu reunión está lista para explorar.");
    let _ = app.emit("processing-complete", &workspace_id);
}

fn update_error(db: &std::sync::Arc<std::sync::Mutex<rusqlite::Connection>>, id: &str) {
    let db = db.lock().unwrap();
    let _ = crate::db::update_workspace_status(&db, id, WorkspaceStatus::Error);
}

// ── Documentos ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_documents(
    state: State<'_, AppState>,
    workspace_id: String,
) -> Result<Vec<db::Document>, String> {
    let db = state.db.lock().unwrap();
    db::get_documents(&db, &workspace_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_document(
    state: State<'_, AppState>,
    id: String,
    title: String,
    content: String,
) -> Result<(), String> {
    let db = state.db.lock().unwrap();
    db::update_document(&db, &id, &title, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_document(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let db = state.db.lock().unwrap();
    db::delete_document(&db, &id).map_err(|e| e.to_string())
}

/// Exporta un documento a Word (.docx) o PDF.
#[tauri::command]
pub async fn export_document(
    state: State<'_, AppState>,
    document_id: String,
    format: String,  // "docx" | "pdf"
    output_path: String,
) -> Result<(), String> {
    let doc = {
        let db = state.db.lock().unwrap();
        // Buscar en todos los workspaces (simple scan)
        let mut stmt = db.prepare(
            "SELECT id, workspace_id, title, content, doc_type, created_at FROM documents WHERE id = ?1"
        ).map_err(|e| e.to_string())?;
        stmt.query_row(rusqlite::params![document_id], |r| {
            Ok(db::Document {
                id: r.get(0)?, workspace_id: r.get(1)?,
                title: r.get(2)?, content: r.get(3)?,
                doc_type: r.get(4)?, created_at: r.get(5)?,
            })
        }).map_err(|e| e.to_string())?
    };

    match format.as_str() {
        "docx" => export_docx(&doc, &output_path).map_err(|e| e.to_string()),
        "pdf"  => export_pdf(&doc, &output_path).map_err(|e| e.to_string()),
        _      => Err(format!("Formato no soportado: {format}")),
    }
}

fn export_docx(doc: &db::Document, path: &str) -> Result<(), AppError> {
    use docx_rs::*;

    let mut docx = Docx::new();

    // Título
    let title_para = Paragraph::new()
        .add_run(Run::new().add_text(&doc.title).bold())
        .style("Heading1");
    docx = docx.add_paragraph(title_para);

    // Contenido (línea a línea)
    for line in doc.content.lines() {
        let para = if line.starts_with("## ") {
            Paragraph::new()
                .add_run(Run::new().add_text(line.trim_start_matches("## ")).bold())
                .style("Heading2")
        } else if line.starts_with("### ") {
            Paragraph::new()
                .add_run(Run::new().add_text(line.trim_start_matches("### ")).bold())
                .style("Heading3")
        } else if line.starts_with("- ") {
            Paragraph::new()
                .add_run(Run::new().add_text(line.trim_start_matches("- ")))
                .style("ListBullet")
        } else {
            Paragraph::new().add_run(Run::new().add_text(line))
        };
        docx = docx.add_paragraph(para);
    }

    let file = std::fs::File::create(path)?;
    docx.build().pack(file).map_err(|e| AppError::Export(e.to_string()))?;
    Ok(())
}

fn export_pdf(doc: &db::Document, path: &str) -> Result<(), AppError> {
    use printpdf::*;

    let (doc_pdf, page1, layer1) = PdfDocument::new(&doc.title, Mm(210.0), Mm(297.0), "Layer 1");
    let current_layer = doc_pdf.get_page(page1).get_layer(layer1);
    let font = doc_pdf.add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| AppError::Export(e.to_string()))?;

    let mut y = 270.0f64;
    let line_height = 5.5;
    let margin_left = 15.0;

    for line in doc.content.lines() {
        if y < 20.0 { break; } // TODO: paginación
        current_layer.use_text(line, 10.0, Mm(margin_left), Mm(y), &font);
        y -= line_height;
    }

    let bytes = doc_pdf.save_to_bytes().map_err(|e| AppError::Export(e.to_string()))?;
    std::fs::write(path, bytes)?;
    Ok(())
}

// ── Models ────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn check_models_exist(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let db = state.db.lock().unwrap();
    let settings = db::get_settings(&db).map_err(|e| e.to_string())?;
    drop(db);

    let whisper_exists = std::path::Path::new(&settings.whisper_model_path).exists();
    let llm_exists     = std::path::Path::new(&settings.llm_model_path).exists();

    Ok(serde_json::json!({
        "whisper": whisper_exists,
        "llm":     llm_exists,
        "whisper_path": settings.whisper_model_path,
        "llm_path": settings.llm_model_path,
    }))
}

#[tauri::command]
pub async fn initialize_models(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let db = state.db.lock().unwrap();
    let settings = db::get_settings(&db).map_err(|e| e.to_string())?;
    drop(db);

    let mut errors: Vec<String> = Vec::new();
    let mut loaded = serde_json::json!({ "whisper": false, "llm": false, "embeddings": false });

    // Whisper
    let whisper_path = std::path::Path::new(&settings.whisper_model_path);
    if whisper_path.exists() {
        match crate::transcription::load_whisper(whisper_path) {
            Ok(ctx) => {
                *state.whisper.lock().unwrap() = Some(ctx);
                loaded["whisper"] = serde_json::json!(true);
            }
            Err(e) => errors.push(format!("Whisper: {e}")),
        }
    } else {
        errors.push(format!("Whisper no encontrado en {}", settings.whisper_model_path));
    }

    // LLM
    let llm_path = std::path::Path::new(&settings.llm_model_path);
    if llm_path.exists() {
        match crate::llm::load_model(llm_path, settings.llm_n_ctx) {
            Ok(instance) => {
                *state.llm.lock().unwrap() = Some(instance);
                loaded["llm"] = serde_json::json!(true);
            }
            Err(e) => errors.push(format!("LLM: {e}")),
        }
    } else {
        errors.push(format!("LLM no encontrado en {}", settings.llm_model_path));
    }

    // Embeddings
    let cache_dir = state.models_dir.join("fastembed_cache");
    std::fs::create_dir_all(&cache_dir).ok();
    let cache_clone = cache_dir.clone();

    match tokio::task::spawn_blocking(move || {
        crate::embeddings::load_embeddings(cache_clone)
    }).await {
        Ok(Ok(emb)) => {
            *state.embeddings.lock().unwrap() = Some(emb);
            loaded["embeddings"] = serde_json::json!(true);
        }
        Ok(Err(e)) => errors.push(format!("Embeddings: {e}")),
        Err(e)     => errors.push(format!("Embeddings (spawn): {e}")),
    }

    Ok(serde_json::json!({ "loaded": loaded, "errors": errors }))
}
