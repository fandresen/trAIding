// src/services/notification/SlackNotificationService.ts
import axios from 'axios';
import { config } from '../../config';

const NOTIFICATION_COOLDOWN_MS = 60000; // 1 minute

export class SlackNotificationService {
  private webhookUrl: string | undefined;
  private lastErrorMessage: string | null = null;
  private lastNotificationTimestamp: number = 0;

  constructor() {
    this.webhookUrl = config.SLACK_WEBHOOK_URL;
  }

  public async sendError(error: Error, context: string = 'General Error'): Promise<void> {
    if (!this.webhookUrl) {
      console.warn('SLACK_WEBHOOK_URL not configured. Skipping notification.');
      return;
    }

    const errorMessage = error.message;
    const now = Date.now();

    if (errorMessage === this.lastErrorMessage && (now - this.lastNotificationTimestamp < NOTIFICATION_COOLDOWN_MS)) {
      console.log('Skipping duplicate error notification to Slack due to cooldown.');
      return;
    }

    this.lastErrorMessage = errorMessage;
    this.lastNotificationTimestamp = now;

    const message = {
      text: `🚨 *Error in Trading Bot* 🚨`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🚨 Error in Trading Bot 🚨`,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Context:*\n${context}` },
            { type: 'mrkdwn', text: `*Timestamp:*\n${new Date().toISOString()}` },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Error Message:*\n\`\`\`${error.message}\`\`\``,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Stack Trace:*\n\`\`\`${error.stack || 'Not available'}\`\`\``,
          },
        },
      ],
    };

    try {
      await axios.post(this.webhookUrl, message);
    } catch (postError) {
      console.error('Failed to send Slack notification:', postError);
    }
  }
}