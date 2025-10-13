// src/services/notification/PushoverNotificationService.ts
import axios from 'axios';
import { config } from '../../config';

interface PushoverPayload {
  token: string;
  user: string;
  message: string;
  title?: string;
  priority?: number;
  sound?: string;
}

export class PushoverNotificationService {
  private readonly apiUrl = 'https://api.pushover.net/1/messages.json';
  private userKey: string | undefined;
  private apiToken: string | undefined;

  constructor() {
    this.userKey = config.PUSHOVER_USER_KEY;
    this.apiToken = config.PUSHOVER_API_TOKEN;
  }

  public async sendNotification(message: string, title: string, priority: number = 0): Promise<void> {
    if (!this.userKey || !this.apiToken) {
      console.warn('Pushover keys not configured. Skipping notification.');
      return;
    }

    const payload: PushoverPayload = {
      token: this.apiToken,
      user: this.userKey,
      title: `TRADING BOT: ${title}`,
      message,
      priority, // 0 = Normal, 1 = High-priority
      sound: priority > 0 ? 'persistent' : 'pushover' // Son différent pour les alertes importantes
    };

    try {
      await axios.post(this.apiUrl, payload);
      console.log(`[PUSHOVER] Notification sent: "${title}"`);
    } catch (error) {
      console.error('Failed to send Pushover notification:', error);
    }
  }
}