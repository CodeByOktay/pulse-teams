/**
 * Pulse — Live Email Delivery Verification Script
 * Usage:
 *   npx ts-node --project prisma/tsconfig.seed.json scripts/test-mail.ts <target-email> [welcome|invite]
 */

import "dotenv/config";
import { sendWelcomeEmail, sendInviteMemberEmail } from "../src/lib/mail";

async function main() {
  const targetEmail = process.argv[2] || process.env.TEST_TARGET_EMAIL;
  const emailType = (process.argv[3] || "welcome").toLowerCase();

  if (!targetEmail) {
    console.error("❌ Hata: Hedef e-posta adresi belirtilmedi!");
    console.log("\nKullanım:");
    console.log("  npx ts-node --project prisma/tsconfig.seed.json scripts/test-mail.ts <target-email> [welcome|invite]");
    console.log("\nÖrnek (TempMail):");
    console.log("  npx ts-node --project prisma/tsconfig.seed.json scripts/test-mail.ts user@tempmail.com welcome");
    console.log("  npx ts-node --project prisma/tsconfig.seed.json scripts/test-mail.ts user@tempmail.com invite\n");
    process.exit(1);
  }

  console.log("==================================================");
  console.log("🚀 Pulse Canlı E-posta Gönderim Testi");
  console.log("==================================================");
  console.log(`Hedef E-posta : ${targetEmail}`);
  console.log(`Şablon Tipi   : ${emailType.toUpperCase()}`);
  console.log(`SMTP Host     : ${process.env.SMTP_HOST || "(Yapılandırılmamış - Ethereal/Console kullanılacak)"}`);
  console.log(`SMTP Port     : ${process.env.SMTP_PORT || "587"}`);
  console.log(`SMTP User     : ${process.env.SMTP_USER || "(boş)"}`);
  console.log(`Gönderen (From): ${process.env.EMAIL_FROM || "Pulse <noreply@pulse.local>"}`);
  console.log("--------------------------------------------------");

  let result;
  if (emailType === "invite") {
    console.log("📧 Proje Üyelik Davet E-postası gönderiliyor...");
    result = await sendInviteMemberEmail({
      to: targetEmail,
      projectName: "Pulse Core Engineering",
      inviterName: "Oktay (Admin)",
      token: "test-token-" + Date.now(),
      role: "ADMIN",
    });
  } else {
    console.log("📧 Hoş Geldiniz (Welcome) E-postası gönderiliyor...");
    result = await sendWelcomeEmail({
      to: targetEmail,
      name: "Pulse Test Kullanıcısı",
    });
  }

  console.log("--------------------------------------------------");
  if (result.success) {
    console.log("✅ E-posta BAŞARIYLA GÖNDERİLDİ!");
    if (result.messageId) {
      console.log(`Message ID: ${result.messageId}`);
    }
    if (result.previewUrl) {
      console.log(`Ethereal Önizleme Linki: ${result.previewUrl}`);
    } else {
      console.log("Gerçek SMTP ile iletildi. Lütfen hedef gelen kutusunu (Spam/Gereksiz dahil) kontrol edin.");
    }
  } else {
    console.error("❌ E-posta gönderimi BAŞARISIZ oldu!");
    console.error(`Hata Detayı: ${result.error}`);
  }
  console.log("==================================================\n");
}

main().catch((err) => {
  console.error("Beklenmeyen hata:", err);
  process.exit(1);
});
