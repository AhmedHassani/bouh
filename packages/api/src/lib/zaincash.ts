/**
 * ZainCash Payment Gateway V2 (OAuth2 + REST)
 *
 * Docs: https://docs.zaincash.iq
 *
 * Env vars:
 *   ZAINCASH_MODE          — "uat" or "production"
 *   ZAINCASH_MERCHANT_ID   — client_id
 *   ZAINCASH_MERCHANT_SECRET — client_secret
 *   APP_URL                — public app URL (for redirect)
 */

const ZAINCASH_URLS = {
  uat:        "https://pg-api-uat.zaincash.iq",
  production: "https://pg-api.zaincash.iq",
};

interface InitOptions {
  amount: number;        // in IQD
  orderId: string;       // your unique reference
  serviceType: string;   // description shown to user
  successUrl: string;
  failureUrl: string;
}

interface InitResult {
  paymentUrl: string;
  transactionId: string;
}

function getConfig() {
  const merchantId     = process.env.ZAINCASH_MERCHANT_ID?.trim();
  const merchantSecret = process.env.ZAINCASH_MERCHANT_SECRET?.trim();
  const modeRaw        = process.env.ZAINCASH_MODE?.trim();
  const mode = (modeRaw === "production" ? "production" : "uat") as "uat" | "production";

  if (!merchantId || !merchantSecret) {
    throw new Error("[ZainCash] Missing env vars");
  }

  return { merchantId, merchantSecret, mode, baseUrl: ZAINCASH_URLS[mode] };
}

/**
 * Step 1: Get OAuth2 access token using client credentials.
 */
async function getAccessToken(): Promise<string> {
  const { merchantId, merchantSecret, baseUrl } = getConfig();

  const body = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     merchantId,
    client_secret: merchantSecret,
    scope:         "payment:read payment:write reverse:write",
  });

  const res = await fetch(`${baseUrl}/oauth2/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    body.toString(),
  });

  const data = await res.json() as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(`[ZainCash] OAuth failed: ${data.error_description ?? data.error ?? JSON.stringify(data)}`);
  }
  return data.access_token;
}

/**
 * Step 2: Initialize a payment transaction.
 */
export async function initZainCashPayment(opts: InitOptions): Promise<InitResult> {
  const { baseUrl } = getConfig();

  const token = await getAccessToken();

  const body = {
    language:            "ar",
    externalReferenceId: crypto.randomUUID(),
    orderId:             opts.orderId,
    serviceType:         opts.serviceType,
    amount: {
      value:    String(opts.amount),
      currency: "IQD",
    },
    redirectUrls: {
      successUrl: opts.successUrl,
      failureUrl: opts.failureUrl,
    },
  };

  const res = await fetch(`${baseUrl}/api/v2/payment-gateway/transaction/init`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  console.log("[ZainCash] Init response:", res.status, rawText);

  let data: {
    status?: string;
    transactionDetails?: { transactionId?: string };
    redirectUrl?: string;
    error?: string;
    message?: string;
  };
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`[ZainCash] Non-JSON response: ${rawText.slice(0, 200)}`);
  }

  if (data.status !== "SUCCESS" || !data.transactionDetails || !data.redirectUrl) {
    throw new Error(`[ZainCash] Init failed: ${data.message ?? data.error ?? rawText.slice(0, 200)}`);
  }

  const transactionId = data.transactionDetails.transactionId;
  if (!transactionId) {
    throw new Error(`[ZainCash] No transactionId in response`);
  }

  return { transactionId, paymentUrl: data.redirectUrl };
}

/**
 * Verify the callback when ZainCash redirects user back to your success URL.
 * V2 sends a transaction ID in query — we fetch its status from the API.
 */
export interface VerifyResult {
  success: boolean;
  orderId?: string;
  amount?: number;
  status?: string;
  transactionId?: string;
  message?: string;
}

export async function verifyZainCashTransaction(transactionId: string): Promise<VerifyResult> {
  try {
    const { baseUrl } = getConfig();
    const token = await getAccessToken();

    const res = await fetch(`${baseUrl}/api/v2/payment-gateway/transaction/${transactionId}`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    const data = await res.json() as {
      orderId?: string;
      amount?:  { value?: string };
      status?:  string;
      id?:      string;
      message?: string;
    };

    const status  = data.status?.toLowerCase();
    const success = status === "success" || status === "completed" || status === "paid";

    return {
      success,
      orderId:       data.orderId,
      amount:        data.amount?.value ? Number(data.amount.value) : undefined,
      status:        data.status,
      transactionId: data.id ?? transactionId,
      message:       data.message,
    };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

// Legacy export name kept for backward compat (callback route imports this)
export const verifyZainCashCallback = verifyZainCashTransaction;

/**
 * Verify the JWT-signed callback sent by ZainCash to the redirect URL.
 * Returns parsed transaction data if valid, null otherwise.
 */
export interface CallbackPayload {
  eventType?: string;
  data?: {
    transactionId?: string;
    orderId?:        string;
    currentStatus?:  string;
    previousStatus?: string;
    errorMessage?:   string | null;
    amount?:         { value?: number; currency?: string };
  };
}

export function verifyZainCashCallbackJWT(token: string): CallbackPayload | null {
  const jwt = require("jsonwebtoken") as typeof import("jsonwebtoken");
  const secret = process.env.ZAINCASH_MERCHANT_SECRET?.trim();
  if (!secret) {
    console.error("[ZainCash] Missing ZAINCASH_MERCHANT_SECRET");
    return null;
  }
  try {
    return jwt.verify(token, secret, { algorithms: ["HS256"] }) as CallbackPayload;
  } catch (err) {
    console.error("[ZainCash] JWT verification failed:", (err as Error).message);
    return null;
  }
}
