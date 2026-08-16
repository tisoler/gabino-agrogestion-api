import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-custom";
import { ExtractJwt } from "passport-jwt";
import * as admin from "firebase-admin";
import serviceAccount from "../../../firebase-service-account.json";
import { Roles } from "src/constantes";
import { FirestoreCacheService } from "../../cache/firestore-cache.service";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as any),
    projectId: "gabino-agrogestion",
  });
}

@Injectable()
export class FirebaseStrategy extends PassportStrategy(Strategy, "firebase") {
  constructor(private readonly cache: FirestoreCacheService) {
    super();
  }

  async validate(req: any): Promise<any> {
    const fn = ExtractJwt.fromAuthHeaderAsBearerToken();
    const token = fn(req);

    if (!token) {
      throw new UnauthorizedException("Token no proporcionado");
    }
    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      const uid = decodedUser.uid;

      // Datos del usuario (idEmpresas + roles + permisos) cacheados por UID.
      const authData = await this.cache.getOrLoadAuth(uid);
      if (!authData) {
        throw new UnauthorizedException(
          "Usuario no configurado en el sistema (UID no encontrado en Firestore)",
        );
      }

      const { idEmpresas, roles, permisos } = authData;

      const isAsesor = roles.includes(Roles.ASESOR);
      const isAdmin =
        roles.includes(Roles.SYS_ADMIN) || roles.includes(Roles.ASESOR_ADMIN);

      // El header x-empresa-id es la "empresa actual" elegida en el FE.
      // Sólo se honra si el usuario la tiene en su idEmpresas (asesor / productor)
      // o si es admin (sys-admin / asesor-admin, puede pedir cualquier empresa).
      const requestedEmpresaId = req.headers["x-empresa-id"];
      let currentEmpresaId: number | null = null;

      if (requestedEmpresaId) {
        const reqId = Number(requestedEmpresaId);
        if (Number.isFinite(reqId) && reqId > 0) {
          if (isAdmin) {
            currentEmpresaId = reqId;
          } else if (isAsesor || roles.includes(Roles.PRODUCTOR)) {
            if (idEmpresas.includes(reqId)) {
              currentEmpresaId = reqId;
            }
          }
        }
      }

      // Fallback a la primera empresa del usuario: sólo para no-admin.
      // Para admin, idEmpresas (si lo tiene poblado) se ignora: el admin
      // trabaja con la admin-toggle y nunca tiene "empresa actual" seleccionada.
      if (!isAdmin && currentEmpresaId === null && idEmpresas.length > 0) {
        currentEmpresaId = idEmpresas[0];
      }

      return {
        id: uid,
        firebaseUid: uid,
        nombreUsuario: decodedUser.email,
        email: decodedUser.email,
        idEmpresas,
        currentEmpresaId,
        roles,
        permisos,
      };
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      console.error("Error en FirebaseStrategy:", e);
      throw new UnauthorizedException("Error al validar token de Firebase");
    }
  }
}
