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
import { Task } from './board/board.models';
import { BoardStore } from './board/board.store';
import { CompletionMotion } from './shared/completion-motion';

const task: Task = {
  id: 'field-notes', title: 'Annotate the field notes', subject: 'Research Methods', description: '',
  priority: 'medium', status: 'pending', dueDate: null, order: 'a0',
  createdAt: '2026-11-24T04:00:00Z', updatedAt: '2026-11-24T04:00:00Z',
};

describe('USAD views', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<App>;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter(routes), provideLocationMocks(),
        { provide: DIALOG_DATA, useValue: { status: 'pending' } },
        { provide: DialogRef, useValue: { close: jasmine.createSpy('close') } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    http.expectOne('/api/tasks').flush([task]);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  async function navigate(path: string): Promise<void> {
    await fixture.ngZone!.run(() => router.navigateByUrl(path));
    fixture.detectChanges();
  }

  async function renderHome(records: Task[]) {
    TestBed.inject(BoardStore).load();
    http.expectOne('/api/tasks').flush(records);
    await navigate('/');
    return fixture.nativeElement as HTMLElement;
  }

  it('prioritizes overdue coursework over undated active work', async () => {
    const page = await renderHome([task, { ...task, id: 'late', title: 'Late report', dueDate: '2000-01-01' }]);
    expect(page.querySelector('#focus-title')?.textContent).toBe('Late report');
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
    expect(page.querySelector('#focus-title')?.textContent).toBe('Magsimula sa isang gawain');
    expect(page.querySelector('.home-priority .eyebrow')).toBeNull();
  });

  it('routes from bottom navigation and identifies the active screen', async () => {
    await navigate('/');
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
    expect(TestBed.inject(BoardStore).columns()['in-progress'][0].id).toBe(task.id);
  });

  it('opens the independent garden and keeps Progress separate', async () => {
    await navigate('/garden');
    http.expectOne('/api/garden').flush({ lifetime: 9, level: 2, available: 3 });
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

  it('plays Bloom only after a successful task write and exposes a confirmed water reward', async () => {
    await navigate('/');
    const view = fixture.nativeElement as HTMLElement;
    const motion = spyOn(fixture.debugElement.injector.get(CompletionMotion), 'play').and.callThrough();
    const store = TestBed.inject(BoardStore);
    const saving = store.move(task.id, 'completed');
    expect(motion).not.toHaveBeenCalled();
    const request = http.expectOne({ method: 'PATCH', url: '/api/tasks/field-notes' });
    request.flush({ ...task, ...request.request.body }, { headers: { 'X-USAD-Water-Earned': '1' } });
    expect(await saving).toBeTrue();
    fixture.detectChanges();
    expect(motion).toHaveBeenCalledOnceWith(task.id, task.title);
    expect(view.querySelector('.feedback-copy')?.textContent).toContain('Ayos! One task down.');
    expect(view.querySelector('.bloom-reward')?.textContent).toContain('+1 water drop earned');
    expect(view.querySelector('[role="status"]')?.textContent).toContain('+1 water drop earned');
  });

  it('shows textual completion and a static check in reduced motion', async () => {
    await navigate('/');
    const view = fixture.nativeElement as HTMLElement;
    spyOn(window, 'matchMedia').and.returnValue({ matches: true } as MediaQueryList);
    const saving = TestBed.inject(BoardStore).move(task.id, 'completed');
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
    await navigate('/');
    const view = fixture.nativeElement as HTMLElement;
    const saving = TestBed.inject(BoardStore).move(task.id, 'completed');
    http.expectOne({ method: 'PATCH', url: '/api/tasks/field-notes' }).flush('Offline', {
      status: 503, statusText: 'Offline',
    });
    expect(await saving).toBeFalse();
    fixture.detectChanges();
    expect(view.querySelector('app-usad-bloom')).toBeNull();
    expect(view.querySelector('[role="alert"]')?.textContent).toContain('Could not confirm');
  });

  it('offers a clean pending composer with saved subjects and a quick due date', () => {
    const dialog = TestBed.createComponent(CardDialogComponent);
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
