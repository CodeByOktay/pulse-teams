import { describe, it, expect } from "vitest";
import {
  collectBlockEdges,
  countGroupedRelations,
  formatTaskIdentifier,
  getRelationLabel,
  groupRelationsForTask,
  hasExistingRelation,
  isSelfRelation,
  requiresCycleCheck,
  wouldCreateBlockCycle,
  type RelatedTaskSummary,
  type RelationEdge,
  type SourceRelationRecord,
  type TargetRelationRecord,
  type TypedRelationEdge,
} from "../relation-logic";
import { formatActivityMessage, type ActivityWithActor } from "../activity-logger";

function edge(sourceTaskId: string, targetTaskId: string): RelationEdge {
  return { sourceTaskId, targetTaskId };
}

function relatedTask(id: string, sequenceId: number): RelatedTaskSummary {
  return {
    id,
    sequenceId,
    title: `Görev ${sequenceId}`,
    stateName: "Yapılacak",
    stateColor: "#60646C",
    projectIdentifier: "PRJ",
  };
}

describe("getRelationLabel", () => {
  it("BLOCKS kaynak perspektifinde 'Engelliyor' döner", () => {
    expect(getRelationLabel("BLOCKS", "source")).toBe("Engelliyor");
  });

  it("BLOCKS hedef perspektifinde 'Tarafından engelleniyor' döner", () => {
    expect(getRelationLabel("BLOCKS", "target")).toBe("Tarafından engelleniyor");
  });

  it("RELATES_TO kaynak perspektifinde 'İlişkili' döner", () => {
    expect(getRelationLabel("RELATES_TO", "source")).toBe("İlişkili");
  });

  it("RELATES_TO hedef perspektifinde de 'İlişkili' döner (simetrik)", () => {
    expect(getRelationLabel("RELATES_TO", "target")).toBe("İlişkili");
  });

  it("DUPLICATES kaynak perspektifinde 'Şunun kopyası' döner", () => {
    expect(getRelationLabel("DUPLICATES", "source")).toBe("Şunun kopyası");
  });

  it("DUPLICATES hedef perspektifinde 'Kopyaları' döner", () => {
    expect(getRelationLabel("DUPLICATES", "target")).toBe("Kopyaları");
  });
});

describe("isSelfRelation", () => {
  it("aynı görev id'si verilirse true döner", () => {
    expect(isSelfRelation("task-1", "task-1")).toBe(true);
  });

  it("farklı görev id'lerinde false döner", () => {
    expect(isSelfRelation("task-1", "task-2")).toBe(false);
  });
});

describe("requiresCycleCheck", () => {
  it("BLOCKS için döngü kontrolü gerekir", () => {
    expect(requiresCycleCheck("BLOCKS")).toBe(true);
  });

  it("RELATES_TO için döngü kontrolü gerekmez", () => {
    expect(requiresCycleCheck("RELATES_TO")).toBe(false);
  });

  it("DUPLICATES için döngü kontrolü gerekmez", () => {
    expect(requiresCycleCheck("DUPLICATES")).toBe(false);
  });
});

describe("collectBlockEdges", () => {
  it("yalnızca BLOCKS kenarlarını süzer, diğer tipleri dışarıda bırakır", () => {
    const relations: TypedRelationEdge[] = [
      { sourceTaskId: "a", targetTaskId: "b", type: "BLOCKS" },
      { sourceTaskId: "b", targetTaskId: "c", type: "RELATES_TO" },
      { sourceTaskId: "c", targetTaskId: "d", type: "DUPLICATES" },
      { sourceTaskId: "d", targetTaskId: "e", type: "BLOCKS" },
    ];

    expect(collectBlockEdges(relations)).toEqual([edge("a", "b"), edge("d", "e")]);
  });

  it("BLOCKS kenarı yoksa boş dizi döner", () => {
    const relations: TypedRelationEdge[] = [
      { sourceTaskId: "a", targetTaskId: "b", type: "RELATES_TO" },
    ];
    expect(collectBlockEdges(relations)).toEqual([]);
  });
});

