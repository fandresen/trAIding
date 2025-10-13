// src/services/notification/SlackNotificationService.ts
import axios from 'axios';
import { config } from '../../config';

export class SlackNotificationService {
  private webhookUrl: string | undefined;

  constructor() {
    this.webhookUrl = config.SLACK_WEBHOOK_URL;
  }

  public async sendError(error: Error, context: string = 'General Error'): Promise<void> {
    if (!this.webhookUrl) {
      console.warn('SLACK_WEBHOOK_URL not configured. Skipping notification.');
      return;
    }

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