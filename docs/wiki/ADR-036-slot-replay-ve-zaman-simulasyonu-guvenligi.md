---
status: proposed
date: 2026-09-27
decision-makers: [Oktay]
consulted: [Antigravity, Claude Code]
informed: []
version: v0.6.7
phase-step: "Phase 6 / Step 6.08"
supersedes: []
superseded-by: null
related: [./ADR-034-ai-agent-koordinasyon-altyapisi.md, ../spec/v0.6.7-step-6.08.md]
confidence: high
---

# ADR-036: Slot Replay ve Zaman Simülasyonu Güvenlik Mimarisi

## Özet (Y-Statement)

Pulse zaman simülasyonu ve test otomasyonu bağlamında, `SystemClock.mockTime` ileri sarıldığında duvar saatine bağlı APScheduler zamanlayıcılarının atlanan günleri çalıştırmaması ve oturumsuz saat mutasyonlarının güvenlik riski doğurması sorunu ile karşı karşıyayken;
**DomainEvent güdümlü `agent/src/replay.py` Slot Replay motoru, kronolojik `scheduledFor` slot yürütümü, oturum zorunluluğu (`requireSession`) ve üretim ortamı bayrak koruması (`isTimeTravelEnabled`)** seçeneğini seçtik, istemci taraflı ad-hoc tetikleme butonları veya korumasız global saat mutasyonları seçeneklerini değil;
böylece 14 güne kadar zaman sıçramalarında tüm 10 ajanın idempoten, sıralı ve eksiksiz çalışması ile güvenli ortam izolasyonu sağlanır, replay sırasında ek veritabanı işlem yükü ve Python tarafında ek planlama mantığı kabul edilerek.

## Bağlam ve Problem Tanımı (Context and Problem Statement)

Phase 6 Step 6.01'de (`ADR-034`) `SystemClock` modeli ve zaman soyutlaması sisteme kazandırılmıştır. Ancak sistem incelemesinde iki kritik eksiklik saptanmıştır:
1. **Atlanan Slotların Çalışmaması:** Python konteynerindeki `APScheduler`, gerçek duvar saati aralıklarına bağlıdır. UI üzerinden saat +7 gün ileri alındığında aradaki günlük denetimler (09:00), sabah standup'ları (09:30/11:30) ve haftalık özetler (Cuma 17:00) fiilen tetiklenmemektedir. `catchup.py` ise yalnızca o anki günün kaçırılan slotunu telafi etmektedir.
2. **Yetkisiz Erişim ve Güvenlik:** `src/actions/clock.ts` içindeki saat değiştirme ve ajan tetikleme eylemleri oturum kontrolü (`requireSession`) içermemekte, `GET /api/internal/agent/clock` uç noktası ise imzasız çalışmaktadır.

Bu karar, zaman yolculuğu simülasyonunun deterministik bir Slot Replay motoruyla nasıl çalışacağını ve yetkisiz müdahalelere karşı nasıl korunacağını belirler.

## Karar Etkenleri (Decision Drivers)

- **Determinizm ve İdempotens:** Zaman ileri sarıldığında atlanan her bir slotun `AgentRun @@unique([agentKey, projectId, scheduledFor])` kısıtıyla korunarak tek bir kez çalışması.
- **Güvenlik ve İzolasyon:** Saat kontrolünün üretim ortamında kapalı olması ve geliştirme ortamında oturum doğrulaması gerektirmesi.
- **İç API Bütünlüğü:** Tüm internal API'ların istisnasız HMAC imzasıyla korunması.
- **Mimari Uyum:** Slot oynatımının dış outbox kuyruk ve domain event mimarisiyle (`CLOCK_ADVANCED`) uyumlu işlemesi.

## Değerlendirilen Seçenekler (Considered Options)

1. **DomainEvent Güdümlü Slot Replay & Oturum Koruması (Seçilen Seçenek):**
   - Saat ileri alındığında `CLOCK_ADVANCED` DomainEvent'i yayınlanır.
   - `agent/src/replay.py` içindeki `plan_missed_slots` fonksiyonu atlanan slotları kronolojik sırada planlar (maksimum 14 gün penceresi, geri sarmada no-op).
   - Her slot kendi `fire_at` zamanını `scheduledFor` olarak alır ve ajanlar o slot zamanındaki durumu değerlendirir.
   - `src/actions/clock.ts` içine `requireSession()` ve `isTimeTravelEnabled(env)` eklenir; internal clock rotaları HMAC ile korunur.
