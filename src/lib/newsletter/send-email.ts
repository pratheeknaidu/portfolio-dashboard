export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const DEFAULT_FROM = "Portfolio Brief <onboarding@resend.dev>";

/** Sends through Resend's HTTP API. Throws on a non-2xx so the caller can report it. */
export async function sendEmail(email: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.NEWSLETTER_FROM || DEFAULT_FROM,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
  }
}
