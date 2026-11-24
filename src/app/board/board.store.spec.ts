import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Task, TaskInput } from './board.models';
import { BoardStore } from './board.store';
import { TaskService } from './task.service';

const endpoint = '/api/tasks';
const input: TaskInput = {
  title: 'Draft the lab report', description: 'Compare both samples', subject: 'Environmental Science',
  priority: 'high', status: 'pending', dueDate: '2000-01-01',
};
const first: Task = { ...input, id: 'one', order: 'a0', createdAt: '2026-11-24T04:00:00Z', updatedAt: '2026-11-24T04:00:00Z' };
const second: Task = { ...first, id: 'two', order: 'a1', title: 'Check the readings', priority: 'low', dueDate: null };
const done: Task = { ...first, id: 'done', title: 'Submit the field notes', status: 'completed' };

describe('BoardStore with TaskService', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function load(tasks = [first, second, done]) {
    const store = TestBed.inject(BoardStore);
    const request = http.expectOne({ method: 'GET', url: endpoint });
    request.flush(tasks);
    return store;
  }

  it('confirms one completion, reaches full academic completion and restores the original rank on Undo', async () => {
    const store = load([first]);
    const saved = store.move(first.id, 'completed');
    expect(await store.move(first.id, 'completed')).toBeFalse();
    const request = http.expectOne({method:'PATCH', url:endpoint+'/one'});
    expect(store.stats().done).toBe(0);
    request.flush({...first, ...request.request.body});
    expect(await saved).toBeTrue();
    expect(store.notice()).toBe('Ayos! One task down.');
    expect(store.stats().percent).toBe(100);
    expect(await store.move(first.id, 'completed')).toBeFalse();
    http.expectNone({ method: 'PATCH', url: endpoint + '/one' });
    expect(store.deadlines().overdue).toEqual([]);
    const undo = store.undo();
    const restore = http.expectOne({method:'PATCH', url:endpoint+'/one'});
    expect(restore.request.body).toEqual(jasmine.objectContaining({status:first.status, order:first.order}));
    restore.flush(first);
    expect(await undo).toBeTrue();
    expect(store.stats().done).toBe(0);
    expect(store.undoTask()).toBeNull();
  });

  it('announces a garden level only from the confirmed server receipt', async () => {
    const store = load([first]);
    const completion = store.move(first.id, 'completed');
    expect(store.earnedGardenLevel()).toBeNull();
    const request = http.expectOne({ method: 'PATCH', url: endpoint + '/one' });
    request.flush({ ...first, ...request.request.body }, { headers: { 'X-USAD-Garden-Level': '2' } });
    expect(await completion).toBeTrue();
    expect(store.completion()?.gardenLevel).toBe(2);
    expect(store.earnedGardenLevel()).toBe(2);
    expect('awardedLevel' in store.tasks()[first.id]).toBeFalse();
    store.clearGardenMilestone();
    expect(store.earnedGardenLevel()).toBeNull();
  });

  it('emits a single confirmed Bloom and does not repeat water after undo and recompletion', async () => {
    const store = load([first]);
    const receipts: boolean[] = [];
    store.completionEvents().subscribe(receipt => receipts.push(receipt.earnedWater));

    const complete = store.move(first.id, 'completed');
    expect(await store.move(first.id, 'completed')).toBeFalse();
    expect(receipts).toEqual([]);
    const patch = http.expectOne({ method: 'PATCH', url: endpoint + '/one' });
    patch.flush({ ...first, ...patch.request.body }, { headers: { 'X-USAD-Water-Earned': '1' } });
    expect(await complete).toBeTrue();
    expect(receipts).toEqual([true]);
    expect('earnedWater' in store.tasks()[first.id]).toBeFalse();

    const undo = store.undo();
    http.expectOne({ method: 'PATCH', url: endpoint + '/one' }).flush(first);
    expect(await undo).toBeTrue();
    expect(receipts).toEqual([true]);
    const again = store.move(first.id, 'completed');
    const repeat = http.expectOne({ method: 'PATCH', url: endpoint + '/one' });
    repeat.flush({ ...first, ...repeat.request.body });
    expect(await again).toBeTrue();
    expect(receipts).toEqual([true, false]);

    store.load();
    http.expectOne(endpoint).flush([{ ...first, status: 'completed' }]);
    expect(receipts).toEqual([true, false]);
    expect(store.completion()).toBeNull();
  });

  it('starts a pending task without celebrating and loads completed work silently', async () => {
    const store = load([first]);
    const started = store.move(first.id, 'in-progress');
    const request = http.expectOne({method:'PATCH',url:endpoint+'/one'});
    request.flush({...first,...request.request.body});
    expect(await started).toBeTrue();
    expect(store.stats().active).toBe(1);
    expect(store.undoTask()).toBeNull();
    store.load();
    http.expectOne(endpoint).flush([done]);
    expect(store.notice()).toBe('');
  });

  it('loads the API records into exactly three canonical stages with live stats', () => {
    const store = load();
    expect(store.view().map(({ id }) => id)).toEqual(['pending', 'in-progress', 'completed']);
    expect(store.stats()).toEqual({ pending: 2, active: 0, done: 1, total: 3, remaining: 2, percent: 33 });
    expect(store.deadlines().overdue.map(({ id }) => id)).toEqual([first.id]);
  });

  it('loads saved server records and ignores stale localStorage', () => {
    const storageKey = 'taskflow.board.v1';
    const original = localStorage.getItem(storageKey);
    try {
      localStorage.setItem(storageKey, JSON.stringify({ cards: { legacy: {} }, columns: [] }));
      const store = load([]);
      expect(store.tasks()).toEqual({});
      expect(store.stats().total).toBe(0);
    } finally {
      if (original === null) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, original);
    }
  });

  it('creates a task through POST and appends it only after confirmation', async () => {
    const store = load();
    const saved = store.save('stable-id', input, false);
    const request = http.expectOne({ method: 'POST', url: endpoint });
    const task = request.request.body as Task;
    expect(task).toEqual(jasmine.objectContaining({ ...input, id: 'stable-id' }));
    expect(task.order > second.order).toBeTrue();
    expect(task.createdAt).toBe(task.updatedAt);
    expect(store.tasks()[task.id]).toBeUndefined();
    expect(await store.save('duplicate-click', input, false)).toBeFalse();
    request.flush(task);
    expect(await saved).toBeTrue();
    expect(store.columns().pending.at(-1)?.id).toBe(task.id);
    expect(store.notice()).toBe('Task created.');
  });

  it('filters the view without changing the board', () => {
    const store = load();
    store.setFilter({ query: 'lab report', priority: 'high' });
    expect(store.view()[0].tasks.map(({ id }) => id)).toEqual(['one']);
    expect(store.view()[0].totalCount).toBe(2);
    expect(store.isFiltering()).toBeTrue();
    store.clearFilter();
    expect(store.view()[0].tasks.length).toBe(2);
    expect(store.isFiltering()).toBeFalse();
  });

  it('rehydrates the persisted status and order from the API after a fresh start', async () => {
    const store = load();
    const moving = store.move(first.id, 'completed', 0);
    const request = http.expectOne({ method: 'PATCH', url: `${endpoint}/one` });
    const persisted = { ...first, ...request.request.body } as Task;
    request.flush(persisted);
    expect(await moving).toBeTrue();

    http.verify();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const refreshed = load([done, second, persisted]);
    expect(refreshed.columns().completed.map(({ id }) => id)).toEqual(['one', 'done']);
  });

  it('counts a moved record as completed only after the API responds', async () => {
    const store = load();
    const moving = store.move(second.id, 'completed');
    const request = http.expectOne({ method: 'PATCH', url: `${endpoint}/two` });
    expect(store.stats().done).toBe(1);
    expect(request.request.body.status).toBe('completed');
    request.flush({ ...second, ...request.request.body });
    expect(await moving).toBeTrue();
    expect(store.stats().done).toBe(2);
  });

  it('patches edited fields and status together while keeping the ID and creation time', async () => {
    const store = load();
    const saving = store.save(first.id, { ...input, title: 'Revised report', status: 'in-progress' }, true);
    const request = http.expectOne({ method: 'PATCH', url: `${endpoint}/one` });
    expect(request.request.body).toEqual(jasmine.objectContaining({ title: 'Revised report', status: 'in-progress' }));
    expect(request.request.body.createdAt).toBeUndefined();
    request.flush({ ...first, ...request.request.body });
    expect(await saving).toBeTrue();
    expect(store.columns()['in-progress'][0]).toEqual(jasmine.objectContaining({ id: first.id, createdAt: first.createdAt }));
  });

  it('deletes a task from the lookup and its stage only after confirmation', async () => {
    const store = load();
    const removing = store.remove(first.id);
    const request = http.expectOne({ method: 'DELETE', url: `${endpoint}/one` });
    expect(store.tasks()[first.id]).toEqual(first);
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(await removing).toBeTrue();
    expect(store.tasks()[first.id]).toBeUndefined();
    expect(store.columns().pending.map(({ id }) => id)).toEqual(['two']);
  });

  it('preserves a canonical stage when its last task is deleted', async () => {
    const store = load([done]);
    const removing = store.remove(done.id);
    http.expectOne({ method: 'DELETE', url: `${endpoint}/done` }).flush({});
    expect(await removing).toBeTrue();
    expect(store.view().map(({ id }) => id)).toEqual(['pending', 'in-progress', 'completed']);
    expect(store.columns().completed).toEqual([]);
  });

  it('ignores missing task IDs and drag indexes while a filter is active', async () => {
    const store = load();
    expect(await store.move('missing', 'completed', 0)).toBeFalse();
    store.setFilter({ priority: 'high' });
    expect(await store.move(first.id, 'completed', 0)).toBeFalse();
    http.expectNone((request) => request.method !== 'GET');
  });

  it('retains the last confirmed state after an API error and recovers through reload', async () => {
    const store = load();
    const saving = store.move(first.id, 'completed', 0);
    http.expectOne({ method: 'PATCH', url: `${endpoint}/one` }).flush(null, { status: 503, statusText: 'Offline' });
    expect(await saving).toBeFalse();
    expect(store.tasks()[first.id].status).toBe('pending');
    expect(store.notice()).toBe('');
    expect(store.completion()).toBeNull();
    expect(store.error()).toContain('Could not confirm');
    expect(await store.move(first.id, 'completed')).toBeFalse();
    store.load();
    store.load();
    http.expectOne({ method: 'GET', url: endpoint }).flush([{ ...first, status: 'completed' }]);
    expect(store.tasks()[first.id].status).toBe('completed');
    expect(store.canWrite()).toBeTrue();
  });

  it('recovers an initial load failure without showing synthetic tasks', () => {
    const store = TestBed.inject(BoardStore);
    http.expectOne(endpoint).flush(null, { status: 503, statusText: 'Offline' });
    expect(store.loaded()).toBeFalse();
    expect(store.tasks()).toEqual({});
    store.load();
    http.expectOne(endpoint).flush([first]);
    expect(store.loaded()).toBeTrue();
    expect(store.error()).toBe('');
  });

  it('reuses the draft ID when the server applied a POST whose response was lost', async () => {
    const store = load();
    const saving = store.save('draft-id', input, false);
    const request = http.expectOne({ method: 'POST', url: endpoint });
    const inserted = request.request.body as Task;
    request.flush(null, { status: 504, statusText: 'Timeout' });
    expect(await saving).toBeFalse();
    store.load();
    http.expectOne(endpoint).flush([first, inserted]);
    const retrying = store.save('draft-id', { ...input, title: 'Updated draft' }, false);
    http.expectOne({ method: 'PATCH', url: `${endpoint}/draft-id` }).flush({ ...inserted, title: 'Updated draft' });
    expect(await retrying).toBeTrue();
    expect(store.columns().pending.map(({ id }) => id)).toEqual(['one', 'draft-id']);
  });

  it('retrieves a single task with an encoded ID and a GET request', () => {
    const taskService = TestBed.inject(TaskService);
    let result: Task | undefined;
    taskService.get('id/with spaces').subscribe((task) => result = task);
    http.expectOne({ method: 'GET', url: `${endpoint}/id%2Fwith%20spaces` }).flush(first);
    expect(result).toEqual(first);
  });
});
