import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { CheckCircle, XCircle, Clock, Mail } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AcceptInviteButton } from "@/components/settings/accept-invite-button";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const session = await getServerSession(authOptions);

  // Daveti bul
  const invite = await prisma.projectInvite.findUnique({
    where: { token },
    include: {
      project: { select: { id: true, name: true, identifier: true } },
      inviter: { select: { name: true } },
    },
  });

  // Davet bulunamadı
  if (!invite) {
    return (
      <InviteLayout>
        <StatusCard
          icon={<XCircle className="h-12 w-12 text-red-500" />}
          title="Davet Bulunamadı"
          description="Bu davet bağlantısı geçersiz veya daha önce silinmiş."
          action={<BackToHome />}
        />
      </InviteLayout>
    );
  }

  // Süresi dolmuş
  const isExpired = invite.status === "EXPIRED" || invite.expiresAt < new Date();
  if (isExpired) {
    return (
      <InviteLayout>
        <StatusCard
          icon={<Clock className="h-12 w-12 text-amber-500" />}
          title="Davet Süresi Doldu"
          description={`${invite.project.name} projesine olan davetinizin süresi dolmuş. Yöneticiden yeni bir davet isteyin.`}
          action={<BackToHome />}
        />
      </InviteLayout>
    );
  }

  // Zaten kabul edilmiş
  if (invite.status === "ACCEPTED") {
    return (
      <InviteLayout>
        <StatusCard
          icon={<CheckCircle className="h-12 w-12 text-green-500" />}
          title="Davet Zaten Kabul Edildi"
          description={`${invite.project.name} projesinin zaten bir üyesisiniz.`}
          action={
            session ? (
              <a
                href={`/projects/${invite.project.id}/board`}
                className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Projeye Git →
              </a>
            ) : (
              <BackToHome />
            )
          }
        />
      </InviteLayout>
    );
  }

  // Kullanıcı giriş yapmamış
  if (!session?.user?.id) {
    return (
      <InviteLayout>
        <StatusCard
          icon={<Mail className="h-12 w-12 text-violet-500" />}
          title={`${invite.project.name} Projesine Davetlisiniz`}
          description={`${invite.inviter.name} sizi ${invite.project.name} projesine davet etti. Daveti kabul etmek için ${invite.email} e-posta adresiyle giriş yapın.`}
          action={
            <a
              href={`/login?callbackUrl=/invite/${token}`}
              className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Giriş Yap & Kabul Et
            </a>
          }
        />
      </InviteLayout>
    );
  }

  // E-posta eşleşmiyor
  const sessionUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });
  const emailMismatch =
    sessionUser?.email.toLowerCase() !== invite.email.toLowerCase();

  if (emailMismatch) {
    return (
      <InviteLayout>
        <StatusCard
          icon={<XCircle className="h-12 w-12 text-red-500" />}
          title="E-posta Adresi Uyuşmuyor"
          description={`Bu davet ${invite.email} adresine gönderilmiştir. Şu an ${sessionUser?.email} adresiyle giriş yapmış durumdasınız. Lütfen doğru hesapla giriş yapın.`}
          action={
            <a
              href={`/login?callbackUrl=/invite/${token}`}
              className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
            >
              Farklı Hesapla Giriş Yap
            </a>
          }
        />
      </InviteLayout>
    );
  }

  // Her şey tamam — kabul sayfası
  return (
    <InviteLayout>
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950">
            <Mail className="h-8 w-8 text-violet-600 dark:text-violet-400" />
          </div>
        </div>
        <h1 className="mb-2 text-center text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Projeye Davetlisiniz
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {invite.inviter.name}
          </span>{" "}
          sizi{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {invite.project.name}
          </span>{" "}
          projesine{" "}
          <span className="font-medium text-violet-600 dark:text-violet-400">
            {invite.role === "ADMIN" ? "yönetici" : "üye"}
          </span>{" "}
          olarak davet etti.
        </p>

        <div className="mb-6 rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Proje</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {invite.project.name}
            </span>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-zinc-500">Rol</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {invite.role === "ADMIN" ? "Yönetici" : "Üye"}
            </span>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-zinc-500">Geçerlilik</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {new Date(invite.expiresAt).toLocaleDateString("tr-TR")}
            </span>
          </div>
        </div>

        <AcceptInviteButton token={token} projectId={invite.project.id} />

        <p className="mt-3 text-center text-xs text-zinc-400">
          {invite.email} olarak giriş yaptınız
        </p>
      </div>
    </InviteLayout>
  );
}

function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      {children}
    </div>
  );
}

function StatusCard({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex justify-center">{icon}</div>
      <h1 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
      {action}
    </div>
  );
}

function BackToHome() {
  return (
    <a
      href="/"
      className="rounded-lg border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      Ana Sayfaya Dön
    </a>
  );
}
