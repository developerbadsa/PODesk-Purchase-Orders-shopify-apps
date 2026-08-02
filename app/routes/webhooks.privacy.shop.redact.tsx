import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Delete all active sessions for this shop
  await db.session.deleteMany({ where: { shop } });

  // Delete Store entity (Cascades to products, variants, locations, suppliers, POs, receipts, mappings, settings, import jobs, and reorder overrides)
  await db.store.deleteMany({ where: { shop } });

  return Response.json(
    { message: `Shop data for ${shop} successfully purged.` },
    { status: 200 }
  );
};
