use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};

// ── Tipos de dominio ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub audio_path: Option<String>,
    pub transcript: Option<String>,
    pub duration_seconds: Option<f64>,
    pub status: WorkspaceStatus,
    pub participant_count: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum WorkspaceStatus {
    Processing,
    Ready,
    Error,
}

impl From<String> for WorkspaceStatus {
    fn from(s: String) -> Self {
        match s.as_str() {
            "ready"      => WorkspaceStatus::Ready,
            "error"      => WorkspaceStatus::Error,
            _            => WorkspaceStatus::Processing,
        }
    }
}

impl std::fmt::Display for WorkspaceStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WorkspaceStatus::Processing => write!(f, "processing"),
            WorkspaceStatus::Ready      => write!(f, "ready"),
            WorkspaceStatus::Error      => write!(f, "error"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub workspace_id: String,
    pub title: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub workspace_id: String,
    pub role: String,
    pub content: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: String,
    pub workspace_id: String,
    pub title: String,
    pub content: String,
    pub doc_type: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chunk {
    pub id: String,
    pub workspace_id: String,
    pub text: String,
    pub start_time: f64,
    pub end_time: f64,
    pub chunk_index: i32,
    pub embedding: Option<Vec<f32>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub whisper_model_path: String,
    pub llm_model_path: String,
    pub llm_n_ctx: u32,
    pub llm_temperature: f32,
    pub llm_repeat_penalty: f32,
    pub llm_max_tokens: u32,
    pub rag_top_k: u32,
    pub onboarding_complete: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        let home = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
        let base = home.join(".konejo").join("models");
        AppSettings {
            whisper_model_path: base.join("ggml-small.bin").to_string_lossy().to_string(),
            llm_model_path: base.join("phi-4-mini-instruct-q4_k_m.gguf").to_string_lossy().to_string(),
            llm_n_ctx: 8192,
            llm_temperature: 0.3,
            llm_repeat_penalty: 1.1,
            llm_max_tokens: 1024,
            rag_top_k: 6,
            onboarding_complete: false,
        }
    }
}

// ── Migraciones ────────────────────────────────────────────────────────────────

const MIGRATIONS: &[&str] = &[
    // V1
    r#"
    CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);
    INSERT INTO schema_version VALUES (1);

    CREATE TABLE IF NOT EXISTS workspaces (
        id               TEXT PRIMARY KEY,
        name             TEXT NOT NULL,
        created_at       INTEGER NOT NULL,
        audio_path       TEXT,
        transcript       TEXT,
        duration_seconds REAL,
        status           TEXT NOT NULL DEFAULT 'processing',
        participant_count INTEGER
    );

    CREATE TABLE IF NOT EXISTS chunks (
        id           TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        text         TEXT NOT NULL,
        start_time   REAL NOT NULL,
        end_time     REAL NOT NULL,
        chunk_index  INTEGER NOT NULL,
        embedding    BLOB,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_workspace ON chunks(workspace_id);

    CREATE TABLE IF NOT EXISTS conversations (
        id           TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        title        TEXT,
        created_at   INTEGER NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
        id              TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        workspace_id    TEXT NOT NULL,
        role            TEXT NOT NULL,
        content         TEXT NOT NULL,
        created_at      INTEGER NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);

    CREATE TABLE IF NOT EXISTS documents (
        id           TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        title        TEXT NOT NULL,
        content      TEXT NOT NULL,
        doc_type     TEXT NOT NULL,
        created_at   INTEGER NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    "#,
];

pub fn init_db(path: &std::path::Path) -> Result<Connection> {
    let conn = Connection::open(path)?;

    // WAL mode para mejor performance con lecturas concurrentes
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

    // Aplicar migraciones
    let version: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='schema_version'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    if version == 0 {
        conn.execute_batch(MIGRATIONS[0])?;
    }

    Ok(conn)
}

// ── CRUD Workspaces ────────────────────────────────────────────────────────────

pub fn insert_workspace(conn: &Connection, ws: &Workspace) -> Result<()> {
    conn.execute(
        "INSERT INTO workspaces (id, name, created_at, audio_path, transcript, duration_seconds, status, participant_count)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![ws.id, ws.name, ws.created_at, ws.audio_path, ws.transcript,
                ws.duration_seconds, ws.status.to_string(), ws.participant_count],
    )?;
    Ok(())
}