describe("wouldCreateBlockCycle", () => {
  it("kendisiyle ilişki döngü sayılır", () => {
    expect(wouldCreateBlockCycle([], "a", "a")).toBe(true);
  });

  it("boş grafta yeni kenar döngü oluşturmaz", () => {
    expect(wouldCreateBlockCycle([], "a", "b")).toBe(false);
  });

  it("doğrudan döngü: A → B varken B → A eklenemez", () => {
    expect(wouldCreateBlockCycle([edge("a", "b")], "b", "a")).toBe(true);
  });

  it("zincirleme döngü: A → B ve B → C varken C → A eklenemez", () => {
    const edges = [edge("a", "b"), edge("b", "c")];
    expect(wouldCreateBlockCycle(edges, "c", "a")).toBe(true);
  });

  it("aynı zincirde ters yön serbesttir: A → B ve B → C varken A → C eklenebilir", () => {
    const edges = [edge("a", "b"), edge("b", "c")];
    expect(wouldCreateBlockCycle(edges, "a", "c")).toBe(false);
  });

  it("elmas graf: A → B, A → C, B → D, C → D varken D → A engellenir", () => {
    const edges = [edge("a", "b"), edge("a", "c"), edge("b", "d"), edge("c", "d")];
    expect(wouldCreateBlockCycle(edges, "d", "a")).toBe(true);
  });

  it("elmas grafta kardeş düğümler arası B → C serbesttir", () => {
    const edges = [edge("a", "b"), edge("a", "c"), edge("b", "d"), edge("c", "d")];
    expect(wouldCreateBlockCycle(edges, "b", "c")).toBe(false);
  });

  it("bağlantısız graflar: E → F varken bağımsız A → B döngü üretmez", () => {
    expect(wouldCreateBlockCycle([edge("e", "f")], "a", "b")).toBe(false);
  });

  it("mevcut veride önceden oluşmuş döngü olsa bile sonsuz döngüye girmez", () => {
    const edges = [edge("a", "b"), edge("b", "c"), edge("c", "a")];
    expect(wouldCreateBlockCycle(edges, "x", "y")).toBe(false);
  });

  it("mevcut döngünün içinden geçen yeni kenarı da doğru tespit eder", () => {
    const edges = [edge("a", "b"), edge("b", "c"), edge("c", "a")];
    expect(wouldCreateBlockCycle(edges, "d", "a")).toBe(false);
    expect(wouldCreateBlockCycle(edges, "a", "d")).toBe(false);
    expect(wouldCreateBlockCycle(edges, "b", "b")).toBe(true);
  });

  it("1000 düğümlü derin zincirde stack overflow vermeden döngüyü bulur (iteratif DFS)", () => {
    const edges: RelationEdge[] = [];
    for (let i = 0; i < 1000; i += 1) {
      edges.push(edge(`node-${i}`, `node-${i + 1}`));
    }

    expect(wouldCreateBlockCycle(edges, "node-1000", "node-0")).toBe(true);
    expect(wouldCreateBlockCycle(edges, "node-0", "node-1000")).toBe(false);
  });

  it("yinelenen kenarlar sonucu değiştirmez", () => {
    const edges = [edge("a", "b"), edge("a", "b"), edge("b", "c")];
    expect(wouldCreateBlockCycle(edges, "c", "a")).toBe(true);
  });
});

describe("hasExistingRelation", () => {
  it("ilişki yoksa false döner", () => {
    expect(hasExistingRelation([], "a", "b")).toBe(false);
  });

  it("aynı yöndeki mükerrer ilişkiyi tespit eder", () => {
    expect(hasExistingRelation([edge("a", "b")], "a", "b")).toBe(true);
  });

  it("ters yöndeki ilişkiyi de mükerrer sayar (tek çift kuralı)", () => {
    expect(hasExistingRelation([edge("a", "b")], "b", "a")).toBe(true);
  });

  it("tip farklı olsa bile aynı çift ikinci kez ilişkilendirilemez", () => {
    const relations: TypedRelationEdge[] = [
      { sourceTaskId: "a", targetTaskId: "b", type: "RELATES_TO" },
    ];
    expect(hasExistingRelation(relations, "a", "b")).toBe(true);
  });

  it("ilgisiz çiftlerde false döner", () => {
    const relations = [edge("a", "b"), edge("c", "d")];
    expect(hasExistingRelation(relations, "a", "c")).toBe(false);
  });
});

