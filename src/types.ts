export interface User {
  id: string;
  name: string;
  role: 'manager' | 'staff';
  password?: string;
  avatar?: string | null;
  managerName?: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  status: 'pending' | 'in-progress' | 'completed';
  staff_id: string;
  created_at: string;
  updated_at?: string | null;
  priority: 'urgent' | 'normal';
}
