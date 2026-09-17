import { Routes } from '@angular/router';
import { LandingPage } from './features/landing-page/landing-page';
import { Login } from './features/landing-page/login/login';
import { Signup } from './features/landing-page/signup/signup';
import { PasswordRecovery } from './features/landing-page/password-recovery/password-recovery';
import { PasswordReset } from './features/landing-page/password-reset/password-reset';
import { Dashboard } from './shared/components/dashboard/dashboard';
import { Chat } from './features/chat/chat';
export const routes: Routes = [
  {
    path: '',
    component: LandingPage,
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      { path: 'login', component: Login },
      { path: 'signup', component: Signup },
      { path: 'password-recovery', component: PasswordRecovery },
      { path: 'password-reset', component: PasswordReset },
    ],
  },
  { path: 'dashboard', component: Dashboard },
  { path: 'channels/:channelId', component: Chat },
  { path: 'dms/:dmId', component: Chat },
];
