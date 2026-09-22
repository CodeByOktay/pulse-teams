/**
 * Pulse — Email Templates & Configuration Validator
 * Pure functions for email HTML/Text generation and configuration checks.
 */

export interface WelcomeEmailParams {
  name?: string | null;
  email: string;
  appUrl?: string;
}

export interface InviteMemberEmailParams {
  recipientEmail: string;
  projectName: string;
  inviterName?: string | null;
  inviteUrl: string;
  role?: string;
}

export interface EmailTemplateResult {
  subject: string;
  html: string;
  text: string;
}


export interface EmailConfigResult {
  isValid: boolean;
  transportMode: "smtp" | "ethereal" | "console";
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
}

/**
 * Escapes characters that have special meaning in HTML to prevent XSS.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Validates provided environment variables and resolves the email transport mode.
 */
export function validateEmailConfig(
  env: Record<string, string | undefined>,
): EmailConfigResult {
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS?.trim();
  const explicitMode = env.EMAIL_TRANSPORT?.trim()?.toLowerCase();
  const nodeEnv = env.NODE_ENV?.trim()?.toLowerCase();

  if (explicitMode === "console") {
    return { isValid: true, transportMode: "console" };
  }

  if (host && user && pass) {
    const rawPort = env.SMTP_PORT ? parseInt(env.SMTP_PORT, 10) : 587;
    const port = Number.isNaN(rawPort) || rawPort <= 0 ? 587 : rawPort;
    const secure = env.SMTP_SECURE === "true" || port === 465;

    return {
      isValid: true,
      transportMode: "smtp",
      host,
      port,
      secure,
      user,
    };
  }

  // If in test environment without SMTP credentials, default to console
  if (nodeEnv === "test") {
    return { isValid: true, transportMode: "console" };
  }

  // Development fallback to Ethereal test inbox
  return {
    isValid: true,
    transportMode: "ethereal",
  };
}

/**
 * Renders a modern, responsive HTML and plain text Welcome Email for Pulse.
 */
export function renderWelcomeEmail(params: WelcomeEmailParams): EmailTemplateResult {
  const rawName = (params.name || "").trim();
  const displayName = rawName ? rawName : "Pulse Kullanıcısı";
  const safeName = escapeHtml(displayName);
  const rawBaseUrl = (params.appUrl || "http://localhost:3000").trim();
  const baseUrl = rawBaseUrl.replace(/\/+$/, "");
  const loginUrl = `${baseUrl}/login`;

  const subject = "Pulse'a Hoş Geldiniz! 🚀";

  const text = `
Merhaba ${displayName},

Pulse ailesine hoş geldiniz! Modern ve çevik proje yönetimi için hesabınız hazırlandı.

Artık projelerinizi daha verimli yönetebilirsiniz:
- Kanban Panoları: Görevlerinizi sürükle-bırak yöntemiyle takip edin.
- Sprint & Döngü Yönetimi: Sprintlerinizi planlayın ve hız metriklerinizi görün.
- Uygulama İçi Bildirimler: Bahsetmeler (@mention) ve yaklaşan son tarihlerden anında haberdar olun.
- Komut Paleti: Ctrl + K (veya Cmd + K) ile tüm sisteme saniyeler içinde erişin.

Hesabınıza giriş yapmak için bağlantı:
${loginUrl}

Pulse ekibi olarak iyi çalışmalar dileriz!
--------------------------------------------------
Bu e-posta, Pulse sistemine kaydolan kullanıcılara otomatik olarak gönderilmektedir.
`.trim();

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f4f4f5;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#09090b;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:580px;background-color:#18181b;border:1px solid #27272a;border-radius:12px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px;border-bottom:1px solid #27272a;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="display:inline-block;background-color:#27272a;border-radius:8px;padding:8px 14px;">
                      <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.5px;">⚡ Pulse</span>
                    </div>
                  </td>
                  <td align="right">
                    <span style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Proje Yönetimi</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
                Pulse'a Hoş Geldin, ${safeName}! 👋
              </h1>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#a1a1aa;">
                Hesabınız başarıyla oluşturuldu. Projelerinizi, takımlarınızı ve sprint döngülerinizi modern bir arayüz ile yönetmeye hemen başlayabilirsiniz.
              </p>

              <!-- Feature Highlights -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#27272a;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#d4d4d8;">
                    📋 <strong style="color:#ffffff;">Akıllı Kanban:</strong> Görevlerinizi sürükle-bırak kolaylığıyla düzenleyin.
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#d4d4d8;">
                    ⚡ <strong style="color:#ffffff;">Sprint &amp; Hız Metrikleri:</strong> Hedefleri zamanında tamamlayın.
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#d4d4d8;">
                    🔔 <strong style="color:#ffffff;">Gerçek Zamanlı Bildirimler:</strong> @bahsetmeler ve son tarih uyarıları.
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#d4d4d8;">
                    ⌨️ <strong style="color:#ffffff;">Hızlı Komut Paleti:</strong> <code style="background:#18181b;padding:2px 6px;border-radius:4px;color:#a1a1aa;font-size:12px;">Ctrl+K</code> ile her şeye saniyede ulaşın.
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(loginUrl)}" target="_blank" style="display:inline-block;background-color:#ffffff;color:#09090b;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:6px;transition:background-color 0.2s;">
                      Pulse'a Giriş Yap &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback URL Link -->
              <p style="margin:0;font-size:12px;line-height:1.5;color:#71717a;text-align:center;">
                Buton çalışmıyorsa aşağıdaki bağlantıyı tarayıcınıza kopyalayabilirsiniz:<br>
                <a href="${escapeHtml(loginUrl)}" target="_blank" style="color:#a1a1aa;text-decoration:underline;word-break:break-all;">
                  ${escapeHtml(loginUrl)}
                </a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#141416;border-top:1px solid #27272a;text-align:center;">
              <p style="margin:0;font-size:12px;color:#71717a;line-height:1.5;">
                Bu e-posta, Pulse sistemine kaydolan <strong>${escapeHtml(params.email)}</strong> adresine otomatik olarak iletilmiştir.
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#52525b;">
                &copy; ${new Date().getFullYear()} Pulse Project Manager. Tüm hakları saklıdır.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject,
    html,
    text,
  };
}

