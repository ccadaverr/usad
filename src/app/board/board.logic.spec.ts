import { deadlineContext, distinctSubjects, groupDeadlines, isOverdue, isValidDeadline, matchesFilter, moveRank, orderTasks, rankBetween, todayISO } from './board.logic';
import { BoardFilter, Task } from './board.models';

const makeTask = (id: string, order: string, changes: Partial<Task> = {}): Task => ({
  id, order, title: id, description: '', subject: 'Research', priority: 'medium', status: 'pending',
  dueDate: null, createdAt: '2026-11-24T04:00:00Z', updatedAt: '2026-11-24T04:00:00Z', ...changes,
});

const first = makeTask('c1', 'a0');
const second = makeTask('c2', 'a1');
const third = makeTask('c3', 'a2');
const fourth = makeTask('c4', 'a0', { status: 'in-progress' });
const source = [first, second, third];
const destination = [fourth];

describe('board.logic', () => {
  it('reorders inside the same column', () => {
    const order = moveRank(source, first, 'pending', 2)!;
    expect(orderTasks([{ ...first, order }, second, third]).map(({ id }) => id)).toEqual(['c2', 'c3', 'c1']);
  });

  it('moves a task to another column at the given index', () => {
    const order = moveRank(destination, second, 'in-progress', 0)!;
    expect(orderTasks([...destination, { ...second, order }]).map(({ id }) => id)).toEqual(['c2', 'c4']);
  });

  it('clamps an index past the end', () => {
    expect(moveRank(destination, first, 'in-progress', 99)! > fourth.order).toBeTrue();
  });

  it('does not mutate the original tasks', () => {
    const snapshot = JSON.stringify(source);
    moveRank(source, first, 'pending', 2);
    expect(JSON.stringify(source)).toBe(snapshot);
  });

  it('skips a move that keeps its original position', () => {
    expect(moveRank(source, first, 'pending', 0)).toBeNull();
  });

  it('appends to the destination when the action does not specify an index', () => {
    expect(moveRank(destination, first, 'in-progress')! > fourth.order).toBeTrue();
  });

  it('maintains deterministic ordering using stable IDs to break rank ties', () => {
    const tasks = [makeTask('b', 'a0V'), makeTask('c', 'a0'), makeTask('a', 'a0V')];
    expect(orderTasks(tasks).map(({ id }) => id)).toEqual(['c', 'a', 'b']);
  });

  it('generates distinct ranks in the same interval and supports repeated inserts', () => {
    const used = new Set<string>();
    let upper = 'a0V1';
    for (let i = 0; i < 80; i++) {
      const rank = rankBetween('a0', upper);
      expect(rank > 'a0' && rank < upper).toBeTrue();
      expect(used.has(rank)).toBeFalse();
      used.add(rank);
      upper = rank;
    }
    expect(rankBetween('a0', 'a1')).not.toBe(rankBetween('a0', 'a1'));
  });

  const searchable = makeTask('x', 'a0', {
    title: 'Survey sample', description: 'Check missing responses', subject: 'Statistics', priority: 'high',
  });
  const filter: BoardFilter = { query: '', priority: 'all', subject: '' };

  it('matches title, description and subject, ignoring case and accents', () => {
    for (const query of ['  SURVEY ', 'missing', 'státistics']) {
      expect(matchesFilter(searchable, { ...filter, query })).toBeTrue();
    }
    expect(matchesFilter(searchable, { ...filter, query: 'History' })).toBeFalse();
  });

  it('filters by priority', () => {
    expect(matchesFilter(searchable, { ...filter, priority: 'high' })).toBeTrue();
    expect(matchesFilter(searchable, { ...filter, priority: 'low' })).toBeFalse();
  });

  it('deduplicates normalized subjects and filters them exactly', () => {
    expect(distinctSubjects([searchable, { ...first, subject: ' státisTics ' }, first])).toEqual(['Research', 'Statistics']);
    expect(matchesFilter(searchable, { ...filter, subject: 'STÁTISTICS' })).toBeTrue();
    expect(matchesFilter(searchable, { ...filter, subject: 'Stat' })).toBeFalse();
  });

  it('compares local deadlines and excludes completed tasks from overdue work', () => {
    const task = { ...first, dueDate: '2026-10-26' };
    expect(isOverdue(task, '2026-10-27')).toBeTrue();
    expect(isOverdue(task, '2026-10-26')).toBeFalse();
    expect(isOverdue({ ...task, dueDate: null }, '2026-10-27')).toBeFalse();
    expect(isOverdue({ ...task, status: 'completed' }, '2026-10-27')).toBeFalse();
  });

  it('keeps deadline urgency separate from priority and excludes completed work', () => {
    const today = '2026-11-24';
    const classify = (dueDate: string | null, status: Task['status'] = 'pending') =>
      deadlineContext({ ...first, dueDate, status }, today);
    expect(classify('2026-11-23').tone).toBe('overdue');
    expect(classify(today).tone).toBe('today');
    expect(classify('2026-12-01').tone).toBe('soon');
    expect(classify('2026-12-02').tone).toBe('neutral');
    expect(classify('2026-11-23', 'completed').tone).toBe('neutral');
    expect(classify(null).label).toBe('No due date');
  });

  it('formats the student’s local date', () => {
    expect(todayISO(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('validates calendar dates and permits an empty or past deadline', () => {
    for (const date of ['', '2024-02-29', '2023-02-28', '0001-01-01']) expect(isValidDeadline(date)).toBeTrue();
    for (const date of ['2025-02-29', '2026-04-31', '2026-1-01', '0000-01-01', '2026-13-01']) {
      expect(isValidDeadline(date)).toBeFalse();
    }
  });

  it('groups unfinished deadlines without duplicating completed records', () => {
    const groups = groupDeadlines([
      { ...first, dueDate: '2026-11-22' },
      { ...second, dueDate: '2026-11-24' },
      { ...third, dueDate: '2026-11-28' },
      fourth,
      makeTask('done', 'a0', { status: 'completed', dueDate: '2026-11-21' }),
    ], '2026-11-24');
    expect(Object.values(groups).map((tasks) => tasks.map(({ id }) => id))).toEqual([['c1'], ['c2'], ['c3'], ['c4']]);
  });
});