pub fn get_workspaces(conn: &Connection) -> Result<Vec<Workspace>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, created_at, audio_path, transcript, duration_seconds, status, participant_count
         FROM workspaces ORDER BY created_at DESC"
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(Workspace {
            id:                r.get(0)?,
            name:              r.get(1)?,
            created_at:        r.get(2)?,
            audio_path:        r.get(3)?,
            transcript:        r.get(4)?,
            duration_seconds:  r.get(5)?,
            status:            WorkspaceStatus::from(r.get::<_, String>(6)?),
            participant_count: r.get(7)?,
        })
    })?;
    rows.collect()
}

pub fn get_workspace(conn: &Connection, id: &str) -> Result<Option<Workspace>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, created_at, audio_path, transcript, duration_seconds, status, participant_count
         FROM workspaces WHERE id = ?1"
    )?;
    let mut rows = stmt.query_map(params![id], |r| {
        Ok(Workspace {
            id:                r.get(0)?,
            name:              r.get(1)?,
            created_at:        r.get(2)?,
            audio_path:        r.get(3)?,
            transcript:        r.get(4)?,
            duration_seconds:  r.get(5)?,
            status:            WorkspaceStatus::from(r.get::<_, String>(6)?),
            participant_count: r.get(7)?,
        })
    })?;
    rows.next().transpose()
}

pub fn update_workspace_status(conn: &Connection, id: &str, status: WorkspaceStatus) -> Result<()> {
    conn.execute("UPDATE workspaces SET status = ?1 WHERE id = ?2", params![status.to_string(), id])?;
    Ok(())
}

pub fn update_workspace_transcript(conn: &Connection, id: &str, transcript: &str, duration: f64) -> Result<()> {
    conn.execute(
        "UPDATE workspaces SET transcript = ?1, duration_seconds = ?2, status = 'ready' WHERE id = ?3",
        params![transcript, duration, id],
    )?;
    Ok(())
}

pub fn delete_workspace(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM workspaces WHERE id = ?1", params![id])?;
    Ok(())
}

// ── CRUD Chunks ───────────────────────────────────────────────────────────────

pub fn insert_chunk(conn: &Connection, chunk: &Chunk) -> Result<()> {
    let embedding_blob: Option<Vec<u8>> = chunk.embedding.as_ref().map(|e| {
        e.iter().flat_map(|f| f.to_le_bytes()).collect()
    });
    conn.execute(
        "INSERT INTO chunks (id, workspace_id, text, start_time, end_time, chunk_index, embedding)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![chunk.id, chunk.workspace_id, chunk.text, chunk.start_time,
                chunk.end_time, chunk.chunk_index, embedding_blob],
    )?;
    Ok(())
}

pub fn get_chunks_with_embeddings(conn: &Connection, workspace_id: &str) -> Result<Vec<Chunk>> {
    let mut stmt = conn.prepare(
        "SELECT id, workspace_id, text, start_time, end_time, chunk_index, embedding
         FROM chunks WHERE workspace_id = ?1 ORDER BY chunk_index"
    )?;
    let rows = stmt.query_map(params![workspace_id], |r| {
        let embedding_blob: Option<Vec<u8>> = r.get(6)?;
        let embedding = embedding_blob.map(|b| {
            b.chunks_exact(4)
             .map(|c| f32::from_le_bytes(c.try_into().unwrap()))
             .collect::<Vec<f32>>()
        });
        Ok(Chunk {
            id:           r.get(0)?,
            workspace_id: r.get(1)?,
            text:         r.get(2)?,
            start_time:   r.get(3)?,
            end_time:     r.get(4)?,
            chunk_index:  r.get(5)?,
            embedding,
        })
    })?;
    rows.collect()
}

// ── CRUD Conversations ────────────────────────────────────────────────────────

pub fn insert_conversation(conn: &Connection, conv: &Conversation) -> Result<()> {
    conn.execute(
        "INSERT INTO conversations (id, workspace_id, title, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![conv.id, conv.workspace_id, conv.title, conv.created_at],
    )?;
    Ok(())
}

pub fn get_conversations(conn: &Connection, workspace_id: &str) -> Result<Vec<Conversation>> {
    let mut stmt = conn.prepare(
        "SELECT id, workspace_id, title, created_at FROM conversations
         WHERE workspace_id = ?1 ORDER BY created_at DESC"
    )?;
    let rows = stmt.query_map(params![workspace_id], |r| {
        Ok(Conversation {
            id: r.get(0)?, workspace_id: r.get(1)?,
            title: r.get(2)?, created_at: r.get(3)?,
        })
    })?;
    rows.collect()
}

// ── CRUD Messages ─────────────────────────────────────────────────────────────

