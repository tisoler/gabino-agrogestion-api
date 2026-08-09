import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as admin from 'firebase-admin';
import { Lote } from '../entities/lote.entity';
import { Campo } from '../entities/campo.entity';
import { CreateLoteDto } from './dto/create-lote.dto';
import { UpdateLoteDto } from './dto/update-lote.dto';
import { Roles } from 'src/constantes';

@Injectable()
export class LotesService {
  constructor(
    @InjectRepository(Lote)
    private loteRepository: Repository<Lote>,
    @InjectRepository(Campo)
    private campoRepository: Repository<Campo>,
  ) {}

  /**
   * Lista lotes visibles para el usuario.
   *
   *  - sys-admin / asesor-admin: ve todos los lotes (sin filtro de empresa).
   *    Si llega `currentEmpresaId`, filtra a esa empresa concreta.
   *  - asesor / productor: ve los lotes de las empresas en su `idEmpresas`.
   *    Si llega `currentEmpresaId` y está en su `idEmpresas`, filtra a esa.
   *    Si llega una empresa que NO está en su `idEmpresas`, devuelve [].
   *
   * No hay lotes "globales" (la columna `id_empresa` es NOT NULL), por lo
   * que no hay rama para "ver todos sin filtro de empresa" fuera de
   * sys-admin / asesor-admin.
   */
  findAll(user: any, currentEmpresaId?: number) {
    const query = this.loteRepository
      .createQueryBuilder('lote')
      .leftJoinAndSelect('lote.campo', 'campo');
    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN) || user.roles?.includes(Roles.ASESOR_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) => Number(e));

    if (currentEmpresaId) {
      // Filtro por empresa específica
      if (!isAdmin && !userEmpresas.includes(currentEmpresaId)) {
        return [];
      }
      query.andWhere('lote.id_empresa = :currentId', { currentId: currentEmpresaId });
      return this.attachNombreUsuario(query.getMany());
    }

    // Sin filtro: admin ve todo; el resto ve los de sus idEmpresas
    if (isAdmin) {
      return this.attachNombreUsuario(query.getMany());
    }

    if (userEmpresas.length === 0) {
      return [];
    }

    return this.attachNombreUsuario(
      query
        .andWhere('lote.id_empresa IN (:...ids)', { ids: userEmpresas })
        .getMany(),
    );
  }

  async findOne(id: number) {
    const lote = await this.loteRepository.findOne({ where: { id }, relations: ['campo'] });
    if (!lote) throw new NotFoundException('Lote no encontrado');
    return (await this.attachNombreUsuario(Promise.resolve([lote])))[0];
  }

  /**
   * Completa `nombreUsuario` y `emailUsuario` en la respuesta con los datos
   * del dueño desde Firestore (y Firebase Auth para el email), para los lotes
   * que aún no los tienen almacenados (los viejos quedaron con ''). Así la
   * grilla muestra el dueño en la primera carga sin depender del lookup del FE.
   */
  private attachNombreUsuario(lotesPromise: Promise<Lote[]>): Promise<Lote[]> {
    return lotesPromise.then(async (lotes) => {
      if (lotes.length === 0) return lotes;

      const uids = Array.from(new Set(lotes.map((l) => l.idUsuario).filter(Boolean)));
      if (uids.length === 0) return lotes;

      try {
        const db = admin.firestore();
        const nameByUid = new Map<string, string>();
        const emailByUid = new Map<string, string>();
        const missingEmail: string[] = [];

        for (let i = 0; i < uids.length; i += 100) {
          const chunk = uids.slice(i, i + 100);
          const refs = chunk.map((uid) => db.collection('usuarios').doc(uid));
          const snaps = await db.getAll(...refs);
          for (const snap of snaps) {
            if (!snap.exists) continue;
            const data = snap.data() || {};
            const nombre = data?.nombre ?? data?.nombreUsuario ?? '';
            if (typeof nombre === 'string' && nombre.trim()) {
              nameByUid.set(snap.id, nombre);
            }
            const email = data?.email;
            if (typeof email === 'string' && email.trim()) {
              emailByUid.set(snap.id, email);
            } else {
              missingEmail.push(snap.id);
            }
          }
        }

        // Email: Firebase Auth es la fuente de verdad si falta en Firestore.
        if (missingEmail.length > 0) {
          for (let i = 0; i < missingEmail.length; i += 100) {
            const chunk = missingEmail.slice(i, i + 100);
            try {
              const res = await admin.auth().getUsers(chunk.map((uid) => ({ uid })));
              for (const rec of res.users) {
                if (rec.email) emailByUid.set(rec.uid, rec.email);
              }
            } catch {
              // Si falla el batch de Auth, seguimos sin ese dato.
            }
          }
        }

        for (const lote of lotes) {
          if (!lote.nombreUsuario) {
            lote.nombreUsuario = nameByUid.get(lote.idUsuario) || '';
          }
          if (!lote.emailUsuario) {
            lote.emailUsuario = emailByUid.get(lote.idUsuario) || '';
          }
        }
      } catch (err) {
        console.warn('[lotes] No se pudo enriquecer con datos del dueño:', err);
      }

      return lotes;
    });
  }

  async create(createLoteDto: CreateLoteDto, user: any, currentEmpresaId?: number) {
    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN) || user.roles?.includes(Roles.ASESOR_ADMIN);

    let idEmpresa: number;
    if (isAdmin) {
      if (!createLoteDto.idEmpresa) {
        throw new BadRequestException('Debe indicar la empresa destino del lote');
      }
      idEmpresa = createLoteDto.idEmpresa;
    } else {
      const target = createLoteDto.idEmpresa ?? currentEmpresaId;
      if (!target) {
        throw new BadRequestException('El usuario no tiene una empresa actual seleccionada');
      }
      const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) => Number(e));
      if (!userEmpresas.includes(target)) {
        throw new ForbiddenException('No tiene permisos para crear un lote en esa empresa');
      }
      idEmpresa = target;
    }

    // El campo debe pertenecer a la empresa del lote.
    if (createLoteDto.idCampo != null) {
      const campo = await this.campoRepository.findOne({ where: { id: createLoteDto.idCampo } });
      if (!campo) throw new BadRequestException('El campo indicado no existe');
      if (campo.idEmpresa !== null && campo.idEmpresa !== idEmpresa) {
        throw new BadRequestException('El campo no pertenece a la empresa del lote');
      }
    }

    const lote = this.loteRepository.create({
      descripcion: createLoteDto.descripcion,
      idCampo: createLoteDto.idCampo ?? null,
      idUsuario: createLoteDto.idUsuario,
      nombreUsuario: createLoteDto.nombreUsuario ?? '',
      emailUsuario: createLoteDto.emailUsuario ?? '',
      lat: createLoteDto.lat,
      long: createLoteDto.long,
      idEmpresa,
    });
    return this.loteRepository.save(lote);
  }

  async update(id: number, updateLoteDto: UpdateLoteDto, user: any) {
    const lote = await this.loteRepository.findOne({ where: { id } });
    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }

    const isAdmin = user.roles?.includes(Roles.SYS_ADMIN) || user.roles?.includes(Roles.ASESOR_ADMIN);
    const userEmpresas: number[] = (user.idEmpresas || []).map((e: any) => Number(e));

    if (!isAdmin && !userEmpresas.includes(lote.idEmpresa)) {
      throw new ForbiddenException('No tiene permisos para editar un lote de otra empresa');
    }

    if (updateLoteDto.idEmpresa && updateLoteDto.idEmpresa !== lote.idEmpresa) {
      if (!isAdmin) {
        throw new ForbiddenException('Solo el sys-admin puede cambiar la empresa de un lote');
      }
    }

    if (updateLoteDto.idCampo !== undefined && updateLoteDto.idCampo !== lote.idCampo) {
      if (updateLoteDto.idCampo != null) {
        const campo = await this.campoRepository.findOne({ where: { id: updateLoteDto.idCampo } });
        if (!campo) throw new BadRequestException('El campo indicado no existe');
        if (campo.idEmpresa !== null && campo.idEmpresa !== lote.idEmpresa) {
          throw new BadRequestException('El campo no pertenece a la empresa del lote');
        }
      }
    }

    Object.assign(lote, updateLoteDto);
    return this.loteRepository.save(lote);
  }
}
