import { siteConfig } from "@/shared/config/site";
import nodemailer from "nodemailer";
import { Resend } from "resend";

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type EmailTransport = "smtp" | "resend" | "none";

export function getEmailTransport(): EmailTransport {
  if (process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim()) {
    return "smtp";
  }
  if (process.env.RESEND_API_KEY?.trim()) {
    return "resend";
  }
  return "none";
}

export function isEmailConfigured(): boolean {
  const transport = getEmailTransport();
  if (transport === "none") return false;
  return Boolean(process.env.EMAIL_FROM?.trim());
}

export function getEmailFrom(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    `Coodelsur <${siteConfig.contact.email}>`
  );
}

async function sendViaSmtp(message: OutboundEmail): Promise<{ sent: boolean; reason?: string }> {
  const host = process.env.SMTP_HOST!.trim();
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER!.trim();
  const pass = process.env.SMTP_PASS!.trim();
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from: getEmailFrom(),
      to: message.to,
      replyTo: siteConfig.contact.email,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    return { sent: true };
  } catch (error) {
    console.error("[email/smtp]", error);
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "smtp_send_failed",
    };
  }
}

async function sendViaResend(message: OutboundEmail): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY!.trim();
  const resend = new Resend(apiKey);

  const result = await resend.emails.send({
    from: getEmailFrom(),
    to: [message.to],
    replyTo: siteConfig.contact.email,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });

  if (result.error) {
    console.error("[email/resend]", result.error);
    return { sent: false, reason: result.error.message };
  }

  return { sent: true };
}

export async function sendOutboundEmail(
  message: OutboundEmail,
): Promise<{ sent: boolean; transport: EmailTransport; reason?: string }> {
  const to = message.to.trim();
  if (!to) {
    return { sent: false, transport: "none", reason: "missing_email" };
  }

  const transport = getEmailTransport();

  if (transport === "none") {
    console.info("[email] Sin SMTP ni Resend — correo simulado:", {
      to,
      subject: message.subject,
    });
    return { sent: false, transport, reason: "not_configured" };
  }

  const result =
    transport === "smtp" ? await sendViaSmtp(message) : await sendViaResend(message);

  return { ...result, transport };
}
