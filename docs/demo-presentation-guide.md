# Pulse — Ekip Tanıtım ve Canlı Demo Rehberi (10-15 Dakika)

> **Hedef Kitle:** Takım arkadaşları, Proje Yöneticileri (PM), Takım Liderleri ve Geliştiriciler  
> **Odak:** "Pulse işimizi nasıl kolaylaştırıyor?", "Akıllı Ajanlar bizim için ne yapıyor?", Canlı Kullanım Akışı.  
> **Süre:** 12-15 Dakika (Sunum + Canlı Gösterim + Soru/Cevap)

---

## 1. Sunum Akışı ve Süre Planı

| Bölüm | Konu | Süre | Gösterilecek Ekran |
|---|---|:---:|---|
| **1. Giriş** | Pulse Nedir? "Pasif Panolardan Proaktif Panolara" | 2 dk | Giriş / Proje Panosu (Kanban) |
| **2. Temel Fark** | Dijital Asistan: 10 Ajanın Rolü (Kural Tabanlı + AI) | 3 dk | Proje Ayarları / Pulse Asistan Sekmesi |
| **3. Canlı Demo 1** | Proje Hafızası (Semantic Search / Benzer İşler) | 2 dk | Görev Detay Çekmecesi |
| **4. Canlı Demo 2** | Sanal Saat, 09:00 Cron Taraması ve Bildirimler | 3 dk | Saat Menüsü / Bildirim Çanı |
| **5. Canlı Demo 3** | İnsan Onaylı İş Yükü Dengeleme (Agent Proposals) | 3 dk | Dashboard / Onay Kartı |
| **6. Kapanış & S&C** | Ekibe Sağlanan Somut Fayda & Soru-Cevap | 2 dk | Genel Dashboard |

---

## 2. Sunucu Konuşma Metni (Speaker Script)

### Bölüm 1: Giriş — Problem ve Çözüm (2 Dakika)
*(Ekranda Kanban Panosu açık)*

> *"Arkadaşlar merhaba. Bugün sizlere bir süredir üzerinde çalıştığımız ve proje yönetim anlayışımızı kökten değiştirecek yeni platformumuz **Pulse**'ı tanıtmak istiyorum.*
>
> *Klasik araçları (Jira, Trello gibi) hepimiz biliyoruz. Hepsinin ortak bir zayıflığı var: **Tamamen pasifler.** Bir görev geciktiğinde kimse uyarmazsa gecikir; birisi engellendiğinde toplantıya kadar kimsenin haberi olmaz; sabah standup'ları uzar gider. Proje yöneticisi sürekli insanları kovalamak, takım ise sürekli durum güncellemesi girmek zorunda kalır.*
>
> *Pulse'ı tasarlarken hedefimiz şuydu: **'Pano sadece işleri tutmasın; projenin sağlığını kendisi izleyen bir takım arkadaşı gibi çalışsın.'**"*

---

### Bölüm 2: Kalpteki Güç — 10 Akıllı Ajan (3 Dakika)
*(Ekranda Proje Ayarları -> 'Pulse Asistan Ayarları' açık)*

> *"Pulse'ın arka planında 7/24 çalışan **10 farklı uzman ajan** var. Bu mimarinin en önemli özelliği, her şey için körü körüne LLM çağırmamasıdır. Görevlerini en doğru ve sıfır maliyetli yöntemle çözerler:*
>
> 1. **Koruyucu Ajanlar (Kural Tabanlı & Deterministik):**
>    - **Termin Takipçisi (Agent-001):** Teslim tarihi yaklaşan ve geçen görevleri tarar, kibarca hatırlatır ve yöneticilere bildirir.
>    - **Görev Hijyeni (Agent-002):** Sahipsiz, tarihsiz veya açıklaması eksik görevleri yakalar.
>    - **Engel Yöneticisi (Agent-004):** İlerlemeyen engel zincirlerini uyarır; bir görev bittiğinde bekleyen işin sahibine engelin kalktığını haber verir.
>    - **Kapsam Bekçisi (Agent-009):** Sprint başladıktan sonra eklenen işlerle büyüyen kapsamı tespit edip yöneticileri uyarır.
>
> 2. **İletişim & Özet Ajanları (Yapay Zeka Destekli):**
>    - **Asenkron Standup (Agent-005):** Sabahları ekipten ilerleme bilgilerini toplar; 11:30'da LLM ile özetleyip panoda hap özet yayınlar.
>    - **Haftalık Sprint Karnesi (Agent-006):** Cuma 17:00'de sprint metriklerini derleyip yönetim özeti çıkarır.
>
> 3. **Optimizasyon Ajanları (Yapay Zeka Karar Desteği):**
>    - **İş Yükü Dengeleyici (Agent-007):** Aşırı yüklenen ve boşta kalan ekip üyelerini tespit eder; iş aktarımı önerir.
>    - **Sprint Asistanı (Agent-008):** Sprint taşma riskini önceden uyarır ve kapanışta retrospektif taslağını otomatik hazırlar.
>
> ⚠️ **En Kritik Güvencemiz (İnsan Kontrolü):**
> *Yapay zeka hiçbir zaman kafasına göre karar alıp bir işin sahibini veya durumunu değiştirmez. Her zaman analizini yapar, bir **Öneri Kartı (AgentProposal)** sunar ve kararı proje yöneticisine bırakır."*

