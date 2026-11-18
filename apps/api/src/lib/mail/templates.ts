import { ROLE_LABELS, type Role } from '@tracker/shared';

export interface EmailContent {
  template: string;
  subject: string;
  html: string;
  text: string;
}

const APP_NAME = 'Project Tracker';

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

interface LayoutOptions {
  preheader: string;
  heading: string;
  paragraphs: string[]; // already-escaped HTML
  action?: { label: string; url: string };
  footnote?: string;
}

function layout({ preheader, heading, paragraphs, action, footnote }: LayoutOptions): string {
  const button = action
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0">
        <tr><td style="border-radius:8px;background:#2563eb">
          <a href="${escapeHtml(action.url)}" target="_blank"
             style="display:inline-block;padding:12px 24px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">
             ${escapeHtml(action.label)}</a>
        </td></tr></table>
       <p style="font-size:12px;color:#64748b;word-break:break-all">If the button does not work, copy this link into your browser:<br>${escapeHtml(action.url)}</p>`
    : '';
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <span style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0">
        <tr><td style="padding:20px 32px;border-bottom:1px solid #e2e8f0">
          <span style="display:inline-block;width:28px;height:28px;border-radius:6px;background:#2563eb;color:#fff;font-weight:700;text-align:center;line-height:28px;vertical-align:middle">PT</span>
          <span style="font-weight:600;font-size:16px;margin-left:8px;vertical-align:middle">${APP_NAME}</span>
        </td></tr>
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(heading)}</h1>
          ${paragraphs.map((p) => `<p style="margin:0 0 12px;line-height:1.6;color:#334155">${p}</p>`).join('')}
          ${button}
          ${footnote ? `<p style="margin-top:24px;font-size:12px;color:#64748b">${escapeHtml(footnote)}</p>` : ''}
        </td></tr>
      </table>
      <p style="font-size:12px;color:#94a3b8;margin-top:16px">This is an automated message from ${APP_NAME}. Please do not reply.</p>
    </td></tr>
  </table>
</body></html>`;
}

function text(lines: (string | undefined)[]): string {
  return lines.filter(Boolean).join('\n\n') + `\n\n- ${APP_NAME}`;
}

