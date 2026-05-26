# 🐰 Konejo — AI Meeting Assistant Local-First

Konejo es una aplicación desktop que transcribe, indexa semánticamente y permite consultar reuniones de trabajo mediante LLM, todo de forma completamente local. Sin nube, sin telemetría.

---

## Arquitectura

```
Tauri v2 (Rust backend + WebView frontend React)
├── Transcripción:   whisper-rs (whisper.cpp) → modelo Whisper Small
├── LLM:             llama-cpp-2 (llama.cpp)  → Phi-4-mini-instruct Q4_K_M
├── Embeddings:      fastembed               → multilingual-e5-small
├── Vector store:    SQLite + cosine similarity en Rust (zero-config)
├── Base de datos:   rusqlite bundled
├── Audio:           cpal + hound
└── Frontend:        React 18 + Zustand + BlockNote + Framer Motion
```

**Hardware objetivo:** Intel Core Ultra 7 265U (iGPU Intel Arc). Para aceleración:
- **Vulkan** (Intel Arc): `cargo build --release --features vulkan`
- **OpenVINO** (whisper): requiere SDK de OpenVINO instalado

---

## Prerrequisitos Windows

### 1. Rust y herramientas de compilación
```powershell
# Instalar Rust
winget install Rustlang.Rustup
# Reiniciar terminal, luego:
rustup update stable

# Visual C++ Build Tools (si no tienes Visual Studio)
winget install Microsoft.VisualStudio.2022.BuildTools
# En el instalador: seleccionar "Desktop development with C++"
```

### 2. CMake (requerido por llama.cpp y whisper.cpp)
```powershell
winget install Kitware.CMake
```

### 3. Node.js y pnpm/npm
```powershell
winget install OpenJS.NodeJS.LTS
```

### 4. WebView2 (ya incluido en Windows 11)
```powershell
# Solo necesario en Windows 10 antiguo:
winget install Microsoft.EdgeWebView2Runtime
```

### 5. ffmpeg (para convertir video a audio)
```powershell
winget install Gyan.FFmpeg
# O con Chocolatey: choco install ffmpeg
```

### 6. Tauri CLI
```powershell
npm install -g @tauri-apps/cli
```

---

## Modelos

Konejo **no descarga modelos automáticamente** en esta versión. Descárgalos y colócalos en:

```
%USERPROFILE%\.konejo\models\
```

### Whisper Small (244 MB)
```
https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin

Ruta destino: %USERPROFILE%\.konejo\models\ggml-small.bin
```

### Phi-4-mini-instruct Q4_K_M (≈2.4 GB)
```
https://huggingface.co/microsoft/Phi-4-mini-instruct-gguf/resolve/main/Phi-4-mini-instruct-Q4_K_M.gguf

Ruta destino: %USERPROFILE%\.konejo\models\phi-4-mini-instruct-q4_k_m.gguf
```

> El modelo de embeddings (`multilingual-e5-small`) se descarga automáticamente desde HuggingFace vía FastEmbed al primer uso.

---

## Setup y desarrollo

```powershell
# 1. Clonar el repositorio
git clone <repo>
cd konejo

# 2. Instalar dependencias de frontend
npm install

# 3. Desarrollo con Mock Mode (no requiere modelos ni compilar Rust)
# VITE_MOCK_MODE=true está activado por defecto en .env.development
npm run dev
# → Abre Tauri WebView con datos simulados

# 4. Desarrollo completo (compilar Rust + frontend hot-reload)
cargo tauri dev

# 5. Build de producción
cargo tauri build --release
```

### Mock Mode
El flag `VITE_MOCK_MODE=true` en `.env.development` intercepta todas las llamadas a Tauri y devuelve datos mock en español. Ideal para iterar el frontend sin compilar Rust.

Para desactivarlo durante desarrollo:
```
VITE_MOCK_MODE=false
```

---

## Aceleración GPU

### Intel Arc iGPU (Vulkan)
```powershell
# Instalar Vulkan SDK: https://vulkan.lunarg.com/sdk/home#windows
# Luego compilar con feature vulkan:
cargo tauri build --release -- --features vulkan
```

### OpenVINO para Whisper (mejor en Intel)
```powershell
# 1. Instalar OpenVINO: https://storage.openvinotoolkit.org/repositories/openvino/packages/
# 2. Activar entorno: openvino_env\Scripts\activate
# 3. Compilar con feature openvino:
cargo tauri build --release -- --features openvino
```

---

## Estructura del proyecto

```
konejo/
├── src-tauri/
│   ├── Cargo.toml              # Dependencias Rust
│   ├── tauri.conf.json         # Config de Tauri v2
│   ├── capabilities/           # Permisos Tauri
│   └── src/
│       ├── lib.rs              # Registro de comandos y plugins
│       ├── state.rs            # AppState compartido
│       ├── db/mod.rs           # SQLite schema + CRUD
│       ├── audio/mod.rs        # cpal + hound + ffmpeg
│       ├── transcription/      # whisper-rs
│       ├── llm/mod.rs          # llama-cpp-2 + streaming
│       ├── embeddings/mod.rs   # fastembed + cosine similarity
│       ├── rag/                # Pipeline RAG completo
│       │   ├── chunker.rs      # Chunking temporal 60s/10s overlap
│       │   └── prompts.rs      # Templates + detección de intención
│       └── commands/           # Tauri commands
│           ├── workspace.rs    # Import, procesamiento pipeline
│           ├── chat.rs         # RAG + inferencia LLM streaming
│           ├── recording.rs    # Grabación micrófono
│           └── settings.rs     # Configuración
└── src/
    ├── types/index.ts          # Tipos TypeScript (espejo de Rust)
    ├── mock/index.ts           # Datos mock + simulación de eventos
    ├── lib/tauri.ts            # Wrapper Tauri (mock/real)
    ├── store/                  # Zustand stores
    ├── hooks/                  # useChat, useTauriEvent
    ├── components/             # Navigation, ChatComposer, BlockNoteEditor
    └── pages/                  # Onboarding, Home, Workspace, Documents...
```

---

## Pipeline RAG

1. **Chunking temporal** — ventanas de 60s con 10s de overlap (criterio primario) + límite de 384 palabras ≈512 tokens (criterio secundario)
2. **Embeddings** — `multilingual-e5-small` con prefijo `passage:` para indexación
3. **Búsqueda** — prefijo `query:` + similitud coseno en SQLite, top-k reordenado por timestamp
4. **Detección de intención** — si el query pide documento (resumen, acta, compromisos…) → top-k=12, max_tokens=2048; si es pregunta libre → top-k=6, max_tokens=1024
5. **Prompt** — templates chatml para Phi-4-mini con instrucción de responder siempre en español con Markdown estructurado
6. **Streaming** — tokens emitidos uno a uno vía eventos Tauri al frontend

---

## Comandos Tauri disponibles

| Comando | Descripción |
|---------|-------------|
| `get_workspaces` | Lista todos los workspaces |
| `import_file` | Importa archivo audio/video, inicia pipeline |
| `start_recording` / `stop_recording` | Control de micrófono |
| `send_chat_message` | RAG + inferencia, streaming de tokens |
| `get_documents` | Lista documentos de un workspace |
| `export_document` | Exporta a .docx o .pdf |
| `initialize_models` | Carga LLM + Whisper en memoria |
| `check_models_exist` | Verifica si los modelos están en disco |
| `get_settings` / `save_settings` | Configuración persistente |

---

## Licencia

MIT
