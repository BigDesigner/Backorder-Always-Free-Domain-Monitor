# Uygulama Planı — Backorder Always-Free Domain Monitor (Tek Oturum)

> Analiz: 2026-07-12 · Claude (Fable 5) · Uygulayıcı: Sonnet
>
> **TALİMAT:** Bu plandaki TÜM adımları sırayla, tek oturumda, aradan onay beklemeden uygula.
> Tüm tasarım kararları verilmiştir — soru sorma, alternatif önerme, kapsam genişletme.
> Her adım dosya bazında gruplandı; bir dosyayı bitirmeden diğerine geçme.
> Sonda "Doğrulama" bölümünü çalıştır, hepsi geçince tek commit at.
>
> Not: `worker` ve `frontend` typecheck şu an temiz; sorunların tamamı mantık/güvenlik/konfigürasyon seviyesindedir. `.tr` ile ilgili tüm tespitler 2026-07-12'de canlı WHOIS testleriyle doğrulanmıştır (en alttaki referans bloğuna bak).

---

## ADIM 1 — `worker/src/rdap.ts` (kritik: yanlış "available" bildirimleri)

### 1a. RDAP fallback listesini düzelt (K1)
`RDAP_PROVIDERS` (satır 19-25) listesindeki sunucuların çoğu domain RDAP'ı sunmaz: `rdap.db.ripe.net` ve `rdap.apnic.net` IP-adresi (RIR) sunucularıdır ve her domain sorgusuna 404 döner; `rdap.nic.google` sadece Google TLD'lerini, `rdap.iana.org` sadece TLD kayıtlarını bilir. Kod 404'ü "available" saydığı için kayıtlı domainler yanlışlıkla "müsait" bildiriliyor.

**Yap:**
- `RDAP_PROVIDERS` dizisini kaldır; fallback olarak **yalnızca** `https://rdap.org/domain/` (IANA bootstrap redirector) kullan. Rastgele sağlayıcı seçimini (`Math.random`) tamamen sil.
- `checkDomain` içinde 404 işleme mantığını değiştir: 404 geldiğinde doğrudan "available" dönme; önce `checkDomainWhois(domain)` çalıştır. WHOIS de "available" derse `available` döndür; WHOIS "registered" derse WHOIS sonucunu döndür; WHOIS hata verirse RDAP 404'üne güvenip `available` döndür (rdap.org otoritatif kaynaklara yönlendirdiği için 404 + WHOIS hatası durumunda en makul sonuç budur). Bu mutabakat kontrolü yalnızca 404 dalı için geçerli; 2xx `registered` dalına dokunma.

### 1b. `.tr` desteğini onar (K2 — canlı testle doğrulandı)
Üç bağımsız hata:
1. `TLD_SPECIFIC_PROVIDERS`'taki (satır 46) `"tr": "https://rdap.iana.org/domain/"` girdisi hatalı — IANA RDAP ikinci seviye .tr sorgularına 404 döner. **Bu girdiyi sil.**
2. `WHOIS_SERVERS`'taki (satır 60) `"tr": "whois.nic.tr"` girdisi ölü — **`whois.nic.tr` DNS'te artık yok (NXDOMAIN)**; .tr registry'si BTK/TRABİS'e devredildi. **`"tr": "whois.trabis.gov.tr"` olarak değiştir** (IANA resmî kaydı, status ACTIVE; canlı testte `google.com.tr` için tam kayıt döndü).
3. `checkDomain`'e erken dal ekle: RDAP'ı olmayan TLD'ler için RDAP'ı hiç denemeden doğrudan WHOIS'e git. Dosya seviyesinde `const WHOIS_ONLY_TLDS = new Set(["tr"]);` tanımla; `checkDomain`'de TLD bu set'teyse (ve `env.RDAP_BASE` override yoksa) `return checkDomainWhois(domain)`.

### 1c. WHOIS availability parser'ını sıkılaştır (O2 + K2c)
`parseWhoisAvailability` (satır 125-144) iki yönde hatalı:
- `"available"` gibi genel kelimeler birçok WHOIS çıktısının disclaimer metninde geçer → kayıtlı domain "available" sayılabilir.
- TRABİS'in gerçek yanıtı `No match found for <domain>` mevcut kalıpların **hiçbirine** uymuyor (`"no match for"` ve `"not found"` bu metnin substring'i değil) → müsait .tr domainleri "registered" görünürdü.

