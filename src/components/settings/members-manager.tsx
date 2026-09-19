"use client";

import { useState, useTransition } from "react";
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

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Yönetici",
  MEMBER: "Üye",
};

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const color = getAvatarColor(name);
  const sizeClass = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full font-semibold text-white`}
      style={{ backgroundColor: color }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function CopyTokenButton({ token, projectId }: { token: string; projectId: string }) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = `${window.location.origin}/invite/${token}`;

  function handleCopy() {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Davet bağlantısını kopyala"
      className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
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
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    setInviteSuccess("");
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      await inviteMember(projectId, inviteEmail.trim(), inviteRole);
      setInviteSuccess(`${inviteEmail} adresine davet gönderildi.`);
      setInviteEmail("");
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : "Davet gönderilemedi.");
    } finally {
      setIsInviting(false);
    }
  }

  function handleRemove(userId: string, userName: string) {
    if (!confirm(`${userName} kullanıcısını projeden çıkartmak istediğinize emin misiniz?`)) return;
    startTransition(async () => {
      try {
        await removeMember(projectId, userId);
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Üye çıkartılamadı.");
      }
    });
  }

  function handleRoleChange(userId: string, currentRole: string) {
    const newRole = currentRole === "ADMIN" ? "MEMBER" : "ADMIN";
    const label = newRole === "ADMIN" ? "yönetici" : "üye";
    if (!confirm(`Rolü "${label}" olarak değiştirmek istediğinize emin misiniz?`)) return;
    startTransition(async () => {
      try {
        await changeMemberRole(projectId, userId, newRole);
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Rol değiştirilemedi.");
      }
    });
  }

  function handleCancelInvite(inviteId: string) {
    if (!confirm("Bu daveti iptal etmek istediğinize emin misiniz?")) return;
    startTransition(async () => {
      try {
        await cancelInvite(projectId, inviteId);
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Davet iptal edilemedi.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Davet Formu */}
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
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="ornek@email.com"
              required
              className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-500"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "MEMBER" | "ADMIN")}
              className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="MEMBER">Üye</option>
              <option value="ADMIN">Yönetici</option>
            </select>
            <button
              type="submit"
              disabled={isInviting || !inviteEmail.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              <UserPlus className="h-3.5 w-3.5" />
              {isInviting ? "Gönderiliyor..." : "Davet Et"}
            </button>
          </div>
          {inviteError && (
            <p className="text-sm text-red-600 dark:text-red-400">{inviteError}</p>
          )}
          {inviteSuccess && (
            <p className="text-sm text-green-600 dark:text-green-400">{inviteSuccess}</p>
          )}
        </form>
      </div>

      {/* Mevcut Üyeler */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Üyeler ({members.length})
          </h3>
        </div>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {members.map((member) => {
            const isOwner = member.user.id === ownerId;
            const isCurrentUser = member.user.id === currentUserId;
            return (
              <li
                key={member.id}
                className="flex items-center gap-3 px-5 py-3"
              >
                <Avatar name={member.user.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {member.user.name}
                      {isCurrentUser && (
                        <span className="ml-1 text-xs text-zinc-400">(siz)</span>
                      )}
                    </p>
                    {isOwner && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                        Sahip
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-zinc-500">{member.user.email}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                  member.role === "ADMIN"
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}>
                  {ROLE_LABEL[member.role] ?? member.role}
                </span>

                {!isOwner && !isCurrentUser && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleRoleChange(member.user.id, member.role)}
                      title={member.role === "ADMIN" ? "Üye yap" : "Yönetici yap"}
                      className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    >
                      {member.role === "ADMIN" ? (
                        <ShieldOff className="h-3.5 w-3.5" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(member.user.id, member.user.name)}
                      title="Projeden çıkart"
                      className="rounded p-1 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Bekleyen Davetler */}
      {pendingInvites.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-zinc-400" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Bekleyen Davetler ({pendingInvites.length})
              </h3>
            </div>
          </div>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="flex items-center gap-3 px-5 py-3">
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
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                  invite.role === "ADMIN"
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}>
                  {ROLE_LABEL[invite.role] ?? invite.role}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <CopyTokenButton token={invite.token} projectId={projectId} />
                  <button
                    type="button"
                    onClick={() => handleCancelInvite(invite.id)}
                    title="Daveti iptal et"
                    className="rounded p-1 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
