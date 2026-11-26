import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Task } from '../board/board.models';
import { BoardStore } from '../board/board.store';
import { GardenService, GardenState } from './garden.service';
import { PlantComponent } from './plant.component';
import { FIRST_IMPACT, POUR_START } from './watering-motion';

const gardenUrl = '/api/garden';
const waterUrl = gardenUrl + '/water';
const storageKey = 'usad.garden.pending-water';
const headers = { 'X-USAD-Garden-Scope': 'test-guest-scope' };
const initial: GardenState = { revision: 3, lifetime: 2, available: 1, waterings: 1, activeWaterings: 1, growth: 1, level: 1, streak: 0 };
const grown: GardenState = { revision: 4, lifetime: 2, available: 0, waterings: 2, activeWaterings: 2, growth: 2, level: 2, streak: 0 };
const task: Task = {
  id: 'task', title: 'Read', subject: 'History', description: '', status: 'pending', priority: 'low',
  dueDate: null, order: 'a0', createdAt: '2026-11-25T01:00:00Z', updatedAt: '2026-11-25T01:00:00Z',
};

describe('Munting Tanim watering', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<PlantComponent>;
  let reduce: boolean;

  beforeEach(() => {
    sessionStorage.removeItem(storageKey);
    reduce = false;
    spyOn(window, 'matchMedia').and.callFake(query => Object.assign(new EventTarget(), {
      matches: reduce, media: query,
    }) as MediaQueryList);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    TestBed.overrideComponent(PlantComponent, { add: { providers: [GardenService] } });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    sessionStorage.removeItem(storageKey);
    http.verify();
  });

  function open(state: GardenState, loadTasks = false) {
    fixture = TestBed.createComponent(PlantComponent);
    if (loadTasks) http.expectOne('/api/tasks').flush([task]);
    http.expectOne({ method: 'GET', url: gardenUrl }).flush(state, { headers });
    fixture.detectChanges();
  }

  function water() {
    control().click();
    fixture.detectChanges();
    return http.expectOne({ method: 'POST', url: waterUrl });
  }

  const control = () => fixture.nativeElement.querySelector('.watering-control') as HTMLButtonElement;
  const stand = () => fixture.nativeElement.querySelector('.plant-interaction') as HTMLElement;
  const available = () => control().querySelector('.watering-count')?.textContent;
  const scene = () => fixture.nativeElement.querySelector('figure') as HTMLElement;
  const record = () => fixture.nativeElement.querySelector('.garden-record').textContent as string;

  it('updates earned water and lifetime progress after completion without animating the plant', async () => {
    open({ ...initial, lifetime: 1, available: 0 }, true);
    const result = TestBed.inject(BoardStore).move(task.id, 'completed');
    const completion = http.expectOne({ method: 'PATCH', url: '/api/tasks/task' });
    completion.flush({ ...task, ...completion.request.body }, { headers: { 'X-USAD-Water-Earned': '1' } });
    http.expectOne(gardenUrl).flush(initial, { headers });
    expect(await result).toBeTrue();
    fixture.detectChanges();
    expect(scene().dataset['watering']).toBeUndefined();
    expect(scene().dataset['gardenLevel']).toBe('1');
    expect(record()).toContain('Level 1');
    expect(fixture.componentInstance['state']()?.lifetime).toBe(2);
    expect(fixture.componentInstance['state']()?.growth).toBe(initial.growth);
    expect(available()).toBe('×1');
    expect(fixture.nativeElement.querySelector('progress')).toBeNull();
  });

  it('starts the old-to-new transition only from a confirmed spend and locks duplicate submissions', () => {
    open(initial, true);
    const request = water();
    expect(scene().dataset['watering']).toBeUndefined();
    expect(scene().dataset['gardenLevel']).toBe('1');
    expect(control().getAttribute('aria-busy')).toBe('true');
    control().click();
    http.expectNone(waterUrl);
    request.flush({ ...grown, wateringNumber: 2, wateringRevision: 4 });
    fixture.detectChanges();
    expect(scene().dataset['watering']).toBe('active');
    expect(fixture.componentInstance['transition']()).toEqual(jasmine.objectContaining({ before: initial, after: grown }));
    expect(record()).toContain('Plant watered. Level 2 reached.');
    expect(control().getAttribute('aria-busy')).toBe('true');
    control().click();
    http.expectNone(waterUrl);
  });

  it('shows the water stream when a confirmed receipt follows concurrent task revisions', () => {
    open(initial, true);
    const request = water();
    const changed = { ...grown, revision: 7 };
    request.flush({ ...changed, wateringNumber: 2, wateringRevision: 6 });
    fixture.detectChanges();
    expect(scene().dataset['watering']).toBe('active');
    expect(fixture.componentInstance['transition']()?.kind).toBe('watering');
    const component = fixture.componentInstance;
    component['elapsed'].set(FIRST_IMPACT + 30);
    fixture.detectChanges();
    const stream = scene().querySelector<SVGPathElement>('.fallback-water-stream');
    expect(stream).not.toBeNull();
    expect(Number(stream?.getAttribute('opacity'))).toBeGreaterThan(.3);
    expect(stream?.getAttribute('d')).toMatch(/143 166$/);
  });

  it('plays an unseen confirmed receipt even when a subsequent watering is already in the response', () => {
    open(initial, true);
    water().flush({ ...grown, revision: 7, lifetime: 3, waterings: 3, activeWaterings: 3, growth: 3,
      wateringNumber: 2, wateringRevision: 5 });
    fixture.detectChanges();
    expect(scene().dataset['watering']).toBe('active');
    expect(available()).toBe('×0');
  });

  it('retains the same ID after an uncertain response and animates only the successful reconciliation', () => {
    open(initial, true);
    const failed = water();
    const { id } = failed.request.body;
    expect(failed.request.headers.get('X-USAD-Garden-Scope')).toBe(headers['X-USAD-Garden-Scope']);
    failed.error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(scene().dataset['watering']).toBeUndefined();
    expect(record()).toContain('Could not confirm watering');
    const retry = water();
    expect(retry.request.body).toEqual({ id });
    retry.flush({ ...grown, wateringNumber: 2, wateringRevision: 4 });
    fixture.detectChanges();
    expect(scene().dataset['watering']).toBe('active');
    expect(sessionStorage.getItem(storageKey)).toBeNull();
  });

  it('settles on restored progress after refresh and retries an already persisted operation without replay', () => {
    open(initial, true);
    const request = water();
    const { id } = request.request.body;
    request.error(new ProgressEvent('error'));
    fixture.destroy();
    open(grown);
    expect(scene().dataset['gardenLevel']).toBe('2');
    expect(scene().dataset['watering']).toBeUndefined();
    const retry = water();
    expect(retry.request.body).toEqual({ id });
    retry.flush({ ...grown, wateringNumber: 2, wateringRevision: 4 });
    fixture.detectChanges();
    expect(scene().dataset['watering']).toBeUndefined();
  });

  it('does not regress when a refresh returns a stale snapshot', () => {
    open(grown, true);
    fixture.componentInstance['load']();
    http.expectOne(gardenUrl).flush(initial, { headers });
    fixture.detectChanges();
    expect(scene().dataset['gardenLevel']).toBe('2');
    expect(scene().dataset['watering']).toBeUndefined();
  });

  it('reconciles a definitive no-credit response and discards that operation ID', () => {
    open(initial, true);
    water().flush({ message: 'No water drops available.' }, { status: 409, statusText: 'Conflict' });
    http.expectOne(gardenUrl).flush(grown, { headers });
    fixture.detectChanges();
    expect(scene().dataset['watering']).toBeUndefined();
    expect(sessionStorage.getItem(storageKey)).toBeNull();
    expect(available()).toBe('×0');
  });

  it('runs the confirmed transition with an accessible SVG when WebGL is unavailable', async () => {
    spyOn(HTMLCanvasElement.prototype, 'getContext').and.returnValue(null);
    open(initial, true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(stand().getAttribute('aria-label')).toContain('Seedling');
    expect(control().getAttribute('aria-label')).toContain('Watering can');
    expect(scene().querySelector('svg.plant-fallback')).toBeTruthy();
    expect(scene().querySelector('canvas')?.getAttribute('aria-hidden')).toBe('true');
    water().flush({ ...grown, wateringNumber: 2, wateringRevision: 4 });
    fixture.detectChanges();
    expect(scene().dataset['watering']).toBe('active');
    expect(scene().querySelector('.fallback-can')).toBeTruthy();
  });

  it('renders an accessible final illustration immediately for reduced motion', () => {
    reduce = true;
    open(initial, true);
    const illustration = stand();
    expect(illustration.getAttribute('aria-label')).toContain('Seedling');
    water().flush({ ...grown, wateringNumber: 2, wateringRevision: 4 });
    fixture.detectChanges();
    expect(scene().dataset['watering']).toBeUndefined();
    expect(illustration.getAttribute('aria-label')).toContain('Young sprout');
    expect(scene().querySelector('canvas')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('isolates horizontal rotation and vertical scrolling from watering gestures', () => {
    reduce = true;
    open(initial, true);
    const plant = stand();
    spyOn(plant, 'setPointerCapture');
    const pointer = (event: string, x: number, y: number) => plant.dispatchEvent(new PointerEvent(event, {
      pointerId: 1, isPrimary: true, button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true,
    }));
    pointer('pointerdown', 10, 20);
    pointer('pointermove', 115, 21);
    pointer('pointerup', 115, 21);
    plant.dispatchEvent(new MouseEvent('click', { detail: 1, bubbles: true }));
    expect(plant.setPointerCapture).toHaveBeenCalledOnceWith(1);
    expect(fixture.componentInstance['angle']()).toBeGreaterThan(1);
    http.expectNone(waterUrl);
    pointer('pointerdown', 10, 20);
    pointer('pointermove', 13, 70);
    pointer('pointerup', 13, 70);
    plant.dispatchEvent(new MouseEvent('click', { detail: 1, bubbles: true }));
    http.expectNone(waterUrl);
    pointer('pointerdown', 10, 20);
    pointer('pointerup', 12, 21);
    plant.dispatchEvent(new MouseEvent('click', { detail: 1, bubbles: true }));
    http.expectNone(waterUrl);
    const angle = fixture.componentInstance['angle']();
    water().flush({ ...grown, wateringNumber: 2, wateringRevision: 4 });
    expect(fixture.componentInstance['angle']()).toBe(angle);
  });

  it('rotates with arrows, exposes the fallback control to the keyboard and skips an empty spend', () => {
    reduce = true;
    open(grown, true);
    const plant = stand();
    for (let index = 0; index < 17; index++) plant.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(fixture.componentInstance['angle']()).toBeCloseTo(6.8 - Math.PI * 2);
    expect(plant.tabIndex).toBe(0);
    expect(plant.getAttribute('role')).toBe('slider');
    control().click();
    fixture.detectChanges();
    http.expectNone(waterUrl);
    expect(record()).toContain('No water available');
    expect(control().getAttribute('aria-disabled')).toBe('true');
    expect(available()).toBe('×0');
    expect(record()).not.toContain('Undo');
  });

  it('reverses consumed growth and fruit from a confirmed task status change without playing the pour', async () => {
    const store = TestBed.inject(BoardStore);
    http.expectOne('/api/tasks').flush([{ ...task, status: 'completed' }]);
    open({ ...grown, streak: 3 });
    const moved = store.move(task.id, 'in-progress');
    const change = http.expectOne('/api/tasks/task');
    change.flush({ ...task, ...change.request.body }, { headers: { 'X-USAD-Garden-Changed': '1' } });
    const reversed = { ...grown, revision: 5, growth: 1, activeWaterings: 1, level: 1, streak: 2 };
    http.expectOne(gardenUrl).flush(reversed, { headers });
    expect(await moved).toBeTrue();
    fixture.detectChanges();
    expect(scene().dataset['gardenLevel']).toBe('1');
    expect(scene().dataset['fruits']).toBe('2');
    expect(scene().dataset['watering']).toBeUndefined();
    expect(fixture.componentInstance['transition']()).toEqual(jasmine.objectContaining({ kind: 'reconcile', after: reversed }));
  });

  it('only animates newly supported fruit and caps the display without capping the saved streak', () => {
    open({ ...initial, streak: 1 }, true);
    expect(scene().dataset['reconciling']).toBeUndefined();
    fixture.componentInstance['load']();
    http.expectOne(gardenUrl).flush({ ...initial, revision: 4, streak: 2 }, { headers });
    fixture.detectChanges();
    expect(fixture.componentInstance['transition']()?.before.level).toBe(1);
    expect(scene().dataset['fruits']).toBe('2');
    fixture.destroy();
    reduce = true;
    open({ ...initial, streak: 12 });
    expect(record()).toContain('12-day streak');
    expect(scene().querySelectorAll('.fallback-fruit').length).toBe(4);
    expect(scene().dataset['reconciling']).toBeUndefined();
  });

  it('plays a new fruit once on the next garden visit after a confirmed task milestone', async () => {
    const store = TestBed.inject(BoardStore);
    http.expectOne('/api/tasks').flush([task]);
    const moved = store.move(task.id, 'completed');
    const request = http.expectOne('/api/tasks/task');
    request.flush({ ...task, ...request.request.body }, { headers: {
      'X-USAD-Water-Earned': '1', 'X-USAD-Streak-Milestone': '3:0:1',
    } });
    expect(await moved).toBeTrue();
    const saved = { ...initial, streak: 1 };
    open(saved);
    expect(fixture.componentInstance['transition']()?.before.streak).toBe(0);
    expect(scene().dataset['watering']).toBeUndefined();
    fixture.destroy();
    open(saved);
    expect(scene().dataset['reconciling']).toBeUndefined();
  });

  it('displays the last confirmed balance until each of two waterings commits', () => {
    reduce = true;
    open({ ...initial, available: 2 }, true);
    expect(available()).toBe('×2');
    const first = water();
    expect(available()).toBe('×2');
    expect(record()).toContain('Saving watering');
    first.flush({ ...grown, available: 1, wateringNumber: 2, wateringRevision: 4 });
    fixture.detectChanges();
    expect(available()).toBe('×1');
    const second = water();
    expect(available()).toBe('×1');
    second.flush({ ...grown, revision: 5, waterings: 3, available: 0, wateringNumber: 3, wateringRevision: 5 });
    fixture.detectChanges();
    expect(available()).toBe('×0');
    control().click();
    http.expectNone(waterUrl);
  });

  it('ignores the second native click even if a reduced-motion spend is already confirmed', () => {
    reduce = true;
    open({ ...initial, available: 2 }, true);
    control().dispatchEvent(new MouseEvent('click', { detail: 1, bubbles: true }));
    http.expectOne(waterUrl).flush({ ...grown, available: 1, wateringNumber: 2, wateringRevision: 4 });
    fixture.detectChanges();
    control().dispatchEvent(new MouseEvent('click', { detail: 2, bubbles: true }));
    http.expectNone(waterUrl);
    expect(available()).toBe('×1');
  });

  it('keeps the same SVG can in the resting, pouring and returned poses', () => {
    open(initial, true);
    const can = scene().querySelector('.fallback-can')!.closest('g')!;
    const rest = can.getAttribute('transform');
    water().flush({ ...grown, wateringNumber: 2, wateringRevision: 4 });
    const component = fixture.componentInstance;
    component['elapsed'].set(750);
    fixture.detectChanges();
    expect(scene().querySelector('.fallback-can')!.closest('g')).toBe(can);
    expect(can.getAttribute('transform')).toContain('rotate(-36)');
    expect(scene().querySelector('.fallback-water')).toBeTruthy();
    const stream = scene().querySelector<SVGPathElement>('.fallback-water-stream')!;
    expect(Number(stream.getAttribute('opacity'))).toBeGreaterThan(.3);
    const outlet = new DOMPoint(-44, -1).matrixTransform(can.getCTM()!);
    const streamStart = stream.getPointAtLength(0).matrixTransform(stream.getCTM()!);
    expect(Math.hypot(outlet.x - streamStart.x, outlet.y - streamStart.y)).toBeLessThan(1);
    expect(stream.getAttribute('d')).not.toMatch(/143 166$/);
    expect(scene().querySelector('.fallback-ripple')).toBeNull();
    component['elapsed'].set(POUR_START + 120);
    fixture.detectChanges();
    expect(scene().querySelector('.fallback-ripple')).toBeNull();
    component['elapsed'].set(1030);
    fixture.detectChanges();
    expect(scene().querySelector('.fallback-ripple')).toBeTruthy();
    component['finishAnimation']();
    fixture.detectChanges();
    expect(scene().querySelector('.fallback-can')!.closest('g')).toBe(can);
    // The plant's framing may change with level. The can is upright at the same screen anchor.
    expect(can.getAttribute('transform')).toContain('rotate(0)');
    expect(rest).toContain('rotate(0)');
    expect(scene().querySelector('.fallback-water')).toBeNull();
  });

});
