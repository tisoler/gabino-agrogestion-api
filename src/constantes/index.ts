export const Roles = {
  SYS_ADMIN: 'sys-admin',
  ASESOR: 'asesor',
  PRODUCTOR: 'productor',
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];
