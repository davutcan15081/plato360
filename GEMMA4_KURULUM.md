# Gemma4 Lokal AI (Telefonda Çalışır)

Gemma4, Google'un yeni açık kaynaklı yapay zeka modelidir. Plato360 uygulamasında **hiçbir sunucu kurulumu olmadan doğrudan telefonda çalışır** ve **video düzenleme için optimize edilmiştir**!

## Hızlı Başlangıç

### 1. Ayarları Yapın
1. Plato360 uygulamasını açın
2. Ayarlar sayfasına gidin
3. AI Sağlayıcı olarak "Gemma4" seçin
4. Model seçin:
   - **E2B (2B)** - Daha hızlı, daha az bellek
   - **E4B (4B)** - Daha kaliteli, tavsiye edilen

### 2. Video Yükleyin ve Düzenleyin
- **Akıllı düzenleme** - Video'ya göre efektler seçer
- **Otomatik kurgu** - Zamanlamaları belirler
- **Vibe tespiti** - Enerjetik, sinematik, minimalist, cyberpunk
- **İçerik odaklı** - Video'nun ruhuna göre efektler

### 3. Kullanmaya Başlayın
- **İndirme gerekmez** - Model otomatik yüklenir
- **İnternet gerekmez** - Tamamen yerel çalışır
- **Kurulum gerekmez** - Hazır gelir

## Video Düzenleme Özellikleri

### Akıllı Düzenleme
Gemma4 video içeriğini analiz eder ve en iyi düzenlemeleri önerir:

#### Energetic Videolar İçin:
- Yüksek kontrast ve parlak renkler
- Hızlı kesmeler ve dinamik geçişler
- Neon efektler ve canlı ışıklar

#### Sinematik Videolar İçin:
- Film grain ve sinematik çerçeveler
- Yavaş geçişler ve dramatik tempo
- Doygunluk ve sıcak tonlar

#### Minimalist Videolar İçin:
- Sade ve temiz efektler
- Düşük doyuruluk ve nötral renkler
- Odaklı ve sade geçişler

#### Cyberpunk Videolar İçin:
- Neon ışıklar ve dijital glitch
- Teknolojik ve endüstriyel his
- Dijital estetik

### Zamanlama Hassasiyeti
- **Otomatik segmentasyon** - Videoyu mantıksal olarak böler
- **Akıllı geçişler** - En iyi kesim noktalarını bulur
- **Hassas ayarlar** - Vibe'a uygun hız ve efektler
- **Gerçek zamanlı** - Anında sonuçlar

## Model Seçimi

| Model | Hız | Kalite | Bellek | Tavsiye |
|-------|-----|--------|-------|---------|
| **E2B** | **En Hızlı** | İyi | ~400MB | **Tavsiye** |
| **E4B** | Hızlı | **En İyi** | ~600MB | **En İyi** |

## Teknik Bilgiler

### Nasıl Çalışır?
1. **Tokenizer** - Metni anlamlandırır
2. **Model Yükleme** - ONNX formatında model yükler
3. **İşlem** - WebGPU/WASM ile hesaplama
4. **Üretim** - JSON formatında edit script'i oluşturur

### Performans
- **WebGPU modunda:**
  - Metin üretimi: ~5-10 saniye
  - Bellek kullanımı: ~400MB
  - En hızlı yanıt

- **WASM modunda:**
  - Metin üretimi: ~10-20 saniye (daha yavaş ama stabil)
  - Bellek kullanımı: ~300MB
  - En uyumlu

- **İnternet:** Gerekmez (sadece ilk indirme için)

### Cihaz Uyumluluğu
- **WebGL2** (hemen hemen tüm telefonlarda)
- **WebAssembly (WASM)** - CPU modu için gerekli
- **Web Workers** (JavaScript paralel çalışma)
- **IndexedDB** (model önbelleği)
- **WebGPU** (en iyi performans, opsiyonel)

### Optimal
- **WebGPU + E4B** - En hızlı ve en kaliteli
- **WASM + E2B** - En uyumlu ve stabil
- **3GB+ RAM** (model için)
- **iOS 16+ / Android 10+**

## Avantajları

### Video Düzenleme
- **İçerik odaklı** - Video'nun ruhuna göre düzenleme
- **Zamanlama hassasiyeti** - Sahne geçişlerini otomatik belirler
- **Efekt uyumu** - Vibe'a uygun filtreler ve çerçeveler
- **Akıllı analiz** - Anında sonuçlar

### Performans
- **Anında yanıt** - Sunucu gecikmesi yok
- **Çevrimdışı çalışır** - İnternet kesildiğinde de çalışır
- **Yerel önbellek** - Bir kez analiz et, hep kullan

### Gizlilik
- **Veriler telefonda kalır** - Analizler yerel yapılır
- **Tamamen özel** - Google cloud'a bağlı değil
- **Reklam yok** - Veri toplanmıyor

### Maliyet
- **Tamamen ücretsiz** - Analiz için ücret yok
- **Sınırsız kullanım** - Kotası yok
- **Abonelik yok** - Tek seferlik kurulum

## Sorun Giderme

### "Model yüklenemedi"
- Transformers.js kütüphanesi yüklenemedi
- Tarayıcı WASM desteklemiyor olabilir
- Sayfayı yenileyin ve tekrar deneyin
- Chrome veya Firefox kullanın

### "ONNX kernel hatası"
- **Normal durum** - Fallback mekanizması çalışır
- **Otomatik düzeltme** - Basit düzenleme dönerir
- **Alternatif** - E2B modelini kullanın
- **WASM modu** - Daha uyumlu

### "Yavaş çalışıyor"
- WebGPU desteklenmiyor (WASM modunda çalışır, normaldir)
- Eski telefon -> E2B modelini seçin
- Diğer uygulamaları kapatın
- WASM modu WebGPU'dan daha yavaş ama daha uyumlu

### "Analiz sonucu kötü"
- Video kalitesi düşük mü? Iyi ışıklandırma
- Çok karanlık veya çok parlak sahneler
- Karmaşık içerik -> daha basit videolarla test edin
- **Text-only modda** - Video analizi olmadan çalışır

## İpuçları

### En İyi Sonuçlar İçin
- **Iyi ışıklandırma** - Yeterli ve dengeli ışık
- **Net görüntüler** - Bulanık ve hareketli olmayan
- **Farklı sahneler** - Çeşitli içerik ve ortamlar
- **Uygun uzunluk** - 10-60 saniye ideal

### Mobil Kullanım
- **Arka planda çalışır** - işlem devam eder
- **Ekranı kapatın** - model yüklemeye devam eder
- **Batarya dostu** - optimize edilmiş algoritma
- **Wi-Fi kullanın** - büyük videolar için

### Ayarlar
- **Model seçimi** - E2B daha uyumlu, E4B daha kaliteli
- **Önbellek temizle** - eski analizleri silin
- **Test videolar** - basit videolarla başlayın

---

## Özet

**Gemma4 ile Plato360 artık akıllı video düzenleme sunuyor:**

- **Telefonda AI** - Videoyu analiz eder, en iyi düzenlemeleri önerir
- **İçerik odaklı** - Video'nun ruhuna göre düzenler
- **Tam güvenli** - Videolarınız sizde kalır
- **Anında yanıt** - Sunucu gecikmesi yok
- **Sonsuz ücretsiz** - Hiçbir ücret yok

**Sadece ayarlardan Gemma4 seçin, video yükleyin ve sihrini izleyin!** 

---

**ONNX kernel sorunları için fallback mekanizması ile her zaman çalışır!** 
