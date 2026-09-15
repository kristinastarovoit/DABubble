export interface User {
    id: string;
  name: string;
  email: string;
  avatarUrl: string;

  isOnline: boolean;
  isCurrentUser?: boolean;  // erst zur Laufzeit berechnet,
                            // nicht aus der Datenbank geladen

  createdAt: Date;
}
