"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendInviteMemberEmail } from "@/lib/mail";

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

async function requireMembership(projectId: string, userId: string) {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member) throw new Error("Bu projeye erişim yetkiniz yok.");
  return member;
}

async function requireAdmin(projectId: string, userId: string) {
  const member = await requireMembership(projectId, userId);
  if (member.role !== "ADMIN") throw new Error("Bu işlem için yönetici yetkisi gerekiyor.");
  return member;
}

// ────────────────────────────────────────────────────────────
// inviteMember
// ────────────────────────────────────────────────────────────

export async function inviteMember(
  projectId: string,
  email: string,
  role: "MEMBER" | "ADMIN" = "MEMBER"
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Oturum açmanız gerekiyor.");

  await requireAdmin(projectId, session.user.id);

  const normalizedEmail = email.trim().toLowerCase();

  // Hedef kullanıcı zaten üye mi?
  const targetUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (targetUser) {
    const existingMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: targetUser.id } },
    });
    if (existingMember) throw new Error("Bu kullanıcı zaten projenin üyesi.");
  }

  // Bekleyen davet var mı?
  const existingInvite = await prisma.projectInvite.findFirst({
    where: { projectId, email: normalizedEmail, status: "PENDING" },
  });
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Daveti kabul etmek için oturum açmanız gerekiyor.");

  const invite = await prisma.projectInvite.findUnique({
    where: { token },
    include: { project: { select: { id: true, name: true } } },
  });

  if (!invite) throw new Error("Davet bulunamadı.");
  if (invite.status === "ACCEPTED") throw new Error("Bu davet daha önce kabul edilmiş.");
  if (invite.status === "EXPIRED" || invite.expiresAt < new Date()) {
    await prisma.projectInvite.update({ where: { token }, data: { status: "EXPIRED" } });
    throw new Error("Bu davet süresi dolmuş.");
  }

  // E-posta eşleşiyor mu?
  const sessionUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!sessionUser) throw new Error("Kullanıcı bulunamadı.");

  if (sessionUser.email.toLowerCase() !== invite.email.toLowerCase()) {
    throw new Error(
      `Bu davet ${invite.email} adresine gönderilmiştir. Lütfen doğru hesapla giriş yapın.`
    );
  }

  // Zaten üye mi?
  const existingMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: invite.projectId, userId: session.user.id } },
  });
  if (existingMember) {
    await prisma.projectInvite.update({ where: { token }, data: { status: "ACCEPTED" } });
    return { projectId: invite.projectId, projectName: invite.project.name };
  }

  await prisma.$transaction([
    prisma.projectMember.create({
      data: {
        projectId: invite.projectId,
        userId: session.user.id,
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Oturum açmanız gerekiyor.");

  await requireAdmin(projectId, session.user.id);

  // Proje sahibini çıkartamazsın
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });
  if (project?.ownerId === targetUserId) {
    throw new Error("Proje sahibi projeden çıkartılamaz.");
  }

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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Oturum açmanız gerekiyor.");

  await requireAdmin(projectId, session.user.id);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });
  if (project?.ownerId === targetUserId) {
    throw new Error("Proje sahibinin rolü değiştirilemez.");
  }

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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Oturum açmanız gerekiyor.");

  await requireAdmin(projectId, session.user.id);

  await prisma.projectInvite.delete({ where: { id: inviteId } });
  revalidatePath(`/projects/${projectId}/settings`);
}

// ────────────────────────────────────────────────────────────
// getProjectMembers (okuma helper — UI'dan çağrılır)
// ────────────────────────────────────────────────────────────

export async function getProjectMembers(projectId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Oturum açmanız gerekiyor.");

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