export const templates = {
  verifyEmail(name: string, url: string): EmailContent {
    return {
      template: 'verify-email',
      subject: `Verify your email for ${APP_NAME}`,
      html: layout({
        preheader: 'Confirm your email address to activate your account.',
        heading: `Welcome, ${name}!`,
        paragraphs: ['Please confirm your email address to activate your account.'],
        action: { label: 'Verify email', url },
        footnote:
          'This link expires in 24 hours. If you did not create an account, ignore this email.',
      }),
      text: text([
        `Hi ${name},`,
        'Confirm your email address:',
        url,
        'This link expires in 24 hours.',
      ]),
    };
  },

  welcome(name: string, url: string): EmailContent {
    return {
      template: 'welcome',
      subject: `Welcome to ${APP_NAME}`,
      html: layout({
        preheader: 'Your account is ready.',
        heading: `You're all set, ${name}`,
        paragraphs: [
          'Your account is active. You can now sign in to view projects, work items and your assigned tasks.',
        ],
        action: { label: 'Open Project Tracker', url },
      }),
      text: text([`Hi ${name},`, 'Your account is active.', url]),
    };
  },

  passwordReset(name: string, url: string): EmailContent {
    return {
      template: 'password-reset',
      subject: `Reset your ${APP_NAME} password`,
      html: layout({
        preheader: 'Reset your password.',
        heading: 'Reset your password',
        paragraphs: [`Hi ${escapeHtml(name)}, we received a request to reset your password.`],
        action: { label: 'Reset password', url },
        footnote:
          'This link expires in 1 hour. If you did not request a reset, you can safely ignore this email.',
      }),
      text: text([`Hi ${name},`, 'Reset your password:', url, 'This link expires in 1 hour.']),
    };
  },

  passwordChanged(name: string): EmailContent {
    return {
      template: 'password-changed',
      subject: `Your ${APP_NAME} password was changed`,
      html: layout({
        preheader: 'Your password was changed.',
        heading: 'Password changed',
        paragraphs: [
          `Hi ${escapeHtml(name)}, the password for your account was just changed and all other sessions were signed out.`,
          'If this was not you, reset your password immediately and contact your administrator.',
        ],
      }),
      text: text([
        `Hi ${name},`,
        'Your password was changed and other sessions were signed out.',
        'If this was not you, reset your password and contact your administrator.',
      ]),
    };
  },

  invite(name: string, inviterName: string, role: Role, url: string): EmailContent {
    return {
      template: 'invite',
      subject: `${inviterName} invited you to ${APP_NAME}`,
      html: layout({
        preheader: `You've been invited as ${ROLE_LABELS[role]}.`,
        heading: `You're invited, ${name}`,
        paragraphs: [
          `${escapeHtml(inviterName)} added you to ${APP_NAME} as <strong>${ROLE_LABELS[role]}</strong>.`,
          'Set your password to activate your account (or sign in with Google using this email).',
        ],
        action: { label: 'Set password', url },
        footnote: 'This invite link expires in 72 hours.',
      }),
      text: text([
        `Hi ${name},`,
        `${inviterName} added you to ${APP_NAME} as ${ROLE_LABELS[role]}.`,
        'Set your password:',
        url,
      ]),
    };
  },

  roleChanged(name: string, role: Role): EmailContent {
    return {
      template: 'role-changed',
      subject: `Your ${APP_NAME} role was updated`,
      html: layout({
        preheader: `Your role is now ${ROLE_LABELS[role]}.`,
        heading: 'Your role was updated',
        paragraphs: [
          `Hi ${escapeHtml(name)}, an administrator changed your role to <strong>${ROLE_LABELS[role]}</strong>.`,
        ],
      }),
      text: text([`Hi ${name},`, `Your role is now ${ROLE_LABELS[role]}.`]),
    };
  },

  accountStatus(name: string, active: boolean): EmailContent {
    return {
      template: active ? 'account-reactivated' : 'account-deactivated',
      subject: active
        ? `Your ${APP_NAME} account was reactivated`
        : `Your ${APP_NAME} account was deactivated`,
      html: layout({
        preheader: active ? 'Your account is active again.' : 'Your account was deactivated.',
        heading: active ? 'Account reactivated' : 'Account deactivated',
        paragraphs: [
          active
            ? `Hi ${escapeHtml(name)}, your account has been reactivated. You can sign in again.`
            : `Hi ${escapeHtml(name)}, your account has been deactivated by an administrator. Contact your administrator if you think this is a mistake.`,
        ],
      }),
      text: text([
        `Hi ${name},`,
        active ? 'Your account has been reactivated.' : 'Your account has been deactivated.',
      ]),
    };
  },

  projectMemberAdded(
    name: string,
    addedBy: string,
    projectName: string,
    projectKey: string,
    roleLabel: string,
    url: string,
  ): EmailContent {
    return {
      template: 'project-member-added',
      subject: `You were added to ${projectKey} · ${projectName}`,
      html: layout({
        preheader: `${addedBy} added you to ${projectName}.`,
        heading: `Added to ${projectName}`,
        paragraphs: [
          `Hi ${escapeHtml(name)}, ${escapeHtml(addedBy)} added you to <strong>${escapeHtml(projectKey)} · ${escapeHtml(projectName)}</strong> as <strong>${escapeHtml(roleLabel)}</strong>.`,
        ],
        action: { label: 'Open project', url },
      }),
      text: text([
        `Hi ${name},`,
        `${addedBy} added you to ${projectKey} - ${projectName} as ${roleLabel}.`,
        url,
      ]),
    };
  },

  workItemAssigned(
    name: string,
    assignedBy: string,
    item: { key: string; title: string; typeLabel: string; priorityLabel: string },
    url: string,
  ): EmailContent {
    return {
      template: 'work-item-assigned',
      subject: `[${item.key}] assigned to you: ${item.title}`,
      html: layout({
        preheader: `${assignedBy} assigned ${item.key} to you.`,
        heading: `${item.key} was assigned to you`,
        paragraphs: [
          `Hi ${escapeHtml(name)}, ${escapeHtml(assignedBy)} assigned you a ${escapeHtml(item.typeLabel.toLowerCase())}:`,
          `<strong>${escapeHtml(item.key)} · ${escapeHtml(item.title)}</strong><br><span style="color:#64748b">Priority: ${escapeHtml(item.priorityLabel)}</span>`,
        ],
        action: { label: `Open ${item.key}`, url },
      }),
      text: text([
        `Hi ${name},`,
        `${assignedBy} assigned you ${item.key}: ${item.title} (priority ${item.priorityLabel}).`,
        url,
      ]),
    };
  },

  mentioned(
    name: string,
    author: string,
    item: { key: string; title: string },
    excerpt: string,
    url: string,
  ): EmailContent {
    const short = excerpt.length > 300 ? `${excerpt.slice(0, 300)}…` : excerpt;
    return {
      template: 'mentioned',
      subject: `${author} mentioned you on ${item.key}`,
      html: layout({
        preheader: `${author} mentioned you on ${item.key}.`,
        heading: `You were mentioned on ${item.key}`,
        paragraphs: [
          `Hi ${escapeHtml(name)}, ${escapeHtml(author)} mentioned you on <strong>${escapeHtml(item.key)} · ${escapeHtml(item.title)}</strong>:`,
          `<span style="display:block;border-left:3px solid #cbd5e1;padding-left:12px;color:#475569;white-space:pre-line">${escapeHtml(short)}</span>`,
        ],
        action: { label: 'Reply', url },
      }),
      text: text([
        `Hi ${name},`,
        `${author} mentioned you on ${item.key} - ${item.title}:`,
        short,
        url,
      ]),
    };
  },

  /** Generic work item activity (state change, new comment, due soon). */
  workItemActivity(
    template: string,
    name: string,
    headline: string,
    item: { key: string; title: string },
    detail: string | null,
    url: string,
  ): EmailContent {
    const short = detail && detail.length > 300 ? `${detail.slice(0, 300)}…` : detail;
    return {
      template,
      subject: `[${item.key}] ${headline}`,
      html: layout({
        preheader: `${item.key}: ${headline}`,
        heading: headline,
        paragraphs: [
          `Hi ${escapeHtml(name)}, <strong>${escapeHtml(item.key)} · ${escapeHtml(item.title)}</strong>`,
          ...(short
            ? [
                `<span style="display:block;border-left:3px solid #cbd5e1;padding-left:12px;color:#475569;white-space:pre-line">${escapeHtml(short)}</span>`,
              ]
            : []),
        ],
        action: { label: `Open ${item.key}`, url },
        footnote: 'Change which emails you receive under Profile & security → Notifications.',
      }),
      text: text([
        `Hi ${name},`,
        `${item.key} - ${item.title}: ${headline}`,
        short ?? undefined,
        url,
      ]),
    };
  },
};
