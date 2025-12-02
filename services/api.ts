

import { ref, set, push, get, child, update, remove, onDisconnect, onValue, serverTimestamp } from "firebase/database";
import { db } from "../firebaseConfig";
import { User, ClassSession, UserRole, Week, WeekItem, Question, Comment, QuizResult } from "../types";

// --- UTILS ---
const generateAccessCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// --- PRESENCE SYSTEM ---
export const initPresence = (userId: string) => {
  const userStatusDatabaseRef = ref(db, `/users/${userId}`);
  const connectedRef = ref(db, '.info/connected');

  onValue(connectedRef, (snapshot) => {
    if (snapshot.val() === false) {
      return;
    }
    
    // Jika disconnect (tutup tab), set offline
    onDisconnect(userStatusDatabaseRef).update({
      isOnline: false,
      lastActive: serverTimestamp()
    }).then(() => {
      // Jika connect, set online
      update(userStatusDatabaseRef, {
        isOnline: true,
        lastActive: serverTimestamp()
      });
    });
  });
};

// --- ADMIN API ---

export const createClass = async (name: string, description: string): Promise<string> => {
  const classRef = push(ref(db, 'classes'));
  const newClassId = classRef.key as string;
  const accessCode = generateAccessCode();
  
  const newClass: ClassSession = {
    id: newClassId,
    name,
    description,
    accessCode,
  };

  await set(classRef, newClass);
  return accessCode;
};

export const fetchAllUsers = async (): Promise<User[]> => {
  const snapshot = await get(child(ref(db), 'users'));
  if (snapshot.exists()) {
    return Object.values(snapshot.val());
  }
  return [];
};

export const deleteUser = async (userId: string) => {
  await remove(ref(db, `users/${userId}`));
};

export const createStudent = async (username: string, password: string): Promise<boolean> => {
  const snapshot = await get(child(ref(db), 'users'));
  if (snapshot.exists()) {
    const users = snapshot.val();
    const exists = Object.values(users).some((u: any) => u.username === username);
    if (exists) throw new Error("Username sudah dipakai!");
  }

  const userRef = push(ref(db, 'users'));
  const newUser: User = {
    id: userRef.key as string,
    username,
    password, 
    role: UserRole.STUDENT,
    joinedClasses: {}
  };

  await set(userRef, newUser);
  return true;
};

// --- CONTENT MANAGEMENT (WEEKS & ITEMS) ---

export const addWeekToClass = async (classId: string, title: string, description: string) => {
  const weekRef = push(ref(db, `classes/${classId}/weeks`));
  const newWeek: Week = {
    id: weekRef.key as string,
    title,
    description
  };
  await set(weekRef, newWeek);
};

export const addItemToWeek = async (
  classId: string, 
  weekId: string, 
  item: Omit<WeekItem, 'id'>
) => {
  const itemRef = push(ref(db, `classes/${classId}/weeks/${weekId}/items`));
  const newItem: WeekItem = {
    ...item,
    id: itemRef.key as string
  };
  await set(itemRef, newItem);
};

export const addQuestionToQuiz = async (
  classId: string,
  weekId: string,
  quizId: string,
  question: Omit<Question, 'id'>
) => {
  const qRef = push(ref(db, `classes/${classId}/weeks/${weekId}/items/${quizId}/questions`));
  const newQ: Question = {
    ...question,
    id: qRef.key as string
  };
  await set(qRef, newQ);
};

// --- QUIZ RESULTS ---

export const submitQuizResult = async (
  classId: string,
  weekId: string,
  quizId: string,
  result: QuizResult
) => {
  // Simpan di: classes/{classId}/weeks/{weekId}/items/{quizId}/results/{studentId}
  const resultRef = ref(db, `classes/${classId}/weeks/${weekId}/items/${quizId}/results/${result.studentId}`);
  await set(resultRef, result);
};