/**
 * Renders a modern, responsive HTML and plain text Project Member Invitation Email for Pulse.
 */
export function renderInviteMemberEmail(
  params: InviteMemberEmailParams,
): EmailTemplateResult {
  const rawProjectName = (params.projectName || "").trim();
  const projectName = rawProjectName || "Pulse Projesi";
  const safeProjectName = escapeHtml(projectName);

  const rawInviter = (params.inviterName || "").trim();
  const inviterName = rawInviter || "Bir takım arkadaşınız";
  const safeInviterName = escapeHtml(inviterName);

  const roleName = params.role === "ADMIN" ? "Yönetici (Admin)" : "Üye (Member)";
  const safeRoleName = escapeHtml(roleName);
  const inviteUrl = params.inviteUrl.trim();
  const safeInviteUrl = escapeHtml(inviteUrl);

  const subject = `Pulse: "${projectName}" projesine davet edildiniz! 📨`;

  const text = `
Merhaba,

${inviterName} sizi Pulse üzerindeki "${projectName}" projesine davet etti!

Proje Rolü: ${roleName}
Geçerlilik: Bu davet bağlantısı 7 gün boyunca geçerlidir.

Daveti kabul etmek ve projeye katılmak için bağlantı:
${inviteUrl}

Pulse ekibi olarak iyi çalışmalar dileriz!
--------------------------------------------------
Bu e-posta, Pulse üzerinden tarafınıza gönderilen proje daveti için iletilmiştir.
`.trim();

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f4f4f5;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#09090b;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:580px;background-color:#18181b;border:1px solid #27272a;border-radius:12px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px;border-bottom:1px solid #27272a;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="display:inline-block;background-color:#27272a;border-radius:8px;padding:8px 14px;">
                      <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.5px;">⚡ Pulse</span>
                    </div>
                  </td>
                  <td align="right">
                    <span style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Proje Daveti</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
                "${safeProjectName}" Projesine Davet Edildiniz! 🎉
              </h1>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#a1a1aa;">
                <strong style="color:#ffffff;">${safeInviterName}</strong> sizi Pulse üzerindeki <strong style="color:#ffffff;">${safeProjectName}</strong> projesinde birlikte çalışmaya davet etti.
              </p>

              <!-- Invitation Details Card -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#27272a;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#a1a1aa;width:120px;">
                    📁 Proje Adı:
                  </td>
                  <td style="padding:6px 0;font-size:13px;color:#ffffff;font-weight:600;">
                    ${safeProjectName}
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#a1a1aa;">
                    👤 Davet Eden:
                  </td>
                  <td style="padding:6px 0;font-size:13px;color:#ffffff;font-weight:600;">
                    ${safeInviterName}
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#a1a1aa;">
                    🔑 Proje Rolü:
                  </td>
                  <td style="padding:6px 0;font-size:13px;color:#ffffff;font-weight:600;">
                    <span style="background-color:#3f3f46;color:#f4f4f5;padding:2px 8px;border-radius:4px;font-size:12px;">
                      ${safeRoleName}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#a1a1aa;">
                    ⏳ Geçerlilik:
                  </td>
                  <td style="padding:6px 0;font-size:13px;color:#fbbf24;font-weight:500;">
                    7 gün (Süresi dolmadan kabul edin)
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${safeInviteUrl}" target="_blank" style="display:inline-block;background-color:#ffffff;color:#09090b;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:6px;transition:background-color 0.2s;">
                      Daveti Kabul Et &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback URL Link -->
              <p style="margin:0;font-size:12px;line-height:1.5;color:#71717a;text-align:center;">
                Buton çalışmıyorsa aşağıdaki bağlantıyı tarayıcınıza kopyalayabilirsiniz:<br>
                <a href="${safeInviteUrl}" target="_blank" style="color:#a1a1aa;text-decoration:underline;word-break:break-all;">
                  ${safeInviteUrl}
                </a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#141416;border-top:1px solid #27272a;text-align:center;">
              <p style="margin:0;font-size:12px;color:#71717a;line-height:1.5;">
                Bu e-posta, Pulse üzerinde <strong>${escapeHtml(params.recipientEmail)}</strong> adresine yapılan üyelik daveti için gönderilmiştir.
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#52525b;">
                &copy; ${new Date().getFullYear()} Pulse Project Manager. Tüm hakları saklıdır.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject,
    html,
    text,
  };
}

