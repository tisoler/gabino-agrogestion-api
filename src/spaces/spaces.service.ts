import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomBytes } from "crypto";

const PREFIXO_PRESCRIPCIONES = "prescripciones/";

@Injectable()
export class SpacesService {
  private readonly logger = new Logger(SpacesService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  /**
   * Prefijo de objeto que corresponde al path de la URL pública
   * (p.ej. "gabino/agro/"). Si DO_SPACES_PUBLIC_URL no tiene path, queda vacío.
   * Los objetos se suben bajo este prefijo para que la URL pública resuelva.
   */
  private readonly pathPrefix: string;

  constructor(config: ConfigService) {
    const endpoint = config.get<string>("DO_SPACES_ENDPOINT");
    const region = config.get<string>("DO_SPACES_REGION", "nyc3");
    const key = config.get<string>("DO_SPACES_KEY");
    const secret = config.get<string>("DO_SPACES_SECRET");
    this.bucket = config.get<string>("DO_SPACES_BUCKET");

    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle: false,
      credentials: {
        accessKeyId: key,
        secretAccessKey: secret,
      },
    });

    this.publicBaseUrl =
      config.get<string>("DO_SPACES_PUBLIC_URL") ??
      `https://${this.bucket}.${region}.digitaloceanspaces.com`;

    const pathname = new URL(this.publicBaseUrl).pathname.replace(/\/+$/, "");
    this.pathPrefix =
      pathname && pathname !== "/" ? `${pathname.replace(/^\//, "")}/` : "";
  }

  /** Key corta (sin el prefijo de path de la URL pública). */
  private keyCorta(key: string): string {
    return this.pathPrefix ? key.replace(this.pathPrefix, "") : key;
  }

  /**
   * Genera una key pública pero "inaccesible por adivinación": un token
   * aleatorio de 160 bits en hex. Así el PDF queda público (lo puede abrir
   * quien reciba el link de WhatsApp) pero nadie puede enumerar/descubrir
   * links de otras prescripciones.
   */
  generarKeyPdf(): string {
    return `${PREFIXO_PRESCRIPCIONES}${randomBytes(20).toString("hex")}.pdf`;
  }

  /**
   * Sube un PDF al Space con ACL público y devuelve la URL pública. El objeto
   * se sube bajo `pathPrefix` para que la key coincida con el path de la URL.
   */
  async subirPdf(key: string, buffer: Buffer): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `${this.pathPrefix}${key}`,
        Body: buffer,
        ContentType: "application/pdf",
        ACL: "public-read",
      }),
    );
    return this.construirUrl(key);
  }

  /**
   * URL pública de una key (mismo formato que devuelve `subirPdf`).
   * Recibe la key corta (sin pathPrefix).
   */
  construirUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  /**
   * Lista los PDFs de prescripciones subidos antes (o en) la fecha `cutoff`.
   * Devuelve key y URL de cada uno. Maneja paginación de ListObjectsV2.
   */
  async listarPdfsAntiguos(
    cutoff: Date,
  ): Promise<{ key: string; url: string }[]> {
    const resultado: { key: string; url: string }[] = [];
    let continuationToken: string | undefined;

    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: `${this.pathPrefix}${PREFIXO_PRESCRIPCIONES}`,
          ContinuationToken: continuationToken,
        }),
      );

      for (const obj of page.Contents ?? []) {
        if (!obj.Key) continue;
        if (obj.LastModified && obj.LastModified <= cutoff) {
          resultado.push({
            key: obj.Key,
            // Para limpiar pdf_url (que guarda la URL con key corta) se
            // construye con la key corta, como en subirPdf.
            url: this.construirUrl(this.keyCorta(obj.Key)),
          });
        }
      }

      continuationToken = page.IsTruncated
        ? page.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return resultado;
  }

  /**
   * Elimina objetos del Space (por lotes de hasta 1000).
   */
  async eliminarPdfs(keys: string[]): Promise<void> {
    const TAMANO_LOTE = 1000;
    for (let i = 0; i < keys.length; i += TAMANO_LOTE) {
      const lote = keys.slice(i, i + TAMANO_LOTE);
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: lote.map((Key) => ({ Key })) },
        }),
      );
    }
  }
}
