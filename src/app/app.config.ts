import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  InjectionToken,
  inject,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

export const FIREBASE_APP = new InjectionToken<FirebaseApp>('firebase.app');
export const FIREBASE_AUTH = new InjectionToken<Auth>('firebase.auth');

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    {
      provide: FIREBASE_APP,
      useFactory: () => initializeApp(environment.firebase),
    },
    {
      provide: FIREBASE_AUTH,
      useFactory: () => getAuth(inject(FIREBASE_APP)),
    },
  ],
};
