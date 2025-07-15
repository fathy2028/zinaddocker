import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';
import { NavbarComponent } from '../navbar/navbar.component';

@Component({
  selector: 'app-home',
  imports: [CommonModule, NavbarComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  isLoading = true;
  private subscriptions: Subscription[] = [];

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    // Subscribe to current user
    this.subscriptions.push(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
        this.isLoading = false;
      })
    );

    // Load user profile if not already loaded
    if (this.authService.isAuthenticated() && !this.currentUser) {
      this.loadUserProfile();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private loadUserProfile(): void {
    this.authService.getProfile().subscribe({
      next: (response) => {
        if (response.status === 'success' && response.data) {
          // User data is automatically updated in the service
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Failed to load user profile:', error);
        this.isLoading = false;
      }
    });
  }

  getJoinDate(): string {
    if (!this.currentUser?.created_at) return '';

    const date = new Date(this.currentUser.created_at);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }
}
