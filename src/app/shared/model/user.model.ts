import { FieldValue } from 'firebase/firestore';

export interface UserModel {
  uid: string;
  name: string;
  email: string;
  avatar: string;
  status: 'online' | 'away';
  isDemoUser?: boolean;
  channels: string[];
  createdAt: FieldValue;
}
