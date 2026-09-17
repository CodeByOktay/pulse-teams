import { PrismaClient, Prisma, StateGroup } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedDefaultStates(
  projectId: string,
  client: Prisma.TransactionClient | PrismaClient,
) {
  const defaultStates = [
    { name: "Backlog", color: "#60646C", group: StateGroup.BACKLOG, sequence: 15000, isDefault: true },
    { name: "Todo", color: "#3A3F47", group: StateGroup.TODO, sequence: 25000 },
    { name: "In Progress", color: "#F59E0B", group: StateGroup.IN_PROGRESS, sequence: 35000 },
    { name: "Done", color: "#46A759", group: StateGroup.DONE, sequence: 45000 },
    { name: "Cancelled", color: "#9AA4BC", group: StateGroup.CANCELLED, sequence: 55000 },
  ];

  return client.state.createMany({
    data: defaultStates.map((state) => ({ ...state, projectId })),
  });
}

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: "admin@staj-pm.local" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@staj-pm.local",
      hashedPassword: "",
    },
  });

  const project = await prisma.project.upsert({
    where: { identifier: "PRJ" },
    update: {},
    create: {
      name: "Demo Project",
      identifier: "PRJ",
      ownerId: owner.id,
    },
  });

  const existingStates = await prisma.state.count({ where: { projectId: project.id } });
  if (existingStates === 0) {
    await seedDefaultStates(project.id, prisma);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
