use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Model not loaded: {0}")]
    ModelNotLoaded(String),

    #[error("Transcription error: {0}")]
    Transcription(String),

    #[error("Inference error: {0}")]
    Inference(String),

    #[error("Embedding error: {0}")]
    Embedding(String),

    #[error("Audio error: {0}")]
    Audio(String),

    #[error("Export error: {0}")]
    Export(String),

    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("Request error: {0}")]
    Request(#[from] reqwest::Error),

    #[error("{0}")]
    Custom(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;

// Allows using ? in Tauri commands (they return Result<T, String>)
impl From<AppError> for String {
    fn from(e: AppError) -> Self {
        e.to_string()
    }
}

impl From<anyhow::Error> for AppError {
    fn from(e: anyhow::Error) -> Self {
        AppError::Custom(e.to_string())
    }
}
