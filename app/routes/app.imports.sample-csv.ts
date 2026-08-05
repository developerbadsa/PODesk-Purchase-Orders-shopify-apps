export const loader = async () => {
  const sampleCsvContent = [
    "sku,supplierName,supplierSku,supplierCost,leadTimeDays,paymentTerms,minimumOrder,notes",
    "SKU-SHIRT-M,Acme Wholesale,ACME-101,12.50,14,Net 30,500,Main apparel supplier",
    "SKU-HAT-RED,North Supply,NS-99,8.00,21,Prepaid,250,Headwear supplier",
    "SKU-PANTS-32,Global Fabrics,GF-3200,18.75,10,Net 15,100,Pants supplier",
  ].join("\n");

  return new Response(sampleCsvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="podesk-supplier-sku-import-sample.csv"',
      "Cache-Control": "no-store",
    },
  });
};
