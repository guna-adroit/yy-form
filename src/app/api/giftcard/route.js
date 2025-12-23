import { NextResponse } from "next/server";

const SHOP = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

/**
 * Allowed Shopify storefront origins
 */
const ALLOWED_ORIGINS = [
  "https://guna-am.myshopify.com",
];

/**
 * Shopify Admin GraphQL query
 */
const GIFT_CARDS_QUERY = `
  query GiftCards($first: Int!) {
    giftCards(first: $first) {
      edges {
        node {
          id
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
`;

export async function POST(req) {
  try {
    // -----------------------------
    // 1️⃣ Origin validation (CORS)
    // -----------------------------
    const origin = req.headers.get("origin");

    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // -----------------------------
    // 2️⃣ Parse request body
    // -----------------------------
    const { code } = await req.json();

    if (!code) {
      return NextResponse.json(
        { error: "Gift card code is required" },
        { status: 400 }
      );
    }

    // Normalize gift card code
    const normalizedCode = code.replace(/\s+/g, "").toUpperCase();
    const lastFour = normalizedCode.slice(-4);

    // -----------------------------
    // 3️⃣ Call Shopify GraphQL API
    // -----------------------------
    const res = await fetch(
      `https://${SHOP}/admin/api/2024-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": TOKEN,
        },
        body: JSON.stringify({
          query: GIFT_CARDS_QUERY,
          variables: { first: 250 },
        }),
        cache: "no-store",
      }
    );

    if (!res.ok) {
      throw new Error("Shopify GraphQL request failed");
    }

    const json = await res.json();

    if (json.errors) {
      throw new Error("Shopify GraphQL error");
    }

    const giftCards =
      json.data?.giftCards?.edges?.map((e) => e.node) || [];

    // -----------------------------
    // 4️⃣ Match gift card
    // -----------------------------
    const giftCard = giftCards.find((gc) => {
      return (
        gc.lastCharacters === lastFour &&
        gc.enabled === true &&
        (!gc.expiresOn || new Date(gc.expiresOn) > new Date())
      );
    });

    if (!giftCard) {
      return NextResponse.json(
        { error: "Invalid or expired gift card" },
        { status: 404 }
      );
    }

    // -----------------------------
    // 5️⃣ Safe response
    // -----------------------------
    return NextResponse.json({
      balance: giftCard.balance.amount,
      currency: giftCard.balance.currencyCode,
      expires_on: giftCard.expiresOn,
    });
  } catch (err) {
    console.error("Gift card GraphQL error");

    return NextResponse.json(
      { error: "Unable to check gift card balance" },
      { status: 500 }
    );
  }
}
