import { ref, set, push, get, child, update, remove } from "firebase/database";
import { db } from "../firebaseConfig";
import { User, ClassSession, Material, UserRole } from "../types";

// --- UTILS ---
const generateAccessCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
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

export const createStudent = async (username: string, password: string): Promise<boolean> => {
  // Check if username exists
  const snapshot = await get(child(ref(db), 'users'));
  if (snapshot.exists()) {
    const users = snapshot.val();
    const exists = Object.values(users).some((u: any) => u.username === username);
    if (exists) throw new Error("Username already taken");
  }

  const userRef = push(ref(db, 'users'));
  const newUser: User = {
    id: userRef.key as string,
    username,
    password, // Note: In production, hash this!
    role: UserRole.STUDENT,
    joinedClasses: {}
  };

  await set(userRef, newUser);
  return true;
};

export const addMaterialToClass = async (classId: string, title: string, content: string, type: 'note' | 'exercise') => {
  const materialRef = push(ref(db, `classes/${classId}/materials`));
  const newMaterial: Material = {
    id: materialRef.key as string,
    title,
    content,
    type
  };
  await set(materialRef, newMaterial);
};

export const fetchAllClasses = async (): Promise<ClassSession[]> => {
  const snapshot = await get(child(ref(db), 'classes'));
  if (snapshot.exists()) {
    return Object.values(snapshot.val());
  }
  return [];
};

// --- STUDENT API ---

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
  // 1. Find class by code
  const snapshot = await get(child(ref(db), 'classes'));
  if (!snapshot.exists()) throw new Error("No classes found");
  
  const classes = snapshot.val();
  const foundClass = Object.values(classes).find((c: any) => c.accessCode === accessCode) as ClassSession;
  
  if (!foundClass) throw new Error("Invalid Access Code");

  // 2. Add to user's joinedClasses
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
  
  // Fetch all classes then filter (Optimized for small scale)
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