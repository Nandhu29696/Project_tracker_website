import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../logger';
import { prisma } from '../prisma';
import type { EmailContent } from './templates';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

async function record(
  to: string,
  content: EmailContent,
  status: 'SENT' | 'FAILED' | 'SKIPPED',
  error?: string,
) {
  try {
    await prisma.emailLog.create({
      data: { to, subject: content.subject, template: content.template, status, error },
    });
  } catch (err) {
    logger.error({ err }, 'failed to write email log');
  }
}

/**
 * Dev transport (no SMTP server needed): saves the email as an HTML file in
 * apps/api/.mail-outbox and prints any links to the log so they can be clicked.
 */
async function writeToOutbox(to: string, content: EmailContent): Promise<boolean> {
  try {
    const dir = resolve(process.cwd(), '.mail-outbox');
    await mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = join(
      dir,
      `${stamp}_${content.template}_${to.replace(/[^a-z0-9@._-]/gi, '_')}.html`,
    );
    await writeFile(file, `<!-- To: ${to} | Subject: ${content.subject} -->\n${content.html}`);
    const links = content.text.match(/https?:\/\/\S+/g) ?? [];
    logger.info({ to, template: content.template, file, links }, `email saved: ${content.subject}`);
    await record(to, content, 'SENT');
    return true;
  } catch (err) {
    logger.error({ err, to }, 'failed to write email to outbox');
    await record(to, content, 'FAILED', 'outbox write failed');
    return false;
  }
}

/**
 * Sends an email. Never throws - a mail outage must not break the API request.
 * Phase 5 moves this onto a BullMQ queue with retries.
 */
export async function sendEmail(to: string, content: EmailContent): Promise<boolean> {
  if (!env.MAIL_ENABLED) {
    logger.info({ to, template: content.template }, 'MAIL_ENABLED=false - email skipped');
    if (!env.isTest) await record(to, content, 'SKIPPED');
    return false;
  }
  if (env.MAIL_TRANSPORT === 'file') return writeToOutbox(to, content);
  try {
    await getTransporter().sendMail({
      from: env.MAIL_FROM,
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
    logger.info({ to, template: content.template }, 'email sent');
    await record(to, content, 'SENT');
    return true;
  } catch (err) {
    logger.error({ err, to, template: content.template }, 'email send failed');
    await record(
      to,
      content,
      'FAILED',
      err instanceof Error ? err.message.slice(0, 500) : 'unknown',
    );
    return false;
  }
}

/** Queue an email without awaiting it (keeps API responses fast). */
export function sendEmailLater(to: string, content: EmailContent): void {
  void sendEmail(to, content);
}

export async function verifyMailConnection(): Promise<void> {
  if (!env.MAIL_ENABLED) return;
  if (env.MAIL_TRANSPORT === 'file') {
    logger.info('MAIL_TRANSPORT=file - emails are saved to apps/api/.mail-outbox');
    return;
  }
  try {
    await getTransporter().verify();
    logger.info({ host: env.SMTP_HOST, port: env.SMTP_PORT }, 'SMTP connection OK');
  } catch (err) {
    logger.warn(
      { err, host: env.SMTP_HOST },
      'SMTP connection failed - emails will not be delivered',
    );
  }
}
