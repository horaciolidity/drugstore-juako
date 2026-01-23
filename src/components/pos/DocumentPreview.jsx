import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, X, Download } from "lucide-react";
import { usePOS } from "@/contexts/POSContext";
import { toast } from "@/components/ui/use-toast";
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const PRINT_FIX_CSS = `
.ticket-80mm {
  width: 80mm;
  max-width: 80mm;
  margin: 0 auto;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Inter, sans-serif;
}
.ticket-80mm .line{ display:flex; justify-content:space-between; gap:8px; }
.ticket-80mm .cut{ border-top:1px dashed #bbb; margin:6px 0; }

#a4-wrapper{
  width: 210mm;
  margin: 0 auto;
  background: #fff;
}

@media print {
  @page { size: auto; margin: 6mm; }
  body { background: #fff !important; }
  #a4-wrapper{ width: 210mm; margin: 0 auto; }
  .ticket-80mm{ width: 80mm; margin: 0 auto; }
  [role="dialog"]{ position: static !important; inset: auto !important; }
}
`;

const DocumentPreview = ({
  isOpen,
  onOpenChange,
  documentType = "sale",
  sale: saleProp = null,
  onConfirm,
}) => {
  const { state, processSale, calculateDetail } = usePOS();
  const [isLoading, setIsLoading] = useState(false);
  const [sale, setSale] = useState(saleProp);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [activeTab, setActiveTab] = useState("A4");

  // Datos de empresa
  const settings = state?.settings || {};
  const companyName = settings.companyName || "Mi Comercio";
  const companyAddr = settings.address || settings.companyAddress || "";
  const companyPhone = settings.phone || settings.companyPhone || "";
  const companyEmail = settings.email || "";
  const companyCUIT = settings.cuit || "";
  const companyIVA = settings.ivaCondition || "CF";
  const docCfg = settings.document || {};
  const watermark =
    docCfg.watermark || { text: "DOCUMENTO NO VÁLIDO", opacity: 0.08, rotation: -30 };

  const title = useMemo(() => {
    switch (documentType) {
      case "sale":
        return "Factura";
      case "remit":
        return "Remito";
      case "quote":
        return "Presupuesto";
      case "credit":
        return "Nota de crédito";
      default:
        return "Documento";
    }
  }, [documentType]);

  useEffect(() => {
    setSale(saleProp || null);
  }, [saleProp]);

  useEffect(() => {
    setPdfUrl(sale?.fiscal?.pdf_url || null);
  }, [sale, isOpen]);

  const computed = useMemo(() => {
    if (sale) {
      return {
        items: sale.items || [],
        subtotal: Number(sale.subtotal || 0),
        itemDiscounts: Number(sale.itemDiscounts || 0),
        discount: Number(sale.discount || 0),
        taxAmount: Number(sale.taxAmount || 0),
        total: Number(sale.total || 0),
        customer: sale.customer || null,
        number: sale.documentNumber || "TEMP",
        training: !!sale?.fiscal?.training,
        cae: sale?.fiscal?.cae || null,
        cae_due: sale?.fiscal?.cae_due_date || null,
      };
    }

    if (typeof calculateDetail === "function") {
      const d = calculateDetail();
      return {
        items: (state.cart || []).map((it) => ({
          ...it,
          totalPrice:
            Number(it.price || 0) * Number(it.quantity || 0) -
            Number(it.itemDiscount || 0),
        })),
        subtotal: Number(d.subtotal || 0),
        itemDiscounts: Number(d.itemDiscounts || 0),
        discount: Number(state.discount || 0),
        taxAmount: Number(d.taxAmount || 0),
        total: Number(d.total || 0),
        customer: state.currentCustomer || null,
        number: "TEMP",
        training: true,
        cae: null,
        cae_due: null,
      };
    }

    const subtotal = (state.cart || []).reduce(
      (s, it) => s + Number(it.price || 0) * Number(it.quantity || 0),
      0
    );
    const itemDiscounts = (state.cart || []).reduce(
      (s, it) => s + Number(it.itemDiscount || 0),
      0
    );
    const base = subtotal - itemDiscounts;
    const taxRate = Number(settings.taxRate || 0);
    const taxAmount = Number((base * taxRate).toFixed(2));
    const total = Number((base + taxAmount - Number(state.discount || 0)).toFixed(2));
    return {
      items: (state.cart || []).map((it) => ({
        ...it,
        totalPrice:
          Number(it.price || 0) * Number(it.quantity || 0) -
          Number(it.itemDiscount || 0),
      })),
      subtotal,
      itemDiscounts,
      discount: Number(state.discount || 0),
      taxAmount,
      total,
      customer: state.currentCustomer || null,
      number: "TEMP",
      training: true,
      cae: null,
      cae_due: null,
    };
  }, [sale, state, settings, calculateDetail]);

 const handlePrint = () => {
  // Si hay un PDF fiscal emitido, abrilo directamente
  if (pdfUrl) {
    window.open(pdfUrl, "_blank");
    return;
  }

  // Detectar qué vista está activa
  const nodeId = activeTab === "80mm" ? "ticket80" : "docA4";
  const node = document.getElementById(nodeId);
  if (!node) {
    toast({
      title: "Error al imprimir",
      description: "No se encontró el contenido del documento.",
      variant: "destructive",
    });
    return;
  }

  // Clonar el contenido a una ventana temporal
  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <html>
      <head>
        <title>Imprimir documento</title>
        <style>
          ${PRINT_FIX_CSS}
          body { background: #fff; margin: 0; padding: 10px; }
        </style>
      </head>
      <body>
        ${node.outerHTML}
      </body>
    </html>
  `);
  printWindow.document.close();

  // Esperar a que cargue el contenido antes de imprimir
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
    setTimeout(() => printWindow.close(), 100);
  };
};

  const generateLocalPdf = async () => {
    const nodeId = activeTab === "80mm" ? "ticket80" : "docA4";
    const node = document.getElementById(nodeId);
    if (!node) {
      toast({
        title: "No se pudo generar PDF",
        description: "No se encontró el nodo de vista.",
        variant: "destructive",
      });
      return;
    }
    const canvas = await html2canvas(node, {
      scale: 2,
      backgroundColor: "#ffffff",
      windowWidth: node.scrollWidth,
      windowHeight: node.scrollHeight,
    });
    const img = canvas.toDataURL("image/png");

    if (activeTab === "80mm") {
      const widthPt = 226.77;
      const heightPt = (canvas.height * widthPt) / canvas.width;
      const pdf = new jsPDF({ unit: "pt", format: [widthPt, heightPt] });
      pdf.addImage(img, "PNG", 0, 0, widthPt, heightPt);
      pdf.save("ticket-80mm.pdf");
    } else {
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = (canvas.height * pageW) / canvas.width;
      pdf.addImage(img, "PNG", 0, 0, pageW, pageH);
      pdf.save("comprobante.pdf");
    }
  };

  const handleDownload = () => {
    if (pdfUrl) {
      window.open(pdfUrl, "_blank");
    } else {
      generateLocalPdf().catch((e) =>
        toast({
          title: "Error al generar PDF",
          description: String(e?.message || e),
          variant: "destructive",
        })
      );
    }
  };

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      if (sale?.id) {
        onOpenChange(false);
        return;
      }
      const created = await processSale(documentType);

      if (!created) {
        toast({ title: "No se pudo emitir", variant: "destructive" });
        return;
      }
      setSale(created);
      setPdfUrl(created?.fiscal?.pdf_url || null);
      onConfirm?.({
        number: created.documentNumber,
        pdf_url: created?.fiscal?.pdf_url || null,
        cae: created?.fiscal?.cae || null,
        cae_due_date: created?.fiscal?.cae_due_date || null,
      });
      toast({
        title: "Documento emitido",
        description: created?.fiscal?.training
          ? "Documento temporal (modo entrenamiento)"
          : `Comprobante ${created?.documentNumber}`,
      });
    } catch (e) {
      toast({
        title: "Error al emitir",
        description: String(e?.message || e),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const showWatermark = computed.training && watermark?.text;
  const watermarkStyle = showWatermark
    ? {
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        transform: `rotate(${watermark.rotation ?? -30}deg)`,
        opacity: watermark.opacity ?? 0.08,
        fontSize: 60,
        color: "#888",
      }
    : null;

  return (
    <Dialog open={!!isOpen} onOpenChange={onOpenChange}>
      <style>{PRINT_FIX_CSS}</style>

      <DialogContent className="sm:max-w-5xl w-[95vw] max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-4">
          <DialogTitle className="flex items-center justify-between">
            {title}
            <span className="ml-2 text-sm text-muted-foreground">
              {sale?.documentNumber ? `- ${sale.documentNumber}` : ""}
            </span>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-4 overflow-y-auto" style={{ maxHeight: "calc(90vh - 120px)" }}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="sticky top-0 bg-white/80 backdrop-blur z-10">
              <TabsTrigger value="A4">Vista A4</TabsTrigger>
              <TabsTrigger value="80mm">Ticket 80mm</TabsTrigger>
              {pdfUrl && <TabsTrigger value="PDF">PDF</TabsTrigger>}
            </TabsList>

            {/* A4 */}
            <TabsContent
              value="A4"
              className="relative flex-1 overflow-auto bg-white text-black py-6"
            >
              <div id="a4-wrapper" className="print-area">
                <div id="docA4" className="px-8">
                  <div className="mb-6">
                    <div className="text-2xl font-bold">{companyName}</div>
                    {(companyAddr || companyPhone) && (
                      <div className="text-sm">
                        {companyAddr && <span>{companyAddr}</span>}
                        {companyAddr && companyPhone && <span> · </span>}
                        {companyPhone && <span>Tel: {companyPhone}</span>}
                      </div>
                    )}
                    {companyEmail && <div className="text-sm">{companyEmail}</div>}
                    <div className="text-sm">
                      CUIT: {companyCUIT || "—"} · IVA: {companyIVA}
                    </div>
                  </div>

                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <div className="text-lg font-semibold">{title}</div>
                      <div className="text-sm text-muted-foreground">
                        {sale?.documentNumber || "TEMPORAL"}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div>Fecha: {new Date(sale?.timestamp || Date.now()).toLocaleString()}</div>
                      <div>Cliente: {computed.customer?.name || "Consumidor Final"}</div>
                      {computed.customer?.docNumber && (
                        <div>Doc: {computed.customer.docNumber}</div>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  <table className="w-full text-sm border-t border-b">
                    <thead>
                      <tr className="text-left">
                        <th className="py-2 pr-2">Código</th>
                        <th className="py-2 pr-2">Descripción</th>
                        <th className="py-2 pr-2 text-right">Cant.</th>
                        <th className="py-2 pr-2 text-right">P.Unit</th>
                        <th className="py-2 pr-2 text-right">Dto.</th>
                        <th className="py-2 pl-2 text-right">Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(computed.items || []).map((it, idx) => {
                        const line =
                          it.totalPrice != null
                            ? Number(it.totalPrice || 0)
                            : Number(it.price || 0) * Number(it.quantity || 0) -
                              Number(it.itemDiscount || 0);
                        return (
                          <tr key={it.cartId || it.id || idx} className="border-t">
                            <td className="py-1 pr-2">{it.code || it.id || "-"}</td>
                            <td className="py-1 pr-2">{it.name}</td>
                            <td className="py-1 pr-2 text-right">{it.quantity}</td>
                            <td className="py-1 pr-2 text-right">
                              ${Number(it.price || 0).toFixed(2)}
                            </td>
                            <td className="py-1 pr-2 text-right">
                              ${Number(it.itemDiscount || 0).toFixed(2)}
                            </td>
                            <td className="py-1 pl-2 text-right">${Number(line).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Totales */}
                  <div className="flex justify-end mt-4">
                    <div className="w-64 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>${computed.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Desc. items</span>
                        <span>-${computed.itemDiscounts.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Desc. global</span>
                        <span>-${computed.discount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>IVA</span>
                        <span>${computed.taxAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-1">
                        <span>Total</span>
                        <span>${computed.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {!computed.training && sale?.fiscal?.cae && (
                    <div className="mt-3 text-[12px]">
                      CAE: {sale.fiscal.cae} · Vto: {sale.fiscal.cae_due_date || "—"}
                    </div>
                  )}

                  <div className="mt-4 text-xs text-center">
                    {docCfg.legalFooter || ""}
                    {docCfg.showQr && (
                      <div className="mt-2 flex justify-center">
                        <QRCodeSVG
                          value={`Doc:${sale?.documentNumber || "TEMP"}|Total:${computed.total.toFixed(
                            2
                          )}`}
                          size={64}
                          level="L"
                        />
                      </div>
                    )}
                  </div>

                  {computed.training && watermark?.text && (
                    <div style={watermarkStyle}>{watermark.text}</div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Ticket 80mm */}
            <TabsContent value="80mm" className="flex-1 overflow-auto bg-white text-black p-4">
              <div id="ticket80" className="ticket-80mm bg-white">
                <div className="text-center">
                  <div className="font-bold text-sm">{companyName}</div>
                  {companyAddr && <div className="text-xs">{companyAddr}</div>}
                  {companyPhone && <div className="text-xs">Tel: {companyPhone}</div>}
                  {companyEmail && <div className="text-[10px]">{companyEmail}</div>}
                  <div className="text-xs">CUIT: {companyCUIT || "—"} · IVA: {companyIVA}</div>
                </div>

                <div className="my-2 text-xs flex justify-between">
                  <span>{title}</span>
                  <span>{new Date(sale?.timestamp || Date.now()).toLocaleString()}</span>
                </div>

                <div className="text-xs">Nro: {sale?.documentNumber || "TEMPORAL"}</div>

                <div className="my-2 cut"></div>

                {(computed.items || []).map((it, idx) => {
                  const line =
                    it.totalPrice != null
                      ? Number(it.totalPrice || 0)
                      : Number(it.price || 0) * Number(it.quantity || 0) -
                        Number(it.itemDiscount || 0);
                  return (
                    <div key={it.cartId || it.id || idx} className="line text-xs">
                      <span className="mr-2 truncate">
                        {it.name} x{it.quantity}
                      </span>
                      <span>${line.toFixed(2)}</span>
                    </div>
                  );
                })}

                <div className="cut"></div>

                <div className="text-xs space-y-0.5">
                  <div className="line">
                    <span>Subtotal</span>
                    <span>${computed.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="line">
                    <span>Desc.items</span>
                    <span>-${computed.itemDiscounts.toFixed(2)}</span>
                  </div>
                  <div className="line">
                    <span>Desc.global</span>
                    <span>-${computed.discount.toFixed(2)}</span>
                  </div>
                  <div className="line">
                    <span>IVA</span>
                    <span>${computed.taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="line font-semibold">
                    <span>Total</span>
                    <span>${computed.total.toFixed(2)}</span>
                  </div>
                </div>

                {!computed.training && sale?.fiscal?.cae && (
                  <div className="mt-2 text-[10px]">
                    CAE: {sale.fiscal.cae} Vto: {sale.fiscal.cae_due_date || "—"}
                  </div>
                )}

                {docCfg.showQr && (
                  <div className="mt-2 flex justify-center">
                    <QRCodeSVG
                      value={`Doc:${sale?.documentNumber || "TEMP"}|Total:${computed.total.toFixed(
                        2
                      )}`}
                      size={56}
                      level="L"
                    />
                  </div>
                )}

                <div className="cut"></div>
                <div className="text-center text-[10px]">¡Gracias por su compra!</div>
              </div>
            </TabsContent>

            {pdfUrl && (
              <TabsContent value="PDF" className="flex-1">
                <iframe src={pdfUrl} title="PDF Factura" className="w-full h-[60vh] border" />
              </TabsContent>
            )}
          </Tabs>
        </div>

        <DialogFooter className="flex items-center gap-2 px-6 pb-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Cerrar
          </Button>

          <Button onClick={handlePrint} disabled={isLoading}>
            <Printer className="h-4 w-4 mr-2" />
            {pdfUrl ? "Imprimir / Abrir PDF" : "Imprimir"}
          </Button>

          <Button variant="secondary" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Descargar PDF
          </Button>

          {!sale?.id && (
            <Button
              onClick={handleConfirm}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? "Emitiendo..." : "Confirmar y Emitir"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentPreview;
