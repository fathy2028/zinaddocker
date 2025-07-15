import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface SuccessMessage {
  message: string;
  email?: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  private messageSubject = new BehaviorSubject<SuccessMessage | null>(null);
  public message$ = this.messageSubject.asObservable();

  constructor() { }

  /**
   * Set a temporary message (will be cleared after being read)
   */
  setMessage(message: SuccessMessage): void {
    this.messageSubject.next(message);
  }

  /**
   * Get and clear the current message
   */
  getMessage(): SuccessMessage | null {
    const message = this.messageSubject.value;
    this.clearMessage();
    return message;
  }

  /**
   * Clear the current message
   */
  clearMessage(): void {
    this.messageSubject.next(null);
  }

  /**
   * Set a registration success message
   */
  setRegistrationSuccess(email: string): void {
    this.setMessage({
      message: 'Registration successful! Please login with your credentials.',
      email: email,
      type: 'success'
    });
  }
}
