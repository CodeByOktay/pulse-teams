import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  validateEmailConfig,
  renderWelcomeEmail,
  renderInviteMemberEmail,
} from "../email-templates";


describe("escapeHtml", () => {
  it("escapes all special HTML characters properly", () => {
    const input = `<script>alert("hello" & 'world')</script>`;
    const output = escapeHtml(input);

    expect(output).toBe(
      "&lt;script&gt;alert(&quot;hello&quot; &amp; &#039;world&#039;)&lt;/script&gt;",
    );
    expect(output).not.toContain("<script>");
  });

  it("preserves alphanumeric characters and Turkish characters", () => {
    const input = "Ahmet Can Çetin — Şanlıurfa / İzmir (Örnek Öğrenci)";
    expect(escapeHtml(input)).toBe(input);
  });

  it("handles strings with no special characters safely", () => {
    expect(escapeHtml("John Doe")).toBe("John Doe");
    expect(escapeHtml("")).toBe("");
  });
});

describe("validateEmailConfig", () => {
  it("detects valid SMTP configuration when host, user, and pass are present", () => {
    const config = validateEmailConfig({
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_USER: "user@example.com",
      SMTP_PASS: "secret123",
      SMTP_SECURE: "false",
    });

    expect(config.isValid).toBe(true);
    expect(config.transportMode).toBe("smtp");
    expect(config.host).toBe("smtp.example.com");
    expect(config.port).toBe(587);
    expect(config.secure).toBe(false);
    expect(config.user).toBe("user@example.com");
  });

  it("handles port 465 and sets secure to true automatically", () => {
    const config = validateEmailConfig({
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: "465",
      SMTP_USER: "pulse@gmail.com",
      SMTP_PASS: "app-pass",
    });

    expect(config.transportMode).toBe("smtp");
    expect(config.port).toBe(465);
    expect(config.secure).toBe(true);
  });

  it("falls back to port 587 when port is invalid or not a number", () => {
    const config = validateEmailConfig({
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "not-a-number",
      SMTP_USER: "user@example.com",
      SMTP_PASS: "secret",
    });

    expect(config.port).toBe(587);
  });

  it("returns console mode when explicitly requested via EMAIL_TRANSPORT", () => {
    const config = validateEmailConfig({
      EMAIL_TRANSPORT: "console",
      SMTP_HOST: "smtp.example.com",
      SMTP_USER: "user@example.com",
      SMTP_PASS: "pass",
    });

    expect(config.transportMode).toBe("console");
    expect(config.isValid).toBe(true);
  });

  it("returns console mode when NODE_ENV is test and no SMTP credentials are provided", () => {
    const config = validateEmailConfig({
      NODE_ENV: "test",
    });

    expect(config.transportMode).toBe("console");
  });

  it("returns ethereal mode in development when no SMTP credentials exist", () => {
    const config = validateEmailConfig({
      NODE_ENV: "development",
    });

    expect(config.transportMode).toBe("ethereal");
  });
});

