export type AppRole = 'USER' | 'MANAGER' | 'ADMIN';

export type Permission =
  | 'time.view'
  | 'time.create'
  | 'time.lock'
  | 'directories.view'
  | 'directories.edit'
  | 'directories.delete'
  | 'users.manage'
  | 'organization.manage'
  | 'reports.own'
  | 'reports.team'
  | 'reports.all'
  | 'workspaces.manage';

export const roleLabels: Record<AppRole, string> = {
  USER: 'Пользователь',
  MANAGER: 'Менеджер',
  ADMIN: 'Администратор',
};

export const permissionLabels: Record<Permission, string> = {
  'time.view': 'Просмотр учета времени',
  'time.create': 'Создание записей времени',
  'time.lock': 'Открытие и закрытие дат календаря',
  'directories.view': 'Просмотр справочников',
  'directories.edit': 'Создание и редактирование справочников',
  'directories.delete': 'Удаление записей справочников',
  'users.manage': 'Управление пользователями и ролями',
  'organization.manage': 'Управление организациями, подразделениями и должностями',
  'reports.own': 'Просмотр своих отчетов',
  'reports.team': 'Просмотр отчетов команды',
  'reports.all': 'Просмотр всех отчетов',
  'workspaces.manage': 'Управление рабочими областями',
};

export const rolePermissions: Record<AppRole, Permission[]> = {
  USER: ['time.view', 'time.create', 'reports.own'],
  MANAGER: [
    'time.view',
    'time.create',
    'time.lock',
    'directories.view',
    'directories.edit',
    'reports.own',
    'reports.team',
  ],
  ADMIN: [
    'time.view',
    'time.create',
    'time.lock',
    'directories.view',
    'directories.edit',
    'directories.delete',
    'users.manage',
    'organization.manage',
    'reports.own',
    'reports.team',
    'reports.all',
    'workspaces.manage',
  ],
};

export function normalizeRole(role: string | null | undefined): AppRole {
  if (role === 'ADMIN' || role === 'MANAGER' || role === 'USER') {
    return role;
  }

  return 'USER';
}

export function can(role: string | null | undefined, permission: Permission) {
  return rolePermissions[normalizeRole(role)].includes(permission);
}
