import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * OAuth2 client-credentials contra Copernicus Data Space Ecosystem (CDSE).
 * El token tiene expiración corta (lo indica `expires_in`); lo cacheamos en
 * memoria y lo refrescamos antes de que expire. Si faltan credenciales,
 * `getToken()` devuelve null y los servicios de NDVI caen al fallback
 * sin-credenciales (NASA GIBS).
 */
@Injectable()
export class CdseAuthService {
  private readonly logger = new Logger(CdseAuthService.name);
  private token: string | null = null;
  private expiraEn = 0;

  constructor(private readonly config: ConfigService) {}

  get habilitado(): boolean {
    return Boolean(
      this.config.get<string>("CDSE_CLIENT_ID") &&
      this.config.get<string>("CDSE_CLIENT_SECRET"),
    );
  }

  async getToken(): Promise<string | null> {
    const clientId = this.config.get<string>("CDSE_CLIENT_ID");
    const clientSecret = this.config.get<string>("CDSE_CLIENT_SECRET");
    if (!clientId || !clientSecret) return null;

    if (this.token && Date.now() < this.expiraEn) return this.token;

    try {
      const res = await fetch(
        "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!res.ok) {
        this.logger.warn(`CDSE auth respondió ${res.status}`);
        return null;
      }
      const data = (await res.json()) as {
        access_token?: string;
        expires_in?: number;
      };
      if (!data.access_token) return null;
      this.token = data.access_token;
      // margen de 30 s para no usar un token a punto de expirar
      this.expiraEn =
        Date.now() + Math.max(30, (data.expires_in ?? 300) - 30) * 1000;
      return this.token;
    } catch (e) {
      this.logger.warn(`CDSE auth falló: ${(e as Error).message}`);
      return null;
    }
  }
}
