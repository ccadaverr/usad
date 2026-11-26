import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Task, TaskPatch } from './board.models';

export interface StreakMilestone { revision: number; before: number; after: number; }
export type SavedTask = Task & { earnedWater?: boolean; gardenChanged?: boolean; milestone?: StreakMilestone };

function savedTask(response: HttpResponse<Task>): SavedTask {
  const streak = response.headers.get('X-USAD-Streak-Milestone');
  const numbers = streak?.match(/^(\d+):(\d+):(\d+)$/)?.slice(1).map(Number);
  return {
    ...response.body!,
    milestone: numbers ? { revision: numbers[0], before: numbers[1], after: numbers[2] } : undefined,
    earnedWater: response.headers.get('X-USAD-Water-Earned') === '1',
    gardenChanged: response.headers.get('X-USAD-Garden-Changed') === '1',
  };
}

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/tasks';
  private readonly options = { timeout: 8000 };

  list(): Observable<Task[]> {
    return this.http.get<Task[]>(this.url, this.options);
  }

  get(id: string): Observable<Task> {
    return this.http.get<Task>(this.taskUrl(id), this.options);
  }

  create(task: Task): Observable<SavedTask> {
    return this.http.post<Task>(this.url, task, { ...this.options, observe: 'response' }).pipe(map(savedTask));
  }

  update(id: string, changes: TaskPatch): Observable<SavedTask> {
    return this.http.patch<Task>(this.taskUrl(id), changes, { ...this.options, observe: 'response' }).pipe(map(savedTask));
  }

  delete(id: string): Observable<boolean> {
    return this.http.delete(this.taskUrl(id), { ...this.options, observe: 'response' }).pipe(
      map(response => response.headers.get('X-USAD-Garden-Changed') === '1'),
    );
  }

  private taskUrl(id: string): string {
    return `${this.url}/${encodeURIComponent(id)}`;
  }
}