**Yap:** Substring listesini satır bazlı regex'lerle değiştir; yalnızca şu kalıplar "available" saysın (multiline, case-insensitive):
```ts
const AVAILABLE_PATTERNS: RegExp[] = [
  /^no match found for/im,        // TRABİS (.tr) — canlı doğrulandı
  /^no match for/im,              // Verisign (.com/.net)
  /^not found/im,
  /^%+\s*no entries found/im,     // DENIC vb.
  /^no data found/im,
  /^domain not found/im,
  /^no object found/im,
  /^status:\s*(free|available)$/im,
  /^%\s*not registered/im,
];
```
Genel `"available"`, `"is free"`, `"not registered"` (satır başı olmayan) substring kalıplarını kaldır. Eşleşme yoksa `registered` (mevcut default) kalsın.

### 1d. WHOIS timeout timer sızıntısı (O7)
`queryWhoisTcp` (satır 81-83): `setTimeout` id'si tutulmuyor, başarıda temizlenmiyor. **Yap:** timer id'sini değişkende tut, `finally` bloğunda `clearTimeout` çağır.

---

## ADIM 2 — `worker/src/index.ts` (güvenlik + endpoint davranışı)

### 2a. CORS `*.pages.dev` wildcard'ını kaldır (K3 — güvenlik açığı)
Satır 16'daki `host.endsWith(".pages.dev")` herhangi bir Cloudflare Pages kullanıcısına (evil.pages.dev) credentialed CORS izni verir; `SameSite=None` çerez + `allowHeaders`'ta izinli `X-Requested-With` ile CSRF koruması da aşılır → giriş yapmış kullanıcı adına tüm API (factory reset dahil) çağrılabilir.

**Yap:** Wildcard'ı projenin kendi Pages projesiyle sınırla:
```ts
if (
  host === "gnn.tr" ||
  host.endsWith(".gnn.tr") ||
  host === "backorder-frontend.pages.dev" ||
  host.endsWith(".backorder-frontend.pages.dev") || // Pages preview deploy'ları
  host === "localhost" ||
  host === "127.0.0.1"
) { return origin; }
```
(`backorder-frontend` adı `.github/workflows/deploy-frontend.yml`'deki `--project-name` ile aynı.)

### 2b. CORS callback'ini exception'a karşı koru (K4)
Satır 13: Origin `null` veya bozuk gelirse `new URL(origin)` throw eder → istek 500 döner. **Yap:** callback gövdesini `try/catch` içine al, hata durumunda `null` döndür.

### 2c. Etkisiz `exposeHeaders`'ı sil (D1)
Satır 24: `exposeHeaders: ["Set-Cookie"]` — tarayıcılar Set-Cookie'yi JS'e asla açmaz. **Yap:** satırı kaldır.

### 2d. `runScheduler`'ı istekten ayır (Y4)
Scheduler bir turda 20 domain'e kadar kontrol eder (aralarda 1.2 s bekleme + 0.1–1.5 s jitter + 5 s WHOIS timeout'ları) → istek dakikalarca bloklanabilir. **Yap:**
- Satır 127 (POST /api/domains): `await runScheduler(c.env);` → `c.executionCtx.waitUntil(runScheduler(c.env));`
- Satır 171 (PATCH forceCheck): aynı değişiklik.
- Bulk endpoint (satır 253) zaten doğru — dokunma.

### 2e. Bulk import `intervalMin` clamp (O1)
Satır 216: `const intervalMin = body?.intervalMin || 60;` sınırsız. **Yap:** tekli eklemeyle aynı clamp: `const intervalMin = Math.max(30, Math.min(24*60, Math.floor(body?.intervalMin ?? 60)));`

### 2f. `ensureAdmin` çağrılarını azalt (D3)
Her endpoint (auth gerektirmeyen `/api/health` dahil) `ensureAdmin` çağırıyor → istek başına 2+ gereksiz DB sorgusu. **Yap:** `ensureAdmin` çağrısını yalnızca şu iki yerde bırak: `POST /api/login` ve `scheduled` handler. Diğer tüm endpoint'lerden `await ensureAdmin(c.env);` satırlarını sil. (Bootstrap ve şifre rotasyonu tespiti için login + cron yeterlidir; `requireAuth` admin kaydına değil sessions tablosuna bakar, etkilenmez.)

### 2g. Çerez kararı (O6 — karar verildi, uygula)
`SameSite=None` **korunacak** (Pages/pages.dev senaryosu çalışmaya devam etsin diye); güvenlik 2a'daki CORS daraltmasıyla sağlanıyor. Kod değişikliği yok — yalnızca ADIM 6'daki README notunu ekle.

