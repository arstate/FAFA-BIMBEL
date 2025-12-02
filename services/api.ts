import { ref, set, push, get, child, update, remove, onDisconnect, onValue, serverTimestamp } from "firebase/database";
import { db } from "../firebaseConfig";
import { User, ClassSession, UserRole, Week, WeekItem, Question, Comment, QuizResult } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

// --- SYSTEM CONFIG (API KEY) ---

export const saveGeminiApiKey = async (apiKey: string) => {
  await set(ref(db, 'config/geminiApiKey'), apiKey);
};

export const getGeminiApiKey = async (): Promise<string | null> => {
  const snapshot = await get(child(ref(db), 'config/geminiApiKey'));
  if (snapshot.exists()) {
    return snapshot.val();
  }
  return null;
};

export const testGeminiConnection = async (apiKey: string): Promise<{ success: boolean; message: string }> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    // Test prompt with conversational response
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Halo! Sapa saya sebagai asisten guru dengan antusias dalam satu kalimat pendek.',
    });
    return { success: true, message: response.text || "Tidak ada teks balasan." };
  } catch (error: any) {
    console.error("Gemini Connection Test Failed:", error);
    return { success: false, message: error.message || "Terjadi kesalahan koneksi." };
  }
};

// --- AI CONFIG ---

export const assessQuizWithAI = async (
  questions: Question[], 
  studentAnswers: Record<string, string>,
  detailLevel: 'brief' | 'detailed'
): Promise<Record<string, string>> => {
  try {
    // 1. Fetch API Key from Database
    const apiKey = await getGeminiApiKey();
    
    if (!apiKey) {
      console.warn("AI Assessment skipped: No API Key found in database.");
      return {};
    }

    // 2. Initialize with stored key
    const ai = new GoogleGenAI({ apiKey });
    
    // Construct the prompt
    let promptText = `Anda adalah guru privat yang teliti. Koreksi jawaban siswa berikut.\n`;
    promptText += `Berikan komentar koreksi yang ${detailLevel === 'brief' ? 'SINGKAT, PADAT, JELAS (maks 2 kalimat)' : 'DETAIL, MENJELASKAN KENAPA SALAH/BENAR, DAN KONSEPNYA'}.\n`;
    promptText += `Gunakan Bahasa Indonesia.\n\n`;

    questions.forEach((q, index) => {
      promptText += `ID Soal: ${q.id}\n`;
      promptText += `Soal ${index + 1} (${q.type}): "${q.text}"\n`;
      if (q.type === 'multiple_choice' && q.options) {
        promptText += `Pilihan: ${q.options.join(', ')}\n`;
        promptText += `Kunci Jawaban: ${q.correctAnswer}\n`;
      }
      promptText += `Jawaban Siswa: "${studentAnswers[q.id] || '(Kosong)'}"\n\n`;
    });

    // 3. Use Gemini 2.5 Flash Lite with structured output
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              questionId: { type: Type.STRING },
              feedback: { type: Type.STRING }
            },
            required: ["questionId", "feedback"]
          }
        }
      }
    });
    
    const jsonStr = response.text || "[]";
    const parsed = JSON.parse(jsonStr);
    
    const result: Record<string, string> = {};
    if (Array.isArray(parsed)) {
      parsed.forEach((item: any) => {
        if (item.questionId && item.feedback) {
          result[item.questionId] = item.feedback;
        }
      });
    }
    
    return result;

  } catch (error) {
    console.error("AI Error:", error);
    return {};
  }
};


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

export const fetchAllClasses = async (): Promise<ClassSession[]> => {
  const snapshot = await get(child(ref(db), 'classes'));
  if (snapshot.exists()) {
    return Object.values(snapshot.val());
  }
  return [];
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

export const deleteQuestionFromQuiz = async (
  classId: string,
  weekId: string,
  quizId: string,
  questionId: string
) => {
  await remove(ref(db, `classes/${classId}/weeks/${weekId}/items/${quizId}/questions/${questionId}`));
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