2. **Next.js Arayüzünden Manuel Çoklu Tetikleme:**
   - Next.js "Ajanları Şimdi Çalıştır" butonu 10 ajana genişletilir; kullanıcı her gün için butona tıklar.
3. **APScheduler Mock Clock Entegrasyonu:**
   - APScheduler'ın dahili saat motorunu dinamik olarak yamalayarak (monkey-patch) yapay zaman hızlandırması yapmak.

## Karar (Decision Outcome)

Seçilen seçenek: **"DomainEvent Güdümlü Slot Replay & Oturum Koruması"**, çünkü mevcut outbox mimarisine tam uyum sağlar, kullanıcı müdahalesi gerektirmeden zaman sıçramalarını otomatik telafi eder ve güvenlik açıklarını kapatır.

### Sonuçlar (Consequences)

- **Olumlu:** Zaman 7 veya 14 gün ileri sarıldığında tüm 10 ajan zincirleme olarak doğru sırayla çalışır; E2E senaryolar (engel takibi, standup, haftalık rapor, retro) otomatik doğrulanır.
- **Olumlu:** `AgentRun` unique kısıtı sayesinde mükerrer işlem yapılması imkansızdır.
- **Olumlu:** Yetkisiz kullanıcıların veya prod ortamında dış aktörlerin sistem saatini manipüle etmesi engellenir.
- **Olumsuz:** 14 günlük büyük zaman sıçramalarında poller tek seferde onlarca slotu sırayla çalıştıracağı için kısa süreli CPU/DB yükü oluşur.
- **Nötr:** `GET /api/internal/agent/clock` diğer 17 endpoint gibi HMAC başlığı gerektirir.

### Doğrulama (Confirmation)

- `agent/src/replay.py` birim testleri (yarı açık aralık `(previous, current]`, 14 gün sınırı, geri sarmada boş liste, Cuma günü filtreleri).
- `src/lib/clock.ts` içindeki `isTimeTravelEnabled` testleri (production vs non-production).
- Vitest ve Pytest entegrasyon testlerinde zaman ileri sarılarak 3 E2E senaryonun başarıyla sonuçlandığının teyidi.

## Seçeneklerin Artı ve Eksileri (Pros and Cons of the Options)

### Seçenek 1: DomainEvent Güdümlü Slot Replay (Seçilen)
- İyi, çünkü event-driven outbox mimarisiyle %100 uyumludur.
- İyi, çünkü her slotun `scheduledFor` zamanını koruyarak geçmişe dönük idempoten denetim kaydı oluşturur.
- Kötü, çünkü büyük gün atlamalarında sıralı çalıştırma kuyruk süresini uzatabilir.

### Seçenek 2: Next.js Arayüzünden Manuel Tetikleme
- İyi, çünkü Python tarafında yeni bir planlayıcı modülü yazmayı gerektirmez.
- Kötü, çünkü `AgentRun` kayıtlarını atlar ve otomatik test senaryolarını desteklemez.
- Kötü, çünkü kullanıcının günleri tek tek elle tıklamasını gerektirir.

### Seçenek 3: APScheduler Mock Clock Entegrasyonu
- İyi, çünkü mevcut cron iş tanımlarını değiştirmeden çalışabilir.
- Kötü, çünkü APScheduler'ın iç zaman döngüsünü çalışma zamanında değiştirmek kararsızlığa ve yarış durumlarına yol açar.

## Ek Bilgiler (More Information)
- **Kanıt / Kaynaklar:** Pulse `ADR-034`, APScheduler dokümantasyonu, `docs/spec/v0.6.7-step-6.08.md`.
- **Yeniden değerlendirme tetikleyicisi:** Zaman yolculuğu ihtiyacının yerel test ortamından çıkıp çok kiracılı (multi-tenant) simülasyonlara evrilmesi.
- **İlgili:** [ADR-034](./ADR-034-ai-agent-koordinasyon-altyapisi.md), [Step 6.08 Spesifikasyonu](../spec/v0.6.7-step-6.08.md).
