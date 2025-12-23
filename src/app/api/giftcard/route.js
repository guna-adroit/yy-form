import { NextResponse } from "next/server";

const SHOP = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

const ALLOWED_ORIGINS = [
  "https://guna-am.myshopify.com",
];

const GIFT_CARD_QUERY = `
  query GiftCards($first: Int!, $after: String) {
    giftCards(first: $first, after: $after, query: "status:enabled") {
      edges {
        cursor
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
      pageInfo {
        hasNextPage
      }
    }
  }
`;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

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
        { error: "Gift card code required" },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const normalized = code.replace(/\s+/g, "").toUpperCase();
    const lastFour = normalized.slice(-4);

    let after = null;
    let found = null;

    // 🔁 PAGINATION LOOP
    while (!found) {
      const res = await fetch(
        `https://${SHOP}/admin/api/2025-01/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": TOKEN,
          },
          body: JSON.stringify({
            query: GIFT_CARD_QUERY,
            variables: { first: 100, after },
          }),
        }
      );

      const json = await res.json();

      const edges = json.data.giftCards.edges;

      found = edges.find(
        (e) =>
          e.node.lastCharacters === lastFour &&
          e.node.enabled &&
          (!e.node.expiresOn ||
            new Date(e.node.expiresOn) > new Date())
      )?.node;

      if (found) break;

      if (!json.data.giftCards.pageInfo.hasNextPage) break;

      after = edges[edges.length - 1].cursor;
    }

    if (!found) {
      return NextResponse.json(
        { error: "Invalid or expired gift card" },
        { status: 404, headers: corsHeaders(origin) }
      );
    }

    return NextResponse.json(
      {
        balance: found.balance.amount,
        currency: found.balance.currencyCode,
        expires_on: found.expiresOn,
      },
      { status: 200, headers: corsHeaders(origin) }
    );
  } catch (err) {
    console.error("Gift card error", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