pub fn insert_message(conn: &Connection, msg: &Message) -> Result<()> {
    conn.execute(
        "INSERT INTO messages (id, conversation_id, workspace_id, role, content, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![msg.id, msg.conversation_id, msg.workspace_id, msg.role, msg.content, msg.created_at],
    )?;
    Ok(())
}

pub fn update_message_content(conn: &Connection, id: &str, content: &str) -> Result<()> {
    conn.execute("UPDATE messages SET content = ?1 WHERE id = ?2", params![content, id])?;
    Ok(())
}

pub fn get_messages(conn: &Connection, conversation_id: &str) -> Result<Vec<Message>> {
    let mut stmt = conn.prepare(
        "SELECT id, conversation_id, workspace_id, role, content, created_at
         FROM messages WHERE conversation_id = ?1 ORDER BY created_at ASC"
    )?;
    let rows = stmt.query_map(params![conversation_id], |r| {
        Ok(Message {
            id: r.get(0)?, conversation_id: r.get(1)?,
            workspace_id: r.get(2)?, role: r.get(3)?,
            content: r.get(4)?, created_at: r.get(5)?,
        })
    })?;
    rows.collect()
}

// ── CRUD Documents ────────────────────────────────────────────────────────────

pub fn insert_document(conn: &Connection, doc: &Document) -> Result<()> {
    conn.execute(
        "INSERT INTO documents (id, workspace_id, title, content, doc_type, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![doc.id, doc.workspace_id, doc.title, doc.content, doc.doc_type, doc.created_at],
    )?;
    Ok(())
}

pub fn update_document(conn: &Connection, id: &str, title: &str, content: &str) -> Result<()> {
    conn.execute(
        "UPDATE documents SET title = ?1, content = ?2 WHERE id = ?3",
        params![title, content, id],
    )?;
    Ok(())
}

pub fn get_documents(conn: &Connection, workspace_id: &str) -> Result<Vec<Document>> {
    let mut stmt = conn.prepare(
        "SELECT id, workspace_id, title, content, doc_type, created_at
         FROM documents WHERE workspace_id = ?1 ORDER BY created_at DESC"
    )?;
    let rows = stmt.query_map(params![workspace_id], |r| {
        Ok(Document {
            id: r.get(0)?, workspace_id: r.get(1)?,
            title: r.get(2)?, content: r.get(3)?,
            doc_type: r.get(4)?, created_at: r.get(5)?,
        })
    })?;
    rows.collect()
}

pub fn delete_document(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM documents WHERE id = ?1", params![id])?;
    Ok(())
}

// ── Settings ──────────────────────────────────────────────────────────────────

pub fn get_settings(conn: &Connection) -> Result<AppSettings> {
    let mut settings = AppSettings::default();

    let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
    let rows = stmt.query_map([], |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
    })?;

    for row in rows.flatten() {
        match row.0.as_str() {
            "whisper_model_path" => settings.whisper_model_path = row.1,
            "llm_model_path"     => settings.llm_model_path = row.1,
            "llm_n_ctx"          => settings.llm_n_ctx = row.1.parse().unwrap_or(8192),
            "llm_temperature"    => settings.llm_temperature = row.1.parse().unwrap_or(0.3),
            "llm_repeat_penalty" => settings.llm_repeat_penalty = row.1.parse().unwrap_or(1.1),
            "llm_max_tokens"     => settings.llm_max_tokens = row.1.parse().unwrap_or(1024),
            "rag_top_k"          => settings.rag_top_k = row.1.parse().unwrap_or(6),
            "onboarding_complete" => settings.onboarding_complete = row.1 == "true",
            _ => {}
        }
    }
    Ok(settings)
}

pub fn save_settings(conn: &Connection, settings: &AppSettings) -> Result<()> {
    let pairs = vec![
        ("whisper_model_path",  settings.whisper_model_path.clone()),
        ("llm_model_path",      settings.llm_model_path.clone()),
        ("llm_n_ctx",           settings.llm_n_ctx.to_string()),
        ("llm_temperature",     settings.llm_temperature.to_string()),
        ("llm_repeat_penalty",  settings.llm_repeat_penalty.to_string()),
        ("llm_max_tokens",      settings.llm_max_tokens.to_string()),
        ("rag_top_k",           settings.rag_top_k.to_string()),
        ("onboarding_complete", settings.onboarding_complete.to_string()),
    ];
    for (k, v) in pairs {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![k, v],
        )?;
    }
    Ok(())
}
