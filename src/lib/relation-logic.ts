import type { RelationType } from "@prisma/client";

/**
 * Bir ilişki veritabanında her zaman TEK yönlü ve TEK kayıt olarak saklanır.
 * "Tarafından engelleniyor" ayrı bir tip değil, BLOCKS kaydının hedef tarafındaki görünümüdür.
 */
export type RelationDirection = "source" | "target";

const RELATION_LABELS: Record<RelationType, Record<RelationDirection, string>> = {
  BLOCKS: { source: "Engelliyor", target: "Tarafından engelleniyor" },
  RELATES_TO: { source: "İlişkili", target: "İlişkili" },
  DUPLICATES: { source: "Şunun kopyası", target: "Kopyaları" },
};

export function getRelationLabel(type: RelationType, direction: RelationDirection): string {
  return RELATION_LABELS[type][direction];
}

export function isSelfRelation(sourceTaskId: string, targetTaskId: string): boolean {
  return sourceTaskId === targetTaskId;
}

export type RelationEdge = { sourceTaskId: string; targetTaskId: string };

export type TypedRelationEdge = RelationEdge & { type: RelationType };

/**
 * Tek çift kuralı: aynı iki görev arasında yönden ve tipten bağımsız olarak
 * yalnızca bir ilişki bulunabilir.
 */
export function hasExistingRelation(
  existingRelations: RelationEdge[],
  taskId1: string,
  taskId2: string,
): boolean {
  return existingRelations.some(
    (relation) =>
      (relation.sourceTaskId === taskId1 && relation.targetTaskId === taskId2) ||
      (relation.sourceTaskId === taskId2 && relation.targetTaskId === taskId1),
  );
}

/** Döngü kontrolü yalnızca BLOCKS için geçerlidir; diğer tipler döngü oluşturabilir. */
export function requiresCycleCheck(type: RelationType): boolean {
  return type === "BLOCKS";
}

export function collectBlockEdges(relations: TypedRelationEdge[]): RelationEdge[] {
  return relations
    .filter((relation) => requiresCycleCheck(relation.type))
    .map(({ sourceTaskId, targetTaskId }) => ({ sourceTaskId, targetTaskId }));
}

/**
 * X BLOCKS Y kenarı eklenirken, Y'den başlayıp BLOCKS kenarlarını takip ederek X'e
 * ulaşılabiliyorsa döngü oluşur. Rekürsiyon yerine stack + visited ile iteratif DFS
 * kullanılır: derin zincirlerde stack overflow olmaz, mevcut veride döngü olsa bile
 * visited seti sonsuz döngüyü engeller.
 */
export function wouldCreateBlockCycle(
  edges: RelationEdge[],
  newSourceId: string,
  newTargetId: string,
): boolean {
  if (isSelfRelation(newSourceId, newTargetId)) return true;

  const adjacency = buildAdjacencyList(edges);
  const visited = new Set<string>([newTargetId]);
  const stack: string[] = [newTargetId];

  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === newSourceId) return true;

    for (const nextId of adjacency.get(current) ?? []) {
      if (visited.has(nextId)) continue;
      visited.add(nextId);
      stack.push(nextId);
    }
  }

  return false;
}

function buildAdjacencyList(edges: RelationEdge[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const { sourceTaskId, targetTaskId } of edges) {
    const targets = adjacency.get(sourceTaskId);
    if (targets) {
      targets.push(targetTaskId);
    } else {
      adjacency.set(sourceTaskId, [targetTaskId]);
    }
  }
  return adjacency;
}

export type RelatedTaskSummary = {
  id: string;
  sequenceId: number;
  title: string;
  stateName: string;
  stateColor: string;
  projectIdentifier: string;
};

export type GroupedRelationItem = {
  id: string;
  type: RelationType;
  direction: RelationDirection;
  task: RelatedTaskSummary;
};

export type GroupedRelations = {
  blocks: GroupedRelationItem[];
  blockedBy: GroupedRelationItem[];
  relatesTo: GroupedRelationItem[];
  duplicates: GroupedRelationItem[];
};

export type SourceRelationRecord = {
  id: string;
  type: RelationType;
  sourceTaskId: string;
  targetTask: RelatedTaskSummary;
};

export type TargetRelationRecord = {
  id: string;
  type: RelationType;
  targetTaskId: string;
  sourceTask: RelatedTaskSummary;
};

/** BLOCKS kaydı perspektife göre blocks ya da blockedBy'a düşer; diğer tipler iki yönde de aynı gruptadır. */
function resolveGroupKey(
  type: RelationType,
  blocksKey: "blocks" | "blockedBy",
): keyof GroupedRelations {
  if (type === "BLOCKS") return blocksKey;
  return type === "RELATES_TO" ? "relatesTo" : "duplicates";
}

/**
 * Görevin kaynak ve hedef olduğu kayıtları tek bir görünüme indirger:
 * blocks/blockedBy aynı BLOCKS kaydının iki perspektifidir.
 */
export function groupRelationsForTask(
  taskId: string,
  sourceRelations: SourceRelationRecord[],
  targetRelations: TargetRelationRecord[],
): GroupedRelations {
  const grouped: GroupedRelations = {
    blocks: [],
    blockedBy: [],
    relatesTo: [],
    duplicates: [],
  };

  for (const relation of sourceRelations) {
    if (relation.sourceTaskId !== taskId) continue;
    grouped[resolveGroupKey(relation.type, "blocks")].push({
      id: relation.id,
      type: relation.type,
      direction: "source",
      task: relation.targetTask,
    });
  }

  for (const relation of targetRelations) {
    if (relation.targetTaskId !== taskId) continue;
    grouped[resolveGroupKey(relation.type, "blockedBy")].push({
      id: relation.id,
      type: relation.type,
      direction: "target",
      task: relation.sourceTask,
    });
  }

  return grouped;
}

export function countGroupedRelations(grouped: GroupedRelations): number {
  return (
    grouped.blocks.length +
    grouped.blockedBy.length +
    grouped.relatesTo.length +
    grouped.duplicates.length
  );
}

export function formatTaskIdentifier(projectIdentifier: string, sequenceId: number): string {
  return `${projectIdentifier}-${sequenceId}`;
}
