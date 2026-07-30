import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { ExtractJwt } from 'passport-jwt';
import * as admin from 'firebase-admin';
import serviceAccount from '../../../firebase-service-account.json';
import { Roles } from 'src/constantes';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as any),
    projectId: 'gabino-agrogestion',
  });
}

@Injectable()
export class FirebaseStrategy extends PassportStrategy(Strategy, 'firebase') {
  constructor() {
    super();
  }

  async validate(req: any): Promise<any> {
    const fn = ExtractJwt.fromAuthHeaderAsBearerToken();
    const token = fn(req);

    if (!token) {
      throw new UnauthorizedException('Token no proporcionado');
    }
    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      const uid = decodedUser.uid;

      const db = admin.firestore();
      const userDoc = await db.collection('usuarios').doc(uid).get();

      if (!userDoc.exists) {
        throw new UnauthorizedException('Usuario no configurado en el sistema (UID no encontrado en Firestore)');
      }

      const userData = userDoc.data();

      // Permisos del rol
      let permisos: string[] = [];
      let roles: string[] = [];
      const rolId = userData?.idRol;
      if (rolId) {
        const roleDoc = await db.collection('roles').doc(rolId).get();
        const roleData = roleDoc.data();

        if (roleData?.permisos && roleData.permisos.length > 0) {
          const permisosDoc = await db.collection('permisos')
            .where(admin.firestore.FieldPath.documentId(), 'in', roleData.permisos)
            .get();
          permisos = permisosDoc.docs.map(doc => doc.data().nombre || doc.id);
        }
        roles = roleData ? [roleData.nombre] : [];
      }

      // Lista normalizada de empresas del usuario (siempre un array de números)
      const idEmpresas: number[] = Array.isArray(userData?.idEmpresas)
        ? userData.idEmpresas
          .map((e: any) => Number(e))
          .filter((n: number) => Number.isFinite(n) && n > 0)
        : [];

      const isAsesor = roles.includes(Roles.ASESOR);
      const isSysAdmin = roles.includes(Roles.SYS_ADMIN);

      // El header x-empresa-id es la "empresa actual" elegida en el FE.
      // Sólo se honra si el usuario la tiene en su idEmpresas (asesor / productor)
      // o si es sys-admin (puede pedir cualquier empresa).
      const requestedEmpresaId = req.headers['x-empresa-id'];
      let currentEmpresaId: number | null = null;

      if (requestedEmpresaId) {
        const reqId = Number(requestedEmpresaId);
        if (Number.isFinite(reqId) && reqId > 0) {
          if (isSysAdmin) {
            currentEmpresaId = reqId;
          } else if (isAsesor || roles.includes(Roles.PRODUCTOR)) {
            if (idEmpresas.includes(reqId)) {
              currentEmpresaId = reqId;
            }
          }
        }
      }

      // Fallback a la primera empresa del usuario: sólo para no-sys-admin.
      // Para sys-admin, idEmpresas (si lo tiene poblado) se ignora: el sys-admin
      // trabaja con la admin-toggle y nunca tiene "empresa actual" seleccionada.
      if (!isSysAdmin && currentEmpresaId === null && idEmpresas.length > 0) {
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
      console.error('Error en FirebaseStrategy:', e);
      throw new UnauthorizedException('Error al validar token de Firebase');
    }
  }
}
