import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Task, TaskPatch } from './board.models';

export type SavedTask = Task & { awardedLevel?: number; earnedWater?: boolean; gardenLifetime?: number };

function savedTask(response: HttpResponse<Task>): SavedTask {
  const level = response.headers.get('X-USAD-Garden-Level');
  const lifetime = Number(response.headers.get('X-USAD-Garden-Lifetime'));
  return {
    ...response.body!,
    awardedLevel: level ? Number(level) : undefined,
    earnedWater: response.headers.get('X-USAD-Water-Earned') === '1',
    gardenLifetime: Number.isSafeInteger(lifetime) && lifetime > 0 ? lifetime : undefined,
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

  delete(id: string): Observable<unknown> {
    return this.http.delete(this.taskUrl(id), this.options);
  }

  private taskUrl(id: string): string {
    return `${this.url}/${encodeURIComponent(id)}`;
  }
}
