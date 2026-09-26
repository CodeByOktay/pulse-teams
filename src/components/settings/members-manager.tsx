"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { UserPlus, Trash2, ShieldCheck, ShieldOff, X, Copy, Check, Clock } from "lucide-react";
import { inviteMember, removeMember, changeMemberRole, cancelInvite } from "@/actions/member";
import { getAvatarColor } from "@/lib/colors";

export type MemberItem = {
  id: string;
  role: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
};

export type PendingInviteItem = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
  token: string;
  inviter: { name: string };
};

type InviteFeedback = { kind: "error" | "success"; message: string };

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Yönetici",
  MEMBER: "Üye",
};

const ROLE_BADGE_BASE_CLASS = "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium";
const ROLE_BADGE_ADMIN_CLASS = "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400";
const ROLE_BADGE_MEMBER_CLASS = "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";

const ICON_BUTTON_BASE_CLASS = "rounded p-1 text-zinc-400 transition-colors";
const ICON_BUTTON_TONE_CLASS = {
  default: "hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
  danger: "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400",
};

const FEEDBACK_CLASS: Record<InviteFeedback["kind"], string> = {
  error: "text-sm text-red-600 dark:text-red-400",
  success: "text-sm text-green-600 dark:text-green-400",
};

const COPIED_RESET_MS = 2000;

function Avatar({ name }: { name: string }) {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{ backgroundColor: getAvatarColor(name) }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const toneClass = role === "ADMIN" ? ROLE_BADGE_ADMIN_CLASS : ROLE_BADGE_MEMBER_CLASS;
  return <span className={`${ROLE_BADGE_BASE_CLASS} ${toneClass}`}>{ROLE_LABEL[role] ?? role}</span>;
}

function IconButton({
  title,
  tone = "default",
  onClick,
  children,
}: {
  title: string;
  tone?: keyof typeof ICON_BUTTON_TONE_CLASS;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`${ICON_BUTTON_BASE_CLASS} ${ICON_BUTTON_TONE_CLASS[tone]}`}
    >
      {children}
    </button>
  );
}

function CopyTokenButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
    } catch {
      // Panoya erişim reddedilirse sessizce yok say, arayüzü bozma.
      return;
    }
    setCopied(true);
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    resetTimeoutRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }

  return (
    <IconButton title="Davet bağlantısını kopyala" onClick={handleCopy}>
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </IconButton>
  );
}

export function MembersManager({
  projectId,
  ownerId,
  currentUserId,
  members,
  pendingInvites,
}: {
  projectId: string;
  ownerId: string;
  currentUserId: string;
  members: MemberItem[];
  pendingInvites: PendingInviteItem[];
}) {
  const [, startTransition] = useTransition();

  function runConfirmed(confirmMessage: string, action: () => Promise<void>, fallbackError: string) {
    if (!confirm(confirmMessage)) return;
    startTransition(async () => {
      try {
        await action();
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : fallbackError);
      }
    });
  }

  function handleRemove(member: MemberItem) {
    runConfirmed(
      `${member.user.name} kullanıcısını projeden çıkartmak istediğinize emin misiniz?`,
      () => removeMember(projectId, member.user.id),
      "Üye çıkartılamadı.",
    );
  }

  function handleRoleChange(member: MemberItem) {
    const newRole = member.role === "ADMIN" ? "MEMBER" : "ADMIN";
    const label = newRole === "ADMIN" ? "yönetici" : "üye";
    runConfirmed(
      `Rolü "${label}" olarak değiştirmek istediğinize emin misiniz?`,
      () => changeMemberRole(projectId, member.user.id, newRole),
      "Rol değiştirilemedi.",
    );
  }

  function handleCancelInvite(invite: PendingInviteItem) {
    runConfirmed(
      "Bu daveti iptal etmek istediğinize emin misiniz?",
      () => cancelInvite(projectId, invite.id),
      "Davet iptal edilemedi.",
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <InviteForm projectId={projectId} />

      <ListCard title={`Üyeler (${members.length})`}>
        {members.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            isOwner={member.user.id === ownerId}
            isCurrentUser={member.user.id === currentUserId}
            onRoleChange={handleRoleChange}
            onRemove={handleRemove}
          />
        ))}
      </ListCard>

      {pendingInvites.length > 0 && (
        <ListCard
          title={`Bekleyen Davetler (${pendingInvites.length})`}
          icon={<Clock className="h-4 w-4 text-zinc-400" />}
        >
          {pendingInvites.map((invite) => (
            <PendingInviteRow key={invite.id} invite={invite} onCancel={handleCancelInvite} />
          ))}
        </ListCard>
      )}
    </div>
  );
}

