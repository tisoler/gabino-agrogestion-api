import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Transcripción de audios de monitoreo (spike de voz).
 *
 * Proveedor configurable vía `TRANSCRIPTION_PROVIDER`:
 *  - `stub` (default): no llama a nadie, devuelve un texto fijo. Sirve para
 *    probar el flujo punta a punta sin keys ni costo.
 *  - `groq`: Whisper `whisper-large-v3-turbo` vía endpoint compatible OpenAI.
 *    Requiere `GROQ_API_KEY` (cuenta gratuita). Barato y suficiente para spikes.
 *  - `openai`: `whisper-1` (u$s 0,006/min; deprecado 26-feb-2027, migrar luego
 *    a `gpt-transcribe`). Requiere `OPENAI_API_KEY` + billing habilitado.
 *
 * Ambos proveedores reales comparten el formato de la Audio API de OpenAI
 * (multipart `file` + `model`), así que el cambio es solo de URL/modelo/key.
 */
export type TranscriptionProvider = "stub" | "groq" | "openai";

export interface TranscripcionResultado {
  texto: string;
  /** Duración aproximada en segundos (si el proveedor la informa). */
  duracionSeg?: number;
}

const MAX_MB = 25;

@Injectable()
export class TranscripcionService {
  private readonly logger = new Logger(TranscripcionService.name);
  readonly provider: TranscriptionProvider;

  constructor(private readonly config: ConfigService) {
    const raw = (config.get<string>("TRANSCRIPTION_PROVIDER") ?? "stub")
      .trim()
      .toLowerCase();
    this.provider = raw === "groq" || raw === "openai" ? raw : "stub";
    if (raw && raw !== this.provider) {
      this.logger.warn(
        `TRANSCRIPTION_PROVIDER="${raw}" no reconocido, uso "stub".`,
      );
    }
  }

  async transcribir(
    buffer: Buffer,
    nombreArchivo = "audio.m4a",
    mimeType = "audio/m4a",
  ): Promise<TranscripcionResultado> {
    if (buffer.length > MAX_MB * 1024 * 1024) {
      throw new Error(`El audio supera el máximo de ${MAX_MB} MB.`);
    }
    switch (this.provider) {
      case "groq":
        return this.transcribirRemoto(
          "https://api.groq.com/openai/v1/audio/transcriptions",
          this.requerirKey("GROQ_API_KEY"),
          "whisper-large-v3-turbo",
          buffer,
          nombreArchivo,
          mimeType,
        );
      case "openai":
        return this.transcribirRemoto(
          "https://api.openai.com/v1/audio/transcriptions",
          this.requerirKey("OPENAI_API_KEY"),
          "whisper-1",
          buffer,
          nombreArchivo,
          mimeType,
        );
      default:
        return {
          texto:
            "[stub] Transcripción pendiente: productor ejemplo, lote ejemplo, " +
            "observación de prueba. Configure TRANSCRIPTION_PROVIDER=groq|openai " +
            "para transcripción real.",
        };
    }
  }

  private requerirKey(nombre: string): string {
    const key = this.config.get<string>(nombre);
    if (!key) {
      throw new Error(
        `Falta ${nombre} en el entorno para TRANSCRIPTION_PROVIDER=${this.provider}.`,
      );
    }
    return key;
  }

  private async transcribirRemoto(
    url: string,
    apiKey: string,
    model: string,
    buffer: Buffer,
    nombreArchivo: string,
    mimeType: string,
  ): Promise<TranscripcionResultado> {
    const form = new FormData();
    form.append(
      "file",
      new Blob([buffer as unknown as ArrayBuffer], { type: mimeType }),
      nombreArchivo,
    );
    form.append("model", model);
    form.append("language", "es");
    form.append("response_format", "verbose_json");

    let respuesta: Response;
    try {
      respuesta = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: AbortSignal.timeout(120_000),
      });
    } catch (e) {
      throw new Error(
        `No se pudo contactar al servicio de transcripción: ${(e as Error).message}`,
      );
    }
    if (!respuesta.ok) {
      const cuerpo = await respuesta.text().catch(() => "");
      this.logger.error(
        `Transcripción falló (${respuesta.status}): ${cuerpo.slice(0, 300)}`,
      );
      throw new Error(
        `El servicio de transcripción devolvió ${respuesta.status}.`,
      );
    }
    const data = (await respuesta.json()) as {
      text?: string;
      duration?: number;
    };
    const texto = (data.text ?? "").trim();
    if (!texto) throw new Error("La transcripción volvió vacía.");
    return {
      texto: texto.slice(0, 5000),
      duracionSeg:
        typeof data.duration === "number" ? data.duration : undefined,
    };
  }
}
