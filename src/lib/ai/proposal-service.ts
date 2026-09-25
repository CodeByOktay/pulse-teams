import { prisma } from "@/lib/prisma";
import { analyzeProgressText } from "@/lib/ai/interpreter";
import { matchSuggestedStateId } from "@/lib/ai-proposal-logic";

/**
 * Bir ilerleme yanıtı için AgentProposal üretir. Önceki PENDING öneriler STALE olur.
 *
 * Bilinçli olarak "use server" dosyasında DEĞİLDİR (istemciden çağrılabilir endpoint olmamalı).
 * Dayanıklılık: tüm gövde try/catch içindedir; hata durumunda null döner, asla fırlatmaz.
 * LLM çağrısı transaction açılmadan ÖNCE yapılır.
 */
export async function createProposalForResponse(responseId: string) {
  try {
    const response = await prisma.progressResponse.findUnique({
      where: { id: responseId },
      select: {
        id: true,
        content: true,
        request: {
          select: {
            taskId: true,
            projectId: true,
            task: {
              select: {
                title: true,
                stateId: true,
                state: { select: { id: true, name: true, group: true } },
                project: {
                  select: {
                    states: {
                      orderBy: { sequence: "asc" },
                      select: { id: true, name: true, group: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!response) {
      console.error("AI önerisi: ilerleme yanıtı bulunamadı.");
      return null;
    }

    const { taskId, projectId, task } = response.request;
    const states = task.project.states;

    const interp = await analyzeProgressText({
      content: response.content,
      currentTaskTitle: task.title,
      currentStateName: task.state.name,
      currentStateGroup: task.state.group,
      availableStates: states,
    });

    const suggestedStateId = matchSuggestedStateId(interp.suggestedGroup, states, task.stateId);

    return await prisma.$transaction(async (tx) => {
      await tx.agentProposal.updateMany({
        where: { taskId, status: "PENDING" },
        data: { status: "STALE" },
      });

      return tx.agentProposal.create({
        data: {
          projectId,
          taskId,
          progressResponseId: response.id,
          summary: interp.summary,
          suggestedStateId,
          suggestedGroup: interp.suggestedGroup,
          blockerDetected: interp.blockerDetected,
          blockerDetails: interp.blockerDetails,
          followUpNeeded: interp.followUpNeeded,
          confidence: interp.confidence,
        },
      });
    });
  } catch (err) {
    console.error("AI önerisi oluşturulamadı:", err);
    return null;
  }
}

/**
 * Yetki kontrolü YAPMAZ; çağıran action requireMembership uygulamış olmalıdır.
 */
export async function loadTaskProposals(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      projectId: true,
      state: { select: { id: true, name: true, color: true, group: true } },
    },
  });

  if (!task) {
    throw new Error("Görev bulunamadı.");
  }

  const [pending, history, states] = await Promise.all([
    prisma.agentProposal.findFirst({
      where: { taskId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: {
        suggestedState: { select: { id: true, name: true, color: true, group: true } },
      },
    }),
    prisma.agentProposal.findMany({
      where: { taskId, status: { not: "PENDING" } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        suggestedState: { select: { id: true, name: true, color: true, group: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.state.findMany({
      where: { projectId: task.projectId },
      orderBy: { sequence: "asc" },
      select: { id: true, name: true, color: true, group: true },
    }),
  ]);

  return { pending, history, states, currentState: task.state };
}
