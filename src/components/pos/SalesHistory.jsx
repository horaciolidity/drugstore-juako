import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  History, Printer, Package, DollarSign, Percent,
  Search, CheckSquare, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePOS } from '@/contexts/POSContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import DocumentPreview from '@/components/pos/DocumentPreview';

const currency = (n) => `$${Number(n || 0).toFixed(2)}`;

const getPaymentMethodLabel = (method) => {
  switch (method) {
    case 'cash': return 'Efectivo';
    case 'card': return 'Tarjeta';
    case 'transfer': return 'Transferencia';
    case 'mixed': return 'Mixto';
    case 'account': return 'Cuenta Corriente';
    case 'credit': return 'A Cuenta';
    default: return method || '-';
  }
};

const humanType = (t) => {
  switch (t) {
    case 'sale': return 'Venta';
    case 'quote': return 'Presupuesto';
    case 'remit': return 'Remito';
    case 'credit': return 'Crédito';
    default: return t;
  }
};

/* ==================== DETALLE ==================== */
const SaleDetail = ({ sale }) => {
  const { dispatch } = usePOS();
  const { isAdmin } = useAuth();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [converted, setConverted] = useState(!!sale._converted);

  const method = sale?.payment?.method ?? sale?.paymentMethod;
  const paid = sale?.payment?.amountPaid ?? sale?.paymentAmount ?? 0;
  const change = sale?.payment?.change ?? sale?.change ?? 0;
  const discountItems = sale?.itemDiscounts ?? (sale?.items || []).reduce((a, i) => a + Number(i.itemDiscount || 0), 0);
  const discountGlobal = Number(sale?.discount || 0);
  const iva = sale?.taxAmount ?? sale?.tax ?? 0;

  const reprintTicket = () => setPreviewOpen(true);

  const convertToSale = () => {
    if (!sale || sale.type !== 'quote') return;

    if (converted || sale._converted) {
      toast({
        title: 'Ya convertido',
        description: 'Este presupuesto ya fue convertido a venta.',
        variant: 'destructive'
      });
      return;
    }

    const newSale = {
      ...sale,
      id: crypto.randomUUID(),
      type: 'sale',
      _converted: true,
      timestamp: new Date().toISOString(),
    };

    dispatch({ type: 'CONVERT_QUOTE_TO_SALE', payload: newSale });
    setConverted(true);

    toast({
      title: 'Presupuesto convertido',
      description: 'Se ha generado una venta y el presupuesto fue cerrado.'
    });
  };

  return (
    <>
      <DialogContent className="card-glass border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalle de {humanType(sale.type)} - {sale.documentNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin p-1">
          {/* Cabecera */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Fecha:</p>
              <p>{new Date(sale.timestamp).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Tipo:</p>
              <p className="capitalize">{humanType(sale.type)}</p>
            </div>
            {sale.customer && (
              <div>
                <p className="text-muted-foreground">Cliente:</p>
                <p>{sale.customer.name}</p>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="border-t border-border pt-4">
            <h3 className="font-semibold mb-2 flex items-center">
              <Package className="h-4 w-4 mr-2" />Productos
            </h3>
            <div className="space-y-2">
              {(sale.items || []).map((item, index) => {
                const line = Number(item.price || 0) * Number(item.quantity || 0);
                const lineNet = line - Number(item.itemDiscount || 0);
                return (
                  <div key={item.cartId || item.id || index} className="flex justify-between items-center bg-background/50 p-2 rounded-md">
                    <div>
                      <p>{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} x {currency(item.price)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{currency(lineNet)}</p>
                      {Number(item.itemDiscount || 0) > 0 && (
                        <p className="text-xs text-green-600">- {currency(item.itemDiscount)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totales */}
          <div className="border-t border-border pt-4">
            <h3 className="font-semibold mb-2 flex items-center">
              <DollarSign className="h-4 w-4 mr-2" />Totales
            </h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>{currency(sale.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Desc. ítems:</span>
                <span className="text-green-600">- {currency(discountItems)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Desc. global:</span>
                <span className="text-green-600">- {currency(discountGlobal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA:</span>
                <span>{currency(iva)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t border-border/50 mt-1 pt-1">
                <span>Total:</span>
                <span>{currency(sale.total)}</span>
              </div>
            </div>
          </div>

          {/* Ganancia (solo admin) */}
          {isAdmin && sale.type !== 'quote' && (
            <div className="border-t border-border pt-4">
              <h3 className="font-semibold mb-2 flex items-center">
                <Percent className="h-4 w-4 mr-2" />Ganancia
              </h3>
              <div className="flex justify-between font-bold text-green-600">
                <span>Ganancia de la venta:</span>
                <span>{currency(sale.profit)}</span>
              </div>
            </div>
          )}

          {/* Pago */}
          <div className="border-t border-border pt-4">
            <h3 className="font-semibold mb-2">Pago</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Método:</span>
                <span>{getPaymentMethodLabel(method)}</span>
              </div>
              {method !== 'transfer' && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monto recibido:</span>
                  <span>{currency(paid)}</span>
                </div>
              )}
              {Number(change) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vuelto:</span>
                  <span>{currency(change)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex justify-end pt-4 gap-2">
          {sale.type === 'quote' && !converted && (
            <Button onClick={convertToSale} className="bg-green-600 hover:bg-green-700">
              <CheckSquare className="h-4 w-4 mr-2" />
              Convertir a Venta
            </Button>
          )}
          {converted && (
            <Button disabled variant="outline" className="text-green-600 border-green-500">
              Ya convertido
            </Button>
          )}
          <Button onClick={reprintTicket}>
            <Printer className="h-4 w-4 mr-2" />
            Ver / Reimprimir
          </Button>
        </div>
      </DialogContent>

      {/* Preview */}
      <DocumentPreview
        isOpen={previewOpen}
        onOpenChange={setPreviewOpen}
        documentType={sale?.type || 'sale'}
        sale={sale}
      />
    </>
  );
};

/* ==================== HISTORIAL ==================== */
export default function SalesHistory() {
  const { state, dispatch } = usePOS();
  const { isAdmin } = useAuth();
  const [filters, setFilters] = useState({
    dateStart: '',
    dateEnd: '',
    type: 'all',
    paymentMethod: 'all',
    search: '',
  });

  const salesDesc = useMemo(
    () => ([...(state.sales || [])]).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    [state.sales]
  );

  const filteredSales = useMemo(() => {
    return salesDesc.filter((sale) => {
      const saleDate = new Date(sale.timestamp);
      const startDate = filters.dateStart ? new Date(filters.dateStart) : null;
      const endDate = filters.dateEnd ? new Date(filters.dateEnd) : null;
      if (endDate) endDate.setHours(23, 59, 59, 999);

      if (startDate && saleDate < startDate) return false;
      if (endDate && saleDate > endDate) return false;
      if (filters.type !== 'all' && sale.type !== filters.type) return false;

      const saleMethod = sale?.payment?.method ?? sale?.paymentMethod;
      if (filters.paymentMethod !== 'all' && saleMethod !== filters.paymentMethod) return false;

      const q = (filters.search || '').toLowerCase();
      if (q) {
        const doc = String(sale.documentNumber || '').toLowerCase();
        const cust = String(sale.customer?.name || '').toLowerCase();
        if (!doc.includes(q) && !cust.includes(q)) return false;
      }
      return true;
    });
  }, [salesDesc, filters]);

  const handleFilterChange = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const clearAll = () => {
    if (filteredSales.length === 0 && (state.sales || []).length === 0) return;
    if (window.confirm(`Se eliminará TODO el historial de ventas (${(state.sales || []).length} registros). ¿Continuar?`)) {
      dispatch({ type: 'CLEAR_SALES_HISTORY' });
      toast({ title: 'Historial eliminado', description: 'Se borraron todas las ventas guardadas.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Historial de Operaciones</h1>
        {isAdmin && (
          <Button variant="destructive" onClick={clearAll}>
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar todo
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="card-glass p-4 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div className="space-y-1">
            <Label>Desde</Label>
            <Input type="date" value={filters.dateStart} onChange={(e) => handleFilterChange('dateStart', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Hasta</Label>
            <Input type="date" value={filters.dateEnd} onChange={(e) => handleFilterChange('dateEnd', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={filters.type} onValueChange={(v) => handleFilterChange('type', v)}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sale">Venta</SelectItem>
                <SelectItem value="quote">Presupuesto</SelectItem>
                <SelectItem value="remit">Remito</SelectItem>
                <SelectItem value="credit">Crédito</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Pago</Label>
            <Select value={filters.paymentMethod} onValueChange={(v) => handleFilterChange('paymentMethod', v)}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="cash">Efectivo</SelectItem>
                <SelectItem value="card">Tarjeta</SelectItem>
                <SelectItem value="transfer">Transferencia</SelectItem>
                <SelectItem value="mixed">Mixto</SelectItem>
                <SelectItem value="account">Cuenta Corriente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Nro o Cliente..." value={filters.search} onChange={(e) => handleFilterChange('search', e.target.value)} className="pl-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card-glass p-6 rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-muted-foreground p-2">Fecha</th>
                <th className="text-left text-muted-foreground p-2">Documento</th>
                <th className="text-left text-muted-foreground p-2">Tipo</th>
                <th className="text-left text-muted-foreground p-2">Cliente</th>
                <th className="text-right text-muted-foreground p-2">Total</th>
                {isAdmin && <th className="text-right text-muted-foreground p-2">Ganancia</th>}
                <th className="text-center text-muted-foreground p-2">Detalles</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((sale, index) => (
                <motion.tr key={sale.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.02 }} className="border-b border-border/50 hover:bg-accent">
                  <td className="p-3 text-sm text-muted-foreground">{new Date(sale.timestamp).toLocaleString()}</td>
                  <td className="p-3 font-medium">{sale.documentNumber}</td>
                  <td className="p-3 capitalize text-yellow-500">{humanType(sale.type)}</td>
                  <td className="p-3 text-muted-foreground">{sale.customer?.name || 'Consumidor Final'}</td>
                  <td className="p-3 text-right font-semibold">{currency(sale.total)}</td>
                  {isAdmin && <td className="p-3 text-right font-semibold text-green-600">{currency(sale.profit)}</td>}
                  <td className="p-3 text-center">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">Ver</Button>
                      </DialogTrigger>
                      <SaleDetail sale={sale} />
                    </Dialog>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>

          {filteredSales.length === 0 && (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-muted-foreground">No se encontraron operaciones.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
