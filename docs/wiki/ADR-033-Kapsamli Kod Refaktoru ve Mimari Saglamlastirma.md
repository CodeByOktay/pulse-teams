# ADR-033: Kapsamlı Kod Refaktörü ve Mimari Sağlamlaştırma (4-Wave Refactoring & Hardening)

- **Durum:** Kabul Edildi (Accepted)
- **Tarih:** 2026-09-26
- **Karar Vericiler:** Antigravity (Lead Architect & QA Authority), Claude Code (Builder & Implementer)
- **Sürüm:** v0.5.4 (Refactoring & Hardening Milestone)
- **İlgili ADR:** [ADR-007-Kanban Panosu](file:///c:/Pulse/docs/wiki/ADR-007-Kanban%20Panosu%20(Board)%20&%20Sürükle-Bırak%20Mimaris), [ADR-008-Görev Detay Paneli](file:///c:/Pulse/docs/wiki/ADR-008-Görev%20Detay%20Paneli%20(Modal)%20&%20Yorum%20Sistemi%20Mimaris), [ADR-016-Durum & Etiket Yönetim Sayfası](file:///c:/Pulse/docs/wiki/ADR-016-Durum%20&%20Etiket%20Yönetim%20Sayfası%20(Proje%20Ayarları)%20—%20Kanban%20Sütunları,%20Durumlar%20ve%20Etiketlerin%20RBAC%20ile%20Yönetim), [ADR-017-Proje Davet Sistemi](file:///c:/Pulse/docs/wiki/ADR-017-Yönetimi%20ve%20Proje%20Davet%20Sistemi), [ADR-023-Görev İlişkileri](file:///c:/Pulse/docs/wiki/ADR-023-Görev%20İlişkileri%20ve%20Bağımlılık%20Mimarisi), [ADR-032-AI Destekli İlerleme Yorumlama](file:///c:/Pulse/docs/wiki/ADR-032-AI%20Destekli%20İlerleme%20Yorumlama%20ve%20Onaylı%20Güncelleme%20Mimarisi)

---

## 1. Bağlam ve Problem Tanımı (Context)

Phase 1'den Phase 5 MVP (Step 5.04) aşamasına kadar Pulse, 19 veritabanı modeli, 9 enum, 26 test paketi ve 514 birim/entegrasyon testiyle zengin bir proje yönetim platformuna evrilmiştir. Ancak bu hızlı evrim sürecinde katmanlar arasında bazı mimari borçlar, kod tekrarları ve performans fırsatları birikmiştir:

1. **"Big Bang" Toptan Refaktör Riski:** Tüm kod tabanını (180 dosya, ~735 KB kod) tek bir oturumda toptan refaktör etme girişimi, yapay zeka bağlam penceresini aşındıracak, tip sözleşmelerinde kırılmalara yol açacak ve izlenemez regresyonlar üretecektir.
2. **Performans ve Algoritmik Verimlilik:** Burndown hesaplamalarında günlük üç ayrı `.filter` döngüsü ($O(3 \times N \times \text{Days})$) çalışmakta; bağımlılık DFS graf gezintisinde yığın kontrolleri optimize edilebilirdi.
3. **Güvenlik (IDOR Açığı):** `cancelInvite` Server Action'ı silme sorgusunu yalnızca `inviteId` üzerinden yapmakta; bu durum bir projenin yöneticisinin farklı bir projenin davetini silebilmesine (cross-tenant IDOR) teorik olarak imkan tanımaktaydı.
4. **React 19 & ESLint Uyumsuzlukları:** `kanban-board.tsx` ve `task-detail-modal.tsx` bileşenlerinde `useEffect` içinde doğrudan state güncellemesi (`react-hooks/set-state-in-effect`) uyarısı mevcuttu. Ayrıca hızlı görev tıklamalarında eski isteğin yeni görevi ezdiği bir yarış durumu (race condition) bulunmaktaydı.
5. **İstemci Bellek ve Hidrasyon Riskleri:** Davet panosu kopyalama animasyonlarında `setTimeout` temizlenmemekte, render esnasında doğrudan `window.location` okunması Next.js SSR hidrasyon riskleri oluşturmaktaydı.
6. **Kör Nokta:** `project-analytics-logic.ts` saf mantık dosyasının doğrudan birim testi bulunmamaktaydı.

---

## 2. Alınan Mimari Kararlar (Decisions)

Projenin tamamı "Aşamalı ve Kontrollü (Incremental) 4 Dalga Mimarisi" ile refaktör edilmiş; her dalga Antigravity tarafından belirlenen katı sözleşmelerle yürütülmüştür.

```
[Wave 1: Saf Mantık (src/lib/)]       ──▶ 14 yeni test yazıldı (528 test) ──▶ git commit
              │
[Wave 2: Server Actions (src/actions/)]──▶ IDOR güvenlik yaması           ──▶ git commit
              │
[Wave 3: Kanban & Slide-Over UI]       ──▶ React 19 & Race-condition düz.  ──▶ git commit
              │
[Wave 4: Settings & Modallar]          ──▶ Optimistic rename & leak fix   ──▶ git commit
```

### A. Wave 1: Saf Alan Mantığı Refaktörü & Test Güvencesi (`src/lib/`)
* **`project-analytics-logic.ts`:**
  - `calculateBurndownSeries`: Günlük üçlü `.filter` taraması tek bir `countTasksForDay` döngüsüne indirgendi. Karmaşıklık $O(N \times \text{Days})$ seviyesine çekildi.
  - İdeal kalan hesabı `idealRemainingForDay`, ortalama ve yuvarlama `mean` ve `round1` saf yardımcılarına taşındı.
* **`relation-logic.ts`:**
  - `wouldCreateBlockCycle`: Graf komşuluk listesi `buildAdjacencyList` ile ayrıştırıldı, `visited` kümesi doğrudan yığına ekleme anında işaretlenerek gereksiz tekrarlar elendi.
  - `groupRelationsForTask`: İlişki gruplaması `resolveGroupKey` ile DRY prensibine uygun hale getirildi.
* **`board-filters.ts`:**
  - URL filtre çözümleme parçaları `pickValid` ve `pickOne` generic yardımcılarına taşındı; `new Date` kopyalama fazlalıkları temizlendi.
* **QA & Test Otoritesi Hamlesi (Antigravity):**
  - Bu modülün test açığı tespit edildi ve [`src/lib/__tests__/project-analytics-logic.test.ts`](file:///c:/Pulse/src/lib/__tests__/project-analytics-logic.test.ts) oluşturularak **14 kapsamlı test** eklendi (514 ➔ 528 test, 27 test suite).

### B. Wave 2: Server Actions & Yetkilendirme Katmanı (`src/actions/`)
* **`cancelInvite` IDOR Güvenlik Yaması:**
  - Sorgu `where: { id: inviteId, projectId }` olarak kilitlendi. Başka bir projenin davetini silmeye kalkan istekler Prisma `P2025` fırlatarak mekanik olarak engellendi.
* **`approveProposal` İşlem Öncesi Doğrulama:**
  - Hedef durumun (`targetState`) geçerliliği artık veritabanı transaction'ına girmeden önce doğrulanıyor; geçersiz durumlarda transaction abort maliyeti ortadan kaldırıldı.
* **Oturum ve Yetki Standartlaşması:**
  - `requireUserId`, `requireAdminSession` ve `assertNotProjectOwner` yardımcıları oluşturularak gereksiz try/catch ve session kontrol tekrarları temizlendi.
* **Sözleşme Dokunulmazlığı:**
  - Dışa aktarılan tüm action `.d.ts` arayüzleri değişiklik öncesi ve sonrasında bayt bayt birebir aynı kaldı.

### C. Wave 3: İnteraktif Kanban ve Görev Detay Paneli (`src/components/`)
* **React 19 Durum Eşitleme Deseni:**
  - `kanban-board.tsx`: `useEffect` içindeki `setColumns(initialStates)` anti-pattern'ı kaldırılarak React 19'un resmi `syncedStates !== initialStates` render-phase desenine dönüştürüldü. ESLint hatası giderildi.
* **Görev Detayı Yarış Durumu (Race Condition) Çözümü:**
  - `task-detail-modal.tsx`: `taskId` değişimlerinde önceki görevin yavaş yanıtının yeni görevi ezmesi `token` ve `activeTask` kontrolleriyle engellendi.
* **Bileşen Modülerliği:**
  - Başlık düzenleme mantığı `EditableTitle` adlı bağımsız alt bileşene çıkartıldı; yerel taslak state'i (`draft`) kapsüllendi.
* **Kanban Mantık Ayrıştırması:**
  - `moveTaskAcrossColumns` ve `findColumnId` saf fonksiyon olarak bileşen dışına taşındı.

### D. Wave 4: Ayarlar ve Yönetim Ekranları (`src/components/settings/`)
* **İyimser Yeniden Adlandırma (Optimistic Renames with Rollback):**
  - Durum ve etiket isimleri değiştirildiğinde kullanıcı arayüzü sunucu cevabını beklemeden anında güncelleniyor; sunucu hata verirse otomatik olarak eski isme geri dönüyor (`revert`).
* **Bellek Sızıntısı & Hydration Güvenliği:**
  - `members-manager.tsx`: "Kopyalandı!" animasyonundaki `setTimeout` sızıntısı `useEffect` cleanup içinde `clearTimeout` ile kapatıldı.
  - Render anında `window.location` okunması kaldırılarak SSR / Next.js hidrasyon güvenliği garantiye alındı.
  - Pano izin reddi (`clipboard rejection`) yakalanarak sessizce yönetildi.

---

## 3. Sonuçlar ve Mimari Kazanımlar (Consequences)

### Pozitif Kazanımlar:
1. **Sıfır Regresyon:** 528 Vitest birim ve entegrasyon testi 27 suite genelinde **%100 yeşil** kaldı.
2. **Kusursuz Tip Güvenliği:** `npx tsc --noEmit` sıfır hata verdi.
3. **Üretim Derlemesi Başarısı:** `npm run build` ile tüm sayfalar (`/`, `/login`, `/register`, `/invite/[token]`, `/projects/[projectId]/board`, `/list`, `/backlog`, `/sprints`, `/settings`) başarıyla derlendi.
4. **Temiz Kod Tabanı:** Dış bileşenlerin bağımlı olduğu hiçbir genel API (`.d.ts`) sözleşmesi değişmedi; 180 dosyalık projede en karmaşık dosyalar yüksek okunabilirlik ve performans seviyesine ulaştı.
5. **Kritik Güvenlik Güçlendirmesi:** Projeler arası davet silme (IDOR) riski ortadan kaldırıldı; durum ve atanan kullanıcıların proje sahipliği transaction öncesi doğrulanarak veri bütünlüğü sağlandı.
6. **Merkezi Yetkilendirme (Authz):** 12 Server Action dosyasındaki yetki kontrolleri `src/lib/authz.ts` altında konsolide edildi.
7. **Kusursuz Modal ve Klavye UX:** Slide-over ve popover modallarında Escape tuşu izolasyonu sağlandı; başlık güncellemelerinde iyimser hata geri alma (`rollback`) ve `useTaskNavigation` ile URL senkronizasyonu tekilleştirildi.
8. **Eşzamanlılık ve Performans İyileştirmeleri:** `completeSprint` atomik `updateMany` ile yarış durumlarına karşı kilitlendi, bildirim gönderimi `try/catch` ile dayanıklı hale getirildi; `ColorPicker` 200ms debounce ve render-phase prop senkronizasyonuna geçirildi.

---

## 4. Tamamlanan Sağlamlaştırma Paketleri (Hardening Packages)

4 dalgalı temel refaktörün ardından Claude Code tarafından raporlanan ve Antigravity gözetiminde uygulanan 3 öncelikli paket:

### Paket 1: Backend Hardening, Security, Data Integrity & authz Consolidation
- `src/lib/authz.ts`: `requireSession`, `requireUserId`, `requireMembership`, `requireAdmin`, `requireAdminSession`, `assertNotProjectOwner` yardımcıları merkezi `server-only` modülünde toplandı.
- `src/actions/*.ts` (12 dosya): Merkezi `authz` modülüne geçirildi, 200+ satır tekrar eden yetki kodu elendi.
- `src/actions/task.ts`: `createTask` ve `updateTask` içinde `stateId` ve `assigneeIds` için cross-project doğrulama eklendi.
- `src/actions/member.ts`: Davet kontrolleri `expiresAt > new Date()` ile sınırlandı; P2025 ham hataları kullanıcı dostu Türkçe hata mesajına dönüştürüldü.
- `src/actions/sprint.ts`: `createSprint` içindeki hatalı aktif sprint engeli kaldırıldı; `startSprint` içine `DRAFT` statü kontrolü eklendi.

### Paket 2: UI, UX, Modal Interactions & Frontend Hardening
- `src/lib/use-task-navigation.ts`: Board, List ve Backlog ekranlarındaki URL parametre (`?task=`) ve slide-over açma/kapama senkronizasyonu ortak hook'a bağlandı.
- `src/components/task-detail/task-detail-modal.tsx`: `EditableTitle` içine Escape tuşu izolasyonu ve sunucu hatasında önceki başlığa otomatik geri alma eklendi.
- `src/components/task-detail/inline-select-popover.tsx` & `task-relations.tsx`: Popover ve combobox'larda Escape tuşunun ebeveyn slide-over modalını kapatması `stopPropagation` ile engellendi.
- `src/components/settings/states-manager.tsx`: Projede tek kalan durumun silinmesi arayüzde `disabled` ve açıklayıcı tooltip ile engellendi.
- `src/components/sprints/edit-sprint-modal.tsx`: Durum değiştirme dropdown'ı kaldırılarak salt-okunur rozet ve açıklayıcı yönlendirme metnine dönüştürüldü.

### Paket 3: Performance, Concurrency & Polish
- `src/actions/sprint.ts`: `completeSprint` eylemi `prisma.sprint.updateMany({ where: { id, status: "ACTIVE" } })` atomik sorgusuna geçirildi; eşzamanlı çift istekler `count === 0` ile elendi. Bildirim gönderimi `try/catch` ile izole edildi. `updateSprint` doğrudan `COMPLETED` geçişini reddedecek şekilde kilitlendi.
- `src/components/settings/color-picker.tsx`: React 19 render-phase prop senkronizasyonuna geçirildi; renk seçici `onChange` 200ms debounce ile sınırlandı, `onBlur` ve `unmount` anlarında bekleyen renk temizlenerek veri kaybı önlendi.
- `src/components/settings/inline-name-input.tsx`: `states-manager.tsx` ve `labels-manager.tsx` içindeki kopya isim düzenleme bileşeni tek bir ortak bileşene çıkartıldı.
