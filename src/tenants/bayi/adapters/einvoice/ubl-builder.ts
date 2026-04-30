/**
 * UBL 2.1 Invoice XML Builder — Peppol BIS Billing 3.0 uyumlu.
 *
 * NL Peppol formatı için minimum required field'lar:
 *   - cbc:CustomizationID (BIS 3.0 specifier)
 *   - cbc:ID (invoice number)
 *   - cbc:IssueDate
 *   - cbc:DueDate
 *   - cbc:InvoiceTypeCode (380 = commercial invoice)
 *   - cbc:DocumentCurrencyCode (EUR)
 *   - cac:AccountingSupplierParty (sender)
 *   - cac:AccountingCustomerParty (receiver)
 *   - cac:InvoiceLine (line items)
 *   - cac:TaxTotal (BTW)
 *   - cac:LegalMonetaryTotal
 *
 * Bu builder minimum NL UBL Peppol-uyumlu XML üretir; Storecove
 * dahili validate edip Peppol network'a iletir.
 */

export interface UblParty {
  name: string;
  vatNumber: string;            // NL: NL...B01 format
  kvkNumber?: string;           // NL: 8 hane
  street: string;
  postalCode: string;
  city: string;
  countryCode: string;          // NL, BE, DE
  email?: string;
  iban?: string;
}

export interface UblLine {
  id: number;                   // 1, 2, 3...
  productName: string;
  productCode?: string;
  quantity: number;
  unit: string;                 // PCE | KGM | LTR (UN/ECE Recommendation 20)
  unitPrice: number;
  vatRate: number;              // 21 | 9 | 0
}

export interface UblInvoice {
  invoiceNumber: string;
  issueDate: string;            // YYYY-MM-DD
  dueDate: string;
  currency: string;             // EUR
  supplier: UblParty;
  customer: UblParty;
  lines: UblLine[];
}

const UNIT_CODE_MAP: Record<string, string> = {
  adet: "PCE", piece: "PCE", kutu: "PCE", paket: "PCE", koli: "PCE", palet: "PCE", rulo: "PCE",
  kg: "KGM", lt: "LTR", litre: "LTR",
  m: "MTR", m2: "MTK", "m²": "MTK",
};

function mapUnit(unit: string): string {
  return UNIT_CODE_MAP[unit.toLowerCase()] || "PCE";
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function num(n: number): string {
  return n.toFixed(2);
}

function partyXml(party: UblParty, role: "Supplier" | "Customer"): string {
  const partyTag = role === "Supplier" ? "AccountingSupplierParty" : "AccountingCustomerParty";
  return `
    <cac:${partyTag}>
      <cac:Party>
        <cbc:EndpointID schemeID="${party.countryCode === "NL" && party.kvkNumber ? "0106" : "9930"}">${escape(party.kvkNumber || party.vatNumber)}</cbc:EndpointID>
        <cac:PartyName>
          <cbc:Name>${escape(party.name)}</cbc:Name>
        </cac:PartyName>
        <cac:PostalAddress>
          <cbc:StreetName>${escape(party.street)}</cbc:StreetName>
          <cbc:CityName>${escape(party.city)}</cbc:CityName>
          <cbc:PostalZone>${escape(party.postalCode)}</cbc:PostalZone>
          <cac:Country>
            <cbc:IdentificationCode>${party.countryCode}</cbc:IdentificationCode>
          </cac:Country>
        </cac:PostalAddress>
        <cac:PartyTaxScheme>
          <cbc:CompanyID>${escape(party.vatNumber)}</cbc:CompanyID>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:PartyTaxScheme>
        <cac:PartyLegalEntity>
          <cbc:RegistrationName>${escape(party.name)}</cbc:RegistrationName>
          ${party.kvkNumber ? `<cbc:CompanyID schemeID="0106">${escape(party.kvkNumber)}</cbc:CompanyID>` : ""}
        </cac:PartyLegalEntity>
        ${party.email ? `<cac:Contact><cbc:ElectronicMail>${escape(party.email)}</cbc:ElectronicMail></cac:Contact>` : ""}
      </cac:Party>
    </cac:${partyTag}>`;
}

/**
 * Build UBL 2.1 Peppol BIS Billing 3.0 compliant invoice XML.
 */
export function buildUblInvoice(invoice: UblInvoice): string {
  // Compute totals
  const lineExtensionTotal = invoice.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const taxByRate = new Map<number, { taxableAmount: number; taxAmount: number }>();
  for (const line of invoice.lines) {
    const lineExt = line.quantity * line.unitPrice;
    const taxAmount = (lineExt * line.vatRate) / 100;
    const cur = taxByRate.get(line.vatRate) || { taxableAmount: 0, taxAmount: 0 };
    cur.taxableAmount += lineExt;
    cur.taxAmount += taxAmount;
    taxByRate.set(line.vatRate, cur);
  }
  const totalTax = Array.from(taxByRate.values()).reduce((s, t) => s + t.taxAmount, 0);
  const taxInclusiveAmount = lineExtensionTotal + totalTax;

  const taxSubtotalsXml = Array.from(taxByRate.entries()).map(([rate, t]) => `
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${invoice.currency}">${num(t.taxableAmount)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${invoice.currency}">${num(t.taxAmount)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${rate === 0 ? "Z" : rate < 21 ? "AA" : "S"}</cbc:ID>
        <cbc:Percent>${num(rate)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`).join("");

  const linesXml = invoice.lines.map(line => {
    const lineExt = line.quantity * line.unitPrice;
    return `
    <cac:InvoiceLine>
      <cbc:ID>${line.id}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="${mapUnit(line.unit)}">${num(line.quantity)}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${invoice.currency}">${num(lineExt)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${escape(line.productName)}</cbc:Name>
        ${line.productCode ? `<cac:SellersItemIdentification><cbc:ID>${escape(line.productCode)}</cbc:ID></cac:SellersItemIdentification>` : ""}
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${line.vatRate === 0 ? "Z" : line.vatRate < 21 ? "AA" : "S"}</cbc:ID>
          <cbc:Percent>${num(line.vatRate)}</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${invoice.currency}">${num(line.unitPrice)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${escape(invoice.invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${invoice.issueDate}</cbc:IssueDate>
  <cbc:DueDate>${invoice.dueDate}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${invoice.currency}</cbc:DocumentCurrencyCode>
  ${partyXml(invoice.supplier, "Supplier")}
  ${partyXml(invoice.customer, "Customer")}
  ${invoice.supplier.iban ? `
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${escape(invoice.supplier.iban)}</cbc:ID>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>` : ""}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${invoice.currency}">${num(totalTax)}</cbc:TaxAmount>
    ${taxSubtotalsXml}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${invoice.currency}">${num(lineExtensionTotal)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${invoice.currency}">${num(lineExtensionTotal)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${invoice.currency}">${num(taxInclusiveAmount)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${invoice.currency}">${num(taxInclusiveAmount)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${linesXml}
</Invoice>`;
}
