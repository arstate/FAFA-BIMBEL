export enum UserRole {
  ADMIN = 'ADMIN',
  STUDENT = 'STUDENT'
}

export interface User {
  id: string;
  username: string;
  password?: string; // Only used for verification, strictly typically shouldn't be stored plain text but for this MVP demo it is.
  role: UserRole;
  joinedClasses?: Record<string, boolean>; // map of classId -> true
}

export interface Material {
  id: string;
  title: string;
  content: string; // Text content
  type: 'note' | 'exercise';
}

export interface ClassSession {
  id: string;
  name: string;
  description: string;
  accessCode: string;
  materials?: Record<string, Material>;
}

export interface ViewState {
  currentView: 'LOGIN' | 'ADMIN_DASHBOARD' | 'STUDENT_DASHBOARD' | 'CLASS_DETAIL';
  selectedClassId?: string;
}