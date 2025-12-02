
export enum UserRole {
  ADMIN = 'ADMIN',
  STUDENT = 'STUDENT'
}

export interface User {
  id: string;
  username: string;
  password?: string;
  role: UserRole;
  joinedClasses?: Record<string, boolean>;
  isOnline?: boolean;
  lastActive?: number;
}

export type QuestionType = 'multiple_choice' | 'essay';

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[]; // Untuk multiple choice
  correctAnswer?: string; // Kunci jawaban (opsional untuk essay manual check)
  score: number;
}

export interface WeekItem {
  id: string;
  title: string;
  content: string; // Materi teks atau deskripsi kuis
  type: 'material' | 'quiz';
  previewText?: string; // Teks preview di thumbnail
  
  // Khusus Quiz
  durationMinutes?: number;
  questions?: Record<string, Question>; 
}

export interface Week {
  id: string;
  title: string; // e.g., "Minggu 1"
  description: string;
  items?: Record<string, WeekItem>;
}

export interface ClassSession {
  id: string;
  name: string;
  description: string;
  accessCode: string;
  weeks?: Record<string, Week>;
}

export interface Comment {
  id: string;
  senderId: string;
  senderName: string;
  role: UserRole;
  text: string;
  timestamp: number;
}

export interface ViewState {
  currentView: 'LOGIN' | 'ADMIN_DASHBOARD' | 'STUDENT_DASHBOARD' | 'CLASS_DETAIL' | 'WEEK_DETAIL' | 'TAKE_QUIZ';
  selectedClassId?: string;
  selectedWeekId?: string;
  selectedQuizId?: string; // Sedang mengerjakan kuis apa
}
