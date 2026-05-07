import fs from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { renderTemplate, type EmailTemplateId, type TemplateVars } from "./templates.js";
import { writeAudit } from "../audit.service.js";

type MailConfig = {
  from: string;
  smtpUrl?: string;
  outDir: string;
};

const cfg: MailConfig = {
  from: process.env.MAIL_FROM ?? "nvms@minaloc.gov.rw",
  smtpUrl: process.env.SMTP_URL,
  outDir: process.env.MAIL_OUT_DIR ?? path.resolve(process.cwd(), "tmp", "emails"),
};

async function ensureOutDir() {
  await fs.mkdir(cfg.outDir, { recursive: true });
}

function safeName(s: string) {
  return s.replace(/[^a-z0-9_.-]+/gi, "_").slice(0, 80);
}

export async function sendTemplatedEmail(opts: {
  templateId: EmailTemplateId;
  to: string;
  vars: TemplateVars;
  actorUserId?: string | null;
  targetUserId?: string | null;
}) {
  const { subject, text } = renderTemplate(opts.templateId, opts.vars);

  // Dev mode: if SMTP_URL is not provided, write emails to disk for inspection.
  if (!cfg.smtpUrl) {
    await ensureOutDir();
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const fname = `${ts}__${safeName(opts.templateId)}__${safeName(opts.to)}.txt`;
    await fs.writeFile(
      path.join(cfg.outDir, fname),
      [`TO: ${opts.to}`, `SUBJECT: ${subject}`, "", text].join("\n"),
      "utf8",
    );
    console.log(`[MAIL:DEV] wrote ${fname}`);
    await writeAudit("EMAIL_SENT", {
      actorUserId: opts.actorUserId ?? undefined,
      targetUserId: opts.targetUserId ?? undefined,
      metadata: { templateId: opts.templateId, to: opts.to, devFile: fname },
    });
    return { ok: true as const, mode: "file" as const, subject };
  }

  const transporter = nodemailer.createTransport(cfg.smtpUrl);
  await transporter.sendMail({
    from: cfg.from,
    to: opts.to,
    subject,
    text,
  });

  await writeAudit("EMAIL_SENT", {
    actorUserId: opts.actorUserId ?? undefined,
    targetUserId: opts.targetUserId ?? undefined,
    metadata: { templateId: opts.templateId, to: opts.to, mode: "smtp" },
  });

  return { ok: true as const, mode: "smtp" as const, subject };
}

