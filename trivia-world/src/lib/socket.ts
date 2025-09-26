// lib/socket.ts
import { io } from 'socket.io-client';

// Use the URL of your deployed server in production
export const socket = io('http://localhost:3001');