---

### Bölüm 3: Canlı Gösterim (Live Walkthrough) (6 Dakika)

#### 🔹 Gösterim 1: Proje Hafızası (Semantic Search — Benzer Görevler)
1. Panodan herhangi bir göreve tıklayın (Sağdan görev detay paneli açılır).
2. Alt kısımdaki **"Benzer Görevler"** alanını gösterin.
3. **Ne Söyleyeceksiniz?**  
   > *"Geçmişte benzer bir sorun çözülmüş müydü? Başka bir projede buna benzer ne yapılmıştı? Pulse, PostgreSQL vektör hafızasını kullanır. Kelime araması yerine konunun anlamına bakar ve geçmişte benzer işleri anında karşınıza çıkarır."*

#### 🔹 Gösterim 2: Zaman Makinesi ve Ajanların Uyanışı
1. Üst menüdeki **Saat simgesine** tıklayın.
2. Preset butonlarından **`🎯 Yarın 09:00 (Agent Saati)`** veya **`+1 Gün`** butonuna basın. *(Ajanlar günlük taramalarını 09:00'da yaptığı için bu buton taramayı tetikler).*
3. İsterseniz hemen popover içindeki **`⚡ Ajanları Şimdi Tetikle`** butonuna basın.
4. Sağ üstteki **Bildirim Çanı**'na tıklayın.
5. **Ne Söyleyeceksiniz?**  
   > *"Ajanların nasıl çalıştığını canlı test etmek için zaman makinesini kullanıyoruz. Saati yarın sabah 09:00'a sardığımızda Slot Replay mekanizması devreye girdi: Termin takipçisi yaklaşan işler için bildirim oluşturdu, standup taraması açıldı ve geciken işler panoya yansıdı."*

#### 🔹 Gösterim 3: İnsan Onaylı İş Yükü Önerisi (Agent Proposal)
1. Dashboard ekranına gelin.
2. Ekranda bekleyen **Yapay Zeka Öneri Kartı**'nı (`AgentProposalCard`) gösterin (*"Ahmet aşırı yüklendi, Görev X'in Mehmet'e devredilmesi öneriliyor"*).
3. **Onayla (Approve)** butonuna tıklayın.
4. Görevin atamasının anında güncellendiğini gösterin.
5. **Ne Söyleyeceksiniz?**  
   > *"Sistem aşırı yükü gördü, öneriyi sundu. Biz onaylayana kadar hiçbir veriyi değiştirmedi. Onayladığımız anda atama yapıldı ve denge sağlandı."*

---

### Bölüm 4: Kapanış ve Değer Özeti (2 Dakika)

> *"Özetle Pulse bize ne kazandırıyor?*
> - *Her gün tekrarlanan manuel takip ve durum sorgulama yükünü ortadan kaldırıyor.*
> - *Engelleri ve gecikmeleri son gün değil, oluştuğu ilk saatte fark etmemizi sağlıyor.*
> - *İş yükünü takım içinde şeffaf ve dengeli paylaştırıyor.*
> - *Tüm bunları yaparken kontrolü yapay zekaya bırakmıyor, onu dijital bir yardımcı olarak kullanıyoruz."*

---

## 3. Sunum Öncesi Birebir Canlı Test Rehberi

Sunumdan önce her şeyin çalıştığını kendi başınıza test etmek için şu adımları uygulayın:

### Adım 1: Oturum Açma
- **URL:** [http://localhost:3000](http://localhost:3000)
- **E-posta:** `admin@pulse.local`
- **Şifre:** `password123`

### Adım 2: Ajan Ayarlarını Kontrol Edin
- Bir projenin **Ayarlar -> Pulse Asistanı** sekmesine gidin.
- 9 ajanın da aktif ve yapılandırılmış olduğunu görün.

### Adım 3: Birebir Test Senaryoları
1. **Benzer Görevler Testi:** Herhangi bir göreve tıklayın; sağ panelde "Benzer Görevler" listesinin benzer işleri getirdiğini görün.
2. **Saat İleri Alma Testi:** Üst bardaki saat popover'ını açın. `🎯 Yarın 09:00 (Agent Saati)` butonuna basın. Ardından `⚡ Ajanları Şimdi Tetikle` butonuna basarak anında çalıştırın.
3. **Bildirim Kontrolü:** Sağ üstteki bildirim çanında yeni oluşturulan sistem bildirimlerini görüntüleyin.
4. **Engel Çözülme Testi:** Görev A'yı Görev B'ye `BLOCKS` (Engelliyor) olarak bağlayın. Görev A'yı `DONE` yapın. Görev B'nin sahibine engelin kalktığına dair bildirim gittiğini görün. *(Kendi yaptığınız işlem için kendinize bildirim gitmez; Görev B'nin sahibi başka bir üye olmalıdır).*
