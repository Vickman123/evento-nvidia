import { TutorialTask, XRTutorialOptions } from './types';
import { XRAudio } from '../audio/XRAudio';

export class XRTutorial {
  private tasks: Map<string, TutorialTask> = new Map();
  private containerEl: HTMLElement | null = null;
  private audio?: XRAudio;
  private options: XRTutorialOptions;
  private isCollapsed = false;

  constructor(options: XRTutorialOptions, audio?: XRAudio) {
    this.options = {
      title: 'Misiones & Práctica',
      position: 'top-left',
      autoSound: true,
      ...options
    };
    this.audio = audio;

    for (const task of options.tasks) {
      this.tasks.set(task.id, {
        ...task,
        completed: task.completed ?? false
      });
    }

    this.mountHUD();
  }

  public setAudio(audio: XRAudio): void {
    this.audio = audio;
  }

  public completeTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;
    if (task.completed) return true;

    task.completed = true;

    if (this.options.autoSound && this.audio) {
      this.audio.playSuccess();
    }

    this.render();

    const remaining = this.getRemainingCount();
    if (this.options.onTaskComplete) {
      this.options.onTaskComplete(task, remaining);
    }

    if (remaining === 0 && this.options.onAllComplete) {
      this.options.onAllComplete();
    }

    return true;
  }

  public resetTask(id: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.completed = false;
      this.render();
    }
  }

  public isCompleted(id: string): boolean {
    return !!this.tasks.get(id)?.completed;
  }

  public getRemainingCount(): number {
    let count = 0;
    for (const task of this.tasks.values()) {
      if (!task.optional && !task.completed) count++;
    }
    return count;
  }

  public getProgress(): number {
    const all = Array.from(this.tasks.values()).filter(t => !t.optional);
    if (all.length === 0) return 100;
    const completed = all.filter(t => t.completed).length;
    return Math.round((completed / all.length) * 100);
  }

  public show(): void {
    if (this.containerEl) this.containerEl.style.display = 'block';
  }

  public hide(): void {
    if (this.containerEl) this.containerEl.style.display = 'none';
  }

  public toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    this.render();
  }

  public destroy(): void {
    if (this.containerEl && this.containerEl.parentNode) {
      this.containerEl.parentNode.removeChild(this.containerEl);
      this.containerEl = null;
    }
  }

  private mountHUD(): void {
    if (typeof document === 'undefined') return;

    this.containerEl = document.createElement('div');
    this.containerEl.className = 'vxr-tutorial-hud';

    const pos = this.options.position || 'top-left';
    const isTop = pos.startsWith('top');
    const isLeft = pos.endsWith('left');

    Object.assign(this.containerEl.style, {
      position: 'fixed',
      zIndex: '9998',
      top: isTop ? '20px' : 'auto',
      bottom: !isTop ? '20px' : 'auto',
      left: isLeft ? '20px' : 'auto',
      right: !isLeft ? '20px' : 'auto',
      width: '320px',
      maxWidth: 'calc(100vw - 40px)',
      background: 'rgba(15, 23, 42, 0.88)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(56, 189, 248, 0.3)',
      borderRadius: '16px',
      boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.5), 0 0 20px rgba(56, 189, 248, 0.15)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#f8fafc',
      overflow: 'hidden',
      transition: 'all 0.3s ease'
    });

    document.body.appendChild(this.containerEl);
    this.render();
  }

  private render(): void {
    if (!this.containerEl) return;

    const progress = this.getProgress();
    const tasksList = Array.from(this.tasks.values());
    const isDoneAll = progress === 100;

    let html = `
      <div style="padding: 14px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); display: flex; align-items: center; justify-content: space-between; cursor: pointer;" id="vxr-hud-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 18px;">${isDoneAll ? '🏆' : '🎯'}</span>
          <div>
            <div style="font-weight: 700; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; color: #38bdf8;">
              ${this.options.title}
            </div>
            <div style="font-size: 11px; color: #94a3b8;">
              ${isDoneAll ? '¡Completado con éxito!' : `Progreso: ${progress}%`}
            </div>
          </div>
        </div>
        <button id="vxr-hud-toggle" style="background: none; border: none; color: #94a3b8; font-size: 16px; cursor: pointer; padding: 4px;">
          ${this.isCollapsed ? '▼' : '▲'}
        </button>
      </div>
      <div style="height: 3px; background: rgba(255,255,255,0.1); width: 100%;">
        <div style="height: 100%; width: ${progress}%; background: linear-gradient(90deg, #38bdf8, #818cf8); transition: width 0.4s ease;"></div>
      </div>
    `;

    if (!this.isCollapsed) {
      html += `<div style="padding: 12px 14px; max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">`;

      for (const task of tasksList) {
        html += `
          <div style="display: flex; align-items: flex-start; gap: 10px; padding: 8px 10px; border-radius: 8px; background: ${task.completed ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 255, 255, 0.03)'}; border: 1px solid ${task.completed ? 'rgba(34, 197, 94, 0.25)' : 'rgba(255, 255, 255, 0.05)'}; transition: all 0.2s ease;">
            <div style="width: 18px; height: 18px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 12px; margin-top: 2px; flex-shrink: 0; ${task.completed ? 'background: #22c55e; color: #000;' : 'border: 2px solid #64748b; color: transparent;'}">
              ✓
            </div>
            <div style="flex: 1;">
              <div style="font-size: 13px; font-weight: 600; color: ${task.completed ? '#86efac' : '#f1f5f9'}; ${task.completed ? 'text-decoration: line-through; opacity: 0.8;' : ''}">
                ${task.title}
              </div>
              ${task.description ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 2px; line-height: 1.4;">${task.description}</div>` : ''}
            </div>
          </div>
        `;
      }

      html += `</div>`;
    }

    this.containerEl.innerHTML = html;

    const header = this.containerEl.querySelector('#vxr-hud-header');
    if (header) {
      header.addEventListener('click', () => this.toggleCollapse());
    }
  }
}
