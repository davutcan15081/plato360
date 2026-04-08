Aşağıdaki metin, yaptığımız tüm teknik düzeltmeleri, 60 saniyelik video senaryosunu ve ücretsiz kota risklerini içeren en güncel ve doğru versiyondur. Bu metni kopyalayıp bir not defterine yapıştırarak **.txt** dosyası olarak kaydedebilirsiniz.

---

PLATO360 - AI MALIYET VE KULLANIM ANALIZI (GUNCEL: NISAN 2026)

1. TEMEL PARAMETRELER (GEMINI 2.5 FLASH)
---------------------------------------
* Doviz Kuru: 1 USD = 45 TL (Sabit)
* Video Verisi: ~258 token / saniye
* Ses Verisi: ~32 token / saniye
* Birim Fiyat (1M Token): Girdi (Video) $0.30 | Girdi (Ses) $1.00 | Cikti $2.50

2. SENARYO: DUGUN & ORGANIZASYON (60 SANIYE VIDEO)
--------------------------------------------------
Tek bir 60 saniyelik video islemi icin teknik dokum:
* Girdi (Video+Metin): 15.480 Token ($0.00464)
* Girdi (Ses): 1.920 Token ($0.00192)
* Cikti (AI Yaniti): 1.000 Token ($0.00250)
* ISLEM BASI MALIYET: ~$0.00906 (Yaklasik 0.41 TL)

3. KULLANIM SECENEKLERI VE KOTARLAR
-----------------------------------

SECENEK A: UCRETSIZ (FREE TIER) 🆓
- Gunluk Istek Siniri: 1.500 Adet
- Dakikalik Istek Siniri: 15 Adet (RPM)
- Maliyet: 0 TL
- KRITIK NOT: Gunluk 300 video (60sn) toplamda 5.5 Milyon token eder. Google ucretsiz katmanda bu yogunlukta yavaslatma (throttling) uygulayabilir. Ayrica veriler gizli degildir, Google modellerini egitmek icin kullanabilir.

SECENEK B: TAM GIZLI / UCRETLI (PAY-AS-YOU-GO) 💳
- Gunluk 300 Video Maliyeti: ~$2.72 (122,40 TL)
- Aylik Tahmini Maliyet: ~3.672 TL (Gunde 300 islem sabit kalirsa)
- AVANTAJ: Veriler tamamen gizlidir, asla egitim icin kullanilmaz. Limitler cok daha yuksektir, takilma yapmaz.

SECENEK C: BEDAVA VE YEREL (LOCAL LLM) 💻
- Maliyet: 0 TL (API ucreti yok)
- Altyapi: AnythingLLM / Yerel GPU islemi.
- AVANTAJ: Veriler isletme icindeki bilgisayardan disari cikmaz. Tam gizlilik ve sifir maliyet saglar.

4. OZET TABLO (60 SN VIDEO / GUNDE 300 ADET)
--------------------------------------------
Kullanim Modu   | Gunluk (TL) | Aylik (TL)  | Gizlilik
----------------|-------------|-------------|----------
Ucretsiz (Google)| 0 TL        | 0 TL        | YOK (Egitim)
Ucretli (Google) | ~122.5 TL   | ~3.675 TL   | TAM GIZLI
Yerel (PC/GPU)   | 0 TL        | 0 TL        | TAM GIZLI

---------------------------------------
Dokuman Revize Tarihi: 04.04.2026
Plato360 Proje Yonetimi İçindir.