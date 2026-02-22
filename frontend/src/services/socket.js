import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  connect(serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000') {
    return new Promise((resolve, reject) => {
      try {
        // If already connected, resolve immediately
        if (this.isConnected && this.socket) {
          resolve();
          return;
        }

        this.socket = io(serverUrl);

        this.socket.on('connect', () => {
          console.log('Connected to server');
          this.isConnected = true;
          resolve();
        });

        this.socket.on('disconnect', () => {
          console.log('Disconnected from server');
          this.isConnected = false;
        });

        this.socket.on('error', (error) => {
          console.error('Socket error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  emit(event, ...args) {
    if (this.socket) {
      this.socket.emit(event, ...args);
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

export const socketService = new SocketService();
