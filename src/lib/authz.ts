/**
 * Centralized authorization guards for server actions.
 *
 * Server-only module (NOT a "use server" file): it must only be imported from
 * server actions / server components. Every helper throws a descriptive Error
 * when the check fails.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const DEFAULT_UNAUTHENTICATED_MESSAGE = "Bu işlem için giriş yapmalısınız.";
export const NOT_A_MEMBER_MESSAGE = "Bu projeye erişim yetkiniz yok.";
export const ADMIN_REQUIRED_MESSAGE = "Bu işlem için yönetici yetkisi gerekiyor.";

/**
 * Resolves the current NextAuth session and guarantees `session.user.id`.
 */
export async function requireSession(message: string = DEFAULT_UNAUTHENTICATED_MESSAGE) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error(message);
  }
  return session;
}

/**
 * Returns the authenticated user's id.
 */
export async function requireUserId(message?: string): Promise<string> {
  const session = await requireSession(message);
  return session.user.id;
}

/**
 * Ensures `userId` is a member of `projectId` and returns the membership row.
 */
export async function requireMembership(projectId: string, userId: string) {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member) {
    throw new Error(NOT_A_MEMBER_MESSAGE);
  }
  return member;
}

/**
 * Ensures `userId` is an ADMIN member of `projectId`.
 */
export async function requireAdmin(projectId: string, userId: string) {
  const member = await requireMembership(projectId, userId);
  if (member.role !== "ADMIN") {
    throw new Error(ADMIN_REQUIRED_MESSAGE);
  }
  return member;
}

/**
 * Resolves the session and asserts the current user is an ADMIN of the project.
 * Returns the session for callers that need the user id.
 */
export async function requireAdminSession(projectId: string) {
  const session = await requireSession();
  await requireAdmin(projectId, session.user.id);
  return session;
}

/**
 * Prevents removing / demoting the project owner.
 */
export async function assertNotProjectOwner(
  projectId: string,
  targetUserId: string,
  message: string,
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });
  if (project?.ownerId === targetUserId) {
    throw new Error(message);
  }
}
