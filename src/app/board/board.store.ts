import { DestroyRef, NgZone, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { Observable, Subject, finalize } from 'rxjs';
import { distinctSubjects, groupDeadlines, matchesFilter, moveRank, orderTasks, rankBetween, todayISO } from './board.logic';
import { BoardFilter, ColumnView, STATUS_LABELS, STATUSES, Task, TaskInput, TaskStatus } from './board.models';
import { SavedTask, StreakMilestone, TaskService } from './task.service';

const emptyFilter: BoardFilter = { query: '', priority: 'all', subject: '' };

export interface CompletionReceipt {
  taskId: string;
  earnedWater: boolean;
}

interface BoardState {
  tasks: Record<string, Task>;
  filter: BoardFilter;
  today: string;
  loaded: boolean;
  loading: boolean;
  saving: boolean;
  error: string;
  notice: string;
  completion: CompletionReceipt | null;
  undoTask: Task | null;
}

const initialState: BoardState = {
  tasks: {},
  filter: emptyFilter,
  today: todayISO(),
  loaded: false,
  loading: false,
  saving: false,
  undoTask: null,
  error: '',
  notice: '',
  completion: null,
};

export const BoardStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ tasks, filter, today, loaded, loading, saving, error }) => {
    const all = computed(() => orderTasks(Object.values(tasks())));
    const columns = computed<Record<TaskStatus, Task[]>>(() => ({
      pending: all().filter(({ status }) => status === 'pending'),
      'in-progress': all().filter(({ status }) => status === 'in-progress'),
      completed: all().filter(({ status }) => status === 'completed'),
    }));
    return {
      columns,
      subjects: computed(() => distinctSubjects(all())),
      deadlines: computed(() => groupDeadlines(all(), today())),
      canWrite: computed(() => loaded() && !loading() && !saving() && !error()),
      isFiltering: computed(() => !!(filter().query.trim() || filter().priority !== 'all' || filter().subject)),
      view: computed<ColumnView[]>(() => STATUSES.map((id) => ({
        id,
        title: STATUS_LABELS[id],
        totalCount: columns()[id].length,
        tasks: columns()[id].filter((task) => matchesFilter(task, filter())),
      }))),
      stats: computed(() => {
        const pending = columns().pending.length;
        const active = columns()['in-progress'].length;
        const done = columns().completed.length;
        const total = pending + active + done;
        return {
          pending, active, done, total,
          remaining: pending + active,
          percent: total ? Math.floor(done / total * 100) : 0,
        };
      }),
    };
  }),
  withMethods((store) => {
    const api = inject(TaskService);
    const destroyRef = inject(DestroyRef);
    const zone = inject(NgZone);
    let noticeTimer: ReturnType<typeof setTimeout>;
    destroyRef.onDestroy(() => clearTimeout(noticeTimer));
    const completed = new Subject<CompletionReceipt>();
    const gardenChanged = new Subject<void>();
    let pendingMilestone: StreakMilestone | undefined;
    const changes = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('usad.tasks.changed');
    let reloadQueued = false;
    const reloadAfterWrite = () => {
      if (reloadQueued && !destroyRef.destroyed && !store.loading() && !store.saving()) load();
    };
    if (changes) changes.onmessage = () => {
      // Only an invalidation signal crosses tabs. Each tab reads its authenticated workspace.
      reloadQueued = true;
      reloadAfterWrite();
      gardenChanged.next();
    };
    destroyRef.onDestroy(() => {
      completed.complete();
      gardenChanged.complete();
      changes?.close();
    });

    function updateTask({ earnedWater, gardenChanged: changed, milestone, ...task }: SavedTask): void {
      const previous = store.tasks()[task.id];
      const tasks = { ...store.tasks(), [task.id]: task };
      const movedToComplete = !!previous && previous.status !== 'completed' && task.status === 'completed';
      if (movedToComplete || earnedWater && task.status === 'completed') {
        const completion: CompletionReceipt = { taskId: task.id, earnedWater: earnedWater === true };
        // The response is confirmed. Let motion capture the visible row before the view changes.
        completed.next(completion);
        patchState(store, { tasks, notice: 'Ayos! One task down.', undoTask: movedToComplete ? previous : null, completion });
      } else {
        patchState(store, { tasks });
      }
      if (milestone) {
        pendingMilestone = { ...milestone, before: Math.min(pendingMilestone?.before ?? milestone.before, milestone.before) };
      }
      if (changed || earnedWater) gardenChanged.next();
    }

    function write<T>(request: Observable<T>, message: string, apply: (value: T) => void): Promise<boolean> {
      if (!store.canWrite()) return Promise.resolve(false);
      clearTimeout(noticeTimer);
      patchState(store, { saving: true, notice: '', completion: null });
      return new Promise((resolve) => {
        request.pipe(takeUntilDestroyed(destroyRef), finalize(reloadAfterWrite)).subscribe({
          next: (value) => {
            patchState(store, { saving: false, notice: message, undoTask: null });
            apply(value);
            changes?.postMessage('changed');
            clearTimeout(noticeTimer);
            noticeTimer = zone.runOutsideAngular(() => setTimeout(() => patchState(store, { notice: '', undoTask: null, completion: null }), 12000));
            resolve(true);
          },
          error: () => {
            patchState(store, { saving: false, error: 'Could not confirm the change. Reload tasks before trying again.' });
            resolve(false);
          },
          complete: () => resolve(false),
        });
      });
    }

    function nextOrder(status: TaskStatus): string {
      return rankBetween(store.columns()[status].at(-1)?.order ?? null, null);
    }

    function load(): void {
      if (store.loading() || store.saving()) return;
      reloadQueued = false;
      patchState(store, { loading: true, notice: '', completion: null });
      api.list().pipe(takeUntilDestroyed(destroyRef), finalize(reloadAfterWrite)).subscribe({
        next: (tasks) => patchState(store, {
          tasks: Object.fromEntries(tasks.map((task) => [task.id, task])),
          undoTask: tasks.some(task => task.id === store.undoTask()?.id && task.status === 'completed') ? store.undoTask() : null,
          loaded: true,
          loading: false,
          error: '',
        }),
        error: () => patchState(store, { loading: false, error: 'Could not load tasks. Check that the task server is running, then try again.' }),
      });
    }

    return {
      completionEvents: () => completed.asObservable(),
      gardenChanges: () => gardenChanged.asObservable(),
      takeStreakMilestone(revision: number, streak: number): number | undefined {
        const milestone = pendingMilestone;
        if (!milestone || revision < milestone.revision) return;
        pendingMilestone = undefined;
        if (streak >= milestone.after) return milestone.before;
        return undefined;
      },
      undo(): Promise<boolean> {
        const previous = store.undoTask();
        if (!previous || store.tasks()[previous.id]?.status !== 'completed') return Promise.resolve(false);
        return write(api.update(previous.id, { status: previous.status, order: previous.order,
          updatedAt: new Date().toISOString() }), 'Previous stage restored.', updateTask);
      },
      load,
      setToday(): void {
        patchState(store, { today: todayISO() });
      },
      setFilter(filter: Partial<BoardFilter>): void {
        patchState(store, { filter: { ...store.filter(), ...filter } });
      },
      clearFilter(): void {
        patchState(store, { filter: emptyFilter });
      },
      save(id: string, input: TaskInput, isEdit: boolean): Promise<boolean> {
        if (!store.canWrite()) return Promise.resolve(false);
        const task = store.tasks()[id];
        if (isEdit && !task) return Promise.resolve(false);
        const updatedAt = new Date().toISOString();
        // A reloaded POST may already exist when its response was lost. Reuse the draft ID.
        if (task) {
          const order = input.status === task.status ? task.order : nextOrder(input.status);
          return write(api.update(id, { ...input, order, updatedAt }), 'Task saved.', updateTask);
        }
        return write(api.create({ ...input, id, order: nextOrder(input.status), createdAt: updatedAt, updatedAt }), 'Task created.', updateTask);
      },
      remove(id: string): Promise<boolean> {
        if (!store.tasks()[id]) return Promise.resolve(false);
        return write(api.delete(id), 'Task deleted.', changed => {
          const tasks = { ...store.tasks() };
          delete tasks[id];
          patchState(store, { tasks });
          if (changed) gardenChanged.next();
        });
      },
      move(id: string, status: TaskStatus, index?: number): Promise<boolean> {
        if (!store.canWrite() || (index !== undefined && store.isFiltering())) return Promise.resolve(false);
        const task = store.tasks()[id];
        if (!task || (index === undefined && task.status === status)) return Promise.resolve(false);
        const order = moveRank(store.columns()[status], task, status, index);
        if (order === null) return Promise.resolve(false);
        return write(
          api.update(id, { status, order, updatedAt: new Date().toISOString() }),
          task.status === status ? 'Task order saved.' : `Task moved to ${STATUS_LABELS[status]}.`,
          updateTask,
        );
      },
    };
  }),
  withHooks({
    onInit(store) {
      store.setToday();
      store.load();
      const timer = inject(NgZone).runOutsideAngular(() => setInterval(() => store.setToday(), 30_000));
      inject(DestroyRef).onDestroy(() => clearInterval(timer));
    },
  }),
);
