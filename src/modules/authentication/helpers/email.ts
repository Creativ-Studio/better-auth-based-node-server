
import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
import { readFileSync } from 'fs';
import { env } from '../../../configs/env';

// Enhanced interfaces
interface EmailConfig {
  service?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
  pool?: boolean;
  maxConnections?: number;
  maxMessages?: number;
}

interface EmailAttachment {
  filename: string;
  path?: string;
  content?: string | Buffer;
  contentType?: string;
  encoding?: string;
}

interface EmailOptions {
  from?: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  priority?: 'high' | 'normal' | 'low';
  replyTo?: string;
}

interface BulkEmailRecipient {
  email: string;
  name?: string;
  data?: Record<string, any>;
}

interface BulkEmailResult {
  email: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

interface TemplateData {
  [key: string]: string | number | boolean;
}

// Email service class with advanced features
class AdvancedEmailService {
  private transporter: Transporter;
  private defaultFrom: string;
  private templates: Map<string, EmailTemplate> = new Map();

  constructor(config: EmailConfig, defaultFrom: string) {
    this.transporter = nodemailer.createTransport(config);
    this.defaultFrom = defaultFrom;
  }

  // Register email templates
  registerTemplate(name: string, template: EmailTemplate): void {
    this.templates.set(name, template);
  }

  // Load template from file
  loadTemplateFromFile(name: string, filePath: string): void {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const template: EmailTemplate = {
        subject: `Template: ${name}`,
        html: content
      };
      this.registerTemplate(name, template);
    } catch (error) {
      throw new Error(`Failed to load template from ${filePath}: ${error}`);
    }
  }

  // Process template with data
  private processTemplate(template: EmailTemplate, data: TemplateData): EmailTemplate {
    const processString = (str: string): string => {
      return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return data[key]?.toString() || match;
      });
    };

    return {
      subject: processString(template.subject),
      html: processString(template.html),
      text: template.text ? processString(template.text) : undefined
    };
  }

  // Send email with template
  async sendTemplateEmail(
    templateName: string,
    options: Omit<EmailOptions, 'subject' | 'html' | 'text'>,
    templateData: TemplateData = {}
  ): Promise<any> {
    const template = this.templates.get(templateName);
    if (!template) {
      return {
        success: false,
        error: `Template '${templateName}' not found`
      };
    }

    const processedTemplate = this.processTemplate(template, templateData);
    
    return this.sendEmail({
      ...options,
      subject: processedTemplate.subject,
      html: processedTemplate.html,
      text: processedTemplate.text
    });
  }

  // Send email with enhanced options
  async sendEmail(options: EmailOptions): Promise<any> {
    try {
      const mailOptions: SendMailOptions = {
        from: options.from || this.defaultFrom,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments ,
        priority: options.priority,
        replyTo: options.replyTo
      };

      const info = await this.transporter.sendMail(mailOptions);
      // console.log(info)
      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // console.log(error)
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  // Send bulk emails with rate limiting
  async sendBulkEmails(
    recipients: BulkEmailRecipient[],
    templateName: string,
    globalData: TemplateData = {},
    delayMs: number = 1000
  ): Promise<BulkEmailResult[]> {
    const results: BulkEmailResult[] = [];
    
    for (const recipient of recipients) {
      try {
        const templateData: TemplateData = {
          ...globalData,
          email: recipient.email,
          name: recipient.name || '',
          ...recipient.data
        };

        const result = await this.sendTemplateEmail(
          templateName,
          {
            to: recipient.email,
            replyTo: this.defaultFrom
          },
          templateData
        );

        results.push({
          email: recipient.email,
          success: result.success,
          messageId: result.messageId,
          error: result.error
        });

        // Rate limiting delay
        if (delayMs > 0) {
          await this.delay(delayMs);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          email: recipient.email,
          success: false,
          error: errorMessage
        });
      }
    }

    return results;
  }

  // Utility method for delays
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Verify connection
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('SMTP verification failed:', error);
      return false;
    }
  }

  // Get email queue info (if using pool)
  isIdle(): boolean {
    return this.transporter.isIdle();
  }

  // Close transporter
  close(): void {
    this.transporter.close();
  }
}

// Configuration builder
class EmailConfigBuilder {
  private config: Partial<EmailConfig> = {};

  setService(service: string): this {
    // this.config.service = service;
    return this;
  }

  setHost(host: string, port: number, secure: boolean = false): this {
    this.config.host = host;
    this.config.port = port;
    this.config.secure = secure;
    return this;
  }

  setAuth(user: string, password: string): this {
    this.config.auth = { user, pass: password };
    return this;
  }

  setPool(maxConnections: number = 5, maxMessages: number = 100): this {
    this.config.pool = true;
    this.config.maxConnections = maxConnections;
    this.config.maxMessages = maxMessages;
    return this;
  }

  build(): EmailConfig {
    if (!this.config.auth) {
      throw new Error('Authentication is required');
    }
    return this.config as EmailConfig;
  }
}

const config = new EmailConfigBuilder()
.setService('gmail')
.setHost(env.AUTH_SERVER_SMTP_SERVER,parseInt(env.AUTH_SERVER_SMTP_PORT),true)
.setAuth(env.AUTH_SERVER_SMTP_USERNAME, env.AUTH_SERVER_SMTP_PASSWORD)
.setPool(3, 50)
.build();

const emailService = new AdvancedEmailService(config, 'noreply@creativ-studio.com');

export async function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  // Your email sending logic here
   await emailService.sendEmail({
    html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>${env.AUTH_SERVER_COMPANY_NAME}</title>
        </head>
        <body style="font-family:Arial,sans-serif;margin:0; padding:0; background:#ffffff;line-height: 1.5">
          <table width="100%" bgcolor="#ffffff" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background:#ffffff;">
                  <tr>
                    <td style="padding: 32px 24px 0 24px;">
                      <h1 style="font-weight:bold; margin:0; font-size:2rem; color:#222;">${env.AUTH_SERVER_COMPANY_NAME}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 24px 24px 0 24px;">
                      ${text}
                    </td>
                  </tr>
                  
                  <tr>
                    <td style="padding: 16px 24px 0 24px;">
                      <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="font-family:Arial,sans-serif; color:#555; opacity:0.7; font-size:0.9rem;">
                              Best regards<br>
                              The GatheredAI team
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 32px 24px 0 24px;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ccc;">
                        <tr>
                          <td style="padding-top:24px; font-family:Arial,sans-serif;">
                            <h1 style="font-size:1rem; font-weight:bold; margin:0; color:#222;">${env.AUTH_SERVER_COMPANY_NAME}</h1>
                            <table cellpadding="0" cellspacing="0" border="0" style="margin-top:8px; line-height: 2;">
                              <tr>
                                <td style="text-decoration:underline; font-family:Arial,sans-serif; font-size:0.8rem; color:#555; opacity:0.7;">
                                  <a href="${env.AUTH_SERVER_COMPANY_WEBSITE_URL}" style="color:#555; text-decoration:none; margin-right:18px;">GatheredAI</a>
                                </td>
                              </tr>
                              <tr>
                                <td style="text-decoration:underline; font-family:Arial,sans-serif; font-size:0.8rem; color:#555; opacity:0.7;">
                                  <a href="${env.AUTH_SERVER_COMPANY_HELP_URL}" style="color:#555; text-decoration:none;">Help center</a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <!-- End Footer -->
                  <tr><td height="32"></td></tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    from: env.AUTH_SERVER_SMTP_FROM,
    to: to,
    subject: `${subject}`,
    text: text,
  })
}
