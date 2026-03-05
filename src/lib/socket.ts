import { io } from 'socket.io-client';

// In development, the socket connects to the same host/port.
// In production, it also connects to the same host/port.
export const socket = io();
