mod audio;
mod commands;
mod db;
mod embeddings;
mod error;
mod llm;
mod rag;
mod state;
mod transcription;

use commands::{chat::*, recording::*, settings::*, workspace::*};
use state::AppState;
use tauri::Manager;


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // El logging es manejado por tauri-plugin-log (inicializado más abajo).
    // NO llamar a tracing_subscriber::fmt().init() aquí — provocaría
    // "attempted to set a logger after the logging system was already initialized".
    tracing::info!("Iniciando Konejo…");

    tauri::Builder::default()
        // ── Plugins ──────────────────────────────────────────────────────────
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_log::Builder::default().build())
        // ── Setup ─────────────────────────────────────────────────────────────
        .setup(|app| {
            // Directorio de datos de la app
            let data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| {
                    dirs::home_dir()
                        .unwrap_or_default()
                        .join(".konejo")
                        .join("app_data")
                });
            std::fs::create_dir_all(&data_dir).ok();

            let db_path = data_dir.join("konejo.db");
            tracing::info!("Base de datos: {:?}", db_path);

            let conn = db::init_db(&db_path)
                .expect("No se pudo inicializar la base de datos SQLite");

            let state = AppState::new(conn);
            app.manage(state);

            tracing::info!("Estado de la app inicializado");
            Ok(())
        })
        // ── Comandos Tauri ────────────────────────────────────────────────────
        .invoke_handler(tauri::generate_handler![
            // Workspace / archivos
            get_workspaces,
            get_workspace,
            delete_workspace,
            import_file,
            check_models_exist,
            initialize_models,
            // Documentos
            get_documents,
            save_document,
            delete_document,
            export_document,
            // Conversaciones y chat
            get_conversations,
            create_conversation,
            get_messages,
            send_chat_message,
            // Grabación
            start_recording,
            stop_recording,
            get_recording_status,
            // Configuración
            get_settings,
            save_settings,
            mark_onboarding_complete,
            get_models_dir,
        ])
        .run(tauri::generate_context!())
        .expect("Error iniciando Konejo");
}
