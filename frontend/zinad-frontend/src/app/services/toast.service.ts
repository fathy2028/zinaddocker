import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  dismissible?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  public toasts$ = this.toastsSubject.asObservable();

  constructor() { }

  /**
   * Show a toast notification
   */
  show(message: string, type: Toast['type'] = 'info', duration: number = 5000): void {
    const toast: Toast = {
      id: this.generateId(),
      message,
      type,
      duration,
      dismissible: true
    };

    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next([...currentToasts, toast]);

    // Auto-remove toast after duration
    if (duration > 0) {
      setTimeout(() => {
        this.remove(toast.id);
      }, duration);
    }
  }

  /**
   * Show success toast
   */
  showSuccess(message: string, duration: number = 4000): void {
    this.show(message, 'success', duration);
  }

  /**
   * Show error toast
   */
  showError(message: string, duration: number = 6000): void {
    this.show(message, 'error', duration);
  }

  /**
   * Show warning toast
   */
  showWarning(message: string, duration: number = 5000): void {
    this.show(message, 'warning', duration);
  }

  /**
   * Show info toast
   */
  showInfo(message: string, duration: number = 4000): void {
    this.show(message, 'info', duration);
  }

  /**
   * Remove a specific toast
   */
  remove(id: string): void {
    const currentToasts = this.toastsSubject.value;
    const filteredToasts = currentToasts.filter(toast => toast.id !== id);
    this.toastsSubject.next(filteredToasts);
  }

  /**
   * Clear all toasts
   */
  clear(): void {
    this.toastsSubject.next([]);
  }

  /**
   * Generate unique ID for toast
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }
}
