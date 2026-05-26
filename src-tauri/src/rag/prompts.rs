/// Templates de prompts para Phi-4-mini-instruct (formato chatml).
/// Siempre en español, Markdown estructurado, profesional.

pub const SYSTEM_BASE: &str = r#"Eres un asistente especializado en análisis de reuniones de trabajo.
Respondes SIEMPRE en español.
Generas respuestas en Markdown estructurado y limpio.
Eres preciso, profesional y conciso.
Solo usas información que aparece explícitamente en la transcripción proporcionada.
Si algo no está en la transcripción, lo dices claramente."#;

pub const SYSTEM_DOCUMENT: &str = r#"Eres un asistente especializado en análisis y documentación de reuniones de trabajo.
Respondes SIEMPRE en español.
Generas documentos en Markdown estructurado, completo y profesional.
Utilizas únicamente información de la transcripción. No inventas datos.
Formato: usa encabezados ##, listas con -, negritas para términos clave, tablas si aplica."#;

/// Formato chatml para Phi-4-mini
pub fn build_chat_prompt(system: &str, context: &str, user_query: &str) -> String {
    format!(
        "<|system|>\n{system}\n<|end|>\n<|user|>\nContexto de la reunión:\n{context}\n\nPregunta: {user_query}\n<|end|>\n<|assistant|>\n"
    )
}

pub fn build_document_prompt(doc_type: &str, context: &str) -> String {
    let instruction = match doc_type {
        "resumen_ejecutivo" => "Genera un resumen ejecutivo completo de la reunión con: \
            ## Resumen Ejecutivo\n## Puntos Principales\n## Decisiones Tomadas\n## Próximos Pasos",

        "acta" => "Genera el acta formal de la reunión con: \
            ## Acta de Reunión\n### Fecha y Participantes\n### Orden del Día\n### \
            Desarrollo\n### Acuerdos y Decisiones\n### Compromisos y Responsables\n### Cierre",

        "compromisos" => "Extrae todos los compromisos y tareas asignadas durante la reunión con: \
            ## Compromisos y Tareas\nPara cada tarea: responsable, descripción, fecha límite si se menciona",

        "riesgos" => "Identifica y documenta los riesgos mencionados con: \
            ## Riesgos Identificados\nPara cada riesgo: descripción, impacto potencial, \
            mitigación propuesta si se menciona",

        "acuerdos" => "Lista todos los acuerdos alcanzados durante la reunión con: \
            ## Acuerdos de la Reunión\nNúmera cada acuerdo con su contexto y responsables",

        "proximos_pasos" => "Documenta los próximos pasos acordados con: \
            ## Próximos Pasos\nPara cada paso: acción, responsable, plazo si se menciona",

        "correo_seguimiento" => "Redacta un correo de seguimiento post-reunión con: \
            Asunto, Saludo, Resumen ejecutivo (3-5 líneas), Acuerdos principales, \
            Próximos pasos con responsables, Cierre formal",

        "timeline" => "Construye una línea de tiempo de los eventos y decisiones mencionados con: \
            ## Timeline de la Reunión\nPara cada punto: timestamp MM:SS - descripción del evento/decisión",

        "minuta" => "Genera la minuta ejecutiva de la reunión con: \
            ## Minuta Ejecutiva\n### Resumen\n### Temas Tratados\n### Decisiones\n### Acciones Pendientes",

        "tareas" => "Extrae todas las tareas y action items con: \
            ## Action Items\nFormato: - [ ] **Responsable**: descripción de la tarea",

        _ => "Analiza la reunión y genera un documento estructurado con los puntos más relevantes.",
    };

    format!(
        "<|system|>\n{SYSTEM_DOCUMENT}\n<|end|>\n<|user|>\nContexto de la reunión:\n{context}\n\n\
        Instrucción: {instruction}\n<|end|>\n<|assistant|>\n"
    )
}

/// Detecta si el query del usuario pide un documento específico.
#[derive(Debug, Clone, PartialEq)]
pub enum IntentType {
    Document(String), // doc_type
    Chat,
}

pub fn detect_intent(query: &str) -> IntentType {
    let q = query.to_lowercase();

    // Orden de prioridad: más específico primero
    let patterns = [
        ("resumen ejecutivo",    "resumen_ejecutivo"),
        ("resumen",              "resumen_ejecutivo"),
        ("acta de reunión",      "acta"),
        ("acta",                 "acta"),
        ("minuta",               "minuta"),
        ("correo de seguimiento","correo_seguimiento"),
        ("follow up",            "correo_seguimiento"),
        ("email",                "correo_seguimiento"),
        ("correo",               "correo_seguimiento"),
        ("compromisos",          "compromisos"),
        ("action items",         "tareas"),
        ("tareas",               "tareas"),
        ("riesgos",              "riesgos"),
        ("riesgo",               "riesgos"),
        ("acuerdos",             "acuerdos"),
        ("acuerdo",              "acuerdos"),
        ("próximos pasos",       "proximos_pasos"),
        ("siguientes pasos",     "proximos_pasos"),
        ("timeline",             "timeline"),
        ("cronograma",           "timeline"),
        ("línea de tiempo",      "timeline"),
    ];

    for (pat, doc_type) in &patterns {
        if q.contains(pat) {
            return IntentType::Document(doc_type.to_string());
        }
    }

    IntentType::Chat
}

/// Devuelve los parámetros de RAG según la intención.
pub struct RagParams {
    pub top_k:      usize,
    pub max_tokens: u32,
}

pub fn rag_params_for_intent(intent: &IntentType) -> RagParams {
    match intent {
        IntentType::Document(_) => RagParams { top_k: 12, max_tokens: 2048 },
        IntentType::Chat        => RagParams { top_k: 6,  max_tokens: 1024 },
    }
}
