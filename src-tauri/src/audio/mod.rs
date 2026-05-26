use crate::error::{AppError, AppResult};
use crate::state::RecordingState;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::{Arc, atomic::Ordering};
use std::path::Path;

/// Inicia grabación de micrófono usando el RecordingState compartido.
/// Devuelve el Stream activo que debe mantenerse vivo mientras se graba.
pub fn start_recording(
    recording: Arc<RecordingState>,
) -> AppResult<cpal::Stream> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| AppError::Audio("No se encontró dispositivo de entrada de audio".into()))?;

    tracing::info!("Dispositivo de audio: {}", device.name().unwrap_or_default());

    // Preferimos 16kHz mono para whisper.cpp
    let config = find_input_config(&device)?;
    // En cpal 0.17, SampleRate es un alias de tipo para u32
    let sample_rate = config.sample_rate();
    let channels = config.channels() as usize;

    tracing::info!("Config audio: {}Hz, {} canales", sample_rate, channels);

    let rec_clone = recording.clone();

    let stream = device.build_input_stream(
        &config.into(),
        move |data: &[f32], _: &cpal::InputCallbackInfo| {
            if !rec_clone.is_active.load(Ordering::Relaxed) { return; }
            let mut buf = rec_clone.samples.lock().unwrap();
            // Downmix a mono si es necesario
            for frame in data.chunks(channels) {
                let mono = frame.iter().sum::<f32>() / channels as f32;
                buf.push(mono);
            }
        },
        |err| tracing::error!("Error en stream de audio: {}", err),
        None,
    ).map_err(|e| AppError::Audio(e.to_string()))?;

    stream.play().map_err(|e| AppError::Audio(e.to_string()))?;
    tracing::info!("Grabación iniciada");
    Ok(stream)
}

/// Detiene la grabación y guarda el WAV en la ruta indicada.
/// Retorna la duración en segundos.
pub fn stop_and_save_wav(
    samples: &[f32],
    out_path: &Path,
    source_sample_rate: u32,
) -> AppResult<f64> {
    let target_rate: u32 = 16_000;

    // Resample lineal simple si es necesario
    let resampled = if source_sample_rate != target_rate {
        resample_linear(samples, source_sample_rate, target_rate)
    } else {
        samples.to_vec()
    };

    let spec = hound::WavSpec {
        channels:        1,
        sample_rate:     target_rate,
        bits_per_sample: 16,
        sample_format:   hound::SampleFormat::Int,
    };

    let mut writer = hound::WavWriter::create(out_path, spec)
        .map_err(|e| AppError::Audio(e.to_string()))?;

    for &s in &resampled {
        let clamped = s.clamp(-1.0, 1.0);
        let sample_i16 = (clamped * i16::MAX as f32) as i16;
        writer.write_sample(sample_i16).map_err(|e| AppError::Audio(e.to_string()))?;
    }
    writer.finalize().map_err(|e| AppError::Audio(e.to_string()))?;

    let duration = resampled.len() as f64 / target_rate as f64;
    tracing::info!("WAV guardado en {:?}, duración: {:.1}s", out_path, duration);
    Ok(duration)
}

/// Lee un WAV ya existente y lo convierte a muestras f32 @ 16kHz mono.
pub fn load_wav_as_f32(path: &Path) -> AppResult<(Vec<f32>, f64)> {
    let mut reader = hound::WavReader::open(path)
        .map_err(|e| AppError::Audio(e.to_string()))?;

    let spec = reader.spec();
    let source_rate = spec.sample_rate;
    let channels = spec.channels as usize;

    let raw: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Int => {
            let max = (1i64 << (spec.bits_per_sample - 1)) as f32;
            reader.samples::<i32>()
                  .filter_map(|s| s.ok())
                  .map(|s| s as f32 / max)
                  .collect()
        }
        hound::SampleFormat::Float => {
            reader.samples::<f32>()
                  .filter_map(|s| s.ok())
                  .collect()
        }
    };

    // Downmix a mono
    let mono: Vec<f32> = raw.chunks(channels)
        .map(|frame| frame.iter().sum::<f32>() / channels as f32)
        .collect();

    // Resample a 16kHz
    let samples = if source_rate != 16_000 {
        resample_linear(&mono, source_rate, 16_000)
    } else {
        mono
    };

    let duration = samples.len() as f64 / 16_000.0;
    Ok((samples, duration))
}

/// Convierte un archivo de video/audio usando ffmpeg (debe estar en PATH).
pub async fn convert_with_ffmpeg(
    app: &tauri::AppHandle,
    input_path: &str,
    output_path: &str,
) -> AppResult<()> {
    use tauri_plugin_shell::ShellExt;

    let output = app.shell()
        .command("ffmpeg")
        .args([
            "-y", "-i", input_path,
            "-ar", "16000",
            "-ac", "1",
            "-f", "wav",
            output_path,
        ])
        .output()
        .await
        .map_err(|e| AppError::Audio(e.to_string()))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Audio(format!("ffmpeg error: {stderr}")));
    }
    Ok(())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn find_input_config(device: &cpal::Device) -> AppResult<cpal::SupportedStreamConfig> {
    let mut configs: Vec<_> = device
        .supported_input_configs()
        .map_err(|e| AppError::Audio(e.to_string()))?
        .collect();

    // Preferimos 16kHz mono; en cpal 0.17 max_sample_rate() ya devuelve u32
    configs.sort_by_key(|c| {
        let rate_diff = (c.max_sample_rate() as i64 - 16_000).abs();
        let ch_diff   = (c.channels() as i64 - 1).abs();
        rate_diff + ch_diff * 100_000
    });

    configs.into_iter().next()
        .map(|c| {
            // SampleRate = u32 en cpal 0.17, se pasa directamente
            let rate = c.max_sample_rate().min(48_000).max(16_000);
            c.with_sample_rate(rate)
        })
        .ok_or_else(|| AppError::Audio("No hay configuraciones de entrada soportadas".into()))
}

fn resample_linear(input: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
    if from_rate == to_rate { return input.to_vec(); }
    let ratio = from_rate as f64 / to_rate as f64;
    let output_len = (input.len() as f64 / ratio) as usize;
    let mut output = Vec::with_capacity(output_len);
    for i in 0..output_len {
        let pos = i as f64 * ratio;
        let lo = pos.floor() as usize;
        let hi = (lo + 1).min(input.len() - 1);
        let t = pos - lo as f64;
        output.push(input[lo] * (1.0 - t as f32) + input[hi] * t as f32);
    }
    output
}
