use std::sync::{Arc, Mutex, atomic::{AtomicBool, AtomicI32}};
use cpal::Stream;

/// Instancia del LLM cargado en memoria
pub struct LlmInstance {
    pub backend: llama_cpp_2::llama_backend::LlamaBackend,
    pub model: llama_cpp_2::model::LlamaModel,
    pub n_ctx: u32,
    pub n_threads: i32,
}

// Safety: LlamaModel es thread-safe (puntero a C++ read-only tras carga)
unsafe impl Send for LlmInstance {}
unsafe impl Sync for LlmInstance {}

/// Estado de grabación de micrófono
pub struct RecordingState {
    pub stream: Mutex<Option<Stream>>,
    pub samples: Mutex<Vec<f32>>,
    pub is_active: AtomicBool,
}

// Safety: cpal::Stream gestiona sus propios hilos internamente
unsafe impl Send for RecordingState {}
unsafe impl Sync for RecordingState {}

/// Estado global de la app compartido entre todos los comandos Tauri
pub struct AppState {
    /// Conexión SQLite (embebida, bundled)
    pub db: Arc<Mutex<rusqlite::Connection>>,

    /// Modelo LLM (Phi-4-mini o similar GGUF)
    pub llm: Arc<Mutex<Option<LlmInstance>>>,

    /// Contexto de Whisper para transcripción
    pub whisper: Arc<Mutex<Option<whisper_rs::WhisperContext>>>,

    /// Modelo de embeddings FastEmbed (multilingual-e5-small)
    pub embeddings: Arc<Mutex<Option<fastembed::TextEmbedding>>>,

    /// Estado de la grabación de micrófono
    pub recording: Arc<RecordingState>,

    /// Progreso de transcripción 0–100
    pub transcription_progress: Arc<AtomicI32>,

    /// Flag: hay inferencia LLM en curso
    pub is_inferring: Arc<AtomicBool>,

    /// Directorio de modelos (~/.konejo/models)
    pub models_dir: std::path::PathBuf,

    /// Directorio de datos de la app (~/.konejo/data)
    pub data_dir: std::path::PathBuf,
}

impl AppState {
    pub fn new(db: rusqlite::Connection) -> Self {
        let home = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
        let konejo_dir = home.join(".konejo");
        let models_dir = konejo_dir.join("models");
        let data_dir   = konejo_dir.join("data");

        std::fs::create_dir_all(&models_dir).ok();
        std::fs::create_dir_all(&data_dir).ok();

        AppState {
            db: Arc::new(Mutex::new(db)),
            llm: Arc::new(Mutex::new(None)),
            whisper: Arc::new(Mutex::new(None)),
            embeddings: Arc::new(Mutex::new(None)),
            recording: Arc::new(RecordingState {
                stream: Mutex::new(None),
                samples: Mutex::new(Vec::new()),
                is_active: AtomicBool::new(false),
            }),
            transcription_progress: Arc::new(AtomicI32::new(0)),
            is_inferring: Arc::new(AtomicBool::new(false)),
            models_dir,
            data_dir,
        }
    }
}
