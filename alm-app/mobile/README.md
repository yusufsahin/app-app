# ALM mobile (Expo)

Web backend ile aynı REST sözleşmesini kullanır (`/api/v1`). Kök `npm install` içinde **yoktur**; Windows’ta `react-native` hoisting sorunlarını önlemek için bağımlılıklar burada kurulur.

## Kurulum

```bash
cd mobile
cp .env.example .env
# .env içinde EXPO_PUBLIC_API_URL = API kökü (örn. http://localhost:8000 veya Android emülatör: http://10.0.2.2:8000)
npm install
npx expo start
```

Repo kökünden: `npm run mobile:install` sonra `npm run mobile:start`.

Typecheck (CI / PR için): `npm run typecheck` veya kökten `npm run mobile:typecheck`.

## Paylaşılan paket

`@alm/manifest-types` → `file:../packages/manifest-types` (manifest + workflow yardımcıları).
