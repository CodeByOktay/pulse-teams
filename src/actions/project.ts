"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { seedDefaultStates } from "../../prisma/seed";

const IDENTIFIER_REGEX = /^[A-Z]{3,5}$/;

export async function createProject(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const identifier = String(formData.get("identifier") ?? "")
    .trim()
    .toUpperCase();

  if (!name) {
    throw new Error("Proje adı zorunludur.");
  }

  if (!IDENTIFIER_REGEX.test(identifier)) {
    throw new Error("Tanımlayıcı 3-5 harften oluşmalıdır.");
  }

  const existing = await prisma.project.findUnique({ where: { identifier } });
  if (existing) {
    throw new Error("Bu tanımlayıcı zaten kullanılıyor.");
  }

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        name,
        identifier,
        ownerId: session.user.id,
      },
    });

    await seedDefaultStates(created.id, tx);

    await tx.projectMember.create({
      data: {
        projectId: created.id,
        userId: session.user.id,
        role: "ADMIN",
      },
    });

    return created;
  });

  revalidatePath("/");
  redirect(`/projects/${project.id}/board`);
}

export async function updateProject(
  projectId: string,
  data: { name?: string; description?: string },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: session.user.id } },
  });

  if (!membership) {
    throw new Error("Bu projeyi güncelleme yetkiniz yok.");
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
    },
  });

  revalidatePath("/");
  revalidatePath(`/projects/${projectId}/board`);

  return project;
}

export async function deleteProject(projectId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: session.user.id } },
  });

  if (!membership || membership.role !== "ADMIN") {
    throw new Error("Bu projeyi silme yetkiniz yok.");
  }

  await prisma.project.delete({ where: { id: projectId } });

  revalidatePath("/");
  redirect("/");
}
