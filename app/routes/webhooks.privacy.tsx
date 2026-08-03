import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  const normalizedTopic = String(topic).toLowerCase();

  console.log(`Received ${topic} privacy webhook for ${shop}`);

  if (normalizedTopic.includes("shop") && normalizedTopic.includes("redact")) {
    await db.session.deleteMany({ where: { shop } });
    await db.store.deleteMany({ where: { shop } });

    return Response.json(
      { message: `Shop data for ${shop} successfully purged.` },
      { status: 200 }
    );
  }

  return Response.json(
    {
      message:
        "Acknowledged. PODesk does not collect or store end-customer PII.",
    },
    { status: 200 }
  );
};
