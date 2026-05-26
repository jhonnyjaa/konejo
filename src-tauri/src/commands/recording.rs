use crate::db::{self, Workspace, WorkspaceStatus};
use crate::state::AppState;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn start_recording(state: State<'_, AppState>) -> Result<(), String> {
    if state.recording.is_active.load(Ordering::Relaxed) {
        return Err("Ya hay una grabación activa".into());
    }

    // Limpiar buffer anterior
    state.recording.samples.lock().unwrap().clear();

    // Clonamos el Arc<RecordingState> para pasarlo al hilo de cpal
    let recording_arc = state.recording.clone();

    // Activar antes de lanzar el hilo para que el callback empiece a capturar
    state.recording.is_active.store(true, Ordering::Relaxed);

    // Iniciar grabación en hilo bloqueante (cpal requiere hilo dedicado en Windows)
    let stream_result = tokio::task::spawn_blocking(move || {
        crate::audio::start_recording(recording_arc)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| {
        // Si falló, desactivar el flag
        e.to_string()
    })?;

    *state.recording.stream.lock().unwrap() = Some(stream_result);
    tracing::info!("Grabación iniciada");
    Ok(())
}

#[tauri::command]
pub async fn stop_recording(
    app: AppHandle,
    state: State<'_, AppState>,
    name: Option<String>,
) -> Result<String, String> {
    if !state.recording.is_active.load(Ordering::Relaxed) {
        return Err("No hay grabación activa".into());
    }

    // Señalizar parada y soltar stream (el callback de cpal dejará de capturar)
    state.recording.is_active.store(false, Ordering::Relaxed);
    {
        let mut stream = state.recording.stream.lock().unwrap();
        drop(stream.take());
    }

    // Recoger muestras grabadas (clonar el Vec<f32> del interior del Mutex)
    let samples: Vec<f32> = state.recording.samples.lock().unwrap().clone();

    if samples.is_empty() {
        return Err("No se capturaron muestras de audio".into());
    }

    let workspace_id = uuid::Uuid::new_v4().to_string();
    let ws_name = name.unwrap_or_else(|| {
        let now = chrono::Local::now();
        format!("Reunión {}", now.format("%d/%m/%Y %H:%M"))
    });

    // Guardar WAV (asumimos 16kHz — cpal puede haber capturado a otra tasa;
    // audio::start_recording ya baja a mono pero NO resamplea en el callback)
    let wav_path = state.data_dir.join(format!("{workspace_id}.wav"));
    let duration = crate::audio::stop_and_save_wav(&samples, &wav_path, 16_000)
        .map_err(|e| e.to_string())?;

    // Crear workspace
    let ws = Workspace {
        id:                workspace_id.clone(),
        name:              ws_name.clone(),
        created_at:        chrono::Utc::now().timestamp(),
        audio_path:        Some(wav_path.to_string_lossy().to_string()),
        transcript:        None,
        duration_seconds:  Some(duration),
        status:            WorkspaceStatus::Processing,
        participant_count: None,
    };
    {
        let db = state.db.lock().unwrap();
        db::insert_workspace(&db, &ws).map_err(|e| e.to_string())?;
    }

    // Lanzar pipeline de procesamiento en background
    let db_arc         = state.db.clone();
    let whisper_arc    = state.whisper.clone();
    let embeddings_arc = state.embeddings.clone();
    let progress_arc   = state.transcription_progress.clone();
    let data_dir       = state.data_dir.clone();
    let wid            = workspace_id.clone();
    let app_clone      = app.clone();
    let wav_str        = wav_path.to_string_lossy().to_string();

    tokio::task::spawn_blocking(move || {
        crate::commands::workspace::run_processing_pipeline(
            &app_clone, wid, wav_str, ws_name,
            db_arc, whisper_arc, embeddings_arc, progress_arc, data_dir,
        );
    });

    tracing::info!("Grabación guardada → workspace {workspace_id} en procesamiento");
    Ok(workspace_id)
}

#[tauri::command]
pub async fn get_recording_status(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.recording.is_active.load(Ordering::Relaxed))
}
