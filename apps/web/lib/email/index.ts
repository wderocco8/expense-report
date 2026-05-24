import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "Expense Report <onboarding@resend.dev>";

export async function sendVerificationEmail({
  email,
  name,
  url,
}: {
  email: string;
  name: string;
  url: string;
}) {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Verify your email address",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #111;">
        <h2 style="margin: 0 0 8px;">Verify your email</h2>
        <p style="margin: 0 0 24px; color: #555;">
          Hi ${name}, click the button below to verify your email address and
          complete your registration.
        </p>
        <a
          href="${url}"
          style="display: inline-block; padding: 12px 24px; background: #111; color: #fff;
                 text-decoration: none; border-radius: 6px; font-weight: 500;"
        >
          Verify email
        </a>
        <p style="margin: 24px 0 0; font-size: 13px; color: #888;">
          If you didn't create an account, you can safely ignore this email.<br/>
          This link expires in 24 hours.
        </p>
      </div>
    `,
  });
}
