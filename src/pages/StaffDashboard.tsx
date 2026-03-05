import { useEffect, useState, FormEvent } from 'react';
import { Task, User } from '../types';
import { socket } from '../lib/socket';
import { format } from 'date-fns';
import { Plus, Trash2, Edit2, CheckCircle2, Circle, Clock, X, Save, AlertCircle } from 'lucide-react';

interface StaffDashboardProps {
  currentUser: User;
}

export default function StaffDashboard({ currentUser }: StaffDashboardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<'urgent' | 'normal'>('normal');
  const [filterPriority, setFilterPriority] = useState<'all' | 'urgent' | 'normal'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in-progress' | 'completed'>('all');
  const [filterType, setFilterType] = useState<'all' | 'date' | 'month' | 'year'>('all');
  const [filterValue, setFilterValue] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterError, setFilterError] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/tasks')
      .then((res) => res.json())
      .then((data) => {
        setTasks(data.filter((t: Task) => t.staff_id === currentUser.id));
        setLoading(false);
      });

    socket.on('task:created', (newTask: Task) => {
      if (newTask.staff_id === currentUser.id) {
        setTasks((prev) => [newTask, ...prev]);
      }
    });

    socket.on('task:updated', (updatedTask: Task) => {
      if (updatedTask.staff_id === currentUser.id) {
        setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
      }
    });

    socket.on('task:deleted', (taskId: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    });

    return () => {
      socket.off('task:created');
      socket.off('task:updated');
      socket.off('task:deleted');
    };
  }, [currentUser.id]);

  const handleSaveTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingTask) {
      await fetch(`/api/tasks/${editingTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          deadline,
          status: editingTask.status,
          priority,
        }),
      });
      setEditingTask(null);
    } else {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          deadline,
          staff_id: currentUser.id,
          priority,
        }),
      });
      setIsAdding(false);
    }

    setTitle('');
    setDescription('');
    setDeadline('');
    setPriority('normal');
  };

  const confirmDeleteTask = (id: string) => {
    setTaskToDelete(id);
  };

  const executeDeleteTask = async () => {
    if (!taskToDelete) return;
    try {
      await fetch(`/api/tasks/${taskToDelete}`, { method: 'DELETE' });
      setTaskToDelete(null);
    } catch (err) {
      console.error('Failed to delete task', err);
    }
  };

  const handleStatusChange = async (task: Task, newStatus: Task['status']) => {
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...task, status: newStatus }),
    });
  };

  const startEditing = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setDeadline(task.deadline || '');
    setPriority(task.priority || 'normal');
    setIsAdding(true);
  };

  const cancelEdit = () => {
    setEditingTask(null);
    setIsAdding(false);
    setTitle('');
    setDescription('');
    setDeadline('');
    setPriority('normal');
  };

  if (loading) {
    return <div className="animate-pulse text-slate-500 p-8">Loading tasks...</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'in-progress': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
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

  const filteredTasks = tasks.filter(task => {
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

  return (
    <div className="space-y-8">
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {filterType === 'all' ? 'My Tasks' : 'Task History'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
              {filterType === 'all' 
                ? 'Manage your daily workload and deadlines efficiently.' 
                : filterType === 'date' && filterEndDate 
                  ? `Viewing history from ${filterValue} to ${filterEndDate}`
                  : `Viewing history for ${filterType}: ${filterValue || '...'}`}
            </p>
          </div>
          
          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2 text-sm whitespace-nowrap active:scale-95 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              New Task
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-end gap-4 pt-2 border-t border-slate-100">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[120px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Priority</label>
            <select 
              value={filterPriority} 
              onChange={(e) => setFilterPriority(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm bg-white shadow-sm transition-all"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="normal">Normal</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5 flex-1 min-w-[120px]">
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

          <div className="flex flex-col gap-1.5 flex-1 min-w-[120px]">
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
              <option value="all">All History</option>
              <option value="date">By Date</option>
              <option value="month">By Month</option>
              <option value="year">By Year</option>
            </select>
          </div>

          {filterType === 'date' && (
            <div className="flex flex-col gap-1.5 col-span-full lg:col-auto">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Date Range (Max 2 Weeks)</label>
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={filterValue}
                  onChange={(e) => {
                    setFilterValue(e.target.value);
                    setFilterError('');
                  }}
                  className="px-2 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-[11px] sm:text-sm bg-white shadow-sm flex-1 sm:w-32 min-w-0"
                />
                <span className="text-slate-400 text-[10px] shrink-0">to</span>
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
                  className={`px-2 py-2 rounded-xl border ${filterError ? 'border-red-500' : 'border-slate-200'} focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-[11px] sm:text-sm bg-white shadow-sm flex-1 sm:w-32 min-w-0`}
                />
              </div>
              {filterError && <span className="text-[10px] text-red-500 font-medium ml-1">{filterError}</span>}
            </div>
          )}

          {filterType === 'month' && (
            <div className="flex flex-col gap-1.5 flex-1 min-w-[120px] max-w-[200px]">
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
            <div className="flex flex-col gap-1.5 flex-1 min-w-[120px]">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Year</label>
              <select 
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm bg-white shadow-sm"
              >
                <option value="">Year...</option>
                {Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {editingTask ? 'Edit Task' : 'Create New Task'}
            </h2>
            <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSaveTask} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Task Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="E.g., Prepare monthly report"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
                placeholder="Add more details..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
              >
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={cancelEdit}
                className="w-full sm:w-auto px-4 py-2 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {editingTask ? 'Update Task' : 'Save Task'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {filteredTasks.length === 0 && !isAdding ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 border-dashed">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">All caught up!</h3>
            <p className="text-slate-500">You don't have any tasks assigned right now.</p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const overdue = isOverdue(task);
            return (
              <div key={task.id} className={`bg-white p-5 rounded-2xl shadow-sm border ${task.status === 'completed' ? 'border-emerald-200 bg-emerald-50/30' : overdue ? 'border-red-300 bg-red-50/30' : 'border-slate-200'} transition-all hover:shadow-md flex flex-col sm:flex-row sm:items-center gap-4`}>
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex-shrink-0 pt-1 sm:pt-0">
                    <button
                      onClick={() => handleStatusChange(task, task.status === 'completed' ? 'pending' : 'completed')}
                      className="focus:outline-none group"
                    >
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 group-hover:text-emerald-600 transition-colors" />
                      ) : (
                        <Circle className={`w-6 h-6 ${overdue ? 'text-red-400 group-hover:text-red-500' : 'text-slate-300 group-hover:text-indigo-500'} transition-colors`} />
                      )}
                    </button>
                  </div>

                  {currentUser.avatar && (
                    <div className="flex-shrink-0">
                      <img 
                        src={currentUser.avatar} 
                        alt={currentUser.name} 
                        className="w-8 h-8 rounded-full object-cover border border-slate-200 cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all" 
                        onClick={() => setPreviewImage(currentUser.avatar || null)}
                      />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`text-base font-semibold truncate ${task.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                      {task.title}
                    </h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {task.priority === 'urgent' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase tracking-wider">
                          Urgent
                        </span>
                      )}
                      {overdue && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white uppercase tracking-wider flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Overdue
                        </span>
                      )}
                    </div>
                  </div>
                  {task.description && (
                    <p className={`text-sm mt-1 line-clamp-2 ${task.status === 'completed' ? 'text-slate-400' : 'text-slate-600'}`}>
                      {task.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task, e.target.value as Task['status'])}
                      className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-md border outline-none cursor-pointer ${getStatusColor(task.status)}`}
                    >
                      <option value="pending">Pending</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                    
                    {task.deadline && (
                      <span className={`text-xs flex items-center gap-1 ${task.status === 'completed' ? 'text-slate-400' : overdue ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                        <Clock className="w-3.5 h-3.5" />
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

              <div className="flex items-center gap-2 sm:self-start sm:ml-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <button
                    onClick={() => startEditing(task)}
                    className={`p-2 rounded-lg transition-colors ${overdue ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                    title="Edit task"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => confirmDeleteTask(task.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {taskToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Task</h3>
            <p className="text-slate-500 mb-6">
              Are you sure you want to delete this task? This action cannot be undone.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                onClick={() => setTaskToDelete(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeDeleteTask}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl font-medium shadow-sm transition-colors"
              >
                Delete Task
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
    </div>
  );
}
