import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Header } from './header';
import { AuthService } from '../../shared/services/auth';
import { UserService } from '../../shared/services/users';
import { Presence } from '../../shared/services/presence';

describe('Header', () => {
  let component: Header;
  let fixture: ComponentFixture<Header>;
  let authService: { currentUserId: ReturnType<typeof signal>; logout: ReturnType<typeof vi.fn> };
  let presenceService: { goOffline: ReturnType<typeof vi.fn> };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    authService = {
      currentUserId: signal<string | undefined>(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
    };
    presenceService = { goOffline: vi.fn().mockResolvedValue(undefined) };
    router = { navigateByUrl: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UserService, useValue: { users: signal([]) } },
        { provide: Presence, useValue: presenceService },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    consoleError?.mockRestore();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('logs a presence cleanup failure but continues logout and redirects', async () => {
    const presenceError = new Error('Presence update failed');
    presenceService.goOffline.mockRejectedValue(presenceError);
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await component.logout();

    await Promise.resolve();
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to set presence offline during logout.',
      presenceError,
    );
    expect(authService.logout).toHaveBeenCalledOnce();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('does not wait for a pending presence cleanup before logging out', async () => {
    presenceService.goOffline.mockReturnValue(new Promise(() => {}));

    await component.logout();

    expect(authService.logout).toHaveBeenCalledOnce();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('does not redirect when Firebase sign-out fails', async () => {
    const signOutError = new Error('Sign-out failed');
    authService.logout.mockRejectedValue(signOutError);

    await expect(component.logout()).rejects.toBe(signOutError);

    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
