# pulse-agent

Pulse Faz 6 yapay zekâ ajan koordinasyonu için Python konteyneri (ADR-034, spesifikasyon `docs/spec/v0.6.0-step-6.01.md` §4).

- **Agent-000 Supervisor** (`src/supervisor.py`): ajan kaydı, proje bazında etkinleştirme (`AgentSettings.enabled`), `AgentRun` benzersizlik kısıtı sayesinde her `(agentKey, projectId, scheduledFor)` için tek çalışma, hata yakalama.
- **Scheduler** (`src/scheduler.py`): APScheduler cron'u; her gün `TZ` saat diliminde `SCHEDULE_HOUR:00`'da çalışır.
- **Başlangıç telafisi** (`src/catchup.py`): açılışta, o gün kaçırılmış slotu bir kez çalıştırır.
- **Outbox poller** (`src/poller.py`): `DomainEvent` satırlarını `FOR UPDATE SKIP LOCKED` ile tüketir. Her sahiplenme bir kiralama (`lockedAt`, `attempts`) alır; süresi dolan kiralamalar yeniden kuyruğa alınır veya başarısız işaretlenir ve `lockedAt` sonlandırmayı korur. Böylece birden fazla ajan örneği güvenle çalışabilir. Handler hataları `DomainEvent.error` alanına yazılır ve otomatik olarak yeniden denenmez.
- **Internal API istemcisi** (`src/internal_client.py`): Next.js `/api/internal/agent/*` uç noktalarına HMAC-SHA256 imzalı çağrılar yapar.
- **Saat** (`src/clock.py`): testler için `set_mock_clock()` destekli `get_now()`.

Python tarafı yalnızca `DomainEvent` durumunu, `AgentRun` ve `AgentProposal` satırlarını yazar; diğer tüm mutasyonlar Next.js Internal API üzerinden yapılır.

## Ortam Değişkenleri

| Değişken | Varsayılan | Notlar |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://postgres:password@localhost:5432/pulse` | `?schema=public` gibi yalnızca Prisma'ya özgü parametreler otomatik olarak ayıklanır |
| `INTERNAL_API_URL` | `http://localhost:3000` | docker-compose içinde `http://app:3000` |
| `INTERNAL_API_SECRET` | `pulse-internal-secret-key-change-in-prod` | Next.js uygulamasındaki değerle aynı olmalıdır |
| `TZ` | `Europe/Istanbul` | |
| `SCHEDULE_HOUR` | `9` | Günlük çalışma saati (yerel `TZ`) |
| `POLL_INTERVAL_SECONDS` | `5` | Outbox yoklama aralığı |
| `POLL_BATCH_SIZE` | `20` | Her yoklamada sahiplenilen olay sayısı |
| `EVENT_LEASE_SECONDS` | `600` | Bu süreden eski bir PROCESSING olayı terk edilmiş sayılır |
| `EVENT_MAX_ATTEMPTS` | `3` | Terk edilmiş bir olayın yeniden kuyruğa alınmak yerine FAILED işaretlenmesinden önce izin verilen sahiplenme sayısı |
| `EVENT_LEASE_SWEEP_SECONDS` | `60` | Poller'ın süresi dolan kiralamaları tarama sıklığı |
| `DB_CONNECT_TIMEOUT_SECONDS` | `10` | psycopg bağlantı zaman aşımı |
| `LOG_LEVEL` | `INFO` | |

Değerler sırasıyla süreç ortamından, `agent/.env` dosyasından ve depo kökündeki `.env` dosyasından okunur.

## Yerelde Çalıştırma

```bash
cd agent
python -m venv .venv
.venv/Scripts/activate        # Windows (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
python -m src.main
```

## Testler

```bash
cd agent && pytest
```

`agent/tests/` altındaki test paketleri Antigravity tarafından yazılır (bkz. ADR-034 §I).

## Docker

```bash
docker compose up -d --build agent   # servis "agent", konteyner "pulse-agent"
docker logs -f pulse-agent
```
