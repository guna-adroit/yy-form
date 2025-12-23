import { NextResponse } from "next/server";

const SHOP = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

const ALLOWED_ORIGINS = [
  "https://guna-am.myshopify.com",
];

// ---------------------------
// CORS helper
// ---------------------------
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// ---------------------------
// Preflight handler
// ---------------------------
export function OPTIONS(req) {
  const origin = req.headers.get("origin");

  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

// ---------------------------
// POST handler
// ---------------------------
export async function POST(req) {
  const origin = req.headers.get("origin");

  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  try {
    const { code } = await req.json();

    if (!code) {
      return NextResponse.json(
        { error: "Gift card code is required" },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    const normalized = code.replace(/\s+/g, "").toUpperCase();
    const lastFour = normalized.slice(-4);

    const res = await fetch(
      `https://${SHOP}/admin/api/2024-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": TOKEN,
        },
        body: JSON.stringify({
          query: `
            query {
              giftCards(first: 250) {
                edges {
                  node {
                    enabled
                    expiresOn
                    lastCharacters
                    balance {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          `,
        }),
      }
    );

    const json = await res.json();

    const giftCards =
      json.data?.giftCards?.edges?.map(e => e.node) || [];

    const giftCard = giftCards.find(gc =>
      gc.lastCharacters === lastFour &&
      gc.enabled &&
      (!gc.expiresOn || new Date(gc.expiresOn) > new Date())
    );

    if (!giftCard) {
      return NextResponse.json(
        { error: "Invalid or expired gift card" },
        {
          status: 404,
          headers: corsHeaders(origin),
        }
      );
    }

    return NextResponse.json(
      {
        balance: giftCard.balance.amount,
        currency: giftCard.balance.currencyCode,
        expires_on: giftCard.expiresOn,
      },
      {
        status: 200,
        headers: corsHeaders(origin),
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Server error" },
      {
        status: 500,
        headers: corsHeaders(origin),
      }
    );
  }
}
