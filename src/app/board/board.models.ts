export const STATUSES = ['pending', 'in-progress', 'completed'] as const;
export type TaskStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  'in-progress': 'In Progress',
  completed: 'Completed',
};

export const PRIORITIES = ['high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export interface Task {
  id: string;
  title: string;
  description: string;
  subject: string;
  priority: Priority;
  status: TaskStatus;
  /** Calendar date in the student's local time, or null. */
  dueDate: string | null;
  /** Case-sensitive fractional index within a status. */
  order: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskInput = Pick<Task, 'title' | 'description' | 'subject' | 'priority' | 'status' | 'dueDate'>;
export type TaskPatch = Partial<TaskInput & Pick<Task, 'order'>> & Pick<Task, 'updatedAt'>;

export interface BoardFilter {
  query: string;
  priority: Priority | 'all';
  subject: string;
}

export interface ColumnView {
  id: TaskStatus;
  title: string;
  tasks: Task[];
  totalCount: number;
}
