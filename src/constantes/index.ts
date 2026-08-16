export const Roles = {
  SYS_ADMIN: 'sys-admin',
  ASESOR: 'asesor',
  ASESOR_ADMIN: 'asesor-admin',
  PRODUCTOR: 'productor',
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

/**
 * idRol por defecto para usuarios nuevos (roles/{id}.nombre en Firestore).
 * El FE pide al BE crear el doc del usuario al registrarse con este rol.
 */
export const ID_ROL_PREDETERMINADO = 4;
