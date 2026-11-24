import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroupDirective } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { CardDialogComponent } from './board/card-dialog.component';
import { GuestSession } from './guest/guest-session.service';
import { WorkspaceComponent } from './workspace.component';
import { Task } from './board/board.models';
import { BoardStore } from './board/board.store';
import { localDate, todayISO } from './board/board.logic';
import { CompletionMotion } from './shared/completion-motion';
import { APPEARANCE_KEY, APPEARANCE_MODE_KEY, AppearanceService } from './shared/appearance.service';

const task: Task = {
  id: 'field-notes', title: 'Annotate the field notes', subject: 'Research Methods', description: '',
  priority: 'medium', status: 'pending', dueDate: null, order: 'a0',
  createdAt: '2026-11-24T04:00:00Z', updatedAt: '2026-11-24T04:00:00Z',
};

describe('USAD views', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<App>;
  let router: Router;

  const guest = { displayName: 'Jaztin', onboardingComplete: true };
  const workspace = () => fixture.debugElement.query(By.directive(WorkspaceComponent));
  const workspaceStore = () => workspace().injector.get(BoardStore);

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter(routes), provideLocationMocks(),
        { provide: GuestSession, useValue: { profile: () => guest, ensure: async () => guest } },
        { provide: DIALOG_DATA, useValue: { status: 'pending' } },
        { provide: DialogRef, useValue: { close: jasmine.createSpy('close') } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await navigate('/home');
    http.expectOne('/api/tasks').flush([task]);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  async function navigate(path: string): Promise<void> {
    await fixture.ngZone!.run(() => router.navigateByUrl(path));
    fixture.detectChanges();
  }

  async function renderHome(records: Task[]) {
    workspaceStore().load();
    http.expectOne('/api/tasks').flush(records);
    await navigate('/home');
    return fixture.nativeElement as HTMLElement;
  }

  function taskGesture(row: HTMLElement) {
    spyOn(row, 'setPointerCapture');
    Object.defineProperty(row, 'clientWidth', { value: 300 });
    const pointer = (type: string, x: number, y: number, target: HTMLElement) => {
      fixture.ngZone!.run(() => target.dispatchEvent(new PointerEvent(type, {
        pointerId: 8, isPrimary: true, pointerType: 'touch', clientX: x, clientY: y,
        button: 0, bubbles: true, cancelable: true,
      })));
      fixture.detectChanges();
    };
    return (dx: number, dy = 0, cancel = false, target = row) => {
      pointer('pointerdown', 150, 100, target);
      pointer('pointermove', 150 + dx, 100 + dy, target);
      pointer(cancel ? 'pointercancel' : 'pointerup', 150 + dx, 100 + dy, target);
    };
  }

  it('prioritizes overdue coursework over undated active work', async () => {
    const page = await renderHome([task, { ...task, id: 'late', title: 'Late report', dueDate: '2000-01-01' }]);
    expect(page.querySelector('#focus-title')?.textContent).toBe('Late report');
  });

  it('keeps completion in Agenda, outside the featured priority section', async () => {
    const page = await renderHome([{ ...task, dueDate: todayISO() }]);
    expect(page.querySelector('.home-priority .complete-action')).toBeNull();
    expect(page.querySelector('.home-priority .priority')?.textContent).toContain('Medium');
    expect(page.querySelector('.home-priority .focus-task-title')?.textContent).toBe(task.title);
    expect(page.querySelector('.home-agenda .complete-action')?.getAttribute('aria-label')).toContain(task.title);
  });

  it('prioritizes actionable deadline groups and excludes finished assignments', async () => {
    const dateAt = (offset: number) => {
      const date = localDate(workspaceStore().today());
      date.setDate(date.getDate() + offset);
      return todayISO(date);
    };
    const page = await renderHome([-1, 0, 1, 5].map((offset, index) => ({
      ...task, id: String(index), dueDate: dateAt(offset),
    })).concat({ ...task, id: 'done', title: 'Finished earlier', status: 'completed', dueDate: dateAt(-1) }));
    await navigate('/deadlines');
    expect(page.querySelector('.deadline-lead')?.getAttribute('data-urgency')).toBe('overdue');
    expect(page.querySelector('.deadline-lead strong')?.textContent).toBe('1');
    expect(Array.from(page.querySelectorAll('[data-deadline-group]'), element => element.getAttribute('data-deadline-group')))
      .toEqual(['overdue', 'today', 'tomorrow', 'upcoming']);
    expect(page.querySelector('[data-deadline-group="overdue"]')?.textContent).toContain('1 day overdue');
    expect(page.querySelector('main')?.textContent).not.toContain('Finished earlier');
  });

  it('selects the nearest future deadline before undated active work', async () => {
    const page = await renderHome([{ ...task, status: 'in-progress' },
      { ...task, id: 'near', title: 'Next deadline', dueDate: '2099-01-01' }]);
    expect(page.querySelector('#focus-title')?.textContent).toBe('Next deadline');
  });

  it('shows the completed percentage and excludes finished tasks from due soon', async () => {
    const page = await renderHome([task, { ...task, id: 'finished', status: 'completed', dueDate: '2099-01-01' }]);
    expect(page.querySelector('.summary-total')?.textContent).toContain('50%');
    expect(page.querySelector('.home-upcoming .task-row')).toBeNull();
  });

  it('limits the agenda to three open deadlines in chronological order', async () => {
    const page = await renderHome(['2099-04-01','2000-01-01','2099-02-01','2099-01-01'].map((dueDate,i) =>
      ({ ...task, dueDate, id: String(i), title: dueDate })));
    expect(Array.from(page.querySelectorAll('.home-agenda .task-row-copy strong'), node => node.textContent))
      .toEqual(['2000-01-01','2099-01-01','2099-02-01']);
  });

  it('shows encouragement without a recommendation in an empty workspace', async () => {
    const page = await renderHome([]);
    expect(page.querySelector('#focus-title')?.textContent).toBe('Every great thing starts with one small step.');
    expect(page.querySelector('.home-priority .eyebrow')).toBeNull();
    expect(page.querySelector('h1')?.textContent).toBe('Kamusta, Jaztin!');
    expect(page.querySelector('.workspace-empty button')?.textContent).toContain('Create your first task');
  });

  it('routes from bottom navigation and identifies the active screen', async () => {
    await navigate('/home');
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('nav [aria-current="page"]')?.textContent?.trim()).toBe('Home');
    for (const [path, heading] of [
      ['/board', 'Task board'], ['/deadlines', 'Deadlines'], ['/progress', 'Study progress'],
    ]) {
      const link = page.querySelector<HTMLAnchorElement>(`nav a[href="${path}"]`)!;
      fixture.ngZone!.run(() => link.click());
      await fixture.whenStable();
      fixture.detectChanges();
      expect(router.url).toBe(path);
      expect(link.getAttribute('aria-current')).toBe('page');
      expect(page.querySelector('h1')?.textContent?.trim()).toBe(heading);
    }
  });

  it('connects three CDK drop lists and persists a cross-stage drop', async () => {
    await navigate('/board');
    const lists = fixture.debugElement.queryAll(By.directive(CdkDropList));
    expect(lists.map((list) => list.injector.get(CdkDropList).data)).toEqual(['pending', 'in-progress', 'completed']);
    const from = lists[0].injector.get(CdkDropList);
    const to = lists[1].injector.get(CdkDropList);
    const drag = fixture.debugElement.query(By.directive(CdkDrag)).injector.get(CdkDrag);
    const event = {
      previousContainer: from, container: to, previousIndex: 0, currentIndex: 0, item: drag,
      isPointerOverContainer: false, distance: { x: 0, y: 20 }, dropPoint: { x: 0, y: 20 }, event: new MouseEvent('mouseup'),
    };
    to.dropped.emit(event);
    http.expectNone({ method: 'PATCH', url: '/api/tasks/field-notes' });
    to.dropped.emit({ ...event, isPointerOverContainer: true });
    const request = http.expectOne({ method: 'PATCH', url: '/api/tasks/field-notes' });
    expect(request.request.body).toEqual(jasmine.objectContaining({ status: 'in-progress', order: jasmine.any(String) }));
    request.flush({ ...task, ...request.request.body });
    expect(workspaceStore().columns()['in-progress'][0].id).toBe(task.id);
  });

  it('opens the existing editor directly from the card text and restores focus on close', async () => {
    await navigate('/board');
    const card = fixture.nativeElement.querySelector('.task-title') as HTMLButtonElement;
    card.focus();
    fixture.ngZone!.run(() => card.querySelector<HTMLElement>('.card-meta')!.click());
    fixture.detectChanges();
    const dialog = document.querySelector<HTMLElement>('.task-dialog')!;
    expect(dialog.querySelector('h2')?.textContent).toBe('Edit task');
    expect(dialog.querySelector<HTMLInputElement>('#task-title')?.value).toBe(task.title);
    const pane = dialog.closest<HTMLElement>('.cdk-overlay-pane')!;
    dialog.querySelector<HTMLButtonElement>('[aria-label="Close task details"]')!.click();
    await Promise.allSettled(pane.getAnimations().map(animation => animation.finished));
    await fixture.whenStable();
    expect(document.activeElement).toBe(card);
  });

  it('starts on a right swipe, completes on a left swipe and ignores unsupported swipes', async () => {
    await navigate('/board');
    const view = fixture.nativeElement as HTMLElement;
    const endpoint = '/api/tasks/' + task.id;
    const gesture = (stage: string) => taskGesture(view.querySelector<HTMLElement>('#stage-' + stage + ' .swipe-row')!);
    const pending = gesture('pending');
    pending(120);
    pending(120);
    const started = http.expectOne({ method: 'PATCH', url: endpoint });
    expect(started.request.body.status).toBe('in-progress');
    started.flush({ ...task, ...started.request.body });
    await navigate('/board');
    const active = gesture('in-progress');
    active(122);
    http.expectNone({ method: 'PATCH', url: endpoint });
    active(-124);
    const completed = http.expectOne({ method: 'PATCH', url: endpoint });
    expect(completed.request.body.status).toBe('completed');
    completed.flush({ ...task, ...completed.request.body }, { headers: { 'X-USAD-Water-Earned': '1' } });
    await navigate('/board');
    const done = gesture('completed');
    done(-124);
    done(124);
    http.expectNone({ method: 'PATCH', url: endpoint });
    expect(workspaceStore().completion()?.earnedWater).toBeTrue();
  });

  it('cancels short, vertical and cancelled swipes and recovers a failed pending completion', async () => {
    await navigate('/board');
    const view = fixture.nativeElement as HTMLElement;
    const row = view.querySelector<HTMLElement>('#stage-pending .swipe-row')!;
    const swipe = taskGesture(row);
    const endpoint = '/api/tasks/' + task.id;
    swipe(-40);
    swipe(-5, 135);
    swipe(-120, 0, true);
    swipe(-120, 0, false, row.querySelector<HTMLElement>('.move-control')!);
    expect(row.style.getPropertyValue('--swipe-offset')).toBe('0px');
    http.expectNone({ method: 'PATCH', url: endpoint });

    swipe(-120);
    const rejected = http.expectOne({ method: 'PATCH', url: endpoint });
    expect(rejected.request.body.status).toBe('completed');
    expect(row.getAttribute('aria-busy')).toBe('true');
    rejected.flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(row.style.getPropertyValue('--swipe-offset')).toBe('0px');
    expect(workspaceStore().tasks()[task.id].status).toBe('pending');
    expect(workspaceStore().completion()).toBeNull();
    expect(view.querySelector('[role="alert"]')?.textContent).toContain('Could not confirm');
    view.querySelector<HTMLButtonElement>('.workspace-error button')!.click();
    http.expectOne('/api/tasks').flush([task]);
    fixture.detectChanges();
    expect(view.querySelector('[role="alert"]')).toBeNull();
  });

  it('reports combined filter results, blocks indexed drops and resets the original task order', async () => {
    const math: Task = { ...task, id: 'math', order: 'a1', subject: 'Math', priority: 'high' };
    const another: Task = { ...math, id: 'another', order: 'a2', title: 'Read the next chapter' };
    const view = await renderHome([task, math, another]);
    await navigate('/board');
    const search = view.querySelector<HTMLInputElement>('#task-search')!;
    search.value = 'field';
    search.dispatchEvent(new Event('input'));
    workspaceStore().setFilter({ subject: 'Math', priority: 'high' });
    fixture.detectChanges();
    expect(view.querySelector('.board-results')?.textContent).toContain('1 of 3 tasks');
    expect(view.querySelectorAll('#stage-pending .board-card').length).toBe(1);
    expect(fixture.debugElement.queryAll(By.directive(CdkDropList)).every(list => list.injector.get(CdkDropList).disabled)).toBeTrue();
    expect(await workspaceStore().move(math.id, 'in-progress', 0)).toBeFalse();
    http.expectNone({ method: 'PATCH', url: '/api/tasks/' + math.id });
    view.querySelector<HTMLButtonElement>('.board-result-line .board-reset')!.click();
    fixture.detectChanges();
    expect(search.value).toBe('');
    expect(Array.from(view.querySelectorAll('#stage-pending .board-card'), element => element.getAttribute('data-task-id')))
      .toEqual([task.id, math.id, another.id]);
  });

  it('renders progress from stored status counts with an honest empty state and no garden directory', async () => {
    const view = await renderHome([task, { ...task, id: 'active', status: 'in-progress' }, { ...task, id: 'done', status: 'completed' }]);
    await navigate('/progress');
    expect(view.querySelector('.completion-ring')?.getAttribute('aria-valuenow')).toBe('33');
    expect(Array.from(view.querySelectorAll<HTMLProgressElement>('.distribution-row progress'), meter => [meter.value, meter.max]))
      .toEqual([[1, 3], [1, 3], [1, 3]]);
    expect(view.querySelector('.completed-panel .task-list')?.children.length).toBe(1);
    expect(view.querySelector('main [href="/garden"]')).toBeNull();
    workspaceStore().load();
    http.expectOne('/api/tasks').flush([]);
    fixture.detectChanges();
    expect(view.querySelector('.completion-ring')?.getAttribute('aria-valuenow')).toBe('0');
    expect(view.querySelector('.progress-distribution')).toBeNull();
  });

  it('opens the independent garden and keeps Progress separate', async () => {
    await navigate('/garden');
    http.expectOne('/api/garden').flush({ lifetime: 3, level: 2, available: 1 });
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    expect(Array.from(page.querySelectorAll('nav .nav-inner a'), link => link.textContent?.trim())).toEqual([
      'Home', 'Board', 'Deadlines', 'Progress', 'Tanim',
    ]);
    expect(page.querySelector('nav [aria-current="page"]')?.getAttribute('aria-label')).toBe('Munting Tanim');
    expect(fixture.nativeElement.textContent).toContain('Level 2 of 10');
    expect(fixture.nativeElement.textContent).toContain('1 task to level 3');
    await navigate('/progress');
    expect(page.querySelector('nav [aria-current="page"]')?.textContent?.trim()).toBe('Progress');
    expect(page.querySelector('app-plant')).toBeNull();
    http.expectNone('/api/garden');

  });

  it('uses a settled flowering illustration in reduced motion and keeps the watering operation across route changes', async () => {
    const media = Object.assign(new EventTarget(), { matches: true });
    spyOn(window, 'matchMedia').and.returnValue(media as unknown as MediaQueryList);
    const view = fixture.nativeElement as HTMLElement;
    await navigate('/garden');
    http.expectOne('/api/garden').flush({ lifetime: 6, level: 4, available: 1 });
    fixture.detectChanges();
    expect(view.querySelector('.plant-art')?.getAttribute('data-blossoms')).toBe('1');
    expect(view.querySelector('.plant-fallback .fallback-flower')).not.toBeNull();
    expect(view.querySelector('.plant-ready')).toBeNull();
    expect(view.querySelector('.flower-unfold')).toBeNull();

    view.querySelector<HTMLButtonElement>('.garden-water button')!.click();
    const failed = http.expectOne('/api/garden/water');
    failed.flush({}, { status: 503, statusText: 'Unavailable' });
    await navigate('/home');
    await navigate('/garden');
    http.expectOne('/api/garden').flush({ lifetime: 6, level: 4, available: 0 });
    fixture.detectChanges();
    const retry = view.querySelector<HTMLButtonElement>('.garden-water button')!;
    expect(retry.textContent).toContain('Retry watering');
    retry.click();
    const resolved = http.expectOne('/api/garden/water');
    expect(resolved.request.body).toEqual(failed.request.body);
    resolved.flush({ lifetime: 6, level: 4, available: 0 });
    fixture.detectChanges();
    expect(view.querySelector('.garden-feedback')?.textContent).toContain('Plant watered.');
    expect(view.querySelector('.plant-art')?.getAttribute('data-blossoms')).toBe('1');
  });

  it('plays Bloom only after a successful task write and exposes a confirmed water reward', async () => {
    await navigate('/home');
    const view = fixture.nativeElement as HTMLElement;
    const motion = spyOn(workspace().injector.get(CompletionMotion), 'play').and.callThrough();
    const store = workspaceStore();
    const saving = store.move(task.id, 'completed');
    expect(motion).not.toHaveBeenCalled();
    const request = http.expectOne({ method: 'PATCH', url: '/api/tasks/field-notes' });
    request.flush({ ...task, ...request.request.body }, { headers: { 'X-USAD-Water-Earned': '1' } });
    expect(await saving).toBeTrue();
    fixture.detectChanges();
    expect(motion).toHaveBeenCalledOnceWith(task.id, task.title);
    expect(view.querySelector('.feedback-copy')?.textContent).toContain('Ayos! One task down.');
    expect(view.querySelector('.bloom-reward')?.textContent).toContain('+1 water drop earned');
    expect(view.querySelectorAll('.reward-droplet').length).toBe(1);
    expect(view.querySelector('[role="status"]')?.textContent).toContain('+1 water drop earned');
    store.load();
    http.expectOne('/api/tasks').flush([{ ...task, status: 'completed' }]);
    fixture.detectChanges();
    expect(view.querySelector('.reward-droplet')).toBeNull();
  });

  it('shows textual completion and a static check in reduced motion', async () => {
    await navigate('/home');
    const view = fixture.nativeElement as HTMLElement;
    spyOn(window, 'matchMedia').and.returnValue({ matches: true } as MediaQueryList);
    const saving = workspaceStore().move(task.id, 'completed');
    const request = http.expectOne({ method: 'PATCH', url: '/api/tasks/field-notes' });
    request.flush({ ...task, ...request.request.body });
    expect(await saving).toBeTrue();
    fixture.detectChanges();
    expect(view.querySelector('app-usad-bloom')).not.toBeNull();
    expect(view.querySelector('.bloom-animated')).toBeNull();
    expect(view.querySelector('.bloom-reward')).toBeNull();
    expect(view.querySelector('[role="status"]')?.textContent).toContain('Ayos! One task down.');
  });

  it('does not render Bloom after a failed task write', async () => {
    await navigate('/home');
    const view = fixture.nativeElement as HTMLElement;
    const saving = workspaceStore().move(task.id, 'completed');
    http.expectOne({ method: 'PATCH', url: '/api/tasks/field-notes' }).flush('Offline', {
      status: 503, statusText: 'Offline',
    });
    expect(await saving).toBeFalse();
    fixture.detectChanges();
    expect(view.querySelector('app-usad-bloom')).toBeNull();
    expect(view.querySelector('[role="alert"]')?.textContent).toContain('Could not confirm');
  });

  it('applies the workspace theme to the real CDK task composer overlay', () => {
    const appearance = TestBed.inject(AppearanceService);
    const original = appearance.selected();
    const originalMode = appearance.mode();
    const saved = localStorage.getItem(APPEARANCE_KEY);
    const savedMode = localStorage.getItem(APPEARANCE_MODE_KEY);
    try {
      appearance.selectMode('light');
      appearance.select('blue-hour');
      const fab = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.create-task-fab')!;
      fixture.ngZone!.run(() => fab.click());
      fixture.detectChanges();
      const taskDialog = document.querySelector<HTMLElement>('.cdk-overlay-container .task-dialog')!;
      expect(getComputedStyle(taskDialog).backgroundColor).toBe('rgb(252, 253, 255)');
      expect(getComputedStyle(taskDialog.querySelector('.button-primary')!).backgroundColor).toBe('rgb(50, 78, 112)');
      appearance.selectMode('dark');
      expect(getComputedStyle(taskDialog).backgroundColor).toBe('rgb(36, 47, 64)');
      taskDialog.querySelector<HTMLButtonElement>('[aria-label="Close task details"]')!.click();
    } finally {
      appearance.select(original);
      appearance.selectMode(originalMode);
      if (saved === null) localStorage.removeItem(APPEARANCE_KEY);
      else localStorage.setItem(APPEARANCE_KEY, saved);
      if (savedMode === null) localStorage.removeItem(APPEARANCE_MODE_KEY);
      else localStorage.setItem(APPEARANCE_MODE_KEY, savedMode);
    }
  });

  it('offers a clean pending composer with saved subjects and a quick due date', () => {
    const dialog = TestBed.createComponent(CardDialogComponent);
    http.expectOne('/api/tasks').flush([task]);
    dialog.detectChanges();
    const page = dialog.nativeElement as HTMLElement;
    expect(page.querySelector('.field-error')).toBeNull();
    expect(page.querySelector('#task-status')).toBeNull();
    expect(page.querySelector('datalist option')?.getAttribute('value')).toBe('Research Methods');
    expect(page.querySelector('details')?.open).toBeFalse();
    const form = dialog.debugElement.query(By.directive(FormGroupDirective)).injector.get(FormGroupDirective).form;
    const today = Array.from(page.querySelectorAll('button')).find(button => button.textContent?.trim() === 'Today');
    today?.click();
    expect(form.value.dueDate).toBe(TestBed.inject(BoardStore).today());
    expect(form.value.priority).toBe('medium');
  });

  it('blocks submission for whitespace-only titles and invalid deadlines', () => {
    const dialog = TestBed.createComponent(CardDialogComponent);
    http.expectOne('/api/tasks').flush([task]);
    dialog.detectChanges();
    const formElement = dialog.debugElement.query(By.directive(FormGroupDirective));
    const form = formElement.injector.get(FormGroupDirective).form;
    form.controls['title'].setValue('  ');
    form.controls['subject'].setValue('Research Methods');
    form.controls['dueDate'].setValue('2025-02-29');
    formElement.nativeElement.dispatchEvent(new Event('submit'));
    dialog.detectChanges();

    expect(dialog.nativeElement.querySelector('#title-error')?.textContent).toContain('Enter a title');
    expect(dialog.nativeElement.querySelector('#date-error')?.textContent).toContain('valid calendar date');
    http.expectNone({ method: 'POST', url: '/api/tasks' });
  });
});