describe("groupRelationsForTask", () => {
  const sourceRelations: SourceRelationRecord[] = [
    { id: "r1", type: "BLOCKS", sourceTaskId: "t1", targetTask: relatedTask("t2", 2) },
    { id: "r2", type: "RELATES_TO", sourceTaskId: "t1", targetTask: relatedTask("t3", 3) },
    { id: "r3", type: "DUPLICATES", sourceTaskId: "t1", targetTask: relatedTask("t4", 4) },
  ];

  const targetRelations: TargetRelationRecord[] = [
    { id: "r4", type: "BLOCKS", targetTaskId: "t1", sourceTask: relatedTask("t5", 5) },
    { id: "r5", type: "RELATES_TO", targetTaskId: "t1", sourceTask: relatedTask("t6", 6) },
    { id: "r6", type: "DUPLICATES", targetTaskId: "t1", sourceTask: relatedTask("t7", 7) },
  ];

  it("karışık kaynak/hedef ilişkilerini 4 gruba doğru ayrıştırır", () => {
    const grouped = groupRelationsForTask("t1", sourceRelations, targetRelations);

    expect(grouped.blocks.map((item) => item.task.id)).toEqual(["t2"]);
    expect(grouped.blockedBy.map((item) => item.task.id)).toEqual(["t5"]);
    expect(grouped.relatesTo.map((item) => item.task.id)).toEqual(["t3", "t6"]);
    expect(grouped.duplicates.map((item) => item.task.id)).toEqual(["t4", "t7"]);
  });

  it("her öğeye doğru perspektif yönünü atar", () => {
    const grouped = groupRelationsForTask("t1", sourceRelations, targetRelations);

    expect(grouped.blocks[0].direction).toBe("source");
    expect(grouped.blockedBy[0].direction).toBe("target");
    expect(grouped.duplicates.map((item) => item.direction)).toEqual(["source", "target"]);
  });

  it("aynı BLOCKS kaydı iki kez sayılmaz: engelliyor ve engelleniyor ayrı kayıtlardır", () => {
    const grouped = groupRelationsForTask("t1", sourceRelations, targetRelations);

    expect(grouped.blocks[0].id).toBe("r1");
    expect(grouped.blockedBy[0].id).toBe("r4");
    expect(countGroupedRelations(grouped)).toBe(6);
  });

  it("başka bir göreve ait kayıtları dışarıda bırakır", () => {
    const grouped = groupRelationsForTask("t9", sourceRelations, targetRelations);

    expect(countGroupedRelations(grouped)).toBe(0);
    expect(grouped.blocks).toEqual([]);
    expect(grouped.blockedBy).toEqual([]);
  });

  it("ilişkisi olmayan görevde tüm gruplar boştur", () => {
    const grouped = groupRelationsForTask("t1", [], []);

    expect(grouped).toEqual({ blocks: [], blockedBy: [], relatesTo: [], duplicates: [] });
    expect(countGroupedRelations(grouped)).toBe(0);
  });

  it("ilişkili görevin özet bilgisini korur", () => {
    const grouped = groupRelationsForTask("t1", sourceRelations, targetRelations);

    expect(grouped.blocks[0].task).toEqual({
      id: "t2",
      sequenceId: 2,
      title: "Görev 2",
      stateName: "Yapılacak",
      stateColor: "#60646C",
      projectIdentifier: "PRJ",
    });
  });
});

describe("formatTaskIdentifier", () => {
  it("PRJ-12 biçiminde identifier üretir", () => {
    expect(formatTaskIdentifier("PRJ", 12)).toBe("PRJ-12");
  });
});

describe("formatActivityMessage — ilişki aktiviteleri", () => {
  function activity(type: "TASK_RELATION_ADDED" | "TASK_RELATION_REMOVED", metadata: string | null) {
    return {
      id: "a1",
      type,
      taskId: "t1",
      actorId: "u1",
      oldValue: null,
      newValue: null,
      metadata,
      createdAt: new Date(),
      actor: { name: "Ayşe" },
    } as ActivityWithActor;
  }

  it("ilişki eklendiğinde hedef identifier'ı içeren mesaj üretir", () => {
    const message = formatActivityMessage(
      activity("TASK_RELATION_ADDED", JSON.stringify({ targetIdentifier: "PRJ-12", type: "BLOCKS" })),
    );
    expect(message).toBe("Ayşe göreve 'PRJ-12' ile ilişki ekledi.");
  });

  it("ilişki kaldırıldığında hedef identifier'ı içeren mesaj üretir", () => {
    const message = formatActivityMessage(
      activity("TASK_RELATION_REMOVED", JSON.stringify({ targetIdentifier: "PRJ-7", type: "RELATES_TO" })),
    );
    expect(message).toBe("Ayşe görevin 'PRJ-7' ile olan ilişkisini kaldırdı.");
  });

  it("metadata bozuksa mesaj yine de üretilir (— yer tutucusu)", () => {
    expect(formatActivityMessage(activity("TASK_RELATION_ADDED", "gecersiz-json"))).toBe(
      "Ayşe göreve '—' ile ilişki ekledi.",
    );
  });
});
