import { useEffect, useState, FormEvent } from 'react';
import { Task, User } from '../types';
import { socket } from '../lib/socket';
import { format } from 'date-fns';
import { CheckCircle2, Circle, Clock, LayoutDashboard, Users, BarChart2, UserPlus, Trash2, X, Save, Download, Settings2, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function ManagerDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStaffId, setFilterStaffId] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'date' | 'month' | 'year'>('all');
  const [filterValue, setFilterValue] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterError, setFilterError] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<'all' | 'urgent' | 'normal'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in-progress' | 'completed'>('all');
  const [showDbInspector, setShowDbInspector] = useState(false);
  const [debugUsers, setDebugUsers] = useState<any[]>([]);

  const fetchDebugUsers = async () => {
    const res = await fetch('/api/admin/debug/users');
    const data = await res.json();
    setDebugUsers(data);
    setShowDbInspector(true);
  };

  // Staff Management
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [newStaffId, setNewStaffId] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [staffError, setStaffError] = useState('');
  const [staffToDelete, setStaffToDelete] = useState<{id: string, name: string} | null>(null);
  const [managingStaff, setManagingStaff] = useState<User | null>(null);
  const [editStaffId, setEditStaffId] = useState('');
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffPassword, setEditStaffPassword] = useState('');
  const [editStaffError, setEditStaffError] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/tasks').then((res) => res.json()),
      fetch('/api/users').then((res) => res.json())
    ]).then(([tasksData, usersData]) => {
      setTasks(tasksData);
      setUsers(usersData);
      setLoading(false);
    });

    socket.on('task:created', (newTask: Task) => {
      setTasks((prev) => [newTask, ...prev]);
    });

    socket.on('task:updated', (updatedTask: Task) => {
      setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
    });

    socket.on('task:deleted', (taskId: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    });

    socket.on('user:created', (newUser: User) => {
      setUsers((prev) => [...prev, newUser]);
    });

    socket.on('user:updated', (updatedUser: User) => {
      setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    });

    socket.on('user:id_changed', ({ oldId, newId }: { oldId: string, newId: string }) => {
      setUsers((prev) => prev.map((u) => (u.id === oldId ? { ...u, id: newId } : u)));
      setTasks((prev) => prev.map((t) => (t.staff_id === oldId ? { ...t, staff_id: newId } : t)));
    });

    socket.on('user:deleted', (userId: string) => {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setTasks((prev) => prev.filter((t) => t.staff_id !== userId));
    });

    return () => {
      socket.off('task:created');
      socket.off('task:updated');
      socket.off('task:deleted');
      socket.off('user:created');
      socket.off('user:updated');
      socket.off('user:id_changed');
      socket.off('user:deleted');
    };
  }, []);

  const handleAddStaff = async (e: FormEvent) => {
    e.preventDefault();
    setStaffError('');

    if (!newStaffId || !newStaffName || !newStaffPassword) {
      setStaffError('All fields are required');
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newStaffId,
          name: newStaffName,
          role: 'staff',
          password: newStaffPassword
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add staff');
      }

      setIsAddingStaff(false);
      setNewStaffId('');
      setNewStaffName('');
      setNewStaffPassword('');
    } catch (err: any) {
      setStaffError(err.message);
    }
  };

  const confirmDeleteStaff = (id: string, name: string) => {
    setStaffToDelete({ id, name });
  };

  const executeDeleteStaff = async () => {
    if (!staffToDelete) return;
    try {
      await fetch(`/api/users/${staffToDelete.id}`, { method: 'DELETE' });
      if (filterStaffId === staffToDelete.id) setFilterStaffId('all');
      setStaffToDelete(null);
    } catch (err) {
      console.error('Failed to delete staff', err);
    }
  };

  const handleUpdateStaffAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!managingStaff) return;
    setEditStaffError('');

    try {
      const res = await fetch(`/api/users/${managingStaff.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newId: editStaffId,
          name: editStaffName,
          password: editStaffPassword || undefined
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update staff account');
      }

      setManagingStaff(null);
    } catch (err: any) {
      setEditStaffError(err.message);
    }
  };

  const openManageStaff = (staff: User) => {
    setManagingStaff(staff);
    setEditStaffId(staff.id);
    setEditStaffName(staff.name);
    setEditStaffPassword('');
    setEditStaffError('');
  };

  const isOverdue = (task: Task) => {
    if (task.status === 'completed' || !task.deadline) return false;
    
    // Get current date in Jakarta (YYYY-MM-DD)
    const nowJakarta = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    
    return task.deadline < nowJakarta;
  };

  const formatJakartaTime = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(new Date(dateStr)).replace(',', '');
    } catch (e) {
      return format(new Date(dateStr), 'dd/MM/yyyy HH:mm');
    }
  };

  if (loading) {
    return <div className="animate-pulse text-slate-500 p-8">Loading dashboard...</div>;
  }

  const staffUsers = users.filter((u) => u.role === 'staff');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'in-progress': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'in-progress': return <Clock className="w-4 h-4 text-amber-600" />;
      default: return <Circle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getJakartaDate = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date(dateStr));
    } catch (e) {
      return format(new Date(dateStr), 'yyyy-MM-dd');
    }
  };

  // Apply filters for the chart
  const filteredTasks = tasks.filter(task => {
    if (filterStaffId !== 'all' && task.staff_id !== filterStaffId) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;

    if (filterType !== 'all' && filterValue) {
      const deadlineStr = task.deadline; // YYYY-MM-DD
      const updatedAtStr = task.updated_at ? getJakartaDate(task.updated_at) : null;
      const createdAtStr = getJakartaDate(task.created_at);

      const checkDate = (dateStr: string | null) => {
        if (!dateStr) return false;
        if (filterType === 'date') {
          if (filterEndDate) {
            return dateStr >= filterValue && dateStr <= filterEndDate;
          }
          return dateStr === filterValue;
        } else if (filterType === 'month') {
          return dateStr.substring(0, 7) === filterValue;
        } else if (filterType === 'year') {
          return dateStr.substring(0, 4) === filterValue;
        }
        return false;
      };

      // If ANY of the dates match the filter, include the task
      return checkDate(deadlineStr) || checkDate(updatedAtStr) || checkDate(createdAtStr);
    }

    return true;
  });

  // Prepare chart data
  const chartData = staffUsers
    .filter(staff => filterStaffId === 'all' || staff.id === filterStaffId)
    .map(staff => {
      const sTasks = filteredTasks.filter(t => t.staff_id === staff.id);
      return {
        name: staff.name,
        completed: sTasks.filter(t => t.status === 'completed').length,
        inProgress: sTasks.filter(t => t.status === 'in-progress').length,
        pending: sTasks.filter(t => t.status === 'pending').length,
      };
    });

  const downloadReport = () => {
    const headers = ['Task Title', 'Description', 'Priority', 'Status', 'Deadline', 'Staff Name', 'Created At'];
    
    const staffToInclude = staffUsers.filter(staff => filterStaffId === 'all' || staff.id === filterStaffId);
    const rows: string[] = [];

    staffToInclude.forEach(staff => {
      const staffTasks = filteredTasks.filter(t => t.staff_id === staff.id);
      
      if (staffTasks.length === 0) {
        rows.push([
          '"(No tasks found)"',
          '"-"',
          '"-"',
          '"-"',
          '"-"',
          `"${staff.name}"`,
          '"-"'
        ].join(','));
      } else {
        staffTasks.forEach(task => {
          rows.push([
            `"${task.title.replace(/"/g, '""')}"`,
            `"${(task.description || '').replace(/"/g, '""')}"`,
            task.priority,
            task.status,
            task.deadline ? format(new Date(task.deadline), 'yyyy-MM-dd') : 'No deadline',
            `"${staff.name}"`,
            formatJakartaTime(task.created_at)
          ].join(','));
        });
      }
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `task_report_${formatJakartaTime(new Date().toISOString()).replace(/[\/:\s]/g, '')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <LayoutDashboard className="w-7 h-7 text-indigo-600" />
            Manager Dashboard
          </h1>
          <p className="text-slate-500 mt-1">Real-time overview of your team's performance and tasks.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full lg:w-auto">
          <button
            onClick={() => setIsAddingStaff(true)}
            className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <UserPlus className="w-5 h-5" />
            Add Staff
          </button>
          <button
            onClick={fetchDebugUsers}
            className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md shadow-slate-200 transition-all flex items-center justify-center gap-2 active:scale-95"
            title="View Raw Database Tables"
          >
            <Settings2 className="w-5 h-5" />
            Database
          </button>
          <div className="flex-1 sm:flex-none bg-white px-4 py-2.5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-center gap-3">
            <div className="p-1.5 bg-indigo-50 rounded-lg">
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-left">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Total Staff</div>
              <div className="text-sm font-bold text-slate-900">{staffUsers.length} Members</div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Staff Form */}
      {isAddingStaff && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-200 bg-indigo-50/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-600" />
              Add New Staff Member
            </h2>
            <button 
              onClick={() => {
                setIsAddingStaff(false);
                setStaffError('');
              }} 
              className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleAddStaff} className="space-y-4">
            {staffError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl font-medium">
                {staffError}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Login ID <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={newStaffId}
                  onChange={(e) => setNewStaffId(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
                  placeholder="e.g., webmaster-1"
                />
                {newStaffId && (
                  <div className="mt-1 text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
                    Role Preview: {newStaffId.split('-')[0]}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
                  placeholder="e.g., David (Staff)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  required
                  value={newStaffPassword}
                  onChange={(e) => setNewStaffPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end pt-2">
              <button
                type="submit"
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Create Account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Analytics & History Section */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Staff Member</label>
            <select 
              value={filterStaffId} 
              onChange={(e) => setFilterStaffId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm bg-white shadow-sm transition-all"
            >
              <option value="all">All Staff</option>
              {staffUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Priority</label>
            <select 
              value={filterPriority} 
              onChange={(e) => setFilterPriority(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm bg-white shadow-sm transition-all"
            >
              <option value="all">All Priority</option>
              <option value="urgent">Urgent</option>
              <option value="normal">Normal</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Status</label>
            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm bg-white shadow-sm transition-all"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Period</label>
            <select 
              value={filterType} 
              onChange={(e) => {
                setFilterType(e.target.value as any);
                setFilterValue('');
                setFilterEndDate('');
                setFilterError('');
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm bg-white shadow-sm transition-all"
            >
              <option value="all">All Time</option>
              <option value="date">Specific Date</option>
              <option value="month">Specific Month</option>
              <option value="year">Specific Year</option>
            </select>
          </div>

          {filterType === 'date' && (
            <div className="flex flex-col gap-1.5 col-span-full lg:col-auto">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Date Range (Max 2 Weeks)</label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <input 
                  type="date" 
                  value={filterValue}
                  onChange={(e) => {
                    setFilterValue(e.target.value);
                    setFilterError('');
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm bg-white shadow-sm flex-1 sm:w-32"
                />
                <span className="text-slate-400 text-xs text-center">to</span>
                <input 
                  type="date" 
                  value={filterEndDate}
                  onChange={(e) => {
                    const start = new Date(filterValue);
                    const end = new Date(e.target.value);
                    const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                    
                    if (diffDays > 14) {
                      setFilterError('Max 2 weeks');
                    } else {
                      setFilterError('');
                      setFilterEndDate(e.target.value);
                    }
                  }}
                  className={`px-3 py-2 rounded-xl border ${filterError ? 'border-red-500' : 'border-slate-200'} focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm bg-white shadow-sm flex-1 sm:w-32`}
                />
              </div>
              {filterError && <span className="text-[10px] text-red-500 font-medium ml-1">{filterError}</span>}
            </div>
          )}

          {filterType === 'month' && (
            <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Month</label>
              <input 
                type="month" 
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm bg-white shadow-sm"
              />
            </div>
          )}

          {filterType === 'year' && (
            <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Year</label>
              <select 
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm bg-white shadow-sm"
              >
                <option value="">Choose Year...</option>
                {Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          <div className="col-span-full lg:col-auto lg:ml-auto">
            <button
              onClick={downloadReport}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md shadow-emerald-100 transition-all flex items-center justify-center gap-2 text-sm active:scale-95"
            >
              <Download className="w-4 h-4" />
              Download Report
            </button>
          </div>
        </div>

        <div className="h-80 w-full">
          {chartData.every(d => d.completed === 0 && d.inProgress === 0 && d.pending === 0) ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-xl">
              No tasks found for the selected filters.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} allowDecimals={false} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="completed" name="Completed" stackId="a" fill="#10b981" />
                <Bar dataKey="inProgress" name="In Progress" stackId="a" fill="#f59e0b" />
                <Bar dataKey="pending" name="Pending" stackId="a" fill="#cbd5e1" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Staff Cards Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {staffUsers.map((staff) => {
          const staffTasks = filteredTasks.filter((t) => t.staff_id === staff.id);
          const totalStaffTasks = tasks.filter(t => t.staff_id === staff.id).length;
          const completedTasks = staffTasks.filter((t) => t.status === 'completed').length;
          const progress = staffTasks.length === 0 ? 0 : Math.round((completedTasks / staffTasks.length) * 100);

          if (filterStaffId !== 'all' && staff.id !== filterStaffId) return null;

          return (
            <div key={staff.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {staff.avatar ? (
                    <img 
                      src={staff.avatar} 
                      alt={staff.name} 
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all" 
                      onClick={() => setPreviewImage(staff.avatar || null)}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold">
                      {staff.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h2 className="font-semibold text-slate-900">{staff.name}</h2>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold uppercase tracking-tight">
                        {staff.id.split('-')[0]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {filterType === 'all' ? `${totalStaffTasks} total tasks` : `${staffTasks.length} filtered tasks`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-4 sm:mt-0">
                  <div className="text-left sm:text-right">
                    <div className="text-2xl font-bold text-slate-900">{progress}%</div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Completion</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openManageStaff(staff)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Manage account (ID/Password)"
                    >
                      <Settings2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => confirmDeleteStaff(staff.id, staff.name)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete staff account"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="h-1.5 w-full bg-slate-100">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="p-5 flex-1 overflow-y-auto max-h-[400px]">
                {staffTasks.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm italic">
                    {filterType === 'all' ? 'No tasks assigned yet.' : 'No tasks found for the selected period.'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {staffTasks.map((task) => {
                      const overdue = isOverdue(task);
                      return (
                        <div key={task.id} className={`p-4 rounded-xl border ${overdue ? 'border-red-200 bg-red-50/30' : 'border-slate-100 bg-white'} shadow-sm hover:shadow-md transition-shadow flex items-start gap-3`}>
                          <div className="flex flex-col items-center gap-2">
                            <div className="mt-0.5">{overdue ? <AlertCircle className="w-4 h-4 text-red-600" /> : getStatusIcon(task.status)}</div>
                            {staff.avatar ? (
                              <img 
                                src={staff.avatar} 
                                alt={staff.name} 
                                className="w-6 h-6 rounded-full object-cover border border-slate-200 cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all" 
                                onClick={() => setPreviewImage(staff.avatar || null)}
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-[8px] font-bold">
                                {staff.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-semibold text-slate-900 truncate">{task.title}</h3>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {task.priority === 'urgent' && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700 uppercase tracking-wider">
                                    Urgent
                                  </span>
                                )}
                                {overdue && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-600 text-white uppercase tracking-wider">
                                    Overdue
                                  </span>
                                )}
                              </div>
                            </div>
                            {task.description && (
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-3">
                              <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${overdue ? 'bg-red-100 text-red-700 border-red-200' : getStatusColor(task.status)}`}>
                                {overdue ? 'Overdue' : task.status.replace('-', ' ')}
                              </span>
                              {task.deadline && (
                                <span className={`text-xs flex items-center gap-1 ${overdue ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(task.deadline), 'MMM d, yyyy')}
                                </span>
                              )}
                              {task.updated_at && (
                                <span className="text-[10px] text-indigo-500 font-medium flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded">
                                  Updated: {formatJakartaTime(task.updated_at)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Manage Staff Modal */}
      {managingStaff && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {managingStaff.avatar ? (
                  <img 
                    src={managingStaff.avatar} 
                    alt={managingStaff.name} 
                    className="w-12 h-12 rounded-full object-cover border border-slate-200 cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
                    onClick={() => setPreviewImage(managingStaff.avatar || null)}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-lg">
                    {managingStaff.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Manage Staff Account</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-bold uppercase tracking-wider border border-indigo-100">
                    Role: {editStaffId.split('-')[0]}
                  </span>
                </div>
              </div>
              <button onClick={() => setManagingStaff(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateStaffAccount} className="space-y-4">
              {editStaffError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl font-medium">
                  {editStaffError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Login ID</label>
                <input
                  type="text"
                  required
                  value={editStaffId}
                  onChange={(e) => setEditStaffId(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editStaffName}
                  onChange={(e) => setEditStaffName(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password (leave blank to keep current)</label>
                <input
                  type="password"
                  value={editStaffPassword}
                  onChange={(e) => setEditStaffPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="••••••••"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setManagingStaff(null)}
                  className="px-4 py-2 rounded-xl font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium shadow-sm"
                >
                  Update Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {staffToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Staff Account</h3>
            <p className="text-slate-500 mb-6">
              Are you sure you want to delete staff member <span className="font-semibold text-slate-900">"{staffToDelete.name}"</span> and ALL their tasks? This action cannot be undone.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                onClick={() => setStaffToDelete(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeDeleteStaff}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl font-medium shadow-sm transition-colors"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl w-full flex items-center justify-center">
            <button 
              className="absolute -top-12 right-0 text-white hover:text-slate-300 transition-colors"
              onClick={() => setPreviewImage(null)}
            >
              <X className="w-8 h-8" />
            </button>
            <img 
              src={previewImage} 
              alt="Preview" 
              className="max-h-[80vh] max-w-full rounded-2xl shadow-2xl border-4 border-white/10 object-contain animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Database Inspector Modal */}
      {showDbInspector && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full p-6 border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-indigo-600" />
                  Database Inspector
                </h3>
                <p className="text-xs text-slate-500">Viewing raw 'users' table content from SQLite.</p>
              </div>
              <button onClick={() => setShowDbInspector(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-auto flex-1 border border-slate-100 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">ID</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">Name</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">Role</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">Password</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {debugUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-slate-600">{u.id}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{u.name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold uppercase">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-indigo-600 bg-indigo-50/30">{u.password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowDbInspector(false)}
                className="bg-slate-900 text-white px-6 py-2 rounded-xl font-medium"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
