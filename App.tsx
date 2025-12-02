import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  UserRole, 
  ViewState, 
  ClassSession,
  Week,
  WeekItem,
  Question,
  Comment,
  QuizResult
} from './types';
import { NeoButton, NeoInput, NeoCard, NeoTextArea, NeoBadge } from './components/NeoUI';
import * as API from './services/api';
import { db } from './firebaseConfig'; // Direct import for realtime listener in component if needed
import { ref, onValue } from 'firebase/database';
import { 
  BookOpen, 
  LogOut, 
  Plus, 
  Users, 
  School, 
  ArrowRight,
  Folder,
  FileText,
  MessageCircle,
  Clock,
  CheckCircle,
  Trash2,
  Circle,
  PlayCircle,
  BarChart2,
  XCircle,
  Bot,
  Loader2
} from 'lucide-react';

const ADMIN_PASSWORD = '1509';

const App: React.FC = () => {
  // --- STATE ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [viewState, setViewState] = useState<ViewState>({ currentView: 'LOGIN' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- ADMIN STATE ---
  const [adminClasses, setAdminClasses] = useState<ClassSession[]>([]);
  const [allStudents, setAllStudents] = useState<User[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');
  const [newStudentUser, setNewStudentUser] = useState('');
  const [newStudentPass, setNewStudentPass] = useState('');
  const [adminTab, setAdminTab] = useState<'CLASSES' | 'STUDENTS'>('CLASSES');
  
  // --- CLASS & CONTENT STATE ---
  const [currentClass, setCurrentClass] = useState<ClassSession | null>(null);
  const [currentWeek, setCurrentWeek] = useState<Week | null>(null);
  
  // Forms for Content
  const [newWeekTitle, setNewWeekTitle] = useState('');
  const [newWeekDesc, setNewWeekDesc] = useState('');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDesc, setNewItemDesc] = useState(''); // Content/Quiz Desc
  const [newItemPreview, setNewItemPreview] = useState('');
  const [newItemType, setNewItemType] = useState<'material' | 'quiz'>('material');
  const [quizDuration, setQuizDuration] = useState(15);
  // AI Config State
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiDetailLevel, setAiDetailLevel] = useState<'brief' | 'detailed'>('brief');

  // --- QUIZ & QUESTIONS STATE ---
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [newQText, setNewQText] = useState('');
  const [newQType, setNewQType] = useState<'multiple_choice' | 'essay'>('multiple_choice');
  const [newQOptions, setNewQOptions] = useState<string[]>(['', '', '', '']);
  const [newQCorrect, setNewQCorrect] = useState('');
  const [newQScore, setNewQScore] = useState(10);
  
  // Student taking quiz
  const [quizTimer, setQuizTimer] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);

  // Teacher viewing report
  const [reportQuizId, setReportQuizId] = useState<string | null>(null);
  const [reportResults, setReportResults] = useState<QuizResult[]>([]);

  // --- COMMENTS STATE ---
  const [activeComments, setActiveComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [selectedStudentThread, setSelectedStudentThread] = useState<string | null>(null); // For admin to pick which student chat to see
  const [studentThreads, setStudentThreads] = useState<Record<string, any>>({}); // For admin to list students who commented

  // --- STUDENT STATE ---
  const [joinCode, setJoinCode] = useState('');
  const [myClasses, setMyClasses] = useState<ClassSession[]>([]);
  
  // --- LOGIN STATE ---
  const [loginMode, setLoginMode] = useState<'STUDENT' | 'ADMIN'>('STUDENT');
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // --- EFFECTS ---
  
  // Presence & Hash
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#/admin') setLoginMode('ADMIN');
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Update Online Status
  useEffect(() => {
    if (currentUser?.id) {
      API.initPresence(currentUser.id);
    }
  }, [currentUser]);

  // Data Loading based on View
  useEffect(() => {
    if (viewState.currentView === 'ADMIN_DASHBOARD') {
      loadAdminData();
      // Realtime listener for students status
      const usersRef = ref(db, 'users');
      const unsub = onValue(usersRef, (snapshot) => {
        if (snapshot.exists()) setAllStudents(Object.values(snapshot.val()));
      });
      return () => unsub();
    } else if (viewState.currentView === 'STUDENT_DASHBOARD' && currentUser) {
      loadStudentData();
    } else if (viewState.currentView === 'CLASS_DETAIL' && viewState.selectedClassId) {
      loadClassDetail(viewState.selectedClassId);
    } else if (viewState.currentView === 'WEEK_DETAIL' && viewState.selectedClassId && viewState.selectedWeekId) {
      loadWeekDetail(viewState.selectedClassId, viewState.selectedWeekId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewState.currentView, viewState.selectedClassId, viewState.selectedWeekId, currentUser]);

  // Timer for Quiz
  useEffect(() => {
    let interval: any;
    if (viewState.currentView === 'TAKE_QUIZ' && quizTimer > 0) {
      interval = setInterval(() => {
        setQuizTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleSubmitQuiz(); // Auto submit
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [viewState.currentView, quizTimer]);

  // --- ACTIONS ---

  const handleLogout = () => {
    setCurrentUser(null);
    setViewState({ currentView: 'LOGIN' });
    setLoginPass('');
    setLoginUser('');
    setError(null);
  };

  const loadAdminData = async () => {
    try {
      const classes = await API.fetchAllClasses();
      setAdminClasses(classes);
      const students = await API.fetchAllUsers();
      setAllStudents(students);
    } catch (e) { console.error(e); }
  };

  const loadStudentData = async () => {
    if (!currentUser) return;
    try {
      const classes = await API.fetchMyClasses(currentUser.id);
      setMyClasses(classes);
    } catch (e) { console.error(e); }
  };

  const loadClassDetail = async (id: string) => {
    setIsLoading(true);
    try {
      const cls = await API.fetchClassDetails(id);
      setCurrentClass(cls);
    } catch (e) { console.error(e); } 
    finally { setIsLoading(false); }
  };

  const loadWeekDetail = async (classId: string, weekId: string) => {
    // Re-fetch class to get latest week data
    const cls = await API.fetchClassDetails(classId);
    if (cls && cls.weeks && cls.weeks[weekId]) {
      setCurrentClass(cls);
      setCurrentWeek(cls.weeks[weekId]);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (loginMode === 'ADMIN') {
        if (loginPass === ADMIN_PASSWORD) {
          const adminUser: User = { id: 'admin', username: 'Guru/Admin', role: UserRole.ADMIN };
          setCurrentUser(adminUser);
          setViewState({ currentView: 'ADMIN_DASHBOARD' });
        } else {
          setError('Password Admin Salah!');
        }
      } else {
        const user = await API.loginStudent(loginUser, loginPass);
        if (user) {
          setCurrentUser(user);
          setViewState({ currentView: 'STUDENT_DASHBOARD' });
        } else {
          setError('Username atau Password salah.');
        }
      }
    } catch (err) {
      setError('Gagal Login. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName) return;
    setIsLoading(true);
    try {
      await API.createClass(newClassName, newClassDesc);
      setNewClassName('');
      setNewClassDesc('');
      await loadAdminData();
      alert("Kelas Berhasil Dibuat!");
    } catch (err) { alert("Gagal membuat kelas"); } 
    finally { setIsLoading(false); }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentUser || !newStudentPass) return;
    setIsLoading(true);
    try {
      await API.createStudent(newStudentUser, newStudentPass);
      setNewStudentUser('');
      setNewStudentPass('');
      alert("Akun Siswa Berhasil Dibuat!");
    } catch (err: any) {
      alert(err.message || "Gagal membuat siswa");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus akun siswa ini selamanya?")) {
      await API.deleteUser(studentId);
      loadAdminData();
    }
  };

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !joinCode) return;
    setIsLoading(true);
    try {
      const className = await API.joinClass(currentUser.id, joinCode);
      alert(`Berhasil bergabung ke kelas ${className}!`);
      setJoinCode('');
      await loadStudentData();
    } catch (err: any) {
      setError(err.message || "Gagal gabung kelas");
    } finally {
      setIsLoading(false);
    }
  };

  // --- CONTENT HANDLERS ---

  const handleAddWeek = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClass || !newWeekTitle) return;
    await API.addWeekToClass(currentClass.id, newWeekTitle, newWeekDesc);
    setNewWeekTitle('');
    setNewWeekDesc('');
    await loadClassDetail(currentClass.id);
  };

  const handleAddItemToWeek = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClass || !currentWeek || !newItemTitle) return;
    
    // Construct payload ensuring no undefined values are passed to Firebase
    const newItemPayload: any = {
      title: newItemTitle,
      content: newItemDesc,
      previewText: newItemPreview,
      type: newItemType,
    };

    if (newItemType === 'quiz') {
      newItemPayload.durationMinutes = quizDuration;
      newItemPayload.aiCorrectionEnabled = aiEnabled;
      newItemPayload.aiDetailLevel = aiDetailLevel;
    }
    
    await API.addItemToWeek(currentClass.id, currentWeek.id, newItemPayload);

    setNewItemTitle('');
    setNewItemDesc('');
    setNewItemPreview('');
    setNewItemType('material');
    setAiEnabled(false);
    await loadWeekDetail(currentClass.id, currentWeek.id);
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClass || !currentWeek || !editingQuizId || !newQText) return;

    // Construct payload ensuring no undefined values are passed to Firebase
    const questionPayload: any = {
      text: newQText,
      type: newQType,
      score: newQScore,
      correctAnswer: newQCorrect
    };

    if (newQType === 'multiple_choice') {
      questionPayload.options = newQOptions;
    }

    await API.addQuestionToQuiz(currentClass.id, currentWeek.id, editingQuizId, questionPayload);

    // Reset form
    setNewQText('');
    setNewQCorrect('');
    setNewQOptions(['', '', '', '']);
    alert("Soal ditambahkan!");
    await loadWeekDetail(currentClass.id, currentWeek.id);
  };

  const handleSendComment = async (itemId: string, studentId: string) => {
    if (!newComment || !currentClass || !currentWeek || !currentUser) return;
    
    await API.sendComment(currentClass.id, currentWeek.id, itemId, studentId, {
      senderId: currentUser.id,
      senderName: currentUser.username,
      role: currentUser.role,
      text: newComment,
      timestamp: Date.now()
    });
    setNewComment('');
  };

  const handleStartQuiz = (quizId: string, duration: number) => {
    setViewState({ 
      ...viewState, 
      currentView: 'TAKE_QUIZ', 
      selectedQuizId: quizId 
    });
    setQuizTimer(duration * 60); // minutes to seconds
    setQuizAnswers({});
  };

  const handleSubmitQuiz = async () => {
    if (!currentClass || !currentWeek || !viewState.selectedQuizId || !currentUser) return;
    
    setIsSubmittingQuiz(true);

    try {
        const quizItem = currentWeek.items?.[viewState.selectedQuizId];
        if (!quizItem || !quizItem.questions) return;
        
        const questions = Object.values(quizItem.questions) as Question[];
        let correctCount = 0;

        // Auto grading logic (for MC)
        questions.forEach(q => {
          const studentAns = quizAnswers[q.id];
          if (q.type === 'multiple_choice' && studentAns === q.correctAnswer) {
            correctCount++;
          }
        });

        const totalQuestions = questions.length;
        // Calculate raw score (0-100) based on correct answers (MC only initially)
        const finalScore = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

        // Prepare Payload - SANITIZE UNDEFINED
        const answersPayload: Record<string, string> = {};
        Object.keys(quizAnswers).forEach(key => {
            if (quizAnswers[key]) answersPayload[key] = quizAnswers[key];
        });

        const resultPayload: QuizResult = {
          studentId: currentUser.id,
          studentName: currentUser.username,
          score: finalScore,
          answers: answersPayload, // Use sanitized payload
          timestamp: Date.now()
        };

        // --- AI CORRECTION LOGIC ---
        if (quizItem.aiCorrectionEnabled) {
          const feedback = await API.assessQuizWithAI(
            questions, 
            answersPayload, 
            quizItem.aiDetailLevel || 'brief'
          );
          resultPayload.aiFeedback = feedback;
        }

        await API.submitQuizResult(currentClass.id, currentWeek.id, viewState.selectedQuizId, resultPayload);
        
        alert(`Latihan Selesai! Nilai Anda: ${finalScore} ${quizItem.aiCorrectionEnabled ? '(AI telah mengoreksi jawaban Anda)' : ''}`);
        
        if (currentUser?.role === UserRole.STUDENT) {
          // Reload week to show result
          await loadWeekDetail(currentClass.id, currentWeek.id);
          setViewState({ 
            currentView: 'WEEK_DETAIL', 
            selectedClassId: viewState.selectedClassId, 
            selectedWeekId: viewState.selectedWeekId 
          });
        }
    } catch (e: any) {
        console.error("Submit Error:", e);
        alert("Gagal mengirim jawaban. Pastikan koneksi lancar.");
    } finally {
        setIsSubmittingQuiz(false);
    }
  };

  const handleViewReport = async (quizId: string) => {
    if (!currentClass || !currentWeek) return;
    const results = await API.fetchQuizResults(currentClass.id, currentWeek.id, quizId);
    setReportResults(results);
    setReportQuizId(quizId);
    setViewState({ ...viewState, currentView: 'QUIZ_REPORT', selectedQuizId: quizId });
  };

  // --- HELPER RENDER ---

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatLastActive = (timestamp?: number) => {
    if (!timestamp) return 'Belum pernah aktif';
    const date = new Date(timestamp);
    return date.toLocaleString('id-ID');
  };

  // --- VIEWS ---

  const renderLogin = () => (
    <div className="min-h-screen flex items-center justify-center p-4 bg-yellow-100 font-sans">
      <div className="w-full max-w-md relative">
        <div className="absolute top-0 left-0 w-full h-full bg-black translate-x-2 translate-y-2 z-0"></div>
        <NeoCard className="relative z-10" color="white" title={loginMode === 'ADMIN' ? 'AKSES GURU' : 'LOGIN SISWA'}>
          {error && (
            <div className="bg-red-400 text-white p-3 border-2 border-black font-bold mb-4 flex items-center gap-2">
              <span className="text-xl">!</span> {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {loginMode === 'STUDENT' && (
              <NeoInput 
                label="Username" 
                placeholder="Masukkan username" 
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
              />
            )}
            
            <NeoInput 
              label="Password" 
              type="password" 
              placeholder={loginMode === 'ADMIN' ? 'PIN GURU' : 'Password'} 
              value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)}
            />

            <NeoButton type="submit" variant="accent" size="lg" disabled={isLoading}>
              {isLoading ? 'MEMUAT...' : 'MASUK'}
            </NeoButton>
          </form>

          <div className="mt-6 pt-6 border-t-2 border-dashed border-black text-center">
            <p className="text-sm font-bold text-gray-500 mb-2">SALAH PINTU?</p>
            <button 
              onClick={() => {
                setLoginMode(prev => prev === 'ADMIN' ? 'STUDENT' : 'ADMIN');
                setError(null);
                setLoginPass('');
              }}
              className="text-xs font-black underline hover:text-blue-600 uppercase tracking-widest"
            >
              Ganti ke Mode {loginMode === 'ADMIN' ? 'Siswa' : 'Guru'}
            </button>
          </div>
        </NeoCard>
      </div>
    </div>
  );

  const renderAdminDashboard = () => (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter">
          RUANG<span className="text-blue-500">GURU</span>
        </h1>
        <NeoButton variant="danger" size="sm" onClick={handleLogout} className="flex items-center gap-2">
          <LogOut size={16} /> KELUAR
        </NeoButton>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 flex flex-col gap-4">
          <NeoCard color="yellow" className="sticky top-4">
             <div className="flex flex-col gap-2">
               <NeoButton 
                 variant={adminTab === 'CLASSES' ? 'secondary' : 'primary'} 
                 onClick={() => setAdminTab('CLASSES')}
                 className="flex items-center justify-center gap-2"
               >
                 <BookOpen size={20}/> KELOLA KELAS
               </NeoButton>
               <NeoButton 
                 variant={adminTab === 'STUDENTS' ? 'secondary' : 'primary'}
                 onClick={() => setAdminTab('STUDENTS')}
                 className="flex items-center justify-center gap-2"
               >
                 <Users size={20}/> KELOLA SISWA
               </NeoButton>
             </div>
          </NeoCard>
        </div>

        <div className="md:col-span-2">
          {adminTab === 'CLASSES' ? (
            <div className="flex flex-col gap-8">
              <NeoCard title="Buat Kelas Baru" color="white">
                <form onSubmit={handleCreateClass} className="flex flex-col gap-4">
                  <NeoInput 
                    label="Nama Kelas" 
                    placeholder="Contoh: Matematika 12 IPA" 
                    value={newClassName}
                    onChange={e => setNewClassName(e.target.value)}
                  />
                  <NeoInput 
                    label="Deskripsi" 
                    placeholder="Deskripsi singkat..." 
                    value={newClassDesc}
                    onChange={e => setNewClassDesc(e.target.value)}
                  />
                  <NeoButton type="submit" className="self-start" disabled={isLoading}>
                    <Plus size={18} className="inline mr-2"/> BUAT KELAS
                  </NeoButton>
                </form>
              </NeoCard>

              <div className="grid gap-4">
                <h3 className="text-2xl font-bold bg-black text-white p-2 inline-block -rotate-1 w-max">DAFTAR KELAS</h3>
                {adminClasses.map(cls => (
                  <div key={cls.id} className="relative group">
                    <div className="absolute top-0 left-0 w-full h-full bg-black translate-x-1 translate-y-1 z-0 transition-transform group-hover:translate-x-2 group-hover:translate-y-2"></div>
                    <div className="relative z-10 bg-white border-2 border-black p-4 flex justify-between items-center">
                      <div>
                        <h4 className="text-xl font-bold">{cls.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <NeoBadge color="bg-green-300">KODE: {cls.accessCode}</NeoBadge>
                        </div>
                      </div>
                      <NeoButton size="sm" onClick={() => {
                        setCurrentClass(cls);
                        setViewState({ currentView: 'CLASS_DETAIL', selectedClassId: cls.id });
                      }}>
                        ATUR
                      </NeoButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              <NeoCard title="Tambah Siswa Baru" color="pink">
                <form onSubmit={handleCreateStudent} className="flex flex-col gap-4">
                  <NeoInput 
                    label="Username Baru" 
                    value={newStudentUser} 
                    onChange={e => setNewStudentUser(e.target.value)}
                  />
                  <NeoInput 
                    label="Password" 
                    value={newStudentPass} 
                    onChange={e => setNewStudentPass(e.target.value)}
                  />
                  <NeoButton type="submit" variant="accent" disabled={isLoading}>
                    BUAT AKUN
                  </NeoButton>
                </form>
              </NeoCard>

              <div>
                <h3 className="text-2xl font-bold mb-4">DATA SISWA</h3>
                <div className="grid gap-3">
                  {allStudents.filter(u => u.role === UserRole.STUDENT).map(student => (
                    <div key={student.id} className="bg-white border-2 border-black p-3 flex justify-between items-center shadow-sm">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">{student.username}</span>
                          {student.isOnline ? (
                             <span className="bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full border border-black font-bold animate-pulse">ONLINE</span>
                          ) : (
                             <span className="bg-gray-300 text-gray-600 text-[10px] px-2 py-0.5 rounded-full border border-black font-bold">OFFLINE</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">Terakhir aktif: {formatLastActive(student.lastActive)}</p>
                      </div>
                      <button 
                        onClick={() => handleDeleteStudent(student.id)}
                        className="bg-red-100 hover:bg-red-400 border-2 border-black p-2 transition-colors"
                        title="Hapus Siswa"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStudentDashboard = () => (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b-4 border-black pb-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase">
            Halo, {currentUser?.username}!
          </h1>
          <p className="font-medium text-gray-600 mt-2">Siap belajar hari ini?</p>
        </div>
        <NeoButton variant="danger" size="sm" onClick={handleLogout}>
          <LogOut size={16} className="inline mr-2"/> KELUAR
        </NeoButton>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <NeoCard title="Gabung Kelas" color="blue">
            <form onSubmit={handleJoinClass} className="flex flex-col gap-4">
              <p className="text-sm font-medium">Punya kode kelas dari guru?</p>
              <NeoInput 
                placeholder="Kode 6 digit" 
                className="text-center uppercase tracking-widest text-xl"
                maxLength={6}
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
              />
              {error && <p className="text-red-600 font-bold text-sm bg-red-100 p-1 border border-red-500">{error}</p>}
              <NeoButton type="submit" variant="primary" disabled={isLoading}>
                GABUNG SEKARANG
              </NeoButton>
            </form>
          </NeoCard>
        </div>

        <div className="md:col-span-2">
           <h2 className="text-3xl font-black mb-6 flex items-center gap-3">
             <School size={32}/> KELAS SAYA
           </h2>
           
           {myClasses.length === 0 ? (
             <div className="bg-gray-100 border-2 border-black border-dashed p-8 text-center">
               <p className="text-xl font-bold text-gray-500">Kamu belum bergabung di kelas manapun.</p>
             </div>
           ) : (
             <div className="grid gap-4">
               {myClasses.map(cls => (
                 <div 
                    key={cls.id} 
                    className="group cursor-pointer"
                    onClick={() => {
                        setCurrentClass(cls);
                        setViewState({ currentView: 'CLASS_DETAIL', selectedClassId: cls.id });
                    }}
                 >
                   <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-100 transition-colors flex justify-between items-center">
                     <div>
                        <h3 className="text-2xl font-black">{cls.name}</h3>
                        <p className="font-medium truncate max-w-xs">{cls.description}</p>
                     </div>
                     <ArrowRight size={32} className="group-hover:translate-x-2 transition-transform"/>
                   </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>
    </div>
  );

  const renderClassDetail = () => {
    if (!currentClass) return <div>Memuat...</div>;
    const weeks: Week[] = currentClass.weeks ? Object.values(currentClass.weeks) : [];

    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <NeoButton 
          variant="secondary" 
          onClick={() => setViewState({ 
            currentView: currentUser?.role === UserRole.ADMIN ? 'ADMIN_DASHBOARD' : 'STUDENT_DASHBOARD' 
          })}
          className="mb-6"
        >
          ← KEMBALI
        </NeoButton>

        <div className="bg-yellow-400 border-4 border-black p-6 mb-8 shadow-[8px_8px_0px_0px_#000]">
          <h1 className="text-4xl md:text-5xl font-black uppercase mb-2">{currentClass.name}</h1>
          <p className="font-bold border-t-2 border-black pt-2">{currentClass.description}</p>
          {currentUser?.role === UserRole.ADMIN && (
             <div className="mt-4 bg-white border-2 border-black p-2 inline-block">
               <span className="font-bold mr-2">KODE AKSES:</span>
               <span className="font-mono text-xl tracking-widest">{currentClass.accessCode}</span>
             </div>
          )}
        </div>

        <div className="flex justify-between items-center mb-6">
           <h2 className="text-3xl font-black bg-white border-2 border-black px-4 py-1 inline-block">DAFTAR MINGGU</h2>
           {currentUser?.role === UserRole.ADMIN && (
             <NeoButton size="sm" onClick={() => document.getElementById('addWeekForm')?.scrollIntoView()}>
               <Plus size={16}/> MINGGU BARU
             </NeoButton>
           )}
        </div>

        <div className="grid gap-6">
          {weeks.length === 0 ? <p className="text-gray-500 italic">Belum ada materi mingguan.</p> : weeks.map(week => (
            <div key={week.id} className="relative group cursor-pointer" 
                 onClick={() => {
                   setCurrentWeek(week);
                   setViewState({ currentView: 'WEEK_DETAIL', selectedClassId: currentClass.id, selectedWeekId: week.id });
                 }}>
              <div className="absolute top-0 left-0 w-full h-full bg-blue-400 border-2 border-black translate-x-1 translate-y-1 z-0"></div>
              <div className="relative z-10 bg-white border-2 border-black p-6 flex justify-between items-center hover:-translate-y-1 hover:-translate-x-1 transition-transform">
                <div className="flex items-center gap-4">
                  <div className="bg-black text-white p-3">
                    <Folder size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase">{week.title}</h3>
                    <p className="text-sm text-gray-600">{week.description}</p>
                    <p className="text-xs font-bold mt-2 bg-yellow-200 inline-block px-1">
                      {week.items ? Object.keys(week.items).length : 0} Item Materi/Soal
                    </p>
                  </div>
                </div>
                <ArrowRight size={24}/>
              </div>
            </div>
          ))}
        </div>

        {currentUser?.role === UserRole.ADMIN && (
          <div id="addWeekForm" className="mt-12 border-t-4 border-dashed border-black pt-8">
            <h3 className="text-xl font-black mb-4">TAMBAH MINGGU BARU</h3>
            {/* FIX: Responsive Add Week Form */}
            <form onSubmit={handleAddWeek} className="flex flex-col md:flex-row gap-4 items-stretch md:items-end bg-gray-100 p-4 border-2 border-black">
              <NeoInput placeholder="Judul (Misal: Minggu 1)" value={newWeekTitle} onChange={e => setNewWeekTitle(e.target.value)} />
              <NeoInput placeholder="Deskripsi Singkat" value={newWeekDesc} onChange={e => setNewWeekDesc(e.target.value)} />
              <NeoButton type="submit" variant="accent"><Plus size={18}/></NeoButton>
            </form>
          </div>
        )}
      </div>
    );
  };

  const renderWeekDetail = () => {
    if (!currentClass || !currentWeek) return <div>Memuat...</div>;
    const items: WeekItem[] = currentWeek.items ? Object.values(currentWeek.items) : [];

    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <NeoButton 
          variant="secondary" 
          onClick={() => setViewState({ currentView: 'CLASS_DETAIL', selectedClassId: currentClass.id })}
          className="mb-6"
        >
          ← KEMBALI KE KELAS
        </NeoButton>

        <header className="mb-8 border-b-4 border-black pb-4">
           <h2 className="text-4xl font-black uppercase">{currentWeek.title}</h2>
           <p className="text-xl">{currentWeek.description}</p>
        </header>

        {/* FIX: Mobile Layout - Reverse Flex Column ensures Admin panel is on top on mobile, but uses Grid on Desktop */}
        <div className="flex flex-col-reverse lg:grid lg:grid-cols-3 gap-8">
          {/* Main Content List */}
          <div className="lg:col-span-2 space-y-8">
            {items.length === 0 ? <p className="italic">Belum ada materi atau tugas.</p> : items.map((item) => {
              // Check result for current student
              const myResult = currentUser && item.results ? item.results[currentUser.id] : null;

              return (
                <div key={item.id} className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_#000]">
                  {/* Header Item */}
                  <div className={`p-4 border-b-2 border-black flex justify-between items-center ${item.type === 'quiz' ? 'bg-pink-100' : 'bg-blue-100'}`}>
                    <div className="flex items-center gap-3">
                       {item.type === 'quiz' ? <Clock size={20}/> : <FileText size={20}/>}
                       <h3 className="text-xl font-bold uppercase">{item.title}</h3>
                    </div>
                    <NeoBadge color={item.type === 'quiz' ? 'bg-pink-400' : 'bg-blue-400'}>{item.type === 'quiz' ? 'LATIHAN' : 'MATERI'}</NeoBadge>
                  </div>

                  {/* Content Preview / Body */}
                  <div className="p-6">
                    {item.previewText && (
                      <div className="mb-4 text-gray-500 font-medium italic border-l-4 border-gray-300 pl-3">
                        "{item.previewText}"
                      </div>
                    )}
                    
                    {item.type === 'material' ? (
                       <div className="prose prose-sm max-w-none">
                         {item.content.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                       </div>
                    ) : (
                       <div className="bg-gray-50 p-4 border border-black text-center">
                          <p className="font-bold mb-2">Durasi: {item.durationMinutes} Menit</p>
                          <p className="text-sm mb-4">{item.content}</p>
                          
                          {/* Student Action */}
                          {currentUser?.role === UserRole.STUDENT && (
                            <>
                              {myResult ? (
                                <div className="bg-green-100 border-2 border-green-600 p-3 inline-block">
                                  <p className="font-bold text-green-800 mb-1">SUDAH DIKERJAKAN</p>
                                  <p className="text-2xl font-black">{myResult.score}/100</p>
                                  {myResult.aiFeedback && (
                                    <p className="text-xs text-blue-700 font-bold mt-1 flex items-center justify-center gap-1">
                                      <Bot size={14}/> Koreksi AI Tersedia
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <NeoButton variant="primary" onClick={() => handleStartQuiz(item.id, item.durationMinutes || 10)}>
                                   MULAI KERJAKAN
                                </NeoButton>
                              )}
                            </>
                          )}

                          {/* Admin Action */}
                          {currentUser?.role === UserRole.ADMIN && (
                            <div className="flex flex-col gap-2 items-center">
                              <div className="text-sm bg-yellow-100 p-2 border border-black inline-block">
                                 Soal: {item.questions ? Object.keys(item.questions).length : 0} butir. 
                                 <button className="underline ml-2 font-bold" onClick={() => {
                                    setEditingQuizId(item.id);
                                    alert("Mode edit soal aktif di panel kanan!");
                                 }}>Tambah Soal</button>
                                 {item.aiCorrectionEnabled && (
                                   <div className="mt-1 flex items-center justify-center gap-1 text-blue-700 font-bold text-xs">
                                     <Bot size={14}/> Koreksi AI Aktif ({item.aiDetailLevel})
                                   </div>
                                 )}
                              </div>
                              <NeoButton variant="secondary" size="sm" onClick={() => handleViewReport(item.id)}>
                                 <BarChart2 size={16} className="mr-2 inline"/> LIHAT HASIL & NILAI
                              </NeoButton>
                            </div>
                          )}
                       </div>
                    )}
                  </div>

                  {/* Comments Section */}
                  <div className="bg-gray-50 border-t-2 border-black p-4">
                    <CommentSection 
                      classId={currentClass.id} 
                      weekId={currentWeek.id} 
                      itemId={item.id} 
                      user={currentUser!}
                      allStudents={allStudents}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sidebar Admin Tools - This comes FIRST on mobile due to flex-col-reverse */}
          {currentUser?.role === UserRole.ADMIN && (
            <div className="lg:col-span-1 space-y-6">
              <NeoCard title="Tambah Item" color="green" className="">
                <form onSubmit={handleAddItemToWeek} className="flex flex-col gap-3">
                  <NeoInput placeholder="Judul Item" value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)} />
                  
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setNewItemType('material')} className={`flex-1 border-2 border-black font-bold py-2 ${newItemType === 'material' ? 'bg-blue-400' : 'bg-white'}`}>MATERI</button>
                    <button type="button" onClick={() => setNewItemType('quiz')} className={`flex-1 border-2 border-black font-bold py-2 ${newItemType === 'quiz' ? 'bg-pink-400' : 'bg-white'}`}>KUIS</button>
                  </div>

                  <NeoInput placeholder="Teks Preview (Thumbnail)" value={newItemPreview} onChange={e => setNewItemPreview(e.target.value)} />
                  <NeoTextArea placeholder={newItemType === 'quiz' ? "Deskripsi instruksi kuis..." : "Isi materi lengkap..."} rows={4} value={newItemDesc} onChange={e => setNewItemDesc(e.target.value)} />
                  
                  {newItemType === 'quiz' && (
                    <div className="bg-white/50 p-2 border border-black space-y-2">
                      <NeoInput type="number" label="Durasi (Menit)" value={quizDuration} onChange={e => setQuizDuration(Number(e.target.value))} />
                      
                      {/* AI SETTINGS */}
                      <div className="flex items-center gap-2 mt-2">
                        <input 
                          type="checkbox" 
                          id="aiCheck" 
                          className="w-5 h-5 accent-black" 
                          checked={aiEnabled} 
                          onChange={e => setAiEnabled(e.target.checked)}
                        />
                        <label htmlFor="aiCheck" className="font-bold flex items-center gap-2 cursor-pointer">
                          <Bot size={16}/> Koreksi AI Otomatis
                        </label>
                      </div>

                      {aiEnabled && (
                        <div>
                          <label className="text-xs font-bold block mb-1">DETAIL KOREKSI</label>
                          <select 
                            className="w-full border-2 border-black p-1 text-sm font-bold"
                            value={aiDetailLevel}
                            onChange={(e: any) => setAiDetailLevel(e.target.value)}
                          >
                            <option value="brief">Singkat & Jelas</option>
                            <option value="detailed">Detail & Penjelasan Konsep</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  <NeoButton type="submit" size="sm"><Plus size={16}/> TAMBAH</NeoButton>
                </form>
              </NeoCard>

              {editingQuizId && (
                <NeoCard title="Editor Soal" color="yellow" className="border-4 border-dashed">
                   <p className="text-xs mb-2 font-bold">Menambah soal untuk ID: ...{editingQuizId.slice(-4)}</p>
                   <form onSubmit={handleAddQuestion} className="flex flex-col gap-3">
                      <NeoTextArea placeholder="Pertanyaan..." value={newQText} onChange={e => setNewQText(e.target.value)} />
                      <select className="border-2 border-black p-2 font-bold" value={newQType} onChange={(e: any) => setNewQType(e.target.value)}>
                        <option value="multiple_choice">Pilihan Ganda</option>
                        <option value="essay">Essay / Isian</option>
                      </select>
                      
                      {newQType === 'multiple_choice' && (
                        <div className="space-y-1">
                          {newQOptions.map((opt, idx) => (
                            <input 
                              key={idx} 
                              className="w-full border-2 border-black p-1 text-sm" 
                              placeholder={`Opsi ${String.fromCharCode(65+idx)}`}
                              value={opt}
                              onChange={e => {
                                const newOpts = [...newQOptions];
                                newOpts[idx] = e.target.value;
                                setNewQOptions(newOpts);
                              }}
                            />
                          ))}
                          <NeoInput placeholder="Jawaban Benar (Teks Persis)" value={newQCorrect} onChange={e => setNewQCorrect(e.target.value)} />
                        </div>
                      )}
                      
                      <NeoInput type="number" label="Poin Skor" value={newQScore} onChange={e => setNewQScore(Number(e.target.value))} />
                      <div className="flex gap-2">
                        <NeoButton type="submit" size="sm" variant="primary">SIMPAN SOAL</NeoButton>
                        <NeoButton type="button" size="sm" variant="danger" onClick={() => setEditingQuizId(null)}>BATAL</NeoButton>
                      </div>
                   </form>
                </NeoCard>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTakeQuiz = () => {
    if (!currentClass || !currentWeek || !viewState.selectedQuizId) return null;
    const quizItem = currentWeek.items ? currentWeek.items[viewState.selectedQuizId] : null;
    if (!quizItem || !quizItem.questions) return <div>Soal tidak ditemukan atau kosong.</div>;

    const questions = Object.values(quizItem.questions) as Question[];

    return (
      <div className="min-h-screen bg-pink-50 p-4 md:p-8">
         <div className="max-w-3xl mx-auto">
            <div className="sticky top-4 z-50 bg-black text-white p-4 flex justify-between items-center shadow-[4px_4px_0px_0px_#fff]">
               <h2 className="font-bold text-xl truncate">{quizItem.title}</h2>
               <div className="flex items-center gap-2 font-mono text-2xl text-yellow-400">
                 <Clock /> {formatTime(quizTimer)}
               </div>
            </div>

            <div className="mt-8 space-y-6">
              {questions.map((q, idx) => (
                <NeoCard key={q.id} className="relative">
                  <div className="absolute -left-4 -top-4 bg-yellow-400 border-2 border-black w-10 h-10 flex items-center justify-center font-black rounded-full z-10">
                    {idx + 1}
                  </div>
                  <div className="mt-2 mb-4 font-bold text-lg">{q.text}</div>
                  
                  {q.type === 'multiple_choice' ? (
                    <div className="space-y-2">
                      {q.options?.map((opt, i) => (
                        <label key={i} className={`flex items-center gap-3 p-3 border-2 border-black cursor-pointer hover:bg-gray-100 ${quizAnswers[q.id] === opt ? 'bg-blue-200 hover:bg-blue-300' : 'bg-white'}`}>
                          <input 
                            type="radio" 
                            name={q.id} 
                            value={opt} 
                            checked={quizAnswers[q.id] === opt}
                            onChange={() => setQuizAnswers({...quizAnswers, [q.id]: opt})}
                            className="w-5 h-5 accent-black"
                          />
                          <span className="font-medium">{opt}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <NeoTextArea 
                      placeholder="Ketik jawabanmu di sini..." 
                      value={quizAnswers[q.id] || ''}
                      onChange={(e) => setQuizAnswers({...quizAnswers, [q.id]: e.target.value})}
                    />
                  )}
                </NeoCard>
              ))}
            </div>

            <div className="mt-8 flex justify-end">
              <NeoButton size="lg" variant="primary" onClick={handleSubmitQuiz} disabled={isSubmittingQuiz}>
                 {isSubmittingQuiz ? (
                   <span className="flex items-center"><Loader2 className="animate-spin mr-2"/> MENGIRIM...</span>
                 ) : (
                   <span className="flex items-center">KIRIM JAWABAN <CheckCircle className="ml-2"/></span>
                 )}
              </NeoButton>
            </div>
         </div>
      </div>
    );
  };

  const renderQuizReport = () => {
    if (!currentClass || !currentWeek || !reportQuizId) return <div>Memuat laporan...</div>;
    const quizItem = currentWeek.items ? currentWeek.items[reportQuizId] : null;
    const questions = quizItem && quizItem.questions ? (Object.values(quizItem.questions) as Question[]) : [];

    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <NeoButton 
          variant="secondary" 
          onClick={() => setViewState({ 
             currentView: 'WEEK_DETAIL', 
             selectedClassId: currentClass.id, 
             selectedWeekId: currentWeek.id 
          })}
          className="mb-6"
        >
          ← KEMBALI KE MATERI
        </NeoButton>

        <NeoCard title={`Laporan Nilai: ${quizItem?.title}`} color="white" className="mb-6">
          <div className="overflow-x-auto">
            <table className="w-full border-2 border-black text-left">
              <thead>
                <tr className="bg-black text-white">
                  <th className="p-3 border-r border-gray-700">Nama Siswa</th>
                  <th className="p-3 border-r border-gray-700">Waktu Submit</th>
                  <th className="p-3">Nilai Akhir</th>
                </tr>
              </thead>
              <tbody>
                {reportResults.length === 0 ? (
                  <tr><td colSpan={3} className="p-4 text-center italic">Belum ada siswa mengerjakan.</td></tr>
                ) : reportResults.map((res, i) => (
                  <tr key={i} className="border-b-2 border-black hover:bg-gray-100">
                     <td className="p-3 font-bold border-r-2 border-black">{res.studentName}</td>
                     <td className="p-3 border-r-2 border-black">{new Date(res.timestamp).toLocaleString()}</td>
                     <td className="p-3 font-black text-xl">{res.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </NeoCard>

        {reportResults.length > 0 && (
          <div className="grid gap-6">
            <h3 className="text-2xl font-black bg-yellow-300 inline-block px-2 border-2 border-black">DETAIL JAWABAN PER SISWA</h3>
            {reportResults.map((res, i) => (
               <NeoCard key={i} title={`${res.studentName} (Skor: ${res.score})`} className="border-2 border-dashed">
                 <div className="grid gap-4">
                   {questions.map((q, idx) => {
                     const studentAns = res.answers[q.id];
                     const isCorrect = q.type === 'multiple_choice' ? studentAns === q.correctAnswer : 'manual';
                     const aiFeedback = res.aiFeedback ? res.aiFeedback[q.id] : null;

                     return (
                       <div key={q.id} className="p-3 bg-gray-50 border border-black text-sm">
                          <p className="font-bold mb-1"><span className="bg-black text-white px-1 mr-2">{idx+1}</span> {q.text}</p>
                          <div className="flex flex-col gap-1 ml-6">
                             <p>Jawaban Siswa: <span className="font-mono font-bold">{studentAns || '-'}</span></p>
                             {q.type === 'multiple_choice' && (
                               <p className="text-gray-500">Kunci Jawaban: {q.correctAnswer}</p>
                             )}
                             
                             <div className="mt-1">
                               {isCorrect === true && <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle size={14}/> BENAR</span>}
                               {isCorrect === false && <span className="text-red-600 font-bold flex items-center gap-1"><XCircle size={14}/> SALAH</span>}
                               {isCorrect === 'manual' && <span className="text-blue-600 font-bold flex items-center gap-1"><Circle size={14}/> ESSAY (Cek Manual)</span>}
                             </div>

                             {aiFeedback && (
                               <div className="mt-2 bg-blue-50 border border-blue-200 p-2 text-blue-900 rounded">
                                  <p className="font-bold text-xs flex items-center gap-1"><Bot size={12}/> KOREKSI AI:</p>
                                  <p className="italic">{aiFeedback}</p>
                               </div>
                             )}
                          </div>
                       </div>
                     );
                   })}
                 </div>
               </NeoCard>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen text-black pb-10 font-sans">
      {viewState.currentView === 'LOGIN' && renderLogin()}
      {viewState.currentView === 'ADMIN_DASHBOARD' && renderAdminDashboard()}
      {viewState.currentView === 'STUDENT_DASHBOARD' && renderStudentDashboard()}
      {viewState.currentView === 'CLASS_DETAIL' && renderClassDetail()}
      {viewState.currentView === 'WEEK_DETAIL' && renderWeekDetail()}
      {viewState.currentView === 'TAKE_QUIZ' && renderTakeQuiz()}
      {viewState.currentView === 'QUIZ_REPORT' && renderQuizReport()}
    </div>
  );
};

// --- SUB-COMPONENTS ---

const CommentSection: React.FC<{
  classId: string, weekId: string, itemId: string, user: User, allStudents?: User[]
}> = ({ classId, weekId, itemId, user, allStudents = [] }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [input, setInput] = useState('');
  const [studentThreads, setStudentThreads] = useState<string[]>([]); // IDs of students who chatted
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // If Admin, load list of students who have chatted
  useEffect(() => {
    if (user.role === UserRole.ADMIN) {
      API.fetchAllStudentThreads(classId, weekId, itemId).then(data => {
        if (data) setStudentThreads(Object.keys(data));
      });
    } else {
      // Student only sees their own chat
      setSelectedStudentId(user.id);
    }
  }, [user, classId, weekId, itemId]);

  // Subscribe to chat messages
  useEffect(() => {
    if (!selectedStudentId && user.role === UserRole.STUDENT) return;
    
    // If admin hasn't selected a student, don't sub yet
    const targetId = user.role === UserRole.ADMIN ? selectedStudentId : user.id;
    if (!targetId) return;

    const unsub = API.subscribeToComments(classId, weekId, itemId, targetId, (data) => {
      setComments(data);
    });
    return () => unsub();
  }, [classId, weekId, itemId, selectedStudentId, user]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input) return;
    const targetId = user.role === UserRole.ADMIN ? selectedStudentId : user.id;
    if (!targetId) return;

    await API.sendComment(classId, weekId, itemId, targetId, {
      senderId: user.id,
      senderName: user.username,
      role: user.role,
      text: input,
      timestamp: Date.now()
    });
    setInput('');
  };

  const getStudentName = (id: string) => {
    const s = allStudents.find(u => u.id === id);
    return s ? s.username : `Siswa ${id.slice(-4)}`;
  }

  return (
    <div>
       <h4 className="font-bold flex items-center gap-2 mb-2">
         <MessageCircle size={18}/> DISKUSI PRIVAT
       </h4>
       
       {user.role === UserRole.ADMIN && (
         <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
            {studentThreads.length === 0 && <span className="text-xs text-gray-400">Belum ada diskusi.</span>}
            {studentThreads.map(sid => (
               <button 
                 key={sid}
                 onClick={() => setSelectedStudentId(sid)}
                 className={`px-3 py-1 text-xs font-bold border-2 border-black whitespace-nowrap ${selectedStudentId === sid ? 'bg-yellow-300' : 'bg-white'}`}
               >
                 {getStudentName(sid)}
               </button>
            ))}
         </div>
       )}

       {(user.role === UserRole.STUDENT || selectedStudentId) ? (
         <>
            <div className="max-h-48 overflow-y-auto space-y-2 mb-2 bg-white border border-black p-2">
              {comments.length === 0 && <p className="text-xs text-gray-400 text-center">Belum ada pesan. Tanyakan sesuatu pada guru!</p>}
              {comments.map(c => (
                <div key={c.id} className={`flex flex-col ${c.role === user.role ? 'items-end' : 'items-start'}`}>
                   <div className={`max-w-[80%] p-2 border border-black text-sm ${c.role === UserRole.ADMIN ? 'bg-yellow-200' : 'bg-gray-200'}`}>
                      <span className="font-bold text-[10px] block mb-1">{c.senderName}</span>
                      {c.text}
                   </div>
                </div>
              ))}
            </div>
            <form onSubmit={send} className="flex gap-2">
               <input 
                 className="flex-1 border-2 border-black px-2 py-1 text-sm outline-none"
                 placeholder="Tulis pesan..."
                 value={input}
                 onChange={e => setInput(e.target.value)}
               />
               <NeoButton size="sm" type="submit" variant="secondary">KIRIM</NeoButton>
            </form>
         </>
       ) : (
         <p className="text-sm italic bg-gray-200 p-2">Pilih siswa untuk melihat percakapan.</p>
       )}
    </div>
  );
};

export default App;