---

## ADIM 3 — `worker/src/scheduler.ts`

### 3a. `retry-after` header'ını backoff'a dahil et (D6)
Satır 90-100: 429'da `retryAfterSec` okunuyor ama kullanılmıyor. **Yap:** rate-limited dalında `const delay = Math.max([hours(6), hours(12), hours(24), hours(24)][step - 1], res.retryAfterSec ?? 0);`

---

## ADIM 4 — `worker/wrangler.toml`

### 4a. `workers_dev` (D2)
Satır 4: `workers_dev = true` — API custom domain'e ek olarak `*.workers.dev`'de de açık. **Yap:** `true` bırak ama üstüne açıklayıcı yorum ekle: `# İlk kurulum için true; custom domain (api.*) bağladıktan sonra false yapmanız önerilir.` (Kullanıcının canlı kurulumunu bozmamak için değeri değiştirme.)

---

## ADIM 5 — Frontend

### 5a. `VITE_API_BASE`'i gerçekten kullan (Y1)
`frontend/src/lib/api.ts:1` hardcoded; README, `.env.production` ve CI workflow'un set ettiği env değişkeninin hiçbir etkisi yok. **Yap:**
```ts
export const API_BASE = import.meta.env.VITE_API_BASE || "https://api.gnn.tr";
```
ve `frontend/src/vite-env.d.ts` oluştur:
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

### 5b. `base` yolunu yapılandırılabilir yap (Y2)
`frontend/vite.config.ts:7` `base: "/backorder/"` sabit — Cloudflare Pages ve cPanel kök deploy'larında tüm asset yolları kırılır; ama kullanıcının mevcut canlı kurulumu `gnn.tr/backorder` altında olabilir, o yüzden davranışı koruyarak yapılandırılabilir yap. **Yap:**
```ts
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss()],
    base: env.VITE_BASE_PATH || "/",
  };
});
```
(`loadEnv`'i `vite`'tan import et.) Ardından `frontend/.env.production` dosyasına `VITE_BASE_PATH=/backorder/` satırını ekle — böylece kullanıcının mevcut kurulumu aynen çalışmaya devam eder, fork'layanlar için default `/` olur. `ImportMetaEnv`'e `readonly VITE_BASE_PATH?: string;` da ekle.

### 5c. Duplicate "Add Domain" modalını sil (Y3)
`frontend/src/App.tsx`'te aynı `addOpen` state'ine bağlı **iki** modal var: satır 268-372 (`<main>` içinde) ve satır 649-753 (`<main>` dışında). İkisi birden render oluyor. **Yap:** `<main>` İÇİNDEKİ kopyayı (268-372) tamamen sil; dıştaki (649-753) kalsın. Silinen kopyadaki daha iyi label metinleri varsa ("one per line" vb. farklar minimal) dıştakini olduğu gibi bırakmak yeterli.

### 5d. 5 dakikalık tam sayfa reload'u kaldır (O4)
`App.tsx:31-37`: `window.location.reload()` interval'i — 30 sn'lik `refreshAll` polling'i zaten varken gereksiz, açık modal/form state'ini siliyor. **Yap:** bu `useEffect` bloğunu tamamen sil.

### 5e. Geçici hatada oturum düşürmeyi durdur (O5)
`App.tsx:67-70`: `refreshAll` her hatada `setAuthed(false)` yapıyor → geçici ağ hatası kullanıcıyı login ekranına atıyor. **Yap:**
1. `api.ts` `req()` fonksiyonunda hata fırlatırken status'u taşı: `const err = new Error(msg) as Error & { status?: number }; err.status = r.status; throw err;`
2. `refreshAll`'daki catch'te: `if ((err as any)?.status === 401) setAuthed(false); else console.error("Refresh failed", err);`

### 5f. `api.login` dönüş tipini düzelt (O3)
`api.ts:47`: tip `{ok:boolean;token:string}` ama backend token döndürmüyor (SEC-01). **Yap:** `{ok:boolean}` yap.

### 5g. Çakışan Tailwind sınıfı (D7)
`App.tsx` label'larında `text-sm` ve `text-xs` birlikte kullanılan yerler var (örn. eski satır 287, 5c'de silinen blokta olabilir — kalan kodda ara). **Yap:** `className` içinde hem `text-sm` hem `text-xs` geçen label'lardan `text-sm`'i kaldır.

---

