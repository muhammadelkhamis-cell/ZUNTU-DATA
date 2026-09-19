# ZUNTU DATA — backend + frontend

Cikakken tsari na sayar da data da airtime, mai haɗi da:
- **Paystack** — cajin walat da kuɗin gaske
- **VTpass** — sayar da data/airtime na gaske ga MTN, Glo, Airtel, 9mobile

## Yadda ake gudanarwa a gida

1. `npm install`
2. Kwafi `.env.example` zuwa `.env`, sannan ka cika makullan API na gaske naka:
   - `PAYSTACK_SECRET_KEY` daga dashboard.paystack.com
   - `VTPASS_API_KEY` / `VTPASS_SECRET_KEY` daga vtpass.com (bayan ka yi rajista ka kuma caje walat ɗinka na VTpass)
3. `npm start` — sabar za ta gudana akan `http://localhost:4000`
4. Buɗe `http://localhost:4000` a burauzarka

## Muhimman abubuwa kafin ka fara amfani da kuɗin gaske

- **Bincika VTpass docs na yanzu** (vtpass.com/documentation) kafin ka tafi live — hanyoyin auth da endpoints na iya canzawa.
- Wannan template na demo ne: yana amfani da fayil ɗin `db.json` maimakon ainihin database, kuma babu real login/authentication — kowa da imel zai iya amfani da wannan wallet. Kafin ka kai wannan ga jama'a, ka ƙara:
  - Ingantaccen tsarin shiga (login/signup, password ko OTP)
  - Paystack **webhook** don tabbatar da biyan kuɗi (kada ka dogara ga verify daga client kaɗai)
  - Real database (Postgres, MongoDB, da sauransu)
  - HTTPS da rate limiting
- Don ka je "live" (ba sandbox ba), canza `VTPASS_BASE_URL` zuwa `https://vtpass.com/api` kuma yi amfani da live Paystack secret key (`sk_live_...`).
- Sanya wannan backend akan sabis kamar Render, Railway, ko VPS naka — ba za a iya sanya shi a matsayin Claude artifact ba domin yana buƙatar sirrin API keys wanda ba za a iya adanawa lafiya a client-side ba.

## Fayiloli

- `server.js` — Express backend, dukkan hanyoyin API
- `public/index.html` — frontend da ke magana da backend
- `.env.example` — jerin makullan da ake buƙata