describe("renderWelcomeEmail", () => {
  it("renders email with custom user name", () => {
    const result = renderWelcomeEmail({
      name: "Oktay Mutaf",
      email: "oktay@example.com",
      appUrl: "http://localhost:3000",
    });

    expect(result.subject).toBe("Pulse'a Hoş Geldiniz! 🚀");
    expect(result.html).toContain("Pulse'a Hoş Geldin, Oktay Mutaf! 👋");
    expect(result.html).toContain("oktay@example.com");
    expect(result.html).toContain("http://localhost:3000/login");
    expect(result.text).toContain("Merhaba Oktay Mutaf,");
    expect(result.text).toContain("http://localhost:3000/login");
  });

  it("falls back to 'Pulse Kullanıcısı' when name is empty, null, or whitespace", () => {
    const nullNameResult = renderWelcomeEmail({
      name: null,
      email: "user@example.com",
    });
    expect(nullNameResult.html).toContain("Pulse'a Hoş Geldin, Pulse Kullanıcısı! 👋");
    expect(nullNameResult.text).toContain("Merhaba Pulse Kullanıcısı,");

    const emptyNameResult = renderWelcomeEmail({
      name: "   ",
      email: "user@example.com",
    });
    expect(emptyNameResult.html).toContain("Pulse'a Hoş Geldin, Pulse Kullanıcısı! 👋");
  });

  it("escapes malicious scripts in user name to prevent XSS", () => {
    const maliciousName = "<img src=x onerror=alert(1)>";
    const result = renderWelcomeEmail({
      name: maliciousName,
      email: "victim@example.com",
    });

    expect(result.html).not.toContain("<img src=x");
    expect(result.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("normalizes appUrl by removing trailing slashes", () => {
    const result = renderWelcomeEmail({
      name: "Ayşe",
      email: "ayse@example.com",
      appUrl: "https://pulse.mycompany.com///",
    });

    expect(result.html).toContain("href=\"https://pulse.mycompany.com/login\"");
    expect(result.text).toContain("https://pulse.mycompany.com/login");
  });

  it("contains complete HTML document tags and mobile responsive attributes", () => {
    const result = renderWelcomeEmail({
      name: "Deniz",
      email: "deniz@example.com",
    });

    expect(result.html).toMatch(/^<!DOCTYPE html>/);
    expect(result.html).toContain("<html lang=\"tr\">");
    expect(result.html).toContain("</html>");
    expect(result.html).toContain("<meta name=\"viewport\"");
    expect(result.html).toContain("⚡ Pulse");
  });

  it("contains core feature onboarding points in both HTML and text", () => {
    const result = renderWelcomeEmail({
      name: "Kemal",
      email: "kemal@example.com",
    });

    // Check HTML
    expect(result.html).toContain("Akıllı Kanban");
    expect(result.html).toContain("Sprint &amp; Hız Metrikleri");
    expect(result.html).toContain("Gerçek Zamanlı Bildirimler");
    expect(result.html).toContain("Ctrl+K");

    // Check Text
    expect(result.text).toContain("Kanban Panoları");
    expect(result.text).toContain("Sprint & Döngü Yönetimi");
    expect(result.text).toContain("Uygulama İçi Bildirimler");
    expect(result.text).toContain("Ctrl + K");
  });
});

describe("renderInviteMemberEmail", () => {
  it("renders member invitation email with project, inviter, and role details", () => {
    const result = renderInviteMemberEmail({
      recipientEmail: "colleague@example.com",
      projectName: "Acme Platform",
      inviterName: "Alice Smith",
      inviteUrl: "https://pulse.app/invite/abc123token",
      role: "ADMIN",
    });

    expect(result.subject).toBe(`Pulse: "Acme Platform" projesine davet edildiniz! 📨`);
    expect(result.html).toContain(`"Acme Platform" Projesine Davet Edildiniz! 🎉`);
    expect(result.html).toContain("Alice Smith");
    expect(result.html).toContain("Yönetici (Admin)");
    expect(result.html).toContain("https://pulse.app/invite/abc123token");
    expect(result.html).toContain("7 gün");
    expect(result.html).toContain("colleague@example.com");

    expect(result.text).toContain("Alice Smith sizi Pulse üzerindeki \"Acme Platform\" projesine davet etti!");
    expect(result.text).toContain("Proje Rolü: Yönetici (Admin)");
    expect(result.text).toContain("https://pulse.app/invite/abc123token");
  });

  it("handles fallback defaults when project name or inviter name is omitted", () => {
    const result = renderInviteMemberEmail({
      recipientEmail: "friend@example.com",
      projectName: "",
      inviterName: null,
      inviteUrl: "http://localhost:3000/invite/xyz456",
      role: "MEMBER",
    });

    expect(result.subject).toBe(`Pulse: "Pulse Projesi" projesine davet edildiniz! 📨`);
    expect(result.html).toContain(`"Pulse Projesi" Projesine Davet Edildiniz! 🎉`);
    expect(result.html).toContain("Bir takım arkadaşınız");
    expect(result.html).toContain("Üye (Member)");
    expect(result.text).toContain("Proje Rolü: Üye (Member)");
  });

  it("escapes malicious HTML characters in project and inviter names", () => {
    const result = renderInviteMemberEmail({
      recipientEmail: "victim@example.com",
      projectName: "<script>hack()</script>",
      inviterName: "<b>Injected</b>",
      inviteUrl: "http://localhost:3000/invite/clean-token",
    });

    expect(result.html).not.toContain("<script>hack()</script>");
    expect(result.html).toContain("&lt;script&gt;hack()&lt;/script&gt;");
    expect(result.html).not.toContain("<b>Injected</b>");
    expect(result.html).toContain("&lt;b&gt;Injected&lt;/b&gt;");
  });
});

describe("universal sendEmail delivery", () => {
  it("rejects invalid or missing recipient email address", async () => {
    const { sendEmail } = await import("../mail");

    const resultEmpty = await sendEmail({
      to: "",
      subject: "Test",
      html: "<p>Test</p>",
    });
    expect(resultEmpty.success).toBe(false);
    expect(resultEmpty.error).toBe("Geçersiz e-posta adresi.");

    const resultNoAt = await sendEmail({
      to: "invalid-recipient",
      subject: "Test",
      html: "<p>Test</p>",
    });
    expect(resultNoAt.success).toBe(false);
  });

  it("dispatches generic email via console transport successfully", async () => {
    const { sendEmail, resetTransporter } = await import("../mail");
    resetTransporter();

    process.env.EMAIL_TRANSPORT = "console";

    const result = await sendEmail({
      to: "recipient@example.com",
      subject: "Özel Bildirim",
      html: "<p>İçerik</p>",
      text: "İçerik",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();

    delete process.env.EMAIL_TRANSPORT;
    resetTransporter();
  });
});

describe("sendWelcomeEmail delivery", () => {
  it("fails early with invalid email address format without crashing", async () => {
    const { sendWelcomeEmail } = await import("../mail");

    const resultEmpty = await sendWelcomeEmail({ to: "" });
    expect(resultEmpty.success).toBe(false);
    expect(resultEmpty.error).toBe("Geçersiz e-posta adresi.");

    const resultNoAt = await sendWelcomeEmail({ to: "not-an-email" });
    expect(resultNoAt.success).toBe(false);
    expect(resultNoAt.error).toBe("Geçersiz e-posta adresi.");
  });

  it("dispatches welcome email safely in test environment via json/console transport", async () => {
    const { sendWelcomeEmail, resetTransporter } = await import("../mail");
    resetTransporter();

    process.env.EMAIL_TRANSPORT = "console";

    const result = await sendWelcomeEmail({
      to: "newuser@example.com",
      name: "Test Kullanıcısı",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();

    delete process.env.EMAIL_TRANSPORT;
    resetTransporter();
  });
});

describe("sendInviteMemberEmail delivery", () => {
  it("delivers member invite email cleanly in test environment", async () => {
    const { sendInviteMemberEmail, resetTransporter } = await import("../mail");
    resetTransporter();

    process.env.EMAIL_TRANSPORT = "console";

    const result = await sendInviteMemberEmail({
      to: "invited-colleague@example.com",
      projectName: "Frontend Revamp",
      inviterName: "Lead Dev",
      token: "secret-invite-token-789",
      role: "MEMBER",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();

    delete process.env.EMAIL_TRANSPORT;
    resetTransporter();
  });
});