## ADIM 6 — `README.md`

1. **(O6)** "Architecture Overview" bölümüne uyarı ekle: gizlilik odaklı tarayıcılar (Safari ITP, Firefox strict ETP) üçüncü-taraf çerezleri engellediğinden, frontend'in API ile **aynı site** altında barındırılması önerilir (örn. `app.gnn.tr` + `api.gnn.tr`); frontend `*.pages.dev` üzerindeyken bu tarayıcılarda login çalışmayabilir.
2. **(K2)** ".tr Specialist" satırını gerçeğe uygun güncelle: .tr kontrolleri RDAP değil, resmî TRABİS WHOIS sunucusu (`whois.trabis.gov.tr`) üzerinden yapılır.
3. **(D8)** "Customization" tablosundaki "Line 16" / "Line 68" gibi satır numarası referanslarını satır numarasız tarife çevir (örn. "CORS allowlist'indeki hostname'leri güncelleyin").
4. **(5b)** Option B (cPanel) adımlarına not ekle: alt dizinde barındırıyorsanız `.env.production`'da `VITE_BASE_PATH=/altdizin/` ayarlayın; kökte barındırıyorsanız bu satırı silin.

---

## ADIM 7 — Doğrulama (hepsi geçmeden commit atma)

```bash
cd worker && npx tsc --noEmit && npx eslint .
cd ../frontend && npm run build
```

Kod içi kontroller:
- `rdap.ts`'te `Math.random` ve `rdap.db.ripe.net` / `rdap.apnic.net` / `rdap.nic.google` referansları kalmamış olmalı.
- `rdap.ts`'te `whois.nic.tr` geçmemeli; `whois.trabis.gov.tr` ve `/^no match found for/im` bulunmalı.
- `index.ts`'te `.pages.dev` genel wildcard'ı kalmamalı; `runScheduler` yalnızca `waitUntil` içinde (ve `scheduled` handler'da) çağrılmalı.
- `App.tsx`'te "Add Domain" modalı tek olmalı; `window.location.reload` interval'i kalmamalı.
- `api.ts` `import.meta.env.VITE_API_BASE` okumalı.

Tümü geçince **tek commit** at:
```
fix: correct RDAP/WHOIS providers (.tr via TRABIS), close CORS wildcard, unblock scheduler, use VITE_API_BASE, dedupe add-domain modal
```

### Deploy sonrası manuel doğrulama (kullanıcı için not)
- Kayıtlı gTLD (`google.com`) → `registered`; kayıtlı .tr (`google.com.tr`) → `registered`; gerçekten boş bir domain → `available` (forceCheck ile).
- **.tr özel:** Event log'da `WHOIS fallback failed` görülürse TRABİS, Cloudflare Workers IP'lerini engelliyor demektir — bu durumda .tr için ek çözüm gerekir; sistem asla sessizce "available" raporlamamalı. (Aşağıdaki canlı testler kullanıcı makinesinden yapıldı; Workers çıkışı ayrıca doğrulanmalı.)
- CORS: `curl -H "Origin: https://evil.pages.dev" -i https://api.gnn.tr/api/health` → yanıtta `Access-Control-Allow-Origin` header'ı **olmamalı**.

---

## Referans: 2026-07-12 canlı .tr WHOIS test kayıtları

```
DNS whois.nic.tr            → NXDOMAIN ("DNS adı yok")
IANA whois kaydı (tld=tr)   → whois: whois.trabis.gov.tr  (status: ACTIVE, changed: 2026-07-05)
whois.trabis.gov.tr:43  "google.com.tr"
  → ** Domain Name: google.com.tr / Domain Status: Active / Expires on: 2026-Aug-22 (754 bayt)
whois.trabis.gov.tr:43  "<kayıtsız>.com.tr"
  → "No match found for <kayıtsız>.com.tr"  (tek satır)
whois.trabis.gov.tr:43  "<kayıtsız>.tr"  (ikinci seviye)
  → "No match found for <kayıtsız>.tr"
```

## Kapsam dışı (bilinçli olarak yapılmayacak)
- `SameSite=None` → `Lax` geçişi (pages.dev senaryosunu kırar; CORS daraltması riski zaten kapatıyor).
- Login rate-limit'inin ayrı tabloya taşınması (mevcut events-LIKE yaklaşımı kabul edilebilir).
- Scheduler `LIMIT 20` değeri (bilinçli free-tier tasarımı; yalnızca README'de zaten belgelenmiş durumda, dokunma).
