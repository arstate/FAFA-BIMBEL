import React, { useState, useEffect } from 'react';
import { 
  User, 
  UserRole, 
  ViewState, 
  ClassSession,
  Material
} from './types';
import { NeoButton, NeoInput, NeoCard, NeoTextArea, NeoBadge } from './components/NeoUI';
import * as API from './services/api';
import { 
  BookOpen, 
  LogOut, 
  Plus, 
  Users, 
  Key, 
  School, 
  ArrowRight,
  FileText,
  CheckCircle,
  Hash
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
  const [newClassName, setNewClassName] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');
  const [newStudentUser, setNewStudentUser] = useState('');
  const [newStudentPass, setNewStudentPass] = useState('');
  const [adminTab, setAdminTab] = useState<'CLASSES' | 'STUDENTS'>('CLASSES');
  
  // --- CLASS DETAIL STATE ---
  const [currentClass, setCurrentClass] = useState<ClassSession | null>(null);
  const [newMatTitle, setNewMatTitle] = useState('');
  const [newMatContent, setNewMatContent] = useState('');
  const [newMatType, setNewMatType] = useState<'note' | 'exercise'>('note');

  // --- STUDENT STATE ---
  const [joinCode, setJoinCode] = useState('');
  const [myClasses, setMyClasses] = useState<ClassSession[]>([]);
  
  // --- LOGIN STATE ---
  const [loginMode, setLoginMode] = useState<'STUDENT' | 'ADMIN'>('STUDENT');
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // --- EFFECTS ---
  
  // Check for admin hash
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#/admin') {
        setLoginMode('ADMIN');
      }
    };
    handleHashChange(); // initial check
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Fetch data when views change
  useEffect(() => {
    if (viewState.currentView === 'ADMIN_DASHBOARD') {
      loadAdminData();
    } else if (viewState.currentView === 'STUDENT_DASHBOARD' && currentUser) {
      loadStudentData();
    } else if (viewState.currentView === 'CLASS_DETAIL' && viewState.selectedClassId) {
      loadClassDetail(viewState.selectedClassId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewState.currentView, viewState.selectedClassId, currentUser]);

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
    } catch (e) {
      console.error(e);
    }
  };

  const loadStudentData = async () => {
    if (!currentUser) return;
    try {
      const classes = await API.fetchMyClasses(currentUser.id);
      setMyClasses(classes);
    } catch (e) {
      console.error(e);
    }
  };

  const loadClassDetail = async (id: string) => {
    setIsLoading(true);
    try {
      const cls = await API.fetchClassDetails(id);
      setCurrentClass(cls);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (loginMode === 'ADMIN') {
        if (loginPass === ADMIN_PASSWORD) {
          const adminUser: User = { id: 'admin', username: 'Admin', role: UserRole.ADMIN };
          setCurrentUser(adminUser);
          setViewState({ currentView: 'ADMIN_DASHBOARD' });
        } else {
          setError('Wrong admin password!');
        }
      } else {
        const user = await API.loginStudent(loginUser, loginPass);
        if (user) {
          setCurrentUser(user);
          setViewState({ currentView: 'STUDENT_DASHBOARD' });
        } else {
          setError('Invalid username or password.');
        }
      }
    } catch (err) {
      setError('Login failed. Please try again.');
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
      alert("Class Created Successfully!");
    } catch (err) {
      alert("Failed to create class");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentUser || !newStudentPass) return;
    setIsLoading(true);
    try {
      await API.createStudent(newStudentUser, newStudentPass);
      setNewStudentUser('');
      setNewStudentPass('');
      alert("Student Account Created!");
    } catch (err: any) {
      alert(err.message || "Failed to create student");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !joinCode) return;
    setIsLoading(true);
    try {
      const className = await API.joinClass(currentUser.id, joinCode);
      alert(`Successfully joined ${className}!`);
      setJoinCode('');
      await loadStudentData();
    } catch (err: any) {
      setError(err.message || "Failed to join class");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClass || !newMatTitle) return;
    setIsLoading(true);
    try {
      await API.addMaterialToClass(currentClass.id, newMatTitle, newMatContent, newMatType);
      setNewMatTitle('');
      setNewMatContent('');
      await loadClassDetail(currentClass.id);
    } catch (err) {
      alert("Failed to add material");
    } finally {
      setIsLoading(false);
    }
  };

  // --- RENDERERS ---

  const renderLogin = () => (
    <div className="min-h-screen flex items-center justify-center p-4 bg-yellow-100">
      <div className="w-full max-w-md relative">
        {/* Decorative background shape */}
        <div className="absolute top-0 left-0 w-full h-full bg-black translate-x-2 translate-y-2 z-0"></div>
        
        <NeoCard className="relative z-10" color="white" title={loginMode === 'ADMIN' ? 'Admin Access' : 'Student Login'}>
          {error && (
            <div className="bg-red-400 text-white p-3 border-2 border-black font-bold mb-4 flex items-center gap-2">
              <span className="text-xl">!</span> {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {loginMode === 'STUDENT' && (
              <NeoInput 
                label="Username" 
                placeholder="Enter your username" 
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
              />
            )}
            
            <NeoInput 
              label="Password" 
              type="password" 
              placeholder={loginMode === 'ADMIN' ? 'Enter Admin PIN' : 'Enter Password'} 
              value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)}
            />

            <NeoButton type="submit" variant="accent" size="lg" disabled={isLoading}>
              {isLoading ? 'LOADING...' : 'LET ME IN!'}
            </NeoButton>
          </form>

          <div className="mt-6 pt-6 border-t-2 border-dashed border-black text-center">
            <p className="text-sm font-bold text-gray-500 mb-2">WRONG PORTAL?</p>
            <button 
              onClick={() => {
                setLoginMode(prev => prev === 'ADMIN' ? 'STUDENT' : 'ADMIN');
                setError(null);
                setLoginPass('');
              }}
              className="text-xs font-black underline hover:text-blue-600 uppercase tracking-widest"
            >
              Switch to {loginMode === 'ADMIN' ? 'Student' : 'Admin'} Mode
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
          TEACHER<span className="text-blue-500">ZONE</span>
        </h1>
        <NeoButton variant="danger" size="sm" onClick={handleLogout} className="flex items-center gap-2">
          <LogOut size={16} /> LOGOUT
        </NeoButton>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Sidebar / Controls */}
        <div className="md:col-span-1 flex flex-col gap-4">
          <NeoCard color="yellow" className="sticky top-4">
             <div className="flex flex-col gap-2">
               <NeoButton 
                 variant={adminTab === 'CLASSES' ? 'secondary' : 'primary'} 
                 onClick={() => setAdminTab('CLASSES')}
                 className="flex items-center justify-center gap-2"
               >
                 <BookOpen size={20}/> Manage Classes
               </NeoButton>
               <NeoButton 
                 variant={adminTab === 'STUDENTS' ? 'secondary' : 'primary'}
                 onClick={() => setAdminTab('STUDENTS')}
                 className="flex items-center justify-center gap-2"
               >
                 <Users size={20}/> Manage Students
               </NeoButton>
             </div>
          </NeoCard>
        </div>

        {/* Main Content Area */}
        <div className="md:col-span-2">
          {adminTab === 'CLASSES' ? (
            <div className="flex flex-col gap-8">
              <NeoCard title="Create New Class" color="white">
                <form onSubmit={handleCreateClass} className="flex flex-col gap-4">
                  <NeoInput 
                    label="Class Name" 
                    placeholder="e.g. Math for Grade 5" 
                    value={newClassName}
                    onChange={e => setNewClassName(e.target.value)}
                  />
                  <NeoInput 
                    label="Description" 
                    placeholder="Short description..." 
                    value={newClassDesc}
                    onChange={e => setNewClassDesc(e.target.value)}
                  />
                  <NeoButton type="submit" className="self-start" disabled={isLoading}>
                    <Plus size={18} className="inline mr-2"/> CREATE CLASS
                  </NeoButton>
                </form>
              </NeoCard>

              <div className="grid gap-4">
                <h3 className="text-2xl font-bold bg-black text-white p-2 inline-block -rotate-1 w-max">EXISTING CLASSES</h3>
                {adminClasses.map(cls => (
                  <div key={cls.id} className="relative group">
                    <div className="absolute top-0 left-0 w-full h-full bg-black translate-x-1 translate-y-1 z-0 transition-transform group-hover:translate-x-2 group-hover:translate-y-2"></div>
                    <div className="relative z-10 bg-white border-2 border-black p-4 flex justify-between items-center">
                      <div>
                        <h4 className="text-xl font-bold">{cls.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <NeoBadge color="bg-green-300">CODE: {cls.accessCode}</NeoBadge>
                        </div>
                      </div>
                      <NeoButton size="sm" onClick={() => {
                        setCurrentClass(cls);
                        setViewState({ currentView: 'CLASS_DETAIL', selectedClassId: cls.id });
                      }}>
                        MANAGE
                      </NeoButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <NeoCard title="Register Student" color="pink">
              <form onSubmit={handleCreateStudent} className="flex flex-col gap-4">
                <NeoInput 
                  label="New Username" 
                  value={newStudentUser} 
                  onChange={e => setNewStudentUser(e.target.value)}
                />
                <NeoInput 
                  label="New Password" 
                  value={newStudentPass} 
                  onChange={e => setNewStudentPass(e.target.value)}
                />
                <NeoButton type="submit" variant="accent" disabled={isLoading}>
                  CREATE ACCOUNT
                </NeoButton>
              </form>
            </NeoCard>
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
            Hello, {currentUser?.username}!
          </h1>
          <p className="font-medium text-gray-600 mt-2">Ready to learn something new today?</p>
        </div>
        <NeoButton variant="danger" size="sm" onClick={handleLogout}>
          <LogOut size={16} className="inline mr-2"/> LOGOUT
        </NeoButton>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <NeoCard title="Join a Class" color="blue">
            <form onSubmit={handleJoinClass} className="flex flex-col gap-4">
              <p className="text-sm font-medium">Got a code from your teacher?</p>
              <NeoInput 
                placeholder="Enter 6-char code" 
                className="text-center uppercase tracking-widest text-xl"
                maxLength={6}
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
              />
              {error && <p className="text-red-600 font-bold text-sm bg-red-100 p-1 border border-red-500">{error}</p>}
              <NeoButton type="submit" variant="primary" disabled={isLoading}>
                JOIN NOW
              </NeoButton>
            </form>
          </NeoCard>
        </div>

        <div className="md:col-span-2">
           <h2 className="text-3xl font-black mb-6 flex items-center gap-3">
             <School size={32}/> MY CLASSES
           </h2>
           
           {myClasses.length === 0 ? (
             <div className="bg-gray-100 border-2 border-black border-dashed p-8 text-center">
               <p className="text-xl font-bold text-gray-500">You haven't joined any classes yet.</p>
             </div>
           ) : (
             <div className="grid gap-4">
               {myClasses.map(cls => (
                 <div 
                    key={cls.id} 
                    className="group cursor-pointer"
                    onClick={() => setViewState({ currentView: 'CLASS_DETAIL', selectedClassId: cls.id })}
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
    if (!currentClass) return <div>Loading...</div>;

    const materials: Material[] = currentClass.materials ? (Object.values(currentClass.materials) as Material[]) : [];

    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <NeoButton 
          variant="secondary" 
          onClick={() => setViewState({ 
            currentView: currentUser?.role === UserRole.ADMIN ? 'ADMIN_DASHBOARD' : 'STUDENT_DASHBOARD' 
          })}
          className="mb-6"
        >
          ← BACK TO DASHBOARD
        </NeoButton>

        <div className="bg-yellow-400 border-4 border-black p-6 mb-8 shadow-[8px_8px_0px_0px_#000]">
          <h1 className="text-4xl md:text-6xl font-black uppercase mb-2">{currentClass.name}</h1>
          <p className="text-xl font-bold font-mono border-t-2 border-black pt-2 inline-block">
            {currentClass.description}
          </p>
          {currentUser?.role === UserRole.ADMIN && (
             <div className="mt-4 bg-white border-2 border-black p-2 inline-block">
               <span className="font-bold mr-2">ACCESS CODE:</span>
               <span className="font-mono text-xl tracking-widest">{currentClass.accessCode}</span>
             </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <h2 className="text-3xl font-black bg-white border-2 border-black inline-block px-4 py-1">
              MATERIALS & EXERCISES
            </h2>
            
            {materials.length === 0 ? (
              <p className="italic text-gray-500 font-bold">No materials uploaded yet.</p>
            ) : (
              materials.map((mat) => (
                <div key={mat.id} className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_#000]">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold">{mat.title}</h3>
                    <NeoBadge color={mat.type === 'note' ? 'bg-blue-300' : 'bg-pink-300'}>
                      {mat.type.toUpperCase()}
                    </NeoBadge>
                  </div>
                  <div className="prose prose-sm max-w-none border-t-2 border-gray-100 pt-2 font-medium">
                    {mat.content.split('\n').map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {currentUser?.role === UserRole.ADMIN && (
            <div className="md:col-span-1">
              <NeoCard title="Add Content" color="green" className="sticky top-4">
                <form onSubmit={handleAddMaterial} className="flex flex-col gap-3">
                  <NeoInput 
                    placeholder="Title" 
                    value={newMatTitle}
                    onChange={e => setNewMatTitle(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      className={`flex-1 border-2 border-black font-bold py-1 ${newMatType === 'note' ? 'bg-blue-400' : 'bg-white'}`}
                      onClick={() => setNewMatType('note')}
                    >
                      NOTE
                    </button>
                    <button 
                      type="button"
                      className={`flex-1 border-2 border-black font-bold py-1 ${newMatType === 'exercise' ? 'bg-pink-400' : 'bg-white'}`}
                      onClick={() => setNewMatType('exercise')}
                    >
                      EXERCISE
                    </button>
                  </div>
                  <NeoTextArea 
                    placeholder="Content..." 
                    rows={4}
                    value={newMatContent}
                    onChange={e => setNewMatContent(e.target.value)}
                  />
                  <NeoButton type="submit" size="sm" disabled={isLoading}>
                    <Plus size={16} className="inline"/> ADD
                  </NeoButton>
                </form>
              </NeoCard>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen text-black pb-10">
      {viewState.currentView === 'LOGIN' && renderLogin()}
      {viewState.currentView === 'ADMIN_DASHBOARD' && renderAdminDashboard()}
      {viewState.currentView === 'STUDENT_DASHBOARD' && renderStudentDashboard()}
      {viewState.currentView === 'CLASS_DETAIL' && renderClassDetail()}
    </div>
  );
};

export default App;