export const hasStudentTakenQuiz = async (
  classId: string,
  weekId: string,
  quizId: string,
  studentId: string
): Promise<QuizResult | null> => {
  const snapshot = await get(child(ref(db), `classes/${classId}/weeks/${weekId}/items/${quizId}/results/${studentId}`));
  if (snapshot.exists()) {
    return snapshot.val() as QuizResult;
  }
  return null;
};

export const fetchQuizResults = async (
  classId: string,
  weekId: string,
  quizId: string
): Promise<QuizResult[]> => {
  const snapshot = await get(child(ref(db), `classes/${classId}/weeks/${weekId}/items/${quizId}/results`));
  if (snapshot.exists()) {
    return Object.values(snapshot.val());
  }
  return [];
};

// --- COMMENTS ---

export const sendComment = async (
  classId: string, 
  weekId: string, 
  itemId: string, 
  studentId: string, // Thread ID (tiap siswa punya thread sendiri dgn guru)
  comment: Omit<Comment, 'id'>
) => {
  const commentRef = push(ref(db, `classes/${classId}/weeks/${weekId}/items/${itemId}/comments/${studentId}`));
  const newComment: Comment = {
    ...comment,
    id: commentRef.key as string
  };
  await set(commentRef, newComment);
};

export const subscribeToComments = (
  classId: string, 
  weekId: string, 
  itemId: string, 
  studentId: string,
  callback: (comments: Comment[]) => void
) => {
  const commentsRef = ref(db, `classes/${classId}/weeks/${weekId}/items/${itemId}/comments/${studentId}`);
  return onValue(commentsRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(Object.values(snapshot.val()));
    } else {
      callback([]);
    }
  });
};

export const fetchAllStudentThreads = async (classId: string, weekId: string, itemId: string) => {
  const snapshot = await get(child(ref(db), `classes/${classId}/weeks/${weekId}/items/${itemId}/comments`));
  if (snapshot.exists()) {
    return snapshot.val(); // Returns object { studentId: { commentId: Comment } }
  }
  return {};
};

// --- DATA FETCHING ---

export const fetchAllClasses = async (): Promise<ClassSession[]> => {
  const snapshot = await get(child(ref(db), 'classes'));
  if (snapshot.exists()) {
    return Object.values(snapshot.val());
  }
  return [];
};

export const loginStudent = async (username: string, password: string): Promise<User | null> => {
  const snapshot = await get(child(ref(db), 'users'));
  if (snapshot.exists()) {
    const users = snapshot.val();
    const user = Object.values(users).find((u: any) => u.username === username && u.password === password) as User;
    return user || null;
  }
  return null;
};

export const joinClass = async (userId: string, accessCode: string): Promise<string> => {
  const snapshot = await get(child(ref(db), 'classes'));
  if (!snapshot.exists()) throw new Error("Tidak ada kelas ditemukan");
  
  const classes = snapshot.val();
  const foundClass = Object.values(classes).find((c: any) => c.accessCode === accessCode) as ClassSession;
  
  if (!foundClass) throw new Error("Kode Akses Salah");

  await update(ref(db, `users/${userId}/joinedClasses`), {
    [foundClass.id]: true
  });

  return foundClass.name;
};

export const fetchMyClasses = async (userId: string): Promise<ClassSession[]> => {
  const userSnapshot = await get(child(ref(db), `users/${userId}`));
  if (!userSnapshot.exists()) return [];
  
  const userData = userSnapshot.val() as User;
  if (!userData.joinedClasses) return [];

  const classIds = Object.keys(userData.joinedClasses);
  
  const classesSnapshot = await get(child(ref(db), 'classes'));
  if (!classesSnapshot.exists()) return [];
  
  const allClasses = classesSnapshot.val();
  return classIds.map(id => allClasses[id]).filter(Boolean);
};

export const fetchClassDetails = async (classId: string): Promise<ClassSession | null> => {
  const snapshot = await get(child(ref(db), `classes/${classId}`));
  if (snapshot.exists()) {
    return snapshot.val();
  }
  return null;
};