/**
 * Pulse — Email Delivery Service
 * Universal mail dispatch engine supporting real SMTP delivery,
 * Ethereal development test inboxes, and console mock logger.
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import {
  renderWelcomeEmail,
  renderInviteMemberEmail,
  validateEmailConfig,
} from "./email-templates";

let transporterInstance: Transporter | null = null;

/**
 * Creates or reuses a Nodemailer Transporter based on environment variables.
 */
export async function getTransporter(): Promise<Transporter> {
  if (transporterInstance) {
    return transporterInstance;
  }

  const config = validateEmailConfig(process.env);

  if (config.transportMode === "smtp" && config.host) {
    transporterInstance = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || "",
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === "production",
      },
    });
    return transporterInstance;
  }

  if (config.transportMode === "console") {
    transporterInstance = nodemailer.createTransport({
      jsonTransport: true,
    });
    return transporterInstance;
  }

  // Fallback to Ethereal Email for local development without external SMTP setup
  try {
    const testAccount = await nodemailer.createTestAccount();
    transporterInstance = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log(
      `[Pulse Mailer] Ethereal test mailer initialized: ${testAccount.user}`,
    );
    return transporterInstance;
  } catch (error) {
    console.warn(
      "[Pulse Mailer] Failed to create Ethereal test account, falling back to console logger:",
      error,
    );
    transporterInstance = nodemailer.createTransport({
      jsonTransport: true,
    });
    return transporterInstance;
  }
}

/**
 * Resets the transporter singleton (useful for test runs and config updates).
 */
export function resetTransporter(): void {
  transporterInstance = null;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  error?: string;
}

/**
 * Universal email dispatch engine.
 * Sends any transactional or notification email via configured transport.
 * Non-blocking: will never crash or disrupt calling application flows.
 */
export async function sendEmail(
  options: SendEmailOptions,
): Promise<SendEmailResult> {
  const { to, subject, html, text, from } = options;

  if (!to || !to.includes("@")) {
    return { success: false, error: "Geçersiz e-posta adresi." };
  }

  try {
    const fromAddress =
      from || process.env.EMAIL_FROM || "Pulse <noreply@pulse.local>";
    const transporter = await getTransporter();

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text: text || "",
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    if (previewUrl) {
      console.log(
        `\n📨 [Pulse Mailer] E-posta '${to}' adresine gönderildi!\n   Konu: ${subject}\n   Test Önizleme Linki: ${previewUrl}\n`,
      );
    } else {
      console.log(
        `[Pulse Mailer] E-posta '${to}' adresine başarıyla iletildi. Konu: "${subject}" (MessageID: ${info.messageId})`,
      );
    }

    return {
      success: true,
      messageId: info.messageId,
      previewUrl,
    };
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Bilinmeyen e-posta gönderim hatası";
    console.error(`[Pulse Mailer] E-posta gönderilemedi (${to}):`, errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export interface SendWelcomeEmailOptions {
  to: string;
  name?: string | null;
}

/**
 * Sends a welcome email to the newly registered user.
 */
export async function sendWelcomeEmail(
  options: SendWelcomeEmailOptions,
): Promise<SendEmailResult> {
  const { to, name } = options;

  const appUrl =
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";

  const { subject, html, text } = renderWelcomeEmail({
    name,
    email: to,
    appUrl,
  });

  return sendEmail({
    to,
    subject,
    html,
    text,
  });
}

export interface SendInviteMemberEmailOptions {
  to: string;
  projectName: string;
  inviterName?: string | null;
  token: string;
  role?: string;
}

/**
 * Sends a project invitation email to the invited recipient.
 */
export async function sendInviteMemberEmail(
  options: SendInviteMemberEmailOptions,
): Promise<SendEmailResult> {
  const { to, projectName, inviterName, token, role } = options;

  const rawBaseUrl =
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";
  const baseUrl = rawBaseUrl.replace(/\/+$/, "");
  const inviteUrl = `${baseUrl}/invite/${token}`;

  const { subject, html, text } = renderInviteMemberEmail({
    recipientEmail: to,
    projectName,
    inviterName,
    inviteUrl,
    role,
  });

  return sendEmail({
    to,
    subject,
    html,
    text,
  });
}
