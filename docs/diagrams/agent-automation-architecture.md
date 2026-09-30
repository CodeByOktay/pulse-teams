# Pulse — Agent Yapısı ve Otomasyon Diyagramları

> Kaynak: `agent/src/` (Python LangGraph container), `src/app/api/internal/agent/` (HMAC Internal API),
> `src/lib/*-service.ts`, `src/lib/domain-events.ts`, `src/lib/dependency-automation.ts`.
> Tüm diyagramlar Mermaid formatındadır (VS Code Markdown Preview / GitHub'da doğrudan render edilir).

---

## 1. Genel Mimari (3 katman: Next.js ↔ PostgreSQL ↔ pulse-agent)

```mermaid
flowchart LR
    subgraph NEXT["Next.js 16 App (pulse-web)"]
        UI["UI / Client Components"]
        SA["Server Actions<br/>src/actions/*"]
        TIERA["Tier A In-App Otomasyon<br/>dependency-automation.ts<br/>embedding-service.ts<br/>notification triggers"]
        IAPI["Internal Agent API<br/>/api/internal/agent/*<br/>HMAC-SHA256"]
        SVC["Domain Servisleri<br/>src/lib/*-service.ts<br/>+ LLM / heuristic fallback"]
        UI --> SA
        SA --> TIERA
        IAPI --> SVC
    end

    subgraph DB["PostgreSQL 16 + pgvector"]
        DE[("DomainEvent<br/>outbox")]
        AR[("AgentRun")]
        AS[("AgentSettings")]
        CLK[("SystemClock")]
        CP[("LangGraph<br/>Checkpoints")]
        DOM[("Task / Sprint / Notification<br/>ProgressRequest / AgentProposal<br/>DailyStandup / TaskEmbedding")]
    end

    subgraph AGENT["pulse-agent (Python container)"]
        MAIN["main.py"]
        SCH["APScheduler<br/>scheduler.py"]
        SUP["Agent-000<br/>Supervisor"]
        POL["DomainEvent Poller<br/>SKIP LOCKED + lease"]
        CAT["Startup Catch-up"]
        REP["Slot Replay<br/>replay.py"]
        AGS["Agent-001 … Agent-009"]
        MAIN --> CAT & SCH & POL
        SCH --> SUP
        CAT --> SUP
        SUP --> AGS
        POL --> AGS
        POL --> REP
        REP --> SUP
    end

    SA -- "emitDomainEvent tx içinde" --> DE
    SA --> DOM
    TIERA --> DOM
    SVC --> DOM
    POL -- "claim / finalize" --> DE
    SUP -- "claim_run / complete_run" --> AR
    SUP -- "load settings" --> AS
    MAIN -- "sync_clock_from_db" --> CLK
    AGS -- "Agent-003 interrupt state" --> CP
    AGS -- "InternalClient POST<br/>HMAC imzalı" --> IAPI
```

---

## 2. Agent Kataloğu ve Tetikleyiciler

```mermaid
flowchart TB
    subgraph TRIG["Tetikleyiciler"]
        D09["Günlük 09:00<br/>Supervisor sweep"]
        S0930["Günlük 09:30<br/>standup open"]
        S1130["Günlük 11:30<br/>standup cutoff"]
        F17["Cuma 17:00<br/>weekly digest"]
        EV_TSC["TASK_STATE_CHANGED"]
        EV_TRC["TASK_RELATION_CREATED"]
        EV_TSA["TASK_SPRINT_ADDED"]
        EV_TC["TASK_CREATED"]
        EV_SC["SPRINT_COMPLETED"]
        EV_PQ["PROGRESS_QUICK_RESPONSE_SUBMITTED"]
        EV_CA["CLOCK_ADVANCED"]
    end

    subgraph AG["Agent'lar"]
        A002["Agent-002<br/>Task Hygiene"]
        A001["Agent-001<br/>Deadline Tracker"]
        A004["Agent-004<br/>Blocker Manager"]
        A009["Agent-009<br/>Scope Creep"]
        A003["Agent-003<br/>Status Requester<br/>LangGraph interrupt/resume"]
        A007["Agent-007<br/>Workload Balancer"]
        A008["Agent-008<br/>Sprint Assistant"]
        A005["Agent-005<br/>Async Standup"]
        A006["Agent-006<br/>Weekly Digest"]
        RPL["Slot Replay"]
    end

    subgraph API["Internal API → Next.js Servisi"]
        E_HY["/hygiene-check<br/>dispatchTaskHygieneReport"]
        E_DL["/deadline-check<br/>dispatchDueDateReminders"]
        E_BL["/blocker-check<br/>dispatchBlockerCheck"]
        E_SCP["/scope-creep-check<br/>dispatchScopeCreepCheck"]
        E_SR["/status-requests<br/>dispatchStatusRequests"]
        E_SRS["/status-response"]
        E_WL["/workload-check<br/>dispatchWorkloadCheck"]
        E_SO["/sprint-overflow-check<br/>dispatchSprintOverflowCheck"]
        E_RET["/sprint-retro<br/>dispatchSprintRetro"]
        E_SUO["/standup-open<br/>openTodayStandup"]
        E_SUS["/standup-synthesize<br/>synthesizeStandup"]
        E_WD["/weekly-digest<br/>dispatchWeeklyDigest"]
    end

    D09 -->|"öncelik 1"| A002
    D09 -->|"2"| A001
    D09 -->|"3"| A004
    D09 -->|"4"| A009
    D09 -->|"5"| A003
    D09 -->|"6"| A007
    D09 -->|"7"| A008

    EV_TSC --> A004
    EV_TRC --> A004
    EV_TSA --> A009
    EV_TC --> A009
    EV_SC --> A008
    EV_PQ -->|"resume"| A003
    EV_CA --> RPL

    S0930 --> A005
    S1130 --> A005
    F17 --> A006

    A002 --> E_HY
    A001 --> E_DL
    A004 --> E_BL
    A009 --> E_SCP
    A003 --> E_SR
    A003 --> E_SRS
    A007 --> E_WL
    A008 --> E_SO
    A008 --> E_RET
    A005 --> E_SUO
    A005 --> E_SUS
    A006 --> E_WD

    RPL -.->|"kaçırılan slotları<br/>now_override ile"| D09
    RPL -.-> S0930
    RPL -.-> S1130
    RPL -.-> F17
```

| Agent | Tetikleyici | LLM | Tier | Çıktı |
|---|---|---|---|---|
| 000 Supervisor | 09:00 cron + catch-up | — | — | AgentRun claim, enablement, rate-limit |
| 001 Deadline Tracker | 09:00 | Yok | A | 3/1/0 gün hatırlatma, overdue → ADMIN eskalasyonu |
| 002 Task Hygiene | 09:00 | Yok | A | Atanmamış / tarihsiz / açıklamasız görev raporu |
| 003 Status Requester | 09:00 + `PROGRESS_QUICK_RESPONSE_SUBMITTED` | Yok | B/C | ProgressRequest, interrupt/resume, 2 gün timeout eskalasyonu |
| 004 Blocker Manager | 09:00 + `TASK_STATE_CHANGED`, `TASK_RELATION_CREATED` | Yok | A | Stale/overdue blocker uyarısı |
| 005 Async Standup | 09:30 / 11:30 (kendi cron'u) | Var (server-side) + heuristic | B | DailyStandup, özet bildirimi |
| 006 Weekly Digest | Cuma 17:00 (kendi cron'u) | Var (server-side) + heuristic | B | Sprint sağlığı / velocity özeti |
| 007 Workload Balancer | 09:00 | Var (server-side) | C | PENDING AgentProposal (yeniden atama) |
| 008 Sprint Assistant | 09:00 + `SPRINT_COMPLETED` | Var (retro, server-side) | B | Overflow uyarısı, retro taslağı |
| 009 Scope Creep | 09:00 + `TASK_SPRINT_ADDED`, `TASK_CREATED` | Yok | A | Sprint kapsam büyümesi uyarısı |

---

## 3. Container Başlangıç Akışı (`main.py`)

```mermaid
flowchart TD
    START(["python -m src.main"]) --> LOG["configure_logging"]
    LOG --> REG["register_builtin_agents<br/>supervisor + poller handler kayıtları"]
    REG --> WAIT{"DB erişilebilir mi?"}
    WAIT -- "Hayır, 5 sn bekle" --> WAIT
    WAIT -- "Evet" --> SYNC["sync_clock_from_db<br/>SystemClock.mockTime"]
    SYNC --> CATCH["run_startup_catchup<br/>bugünün kaçırılan 09:00 slotu"]
    CATCH --> SCHED["APScheduler başlat<br/>09:00 / 09:30 / 11:30 / Cuma 17:00"]
    SCHED --> POLL["DomainEvent poller loop<br/>+ lease sweep"]
    POLL --> RUN(["çalışıyor… SIGINT/SIGTERM bekleniyor"])
    RUN --> STOP["Graceful shutdown<br/>scheduler.shutdown, poller drain,<br/>close_replay, Agent-003 checkpointer kapat"]
```

---

## 4. Supervisor Günlük Çalıştırma (Agent-000)

```mermaid
sequenceDiagram
    autonumber
    participant CRON as APScheduler 09:00
    participant SUP as Agent-000 Supervisor
    participant DB as PostgreSQL
    participant AG as Agent-00X
    participant API as Next.js Internal API

    CRON->>SUP: run_daily_agents
    SUP->>DB: SELECT AgentSettings
    loop AGENT_PRIORITY sırasıyla: 002, 001, 004, 009, 003, 007, 008
        loop Her proje
            alt Agent bu projede disabled
                SUP->>DB: INSERT AgentRun SKIPPED
            else enabled
                SUP->>DB: INSERT AgentRun RUNNING<br/>ON CONFLICT agentKey,projectId,scheduledFor DO NOTHING
                alt Slot zaten alınmış
                    DB-->>SUP: satır yok → DUPLICATE, rate limited
                else Slot alındı
                    SUP->>AG: run_for_project projectId, scheduledFor
                    AG->>API: POST /api/internal/agent/... HMAC imzalı
                    API-->>AG: result JSON
                    AG-->>SUP: dict veya exception
                    SUP->>DB: UPDATE AgentRun SUCCESS / FAILED + result, tokenCount
                end
            end
        end
    end
```

---

## 5. DomainEvent Outbox Yaşam Döngüsü (Poller)

```mermaid
stateDiagram-v2
    [*] --> PENDING: Server Action tx içinde emitDomainEvent
    PENDING --> PROCESSING: claim - FOR UPDATE SKIP LOCKED, lockedAt=now, attempts+1
    PROCESSING --> DONE: handler başarılı
    PROCESSING --> FAILED: handler exception
    PROCESSING --> FAILED: handler timeout
    PROCESSING --> PENDING: lease süresi doldu ve attempts < MAX
    PROCESSING --> FAILED: lease süresi doldu ve attempts >= MAX
    PROCESSING --> PENDING: graceful shutdown, henüz başlamamış, attempts-1
    DONE --> [*]
    FAILED --> [*]
```

```mermaid
flowchart LR
    subgraph EMIT["Olayı üreten Server Action"]
        T1["task.ts: createTask"] --> E1["TASK_CREATED"]
        T2["task.ts: updateTask / moveTask"] --> E2["TASK_STATE_CHANGED<br/>TASK_COMPLETED"]
        S1["sprint.ts: addTaskToSprint / moveTaskToSprint"] --> E3["TASK_SPRINT_ADDED"]
        S2["sprint.ts: removeTask / moveTaskToBacklog"] --> E4["TASK_SPRINT_REMOVED"]
        S3["sprint.ts: startSprint"] --> E5["SPRINT_STARTED"]
        S4["sprint.ts: completeSprint"] --> E6["SPRINT_COMPLETED"]
        R1["relation.ts: addTaskRelation"] --> E7["TASK_RELATION_CREATED"]
        P1["progress.ts: respondToProgressRequestQuick"] --> E8["PROGRESS_QUICK_RESPONSE_SUBMITTED"]
        C1["clock-service.ts: advance clock"] --> E9["CLOCK_ADVANCED - global"]
    end

    subgraph HANDLE["Poller handler"]
        H4["Agent-004.handle_event"]
        H9["Agent-009.handle_event"]
        H8["Agent-008.handle_event"]
        H3["Agent-003.resume_request"]
        HR["replay.handle_clock_advanced"]
        HD["default_handler - no-op"]
    end

    E1 --> H9
    E2 --> H4
    E3 --> H9
    E7 --> H4
    E6 --> H8
    E8 --> H3
    E9 --> HR
    E4 --> HD
    E5 --> HD
```

---

## 6. Agent-003 Status Requester — LangGraph interrupt / resume (Human-in-the-loop)

```mermaid
sequenceDiagram
    autonumber
    participant SUP as Supervisor 09:00
    participant A3 as Agent-003
    participant API as Next.js Internal API
    participant CP as LangGraph Checkpointer - Postgres
    participant U as Assignee - UI
    participant SA as Server Action
    participant POL as Poller

    SUP->>A3: run_for_project
    A3->>API: POST /status-requests - dispatchStatusRequests
    API-->>A3: staleDays aşan IN_PROGRESS görevler için açılan ProgressRequest listesi
    Note over API: Aynı çağrıda: 2 günden eski PENDING istekler<br/>EXPIRED + ADMIN eskalasyonu
    loop Her yeni ProgressRequest
        A3->>CP: graph.ainvoke thread_id = requestId
        CP-->>A3: node interrupt() → durum kalıcı, bekleme
    end
    Note over CP: Bekleme container restart'ına dayanıklıdır

    U->>SA: İlerliyor ▶ / Engel var 🚫 / Bitti ✅
    SA->>SA: ProgressRequest RESPONDED + tx içinde DomainEvent
    SA-->>POL: PROGRESS_QUICK_RESPONSE_SUBMITTED
    POL->>A3: resume_request requestId, action
    A3->>CP: Command resume=action
    CP-->>A3: node tamamlanır
    A3->>API: POST /status-response
    API-->>U: AgentProposal / ADMIN eskalasyonu / bildirim
```

---

## 7. Tier A — Next.js İçi Deterministik Otomasyonlar (Container'sız)

```mermaid
flowchart TD
    subgraph ACT["Kullanıcı aksiyonu"]
        DONE["Görev DONE durumuna taşındı"]
        CREATE["Görev oluşturuldu / güncellendi"]
        ASSIGN["Kullanıcı atandı"]
        COMMENT["Yorum eklendi"]
        SPRINTC["Sprint tamamlandı"]
    end

    DONE --> TUD["triggerUnblockedDependencies<br/>dependency-automation.ts"]
    TUD --> CHK{"isTaskFullyUnblocked?<br/>tüm BLOCKS kaynakları DONE"}
    CHK -- "Hayır" --> NOP1["İşlem yok"]
    CHK -- "Evet" --> LOCK["claimUnblockAnnouncement<br/>advisory lock + computeLastBlockedAt"]
    LOCK -- "zaten duyuruldu" --> NOP2["Tekrar yok - dedup"]
    LOCK -- "ilk duyuru" --> ACTV["Activity: TASK_UNBLOCKED"]
    ACTV --> NT1["Notification: TASK_UNBLOCKED<br/>self-notification filtrelenir"]

    CREATE --> EMB["upsertTaskEmbedding<br/>embedding-service.ts"]
    EMB --> HASH{"SHA-256 content hash<br/>değişti mi?"}
    HASH -- "Hayır" --> NOP3["API çağrısı yok"]
    HASH -- "Evet" --> VEC[("TaskEmbedding<br/>pgvector ivfflat")]
    VEC --> RAG["Hybrid semantic search<br/>mergeHybridResults"]

    ASSIGN --> PREF{"shouldDeliverWithPreferences<br/>actor ≠ recipient + tercih açık"}
    COMMENT --> MEN["extractMentions<br/>resolveMentionedUserIds"]
    MEN --> PREF
    SPRINTC --> GUARD["updateMany status=ACTIVE<br/>atomik concurrency guard"]
    GUARD --> PREF
    PREF -- "Evet" --> NT2["Notification<br/>TASK_ASSIGNED / TASK_MENTIONED /<br/>COMMENT_ADDED / SPRINT_COMPLETED"]
    PREF -- "Hayır" --> NOP4["Bastırılır"]
```

---

## 8. Otomasyon Seviyeleri (ADR-028 — Autonomy Tiers)

```mermaid
flowchart LR
    subgraph A["Tier A — Deterministik, Level 1 auto-notify"]
        a1["TASK_UNBLOCKED"]
        a2["Agent-001 Deadline"]
        a3["Agent-002 Hygiene"]
        a4["Agent-004 Blocker"]
        a5["Agent-009 Scope Creep"]
    end
    subgraph B["Tier B — AI destekli koordinasyon"]
        b1["Progress yorumlama<br/>LLM + heuristic fallback"]
        b2["Agent-005 Standup özeti"]
        b3["Agent-006 Weekly digest"]
        b4["Agent-008 Overflow + Retro"]
        b5["Agent-003 Status yanıtı"]
    end
    subgraph C["Tier C — İnsan onayı zorunlu, Level 2 propose + approve"]
        c1["AgentProposal PENDING"]
        c2["Agent-007 yeniden atama önerisi"]
        c3["AgentProposalCard<br/>approveProposal / reject"]
    end

    A -->|"Bildirim"| USER(["Kullanıcı / ADMIN"])
    B -->|"Özet / uyarı / öneri"| USER
    b1 --> c1
    b5 --> c1
    c2 --> c1
    c1 --> c3
    c3 -->|"Onay sonrası mutasyon"| USER
```

---

## 9. Slot Replay — Time Travel (ADR-036)

```mermaid
sequenceDiagram
    autonumber
    participant ADM as ADMIN - AgentSettings UI
    participant NX as Next.js clock-service
    participant DB as PostgreSQL
    participant POL as Poller
    participant RP as replay.py
    participant SUP as Supervisor / Agent-005 / Agent-006

    ADM->>NX: Saati ileri al, örn. +7 gün
    NX->>NX: requireSession + isTimeTravelEnabled - prod kilidi
    NX->>DB: SystemClock.mockTime güncelle
    NX->>DB: DomainEvent CLOCK_ADVANCED previous, current
    POL->>DB: claim event
    POL->>RP: handle_clock_advanced
    RP->>RP: plan_missed_slots - aralık previous, current, en fazla 14 gün
    RP-->>POL: arka plan task başlatıldı → event DONE
    loop Her kaçırılan slot - kronolojik
        RP->>SUP: now_override = slot.fire_at ile çalıştır
        SUP->>DB: AgentRun claim - scheduledFor = slot zamanı
        Note over SUP,DB: @@unique sayesinde tekrar oynatma idempotent,<br/>result içine replayed: true eklenir
    end
```
