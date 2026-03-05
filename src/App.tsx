import { useEffect, useState } from 'react';
import { User } from './types';
import Login from './pages/Login';
import ManagerDashboard from './pages/ManagerDashboard';
import StaffDashboard from './pages/StaffDashboard';
import { ProfileModal } from './components/ProfileModal';
import { Settings } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  const handleUpdateProfile = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    setIsProfileModalOpen(false);
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
            TM
          </div>
          <h1 className="text-xl font-semibold tracking-tight">TaskMonitor</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt="Profile" className="w-8 h-8 rounded-full object-cover border border-slate-200" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-medium text-sm">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="text-sm text-slate-500 hidden sm:block">
              Logged in as <span className="font-medium text-slate-900">{currentUser.name}</span>
            </div>
          </div>
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="Edit Profile"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors ml-2"
          >
            Sign out
          </button>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto p-6">
        {currentUser.role === 'manager' ? (
          <ManagerDashboard />
        ) : (
          <StaffDashboard currentUser={currentUser} />
        )}
      </main>

      {isProfileModalOpen && (
        <ProfileModal
          user={currentUser}
          onClose={() => setIsProfileModalOpen(false)}
          onUpdate={handleUpdateProfile}
        />
      )}
    </div>
  );
}
