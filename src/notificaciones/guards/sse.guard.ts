import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Roles } from 'src/constantes';

/**
 * Guard para el endpoint SSE de notificaciones.
 *
 * EventSource (nativo del browser) no permite enviar headers personalizados,
 * por eso el token de Firebase viaja como query param (?token=). Verifica el
 * token y arma un usuario mínimo (uid + roles + idEmpresas) como los demás
 * endpoints, sólo que sin permisos (no se aplican aquí).
 */
@Injectable()
export class FirebaseSseGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = req.query?.token;
    if (typeof token !== 'string' || token === '') {
      throw new UnauthorizedException('Token no proporcionado');
    }

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      const uid = decodedUser.uid;

      const db = admin.firestore();
      const userDoc = await db.collection('usuarios').doc(uid).get();
      if (!userDoc.exists) {
        throw new UnauthorizedException('Usuario no configurado en el sistema');
      }
      const userData = userDoc.data();

      let roles: string[] = [];
      const rolId = userData?.idRol;
      if (rolId) {
        const roleDoc = await db.collection('roles').doc(rolId).get();
        const roleData = roleDoc.data();
        roles = roleData ? [roleData.nombre] : [];
      }

      const idEmpresas: number[] = Array.isArray(userData?.idEmpresas)
        ? userData.idEmpresas
          .map((e: any) => Number(e))
          .filter((n: number) => Number.isFinite(n) && n > 0)
        : [];

      req.user = {
        id: uid,
        firebaseUid: uid,
        nombreUsuario: decodedUser.email,
        email: decodedUser.email,
        idEmpresas,
        roles,
        permisos: [],
      };
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      console.error('Error en FirebaseSseGuard:', e);
      throw new UnauthorizedException('Error al validar token de Firebase');
    }
  }
}
