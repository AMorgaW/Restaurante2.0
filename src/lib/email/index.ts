import "server-only";
import { getServerEnv } from "@/lib/env/server";

/**
 * Capa de correo transaccional desacoplada. Sin credenciales opera el
 * adaptador nulo (la app funciona igual); con EMAIL_PROVIDER=resend y
 * RESEND_API_KEY se envían correos reales vía API HTTP.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailProvider {
  readonly name: "none" | "resend";
  send(message: EmailMessage): Promise<{ delivered: boolean }>;
}

class NoopEmailProvider implements EmailProvider {
  readonly name = "none" as const;
  async send(): Promise<{ delivered: boolean }> {
    // Sin proveedor configurado no se envía nada (y no se registra PII).
    return { delivered: false };
  }
}

class ResendEmailProvider implements EmailProvider {
  readonly name = "resend" as const;

  async send(message: EmailMessage): Promise<{ delivered: boolean }> {
    const env = getServerEnv();
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
      return { delivered: false };
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });
    return { delivered: response.ok };
  }
}

export function getEmailProvider(): EmailProvider {
  const env = getServerEnv();
  if (env.EMAIL_PROVIDER === "resend" && env.RESEND_API_KEY) {
    return new ResendEmailProvider();
  }
  return new NoopEmailProvider();
}
