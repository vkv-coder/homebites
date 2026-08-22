// Shared Supabase + notification config, loaded by every page before its own script.

// Reuses the existing "Dhobi-digital" Supabase project (also used by Dasaram Ganthiya) —
// HomeBites' tables/functions are all hb_-prefixed to stay cleanly separated from Dasaram's
// ag_-prefixed ones in the same project.
const SUPABASE_URL = 'https://jqqnnkzozjskziaizajg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcW5ua3pvempza3ppYWl6YWpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5Mjk1ODAsImV4cCI6MjA4ODUwNTU4MH0.sEYeWnm0dvuw8bLSVnQhqmgV8LB-pELjpuVIa3Us1Gg';

// Reuses the "Annapurna" Apps Script Telegram relay (originally built for Dasaram Ganthiya,
// same owner) rather than standing up a separate HomeBites bot — every message already says
// which app it's from, so a shared alert chat is unambiguous. Fixed 2026-08-19 to return
// HtmlService instead of ContentService, which was causing every notification to double-send.
const GAS_RELAY_URL = 'https://script.google.com/macros/s/AKfycbwNAxiSandIkgt4N6Df9eGzsaHsaIQHshvapiLdMpEsdtBX83jjAo5nCLLWMU4OqmMy/exec';

const SUPPORT_EMAIL = 'vkvcoder.support@gmail.com';
const APP_DISPLAY_NAME = 'HomeBites';

// Persists the logged-in session (supplier) in localStorage.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fire-and-forget Telegram notification via the Google Apps Script relay.
// Uses text/plain to avoid a CORS preflight that most Apps Script deployments don't handle.
async function notifyTelegram(message) {
  if (!GAS_RELAY_URL) return;
  try {
    await fetch(GAS_RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ message })
    });
  } catch (err) {
    console.error('Telegram relay notification failed:', err);
  }
}

// Fire-and-forget email via the same Apps Script relay (type: "email" branch, added
// 2026-08-19). Sends as whichever address the relay's Google account resolves to —
// see notifyTelegram() above for the shared-relay rationale.
async function notifyEmail(to, subject, body) {
  if (!GAS_RELAY_URL) return;
  try {
    await fetch(GAS_RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ type: 'email', to, subject, body, fromName: APP_DISPLAY_NAME })
    });
  } catch (err) {
    console.error('Email relay notification failed:', err);
  }
}

// Builds the plain-text bill used for the customer's self-tap "Get Bill on WhatsApp" link.
function buildBillText(supplierName, items, totalAmount, paymentMethod) {
  const lines = [];
  lines.push('*' + supplierName + '*');
  lines.push('--------------------');
  items.forEach((item) => {
    lines.push(item.item_name + ' x' + item.qty + ' - ₹' + (item.price * item.qty));
  });
  lines.push('--------------------');
  lines.push('Total: ₹' + totalAmount);
  if (paymentMethod) {
    lines.push('Payment: ' + paymentMethod.toUpperCase());
  }
  lines.push('Thank you for your order!');
  return lines.join('\n');
}

// Normalizes an Indian mobile number to the 91XXXXXXXXXX format wa.me expects.
function toWhatsAppNumber(mobile) {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) return '91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

// Normalizes any phone input down to bare digits — used as the customers.phone lookup key.
function normalizePhone(mobile) {
  return (mobile || '').replace(/\D/g, '');
}

// Builds a upi://pay deep link — same mechanism as Dasaram, parameterized per-supplier
// instead of a hardcoded constant, since each supplier has their own UPI VPA.
function buildUpiLink(vpa, payeeName, amount, note) {
  return 'upi://pay?pa=' + encodeURIComponent(vpa) +
    '&pn=' + encodeURIComponent(payeeName) +
    '&am=' + encodeURIComponent(amount) +
    '&tn=' + encodeURIComponent(note || 'Order') +
    '&cu=INR';
}

// Classifies a menu item's free-text tag (e.g. "Veg", "Non-Veg", "Spicy") into a badge
// color: green-dot for veg, brown-dot for non-veg, plain for anything else. Suppliers type
// tags freely (no fixed veg/non-veg field), so this is a best-effort text match.
function tagBadgeClass(tag) {
  const t = (tag || '').toLowerCase();
  if (/non[\s-]?veg/.test(t)) return 'item-tag-badge tag-nonveg';
  if (/\bveg\b/.test(t)) return 'item-tag-badge';
  return 'item-tag-badge';
}

// Parses a supplier's select-type order-option choices string, where a choice may
// optionally carry a price after a pipe, e.g. "Pickup|0,Delivery|20" ->
// [{label:'Pickup', price:0}, {label:'Delivery', price:20}]. Choices without a "|" are
// treated as free (price 0).
function parseOptionChoices(choicesStr) {
  return (choicesStr || '').split(',').map((c) => c.trim()).filter(Boolean).map((c) => {
    const parts = c.split('|');
    const label = parts[0].trim();
    const price = parts.length > 1 ? Number(parts[1]) : 0;
    return { label: label, price: isNaN(price) ? 0 : price };
  });
}

// Turns a business name into a URL-safe slug for the shareable order link.
function slugify(str) {
  return (str || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
}

// Registers the PWA service worker (no-op if unsupported).
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
    });
  }
}
