export const Roles = {
  SYS_ADMIN: 'sys-admin',
  ASESOR: 'asesor',
  ASESOR_ADMIN: 'asesor-admin',
  PRODUCTOR: 'productor',
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];
