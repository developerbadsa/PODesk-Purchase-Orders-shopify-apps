import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // PODesk processes operational store data (products, suppliers, POs) and does not store customer PII.
  return Response.json(
    { message: "Acknowledged. No customer PII retained to redact." },
    { status: 200 }
  );
};