function InviteForm({ projectId }: { projectId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [feedback, setFeedback] = useState<InviteFeedback | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const trimmedEmail = email.trim();

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!trimmedEmail) return;
    setIsInviting(true);
    try {
      await inviteMember(projectId, trimmedEmail, role);
      setFeedback({ kind: "success", message: `${trimmedEmail} adresine davet gönderildi.` });
      setEmail("");
    } catch (err: unknown) {
      setFeedback({
        kind: "error",
        message: err instanceof Error ? err.message : "Davet gönderilemedi.",
      });
    } finally {
      setIsInviting(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-zinc-500" />
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Üye Davet Et
        </h3>
      </div>
      <form onSubmit={handleInvite} className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@email.com"
            required
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-500"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "MEMBER" | "ADMIN")}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="MEMBER">Üye</option>
            <option value="ADMIN">Yönetici</option>
          </select>
          <button
            type="submit"
            disabled={isInviting || !trimmedEmail}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            <UserPlus className="h-3.5 w-3.5" />
            {isInviting ? "Gönderiliyor..." : "Davet Et"}
          </button>
        </div>
        {feedback && <p className={FEEDBACK_CLASS[feedback.kind]}>{feedback.message}</p>}
      </form>
    </div>
  );
}

function ListCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const heading = (
    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
  );

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
        {icon ? (
          <div className="flex items-center gap-2">
            {icon}
            {heading}
          </div>
        ) : (
          heading
        )}
      </div>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">{children}</ul>
    </div>
  );
}

function MemberRow({
  member,
  isOwner,
  isCurrentUser,
  onRoleChange,
  onRemove,
}: {
  member: MemberItem;
  isOwner: boolean;
  isCurrentUser: boolean;
  onRoleChange: (member: MemberItem) => void;
  onRemove: (member: MemberItem) => void;
}) {
  const canManage = !isOwner && !isCurrentUser;
  const isAdmin = member.role === "ADMIN";

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <Avatar name={member.user.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {member.user.name}
            {isCurrentUser && <span className="ml-1 text-xs text-zinc-400">(siz)</span>}
          </p>
          {isOwner && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
              Sahip
            </span>
          )}
        </div>
        <p className="truncate text-xs text-zinc-500">{member.user.email}</p>
      </div>
      <RoleBadge role={member.role} />

      {canManage && (
        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            title={isAdmin ? "Üye yap" : "Yönetici yap"}
            onClick={() => onRoleChange(member)}
          >
            {isAdmin ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          </IconButton>
          <IconButton title="Projeden çıkart" tone="danger" onClick={() => onRemove(member)}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      )}
    </li>
  );
}

function PendingInviteRow({
  invite,
  onCancel,
}: {
  invite: PendingInviteItem;
  onCancel: (invite: PendingInviteItem) => void;
}) {
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-zinc-300 text-zinc-400 dark:border-zinc-700">
        <UserPlus className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {invite.email}
        </p>
        <p className="text-xs text-zinc-500">
          {invite.inviter.name} tarafından davet edildi ·{" "}
          {new Date(invite.expiresAt).toLocaleDateString("tr-TR")} tarihine kadar geçerli
        </p>
      </div>
      <RoleBadge role={invite.role} />
      <div className="flex shrink-0 items-center gap-1">
        <CopyTokenButton token={invite.token} />
        <IconButton title="Daveti iptal et" tone="danger" onClick={() => onCancel(invite)}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </li>
  );
}
