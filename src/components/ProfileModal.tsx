import { useState, FormEvent, useRef, ChangeEvent } from 'react';
import { User } from '../types';
import { X, Camera, Save } from 'lucide-react';

interface ProfileModalProps {
  user: User;
  onClose: () => void;
  onUpdate: (updatedUser: User) => void;
}

export function ProfileModal({ user, onClose, onUpdate }: ProfileModalProps) {
  const [name, setName] = useState(user.name);
  const [loginId, setLoginId] = useState(user.id);
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`/api/users/${user.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newId: loginId !== user.id ? loginId : undefined,
          name,
          password: password || undefined,
          avatar: avatar || undefined
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update profile');
      }

      const updatedUser = await response.json();
      onUpdate(updatedUser);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-900">Edit Profile</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center mb-6">
            <div className="relative group">
              <div 
                className={`w-24 h-24 rounded-full bg-slate-100 border-2 border-slate-200 overflow-hidden flex items-center justify-center ${avatar ? 'cursor-zoom-in' : ''}`}
                onClick={() => avatar && setIsPreviewOpen(true)}
              >
                {avatar ? (
                  <img src={avatar} alt="Profile" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                ) : (
                  <span className="text-3xl font-bold text-slate-400">
                    {name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="absolute bottom-0 right-0 p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors shadow-lg z-10"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
            </div>
            <div className="mt-2 px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wider border border-indigo-100">
              Role: {loginId.split('-')[0]}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Login ID {user.role === 'staff' && <span className="text-[10px] text-slate-400 font-normal">(Contact manager to change)</span>}
            </label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              disabled={user.role === 'staff'}
              className={`w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${user.role === 'staff' ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
              required
            />
          </div>

          {user.role === 'staff' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Manager Name
              </label>
              <div className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed">
                {user.managerName || "No manager assigned"}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              New Password (leave blank to keep current)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="••••••••"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Image Preview Modal */}
      {isPreviewOpen && avatar && (
        <div 
          className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div className="relative max-w-4xl w-full flex items-center justify-center">
            <button 
              className="absolute -top-12 right-0 text-white hover:text-slate-300 transition-colors"
              onClick={() => setIsPreviewOpen(false)}
            >
              <X className="w-8 h-8" />
            </button>
            <img 
              src={avatar} 
              alt="Preview" 
              className="max-h-[80vh] max-w-full rounded-2xl shadow-2xl border-4 border-white/10 object-contain animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
