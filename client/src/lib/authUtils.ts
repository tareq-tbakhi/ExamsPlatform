export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  TEACHER_SUPERVISOR: 'teacher_supervisor', 
  TEACHER: 'teacher',
  STUDENT: 'student'
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

export function hasPermission(userRole: string, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(userRole as UserRole);
}

export function isSuperAdmin(userRole: string): boolean {
  return userRole === ROLES.SUPER_ADMIN;
}

export function isAdmin(userRole: string): boolean {
  return hasPermission(userRole, [ROLES.SUPER_ADMIN, ROLES.ADMIN]);
}

export function isTeacherOrAbove(userRole: string): boolean {
  return hasPermission(userRole, [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER_SUPERVISOR, ROLES.TEACHER]);
}

export function isSupervisorOrAbove(userRole: string): boolean {
  return hasPermission(userRole, [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER_SUPERVISOR]);
}