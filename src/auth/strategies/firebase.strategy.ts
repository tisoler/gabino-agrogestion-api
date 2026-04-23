import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { ExtractJwt } from 'passport-jwt';
import * as admin from 'firebase-admin';
import { EmpresasService } from '../../empresas/empresas.service';
import serviceAccount from '../../../firebase-service-account.json';
import { Roles } from 'src/constantes';

// Inicializar la app si no ha sido inicializada
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as any),
    projectId: 'gabino-agrogestion',
  });
}

@Injectable()
export class FirebaseStrategy extends PassportStrategy(Strategy, 'firebase') {
  constructor(
    private empresasService: EmpresasService,
  ) {
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

      // Consultar datos adicionales en Firestore
      const db = admin.firestore();
      const userDoc = await db.collection('usuarios').doc(uid).get();

      if (!userDoc.exists) {
        throw new UnauthorizedException('Usuario no configurado en el sistema (UID no encontrado en Firestore)');
      }

      const userData = userDoc.data();
      const rolId = userData?.idRol;
      const idEmpresa = userData?.idEmpresa || (userData?.idEmpresas?.length && userData?.idEmpresas?.[0]);

      // Consultar permisos del rol
      let permisos: string[] = [];
      let roles: string[] = [];

      if (rolId) {
        const roleDoc = await db.collection('roles').doc(rolId).get();
        const roleData = roleDoc.data();

        if (roleData?.permisos && roleData.permisos.length > 0) {
          const permisosDoc = await db.collection('permisos')
            .where(admin.firestore.FieldPath.documentId(), 'in', roleData.permisos)
            .get();
          permisos = permisosDoc.docs.map(doc => doc.data().nombre || doc.id);
        }
        roles = [roleData.nombre];
      }

      const empresa = idEmpresa ? await this.empresasService.findOne(idEmpresa) : null;

      const isAsesor = roles.includes(Roles.ASESOR);
      const requestedEmpresaId = req.headers['x-empresa-id'];

      let finalIdEmpresa = idEmpresa;
      let finalNombreEmpresa = empresa?.nombre || null;

      if (requestedEmpresaId && isAsesor) {
        const reqId = parseInt(requestedEmpresaId, 10);
        if (isAsesor && userData?.idEmpresas?.includes(reqId)) {
          finalIdEmpresa = reqId;
          const reqEmpresa = await this.empresasService.findOne(reqId);
          finalNombreEmpresa = reqEmpresa?.nombre || null;
        }
      }
      // Devolver un objeto de usuario enriquecido con Firestore y Firebase Auth
      return {
        id: uid,
        firebaseUid: uid,
        nombreUsuario: decodedUser.email,
        email: decodedUser.email,
        idEmpresa: finalIdEmpresa,
        nombreEmpresa: finalNombreEmpresa,
        idEmpresas: userData?.idEmpresas || [], // Lista de empresas para asesores
        roles: roles,
        permisos: permisos,
      };
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      console.error('Error en FirebaseStrategy:', e);
      throw new UnauthorizedException('Error al validar token de Firebase');
    }
  }
}
