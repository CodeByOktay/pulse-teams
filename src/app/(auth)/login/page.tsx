import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Giriş Yap · Pulse",
};

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Giriş Yap</h1>
      <LoginForm />
    </div>
  );
}
