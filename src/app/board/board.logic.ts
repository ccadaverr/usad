import { generateKeyBetween } from 'fractional-indexing';
import { BoardFilter, Task, TaskStatus } from './board.models';

export function createId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    Array.from(globalThis.crypto.getRandomValues(new Uint32Array(4)), (value) => value.toString(16).padStart(8, '0')).join('');
}

export function todayISO(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(now.getFullYear()).padStart(4, '0')}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Parse into local calendar time for display without shifting the date through UTC.
export function localDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export function isValidDeadline(value: string): boolean {
  if (value === '') return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = localDate(value);
  return !Number.isNaN(date.getTime()) && todayISO(date) === value;
}

export function isOverdue(task: Task, today: string): boolean {
  return task.status !== 'completed' && task.dueDate !== null && task.dueDate < today;
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

export function matchesFilter(task: Task, filter: BoardFilter): boolean {
  if (filter.priority !== 'all' && task.priority !== filter.priority) return false;
  if (filter.subject && normalize(task.subject) !== normalize(filter.subject)) return false;
  const query = normalize(filter.query);
  return [task.title, task.description, task.subject].some((value) => normalize(value).includes(query));
}

export function distinctSubjects(tasks: Task[]): string[] {
  const subjects = new Map<string, string>();
  for (const { subject } of tasks) {
    const key = normalize(subject);
    if (!subjects.has(key)) subjects.set(key, subject);
  }
  return [...subjects.values()].sort((a, b) => a.localeCompare(b));
}

function compareKey(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function orderTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => compareKey(a.order, b.order) || compareKey(a.id, b.id));
}

/** Use a distinct suffix so concurrent appends or drops can share an interval safely. */
export function rankBetween(before: string | null, after: string | null): string {
  let key = generateKeyBetween(before, after);
  // If the generated key is a prefix of the upper bound, leave room for the suffix below it.
  while (after?.startsWith(key)) key += '0';
  const suffix = Array.from(crypto.getRandomValues(new Uint32Array(2)), (value) =>
    value.toString(36).padStart(7, '0'),
  ).join('');
  return key + suffix + 'V';
}

/** A new rank only changes the moved record, so there is no partial multi-request reorder. */
export function moveRank(tasks: Task[], task: Task, status: TaskStatus, index?: number): string | null {
  const siblings = tasks.filter(({ id }) => id !== task.id);
  const position = Math.max(0, Math.min(index ?? siblings.length, siblings.length));
  if (status === task.status && tasks[position]?.id === task.id) return null;
  return rankBetween(siblings[position - 1]?.order ?? null, siblings[position]?.order ?? null);
}

export function taskSwipeStatus(status: TaskStatus | undefined, action: 'start' | 'complete'): TaskStatus | null {
  if (status === 'pending') return action === 'start' ? 'in-progress' : 'completed';
  return status === 'in-progress' && action === 'complete' ? 'completed' : null;
}

function calendarDistance(date: string, today: string): number {
  // ISO date-only strings represent calendar days, independent of local DST changes.
  return (Date.parse(date) - Date.parse(today)) / 86_400_000;
}

export function groupDeadlines(tasks: Task[], today: string) {
  const groups: Record<'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'undated', Task[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
    upcoming: [],
    undated: [],
  };
  const open = tasks.filter((task) => task.status !== 'completed')
    .sort((a, b) => compareKey(a.dueDate ?? '', b.dueDate ?? '') || compareKey(a.id, b.id));
  for (const task of open) {
    if (!task.dueDate) groups.undated.push(task);
    else if (isOverdue(task, today)) groups.overdue.push(task);
    else if (task.dueDate === today) groups.today.push(task);
    else if (calendarDistance(task.dueDate, today) === 1) groups.tomorrow.push(task);
    else groups.upcoming.push(task);
  }
  return groups;
}

export function deadlineContext(task: Pick<Task, 'dueDate' | 'status'>, today: string) {
  if (!task.dueDate) return { tone: 'neutral', label: 'No due date' };
  if (task.status === 'completed') return { tone: 'neutral', label: 'Due' };
  const days = calendarDistance(task.dueDate, today);
  if (days < 0) return { tone: 'overdue', label: `${-days} ${days === -1 ? 'day' : 'days'} overdue` };
  if (days === 0) return { tone: 'today', label: 'Due today' };
  if (days === 1) return { tone: 'tomorrow', label: 'Due tomorrow' };
  if (days <= 7) return { tone: 'soon', label: 'Due soon' };
  return { tone: 'neutral', label: 'Due' };
}
