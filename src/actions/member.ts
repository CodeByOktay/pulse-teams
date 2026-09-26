"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  assertNotProjectOwner,
  requireAdminSession,
  requireMembership,
  requireSession,
} from "@/lib/authz";
import { sendInviteMemberEmail } from "@/lib/mail";

// ────────────────────────────────────────────────────────────
// inviteMember
// ────────────────────────────────────────────────────────────

export async function inviteMember(
  projectId: string,
  email: string,
  role: "MEMBER" | "ADMIN" = "MEMBER"
) {
  const session = await requireAdminSession(projectId);

  const normalizedEmail = email.trim().toLowerCase();

  // Hedef kullanıcı zaten üye mi? Süresi dolmamış bekleyen davet var mı?
  // (Süresi dolmuş PENDING davet yeniden davet etmeyi engellemez.)
  const [existingMember, existingInvite] = await Promise.all([
    prisma.projectMember.findFirst({
      where: { projectId, user: { email: normalizedEmail } },
      select: { id: true },
    }),
    prisma.projectInvite.findFirst({
      where: {
        projectId,
        email: normalizedEmail,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    }),
  ]);
  if (existingMember) throw new Error("Bu kullanıcı zaten projenin üyesi.");
  if (existingInvite) throw new Error("Bu e-posta adresine zaten bekleyen bir davet gönderilmiş.");

  // Token üret, 7 gün geçerli
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invite = await prisma.projectInvite.create({
    data: {
      token,
      email: normalizedEmail,
      role,
      projectId,
      inviterId: session.user.id,
      expiresAt,
    },
    include: {
      project: { select: { name: true, identifier: true } },
    },
  });

  // Dispatch member invitation email asynchronously
  sendInviteMemberEmail({
    to: normalizedEmail,
    projectName: invite.project.name,
    inviterName: session.user.name || session.user.email || "Bir Pulse kullanıcısı",
    token: invite.token,
    role: invite.role,
  }).catch((err) => {
    console.error("[inviteMember] Failed to dispatch invitation email:", err);
  });

  revalidatePath(`/projects/${projectId}/settings`);
  return invite;
}

// ────────────────────────────────────────────────────────────
// acceptInvite
// ────────────────────────────────────────────────────────────

export async function acceptInvite(token: string) {
  const session = await requireSession("Daveti kabul etmek için oturum açmanız gerekiyor.");
  const userId = session.user.id;

  const invite = await prisma.projectInvite.findUnique({
    where: { token },
    include: { project: { select: { name: true } } },
  });

  if (!invite) throw new Error("Davet bulunamadı.");
  if (invite.status === "ACCEPTED") throw new Error("Bu davet daha önce kabul edilmiş.");
  if (invite.status === "EXPIRED" || invite.expiresAt < new Date()) {
    if (invite.status !== "EXPIRED") {
      await prisma.projectInvite.update({ where: { token }, data: { status: "EXPIRED" } });
    }
    throw new Error("Bu davet süresi dolmuş.");
  }

  // E-posta eşleşiyor mu?
  const sessionUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!sessionUser) throw new Error("Kullanıcı bulunamadı.");

  if (sessionUser.email.toLowerCase() !== invite.email.toLowerCase()) {
    throw new Error(
      `Bu davet ${invite.email} adresine gönderilmiştir. Lütfen doğru hesapla giriş yapın.`
    );
  }

  // Zaten üye mi?
  const existingMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: invite.projectId, userId } },
    select: { id: true },
  });
  if (existingMember) {
    await prisma.projectInvite.update({ where: { token }, data: { status: "ACCEPTED" } });
    return { projectId: invite.projectId, projectName: invite.project.name };
  }

  await prisma.$transaction([
    prisma.projectMember.create({
      data: {
        projectId: invite.projectId,
        userId,
        role: invite.role,
      },
    }),
    prisma.projectInvite.update({
      where: { token },
      data: { status: "ACCEPTED" },
    }),
  ]);

  revalidatePath(`/projects/${invite.projectId}`);
  return { projectId: invite.projectId, projectName: invite.project.name };
}

// ────────────────────────────────────────────────────────────
// removeMember
// ────────────────────────────────────────────────────────────

export async function removeMember(projectId: string, targetUserId: string) {
  await requireAdminSession(projectId);

  // Proje sahibini çıkartamazsın
  await assertNotProjectOwner(projectId, targetUserId, "Proje sahibi projeden çıkartılamaz.");

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: targetUserId } },
    select: { id: true },
  });
  if (!member) throw new Error("Üye bulunamadı.");

  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId, userId: targetUserId } },
  });

  revalidatePath(`/projects/${projectId}/settings`);
}

// ────────────────────────────────────────────────────────────
// changeMemberRole
// ────────────────────────────────────────────────────────────

export async function changeMemberRole(
  projectId: string,
  targetUserId: string,
  newRole: "MEMBER" | "ADMIN"
) {
  await requireAdminSession(projectId);

  await assertNotProjectOwner(projectId, targetUserId, "Proje sahibinin rolü değiştirilemez.");

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: targetUserId } },
    select: { id: true },
  });
  if (!member) throw new Error("Üye bulunamadı.");

  await prisma.projectMember.update({
    where: { projectId_userId: { projectId, userId: targetUserId } },
    data: { role: newRole },
  });

  revalidatePath(`/projects/${projectId}/settings`);
}

// ────────────────────────────────────────────────────────────
// cancelInvite
// ────────────────────────────────────────────────────────────

export async function cancelInvite(projectId: string, inviteId: string) {
  await requireAdminSession(projectId);

  await prisma.projectInvite.delete({ where: { id: inviteId, projectId } });
  revalidatePath(`/projects/${projectId}/settings`);
}

// ────────────────────────────────────────────────────────────
// getProjectMembers (okuma helper — UI'dan çağrılır)
// ────────────────────────────────────────────────────────────

export async function getProjectMembers(projectId: string) {
  const session = await requireSession("Oturum açmanız gerekiyor.");

  await requireMembership(projectId, session.user.id);

  const [members, pendingInvites] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.projectInvite.findMany({
      where: { projectId, status: "PENDING", expiresAt: { gt: new Date() } },
      include: { inviter: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { members, pendingInvites };
}
