import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import * as admin from "firebase-admin";
import { FirestoreCacheService } from "../../cache/firestore-cache.service";

/**
 * Guard para el endpoint SSE de notificaciones.
 *
 * EventSource (nativo del browser) no permite enviar headers personalizados,
 * por eso el token de Firebase viaja como query param (?token=). Verifica el
 * token y arma un usuario mínimo (uid + roles + idEmpresas) como los demás
 * endpoints, sólo que sin permisos (no se aplican aquí).
 *
 * Los datos del usuario se sirven desde el cache (FirestoreCacheService).
 */
@Injectable()
export class FirebaseSseGuard implements CanActivate {
  constructor(private readonly cache: FirestoreCacheService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = req.query?.token;
    if (typeof token !== "string" || token === "") {
      throw new UnauthorizedException("Token no proporcionado");
    }

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      const uid = decodedUser.uid;

      const authData = await this.cache.getOrLoadAuth(uid);
      if (!authData) {
        throw new UnauthorizedException("Usuario no configurado en el sistema");
      }

      req.user = {
        id: uid,
        firebaseUid: uid,
        nombreUsuario: decodedUser.email,
        email: decodedUser.email,
        idEmpresas: authData.idEmpresas,
        roles: authData.roles,
        permisos: [],
      };
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      console.error("Error en FirebaseSseGuard:", e);
      throw new UnauthorizedException("Error al validar token de Firebase");
    }
  }
}
