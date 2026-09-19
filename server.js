// ZUNTU DATA — backend server
// Handles: wallet funding via Paystack, real data/airtime purchase via VTpass.
//
// SETUP:
//   1. npm install
//   2. Copy .env.example to .env and fill in your real keys
//   3. npm start
//
// IMPORTANT: This is a starter template, not a production-ready system.
// Before going live you MUST add:
//   - real user accounts + authentication (this demo keys everything off an email string)
//   - Paystack webhook verification (don't only trust the client-side "verify" call)
//   - HTTPS, rate limiting, input validation, logging
//   - Confirm VTpass's current auth headers & endpoint paths against their live docs,
//     since providers occasionally change these: https://www.vtpass.com/documentation/

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 4000;

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const VTPASS_API_KEY = process.env.VTPASS_API_KEY;
const VTPASS_SECRET_KEY = process.env.VTPASS_SECRET_KEY;
const VTPASS_BASE_URL = process.env.VTPASS_BASE_URL || 'https://sandbox.vtpass.com/api'; // switch to https://vtpass.com/api when live

// ---------- tiny JSON "database" (replace with real DB in production) ----------
const DB_PATH = path.join(__dirname, 'db.json');
function readDB() {
  if (!fs.existsSync(DB_PATH)) return { wallets: {} };
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}
function getWallet(email) {
  const db = readDB();
  if (!db.wallets[email]) db.wallets[email] = { balance: 0, tx: [] };
  writeDB(db);
  return db.wallets[email];
}
function updateWallet(email, mutateFn) {
  const db = readDB();
  if (!db.wallets[email]) db.wallets[email] = { balance: 0, tx: [] };
  mutateFn(db.wallets[email]);
  writeDB(db);
  return db.wallets[email];
}

// ---------- wallet ----------
app.get('/api/wallet/:email', (req, res) => {
  res.json(getWallet(req.params.email));
});

// Step 1: start a Paystack payment to fund the wallet
app.post('/api/wallet/fund/initialize', async (req, res) => {
  const { email, amount } = req.body; // amount in Naira
  if (!email || !amount) return res.status(400).json({ error: 'email da amount ana bukatarsu' });
  try {
    const resp = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: Math.round(amount * 100), // Paystack expects kobo
        callback_url: req.body.callback_url,
      },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );
    res.json(resp.data.data); // { authorization_url, access_code, reference }
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || 'Paystack init ya kasa' });
  }
});

// Step 2: verify payment and credit wallet
app.get('/api/wallet/fund/verify/:reference', async (req, res) => {
  const { reference } = req.params;
  const { email } = req.query;
  try {
    const resp = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );
    const data = resp.data.data;
    if (data.status === 'success') {
      const nairaAmount = data.amount / 100;
      const wallet = updateWallet(email, (w) => {
        w.balance += nairaAmount;
        w.tx.unshift({ label: 'Caje walat (Paystack)', sub: reference, amt: -nairaAmount, time: new Date().toISOString() });
      });
      return res.json({ success: true, wallet });
    }
    res.json({ success: false, status: data.status });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || 'Ba a iya tabbatar da biyan kuɗi ba' });
  }
});

// ---------- VTU: data plans lookup ----------
// networkId examples per VTpass serviceID convention: mtn-data, glo-data, airtel-data, etesalat-data (9mobile)
app.get('/api/vtu/plans/:serviceID', async (req, res) => {
  try {
    const resp = await axios.get(`${VTPASS_BASE_URL}/service-variations`, {
      params: { serviceID: req.params.serviceID },
      headers: { 'api-key': VTPASS_API_KEY, 'secret-key': VTPASS_SECRET_KEY },
    });
    res.json(resp.data);
  } catch (err) {
    res.status(500).json({ error: err.response?.data || 'Ba a samo shirye-shiryen data ba' });
  }
});

// ---------- VTU: buy data ----------
app.post('/api/vtu/data', async (req, res) => {
  const { email, serviceID, variation_code, phone, amount } = req.body;
  const wallet = getWallet(email);
  if (wallet.balance < amount) return res.status(400).json({ error: 'Ba isashen kuɗi a walat ba' });

  try {
    const request_id = `zuntu_${Date.now()}`;
    const resp = await axios.post(
      `${VTPASS_BASE_URL}/pay`,
      { request_id, serviceID, billersCode: phone, variation_code, phone, amount },
      { headers: { 'api-key': VTPASS_API_KEY, 'secret-key': VTPASS_SECRET_KEY } }
    );
    if (resp.data.code === '000') {
      updateWallet(email, (w) => {
        w.balance -= amount;
        w.tx.unshift({ label: `Data — ${serviceID}`, sub: phone, amt: amount, time: new Date().toISOString() });
      });
      return res.json({ success: true, result: resp.data });
    }
    res.status(400).json({ success: false, result: resp.data });
  } catch (err) {
    res.status(500).json({ error: err.response?.data || 'Sayan data ya kasa' });
  }
});

// ---------- VTU: buy airtime ----------
app.post('/api/vtu/airtime', async (req, res) => {
  const { email, serviceID, phone, amount } = req.body; // serviceID: mtn, glo, airtel, etisalat
  const wallet = getWallet(email);
  if (wallet.balance < amount) return res.status(400).json({ error: 'Ba isashen kuɗi a walat ba' });

  try {
    const request_id = `zuntu_${Date.now()}`;
    const resp = await axios.post(
      `${VTPASS_BASE_URL}/pay`,
      { request_id, serviceID, phone, amount },
      { headers: { 'api-key': VTPASS_API_KEY, 'secret-key': VTPASS_SECRET_KEY } }
    );
    if (resp.data.code === '000') {
      updateWallet(email, (w) => {
        w.balance -= amount;
        w.tx.unshift({ label: `Airtime — ${serviceID}`, sub: phone, amt: amount, time: new Date().toISOString() });
      });
      return res.json({ success: true, result: resp.data });
    }
    res.status(400).json({ success: false, result: resp.data });
  } catch (err) {
    res.status(500).json({ error: err.response?.data || 'Cajin airtime ya kasa' });
  }
});

app.listen(PORT, () => console.log(`ZUNTU DATA backend yana gudana akan port ${PORT}`));
