use crate::db::{self, AppSettings};
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let db = state.db.lock().unwrap();
    db::get_settings(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_settings(
    state: State<'_, AppState>,
    settings: AppSettings,
) -> Result<(), String> {
    let db = state.db.lock().unwrap();
    db::save_settings(&db, &settings).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mark_onboarding_complete(state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().unwrap();
    let mut settings = db::get_settings(&db).map_err(|e| e.to_string())?;
    settings.onboarding_complete = true;
    db::save_settings(&db, &settings).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_models_dir(state: State<'_, AppState>) -> Result<String, String> {
    Ok(state.models_dir.to_string_lossy().to_string())
}
