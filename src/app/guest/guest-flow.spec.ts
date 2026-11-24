import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NavigationEnd, Router, provideRouter } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { App } from '../app';
import { routes } from '../app.routes';
import { Task } from '../board/board.models';
import { BoardStore } from '../board/board.store';
import { GardenService } from '../pages/garden.service';
import { CompletionMotion } from '../shared/completion-motion';
import { WorkspaceComponent } from '../workspace.component';
import { GuestSession, guestExpiryInterceptor, workspaceDestination } from './guest-session.service';

const guest = { displayName: 'Jaztin', onboardingComplete: false };

describe('Guest routing and first use', () => {
  let fixture: ComponentFixture<App>;
  let http: HttpTestingController;
  let router: Router;
  let view: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([guestExpiryInterceptor])), provideHttpClientTesting(), provideRouter(routes), provideLocationMocks()],
    });
    fixture = TestBed.createComponent(App);
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
    view = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  const start = (url: string) => fixture.ngZone!.run(() => router.navigateByUrl(url));
  const click = (target: HTMLElement) => fixture.ngZone!.run(() => target.click());

  async function pending(url: string, attempts = 70): Promise<TestRequest> {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const [request, ...extra] = http.match(url);
      if (request) {
        expect(extra).toEqual([]);
        return request;
      }
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error('No request for ' + url);
  }

  async function settled() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function showTour() {
    const navigation = start('/onboarding');
    (await pending('/api/session')).flush({ guest });
    await navigation;
    await settled();
  }

  async function showReturningGuest() {
    const navigation = start('/');
    (await pending('/api/session')).flush({ guest: { ...guest, onboardingComplete: true } });
    await navigation;
    await settled();
  }

  function confirmStart() {
    click(view.querySelector<HTMLButtonElement>('.guest-switch-action, .guest-menu button')!);
    fixture.detectChanges();
    const dialog = view.querySelector<HTMLDialogElement>('.guest-confirm')!;
    expect(dialog.open).toBeTrue();
    return dialog;
  }

  function tourGesture() {
    const viewport = view.querySelector<HTMLElement>('.tour-viewport')!;
    spyOn(viewport, 'setPointerCapture');
    Object.defineProperty(viewport, 'clientWidth', { value: 320 });
    const pointer = (type: string, x: number, y: number, time?: number) => {
      const event = new PointerEvent(type, {
        pointerId: 7, isPrimary: true, pointerType: 'touch', clientX: x, clientY: y, button: 0,
      });
      if (time !== undefined) Object.defineProperty(event, 'timeStamp', { value: time });
      viewport.dispatchEvent(event);
      fixture.detectChanges();
    };
    const current = () => view.querySelector('.tour-indicators [aria-current="step"]')?.getAttribute('aria-label');
    return { viewport, pointer, current };
  }

  it('holds a protected deep link at welcome without loading the task store', async () => {
    const navigation = start('/board');
    http.expectNone('/api/tasks');
    (await pending('/api/session')).flush({ guest: null });
    await navigation;
    await settled();
    expect(router.url).toBe('/?returnTo=%2Fboard');
    expect(view.querySelector('nav')).toBeNull();
    expect(view.querySelector<HTMLInputElement>('#guest-name')?.placeholder).toBe('ex. Jaztin');
    expect(view.textContent).toContain('Coming soon');
    http.expectNone('/api/tasks');
  });

  it('keeps a legacy session 404 distinct from an empty session and recovers on retry', async () => {
    const navigation = start('/');
    const first = await pending('/api/session');
    fixture.ngZone!.run(() => first.flush({}, { status: 404, statusText: 'Not Found' }));
    await navigation;
    await settled();
    expect(view.querySelector('[role="alert"]')?.textContent).toContain('couldn’t check');
    expect(view.querySelector('#guest-name')).toBeNull();
    const session = TestBed.inject(GuestSession);
    const button = view.querySelector<HTMLButtonElement>('.button-secondary')!;
    fixture.ngZone!.run(() => button.click());
    const inFlight = session.ensure();
    expect(session.refresh()).toBe(inFlight);
    (await pending('/api/session')).flush({ guest: null });
    await inFlight;
    await settled();
    expect(view.querySelector<HTMLInputElement>('#guest-name')?.placeholder).toBe('ex. Jaztin');
    expect(view.querySelector('[role="alert"]')).toBeNull();
    http.expectNone('/api/tasks');
  });

  it('takes an unfinished returning guest to the tour before the board', async () => {
    const navigation = start('/board');
    (await pending('/api/session')).flush({ guest });
    await navigation;
    await settled();
    expect(router.url).toBe('/onboarding?returnTo=%2Fboard');
    expect(view.querySelector('.tour-active h2')?.textContent).toBe('Start with one small step.');
    http.expectNone('/api/tasks');
  });

  it('shows a returning guest and rejects unsafe return destinations', async () => {
    expect(workspaceDestination('//another.example/board')).toBe('/home');
    expect(workspaceDestination('/board')).toBe('/board');
    await showReturningGuest();
    expect(view.querySelector('#guest-name')).toBeNull();
    expect(view.querySelector('.entry-primary')?.textContent).toContain('Continue as Jaztin');
    expect(view.querySelector('.guest-switch-action')?.textContent).toContain('Start another guest');
    http.expectNone('/api/session/guest');
    http.expectNone('/api/tasks');
  });

  it('cancels without a session request and continues to the same workspace', async () => {
    await showReturningGuest();
    const dialog = confirmStart();
    click(dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!);
    await settled();
    expect(dialog.open).toBeFalse();
    expect(TestBed.inject(GuestSession).profile()?.displayName).toBe('Jaztin');
    http.expectNone('/api/session/leave');
    click(view.querySelector<HTMLButtonElement>('.entry-primary')!);
    (await pending('/api/tasks')).flush([]);
    await settled();
    expect(router.url).toBe('/home');
    expect(view.querySelector('h1')?.textContent).toBe('Kamusta, Jaztin!');
  });

  it('allows one leave at a time and waits for a verified empty session after retry', async () => {
    await showReturningGuest();
    const dialog = confirmStart();
    const confirm = dialog.querySelector<HTMLButtonElement>('button[type="button"]')!;
    const session = TestBed.inject(GuestSession);
    const leave = spyOn(session, 'leave').and.callThrough();

    click(confirm);
    click(confirm);
    const failed = await pending('/api/session/leave');
    expect(failed.request.method).toBe('POST');
    expect(leave).toHaveBeenCalledTimes(1);
    fixture.detectChanges();
    expect([...dialog.querySelectorAll('button')].every(button => button.disabled)).toBeTrue();
    const concurrentRead = session.refresh();
    http.expectNone('/api/session');
    failed.flush({}, { status: 503, statusText: 'Unavailable' });
    await leave.calls.mostRecent().returnValue.catch(() => undefined);
    await settled();
    expect(dialog.open).toBeTrue();
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain('couldn’t confirm');
    expect((await concurrentRead)?.displayName).toBe('Jaztin');
    expect(session.profile()?.displayName).toBe('Jaztin');

    click(confirm);
    (await pending('/api/session/leave')).flush(null, { status: 204, statusText: 'No Content' });
    const check = await pending('/api/session');
    expect(view.querySelector('#guest-name')).toBeNull();
    check.flush({ guest: null });
    await leave.calls.mostRecent().returnValue;
    await settled();
    expect(dialog.open).toBeFalse();
    expect(view.querySelector('#guest-name')).not.toBeNull();
    http.expectNone('/api/tasks');
  });

  it('keeps the flow blocked if read-back reports another guest or the wrong HTTP status', async () => {
    await showReturningGuest();
    const dialog = confirmStart();
    const confirm = dialog.querySelector<HTMLButtonElement>('button[type="button"]')!;
    const session = TestBed.inject(GuestSession);
    const leave = spyOn(session, 'leave').and.callThrough();
    for (const [reply, status] of [[{ guest: { ...guest, displayName: 'Alex' } }, 200], [{ guest: null }, 202]] as const) {
      click(confirm);
      (await pending('/api/session/leave')).flush(null, { status: 204, statusText: 'No Content' });
      (await pending('/api/session')).flush(reply, { status, statusText: status === 200 ? 'OK' : 'Accepted' });
      await leave.calls.mostRecent().returnValue.catch(() => undefined);
      await settled();
      expect(dialog.open).toBeTrue();
      expect(dialog.querySelector('[role="alert"]')).not.toBeNull();
      expect(session.profile()?.displayName).toBe('Jaztin');
      expect(view.querySelector('#guest-name')).toBeNull();
      http.expectNone('/api/tasks');
      http.expectNone('/api/session/guest');
    }
  });

  it('disposes the board, garden and completion state before the next guest enters', async () => {
    const task: Task = {
      id: 'jaztin-task', title: 'Jaztin’s task', description: '', subject: 'Research',
      priority: 'medium', status: 'pending', dueDate: null, order: 'a0',
      createdAt: '2026-11-24T04:00:00.000Z', updatedAt: '2026-11-24T04:00:00.000Z',
    };
    const navigation = start('/home');
    (await pending('/api/session')).flush({ guest: { ...guest, onboardingComplete: true } });
    await navigation;
    (await pending('/api/tasks')).flush([task]);
    await settled();
    const oldWorkspace = fixture.debugElement.query(By.directive(WorkspaceComponent)).injector;
    const oldBoard = oldWorkspace.get(BoardStore);
    const oldGarden = oldWorkspace.get(GardenService);
    oldGarden.pendingWater.set('previous-water-operation');
    const move = fixture.ngZone!.run(() => oldBoard.move(task.id, 'completed'));
    (await pending('/api/tasks/' + task.id)).flush({ ...task, status: 'completed' }, {
      headers: { 'X-USAD-Water-Earned': '1', 'X-USAD-Garden-Lifetime': '1' },
    });
    await move;
    await settled();
    expect(oldBoard.completion()?.taskId).toBe(task.id);
    const dialog = confirmStart();
    const welcome = firstValueFrom(router.events.pipe(filter(event => event instanceof NavigationEnd)));
    click(dialog.querySelector<HTMLButtonElement>('button[type="button"]')!);
    (await pending('/api/session/leave')).flush(null, { status: 204, statusText: 'No Content' });
    (await pending('/api/session')).flush({ guest: null });
    await welcome;
    await settled();
    expect(router.url).toBe('/');
    expect(view.querySelector('app-workspace')).toBeNull();
    expect(view.querySelector('#guest-name')).not.toBeNull();

    const input = view.querySelector<HTMLInputElement>('#guest-name')!;
    fixture.ngZone!.run(() => {
      input.value = 'Alex';
      input.dispatchEvent(new Event('input'));
      view.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    });
    const alex = { guest: { displayName: 'Alex', onboardingComplete: true } };
    (await pending('/api/session/bootstrap')).flush(null, { status: 204, statusText: 'No Content' });
    (await pending('/api/session/guest')).flush(alex);
    (await pending('/api/session')).flush(alex);
    (await pending('/api/tasks')).flush([]);
    await settled();
    const newWorkspace = fixture.debugElement.query(By.directive(WorkspaceComponent)).injector;
    const newBoard = newWorkspace.get(BoardStore);
    expect(newBoard).not.toBe(oldBoard);
    expect(newBoard.tasks()).toEqual({});
    expect(newBoard.completion()).toBeNull();
    expect(newBoard.pendingGrowthLifetime()).toBeNull();
    expect(newWorkspace.get(GardenService).pendingWater()).toBeNull();
    expect(newWorkspace.get(CompletionMotion).position()).toBeNull();
    expect(view.querySelector('h1')?.textContent).toBe('Kamusta, Alex!');
  });

  it('stays at welcome when the browser cannot establish a cookie-backed workspace', async () => {
    const navigation = start('/');
    (await pending('/api/session')).flush({ guest: null });
    await navigation;
    await settled();
    const input = view.querySelector<HTMLInputElement>('#guest-name')!;
    fixture.ngZone!.run(() => {
      input.value = '  Jaztin  ';
      input.dispatchEvent(new Event('input'));
      view.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    });
    (await pending('/api/session/bootstrap')).flush(null, { status: 204, statusText: 'No Content' });
    const creation = await pending('/api/session/guest');
    expect(creation.request.body).toEqual({ displayName: 'Jaztin' });
    fixture.ngZone!.run(() => creation.flush({ message: 'Allow cookies for USAD, then try again.' }, {
      status: 409, statusText: 'Conflict',
    }));
    await new Promise(resolve => setTimeout(resolve, 0));
    await settled();
    expect(router.url).toBe('/');
    expect(view.querySelector('[role="alert"]')?.textContent).toContain('Allow cookies');
    http.expectNone('/api/tasks');
  });

  it('leaves a protected route when the backing session expires', async () => {
    const navigation = start('/home');
    (await pending('/api/session')).flush({ guest: { ...guest, onboardingComplete: true } });
    await navigation;
    const tasks = await pending('/api/tasks');
    fixture.ngZone!.run(() => tasks.flush({}, { status: 401, statusText: 'Unauthorized' }));
    await settled();
    expect(router.url).toContain('expired=1');
    expect(view.querySelector('nav')).toBeNull();
    expect(view.textContent).toContain('Your guest session has expired.');
  });

  it('follows horizontal drags, snaps back on cancellation and supports keyboard navigation', async () => {
    await showTour();
    const { viewport, pointer, current } = tourGesture();
    const main = view.querySelector('main')!;
    pointer('pointerdown', 170, 80);
    pointer('pointermove', 115, 81);
    expect(viewport.classList.contains('tour-dragging')).toBeTrue();
    expect(viewport.style.getPropertyValue('--tour-shift')).toBe('-55px');
    pointer('pointercancel', 115, 81);
    expect(viewport.style.getPropertyValue('--tour-shift')).toBe('0px');
    expect(viewport.style.getPropertyValue('--tour-duration')).toBe('200ms');
    expect(current()).toBe('Step 1: Organize');
    pointer('pointerdown', 170, 80);
    pointer('pointermove', 168, 160);
    pointer('pointerup', 168, 160);
    expect(current()).toBe('Step 1: Organize');
    pointer('pointerdown', 170, 80);
    pointer('pointermove', 70, 81);
    pointer('pointerup', 70, 81);
    expect(current()).toBe('Step 2: Progress');
    main.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();
    expect(current()).toBe('Step 3: Grow');
    main.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    fixture.detectChanges();
    expect(current()).toBe('Step 2: Progress');
  });

  it('shows Grow until a separate intentional left swipe saves the tour', async () => {
    await showTour();
    const { pointer, current } = tourGesture();
    const swipeLeft = (end: number) => {
      pointer('pointerdown', 230, 90);
      pointer('pointermove', end, 91);
      pointer('pointerup', end, 91);
    };
    expect(view.querySelector('.tour-skip')?.textContent).toContain('Explore now');
    expect(view.querySelector('.tour-actions')).toBeNull();
    swipeLeft(90);
    swipeLeft(90);
    expect(current()).toBe('Step 3: Grow');
    swipeLeft(210);
    http.expectNone('/api/session/onboarding-complete');
    swipeLeft(90);
    const completion = await pending('/api/session/onboarding-complete');
    expect(completion.request.method).toBe('POST');
    expect(router.url).toBe('/onboarding');
    expect(view.querySelector('.tour-home-preview[inert] app-home')).not.toBeNull();
    expect(TestBed.inject(GuestSession).profile()?.onboardingComplete).toBeFalse();
    http.expectNone('/api/tasks');
    http.expectNone('/api/garden');
    swipeLeft(90);
    http.expectNone('/api/session/onboarding-complete');
    fixture.ngZone!.run(() => completion.flush({ guest: { ...guest, onboardingComplete: true } }));
    await new Promise(resolve => setTimeout(resolve, 0));
    fixture.detectChanges();
    const tasks = await pending('/api/tasks', 240);
    fixture.detectChanges();
    expect(view.querySelector('.tour-home-preview')).toBeNull();
    expect(view.querySelectorAll('app-home').length).toBe(1);
    expect(view.querySelector('app-home h1')?.textContent).toBe('Kamusta, Jaztin!');
    tasks.flush([]);
    await settled();
    expect(router.url).toBe('/home');
  });

  it('reveals an inert Home during a short Grow drag without reading or writing workspace state', async () => {
    await showTour();
    const { pointer, current } = tourGesture();
    click(view.querySelector<HTMLButtonElement>('[aria-label="Step 3: Grow"]')!);
    await settled();
    const tour = view.querySelector<HTMLElement>('app-onboarding')!;
    const preview = tour.querySelector<HTMLElement>('.tour-home-preview')!;
    expect(preview.inert).toBeTrue();
    expect(preview.getAttribute('aria-hidden')).toBe('true');
    expect(preview.querySelector('app-home h1')?.textContent).toBe('Kamusta, Jaztin!');
    expect(preview.querySelector('app-task-actions, .workspace-empty')).toBeNull();

    pointer('pointerdown', 230, 90, 100);
    pointer('pointermove', 205, 91, 200);
    expect(tour.style.getPropertyValue('--tour-page-offset')).toBe('25px');
    pointer('pointerup', 205, 91, 300);
    expect(tour.style.getPropertyValue('--tour-page-offset')).toBe('0px');
    expect(tour.style.getPropertyValue('--tour-page-duration')).toBe('200ms');
    expect(current()).toBe('Step 3: Grow');
    http.expectNone('/api/session/onboarding-complete');
    http.expectNone('/api/tasks');
    http.expectNone('/api/garden');
  });

  it('accepts a fast flick below the distance threshold and returns to Grow if the save fails', async () => {
    await showTour();
    const { pointer, current } = tourGesture();
    click(view.querySelector<HTMLButtonElement>('[aria-label="Step 3: Grow"]')!);
    await settled();
    const tour = view.querySelector<HTMLElement>('app-onboarding')!;
    pointer('pointerdown', 230, 90, 100);
    pointer('pointermove', 182, 91, 118);
    pointer('pointerup', 182, 91, 121);
    const completion = await pending('/api/session/onboarding-complete');
    expect(tour.style.getPropertyValue('--tour-page-offset')).toBe('48px');
    expect(TestBed.inject(GuestSession).profile()?.onboardingComplete).toBeFalse();
    fixture.ngZone!.run(() => completion.flush({}, { status: 503, statusText: 'Unavailable' }));
    await settled();
    expect(current()).toBe('Step 3: Grow');
    expect(tour.style.getPropertyValue('--tour-page-offset')).toBe('0px');
    expect(view.querySelector('[role="alert"]')?.textContent).toContain('couldn’t save');
    expect(view.querySelector<HTMLButtonElement>('.tour-skip')?.disabled).toBeFalse();
    http.expectNone('/api/tasks');
    http.expectNone('/api/garden');
  });

  it('waits for the skip write before loading tasks and shows the empty destination', async () => {
    await showTour();
    const skip = view.querySelector<HTMLButtonElement>('.tour-skip')!;
    fixture.ngZone!.run(() => skip.click());
    const completion = await pending('/api/session/onboarding-complete');
    http.expectNone('/api/tasks');
    expect(router.url).toBe('/onboarding');
    completion.flush({ guest: { ...guest, onboardingComplete: true } });
    (await pending('/api/tasks')).flush([]);
    await settled();
    expect(router.url).toBe('/home');
    expect(view.querySelector('h1')?.textContent).toBe('Kamusta, Jaztin!');
    expect(view.textContent).toContain('Every great thing starts with one small step.');
    expect(view.querySelector('.home-progress')).toBeNull();
  });

  it('leaves the guest on the tour when completing it fails', async () => {
    await showTour();
    const skip = view.querySelector<HTMLButtonElement>('.tour-skip')!;
    fixture.ngZone!.run(() => skip.click());
    const completion = await pending('/api/session/onboarding-complete');
    fixture.ngZone!.run(() => completion.flush({}, { status: 503, statusText: 'Unavailable' }));
    await new Promise(resolve => setTimeout(resolve, 0));
    await settled();
    expect(router.url).toBe('/onboarding');
    expect(view.querySelector('[role="alert"]')?.textContent).toContain('couldn’t save');
    http.expectNone('/api/tasks');
  });

  it('replays an already completed tour and returns without a completion write', async () => {
    const navigation = start('/onboarding');
    (await pending('/api/session')).flush({ guest: { ...guest, onboardingComplete: true } });
    await navigation;
    await settled();
    fixture.ngZone!.run(() => view.querySelector<HTMLButtonElement>('.tour-skip')!.click());
    (await pending('/api/tasks')).flush([]);
    await settled();
    expect(router.url).toBe('/home');
    expect(view.querySelector('h1')?.textContent).toBe('Kamusta, Jaztin!');
    http.expectNone('/api/session/onboarding-complete');
    http.expectNone('/api/session/guest');
  });
});
