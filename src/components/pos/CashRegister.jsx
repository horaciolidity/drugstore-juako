import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, Lock, Unlock, Printer, History, Plus, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePOS } from '@/contexts/POSContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';


/* ================== Diálogo de movimiento ================== */
const CashMovementDialog = ({ isOpen, onOpenChange }) => {
  const { dispatch } = usePOS();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('income');

  const handleAddMovement = () => {
    if (Number(amount) <= 0 || !description.trim()) {
      toast({
        title: 'Error',
        description: 'Monto y descripción son requeridos.',
        variant: 'destructive',
      });
      return;
    }
    dispatch({
      type: 'ADD_CASH_MOVEMENT',
      payload: {
        type,
        concept: description.trim(),
        amount: Number(amount || 0),
        timestamp: new Date().toISOString(),
      },
    });
    toast({
      title: 'Movimiento agregado',
      description: `Se ${type === 'income' ? 'agregó' : 'retiró'} $${Number(amount).toFixed(2)}.`,
    });
    onOpenChange(false);
    setAmount('');
    setDescription('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="glass-effect border-border">
        <DialogHeader><DialogTitle>Nuevo Movimiento de Caja</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipo</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Button
                variant={type === 'income' ? 'default' : 'outline'}
                onClick={() => setType('income')}
                className={type === 'income' ? 'bg-green-600 hover:bg-green-700' : 'border-border'}
              >
                Ingreso
              </Button>
              <Button
                variant={type === 'expense' ? 'default' : 'outline'}
                onClick={() => setType('expense')}
                className={type === 'expense' ? 'bg-red-600 hover:bg-red-700' : 'border-border'}
              >
                Retiro
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="mov_amount">Monto</Label>
            <Input
              id="mov_amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
            />
          </div>

          <div>
            <Label htmlFor="mov_desc">Descripción</Label>
            <Textarea
              id="mov_desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <Button onClick={handleAddMovement} className="w-full">
            Agregar Movimiento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ================== Componente principal ================== */
export default function CashRegister() {
  const { state, dispatch } = usePOS();
  const { isAdmin } = useAuth();
  const [openingAmount, setOpeningAmount] = useState('');
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [expandedClosure, setExpandedClosure] = useState(null);

  const cr = state.cashRegister || {};
  const {
    openingAmount: currentOpening = 0,
    salesByType = { cash: 0, transfer: 0, mixed: 0 },
    currentAmount = 0,
    movements = [],
    isOpen = false,
    openedAt,
    cashFromMixed = 0,
  } = cr;

  let totalCashSales = Number(salesByType.cash || 0);
  let totalTransferSales = Number(salesByType.transfer || 0);
  let totalMixedSales = Number(salesByType.mixed || 0);

 // 🔧 Solo movimientos MANUALES reales (excluir ventas/vueltos/apertura/cierre/auto)
const movNet = (movements || [])
  .filter((m) => {
    const c = String(m.concept || '').toLowerCase();

    // si viene marcado como manual, se acepta
    if (m.manual === true || m.isManual === true || m.kind === 'manual' || m.source === 'manual') {
      return true;
    }

    // excluir todo lo automático o propio de la venta
    if (
      c.includes('venta') ||        // "Venta TEMP-..."
      c.includes('vuelto') ||       // Vuelto
      c.includes('apertura') ||     // Apertura
      c.includes('cierre') ||       // Cierre
      c.includes('[auto]')          // cualquier tag automático
    ) return false;

    // por defecto, aceptar solo si el concepto luce manual
    return c.includes('manual') || c.includes('retiro') || c.includes('ingreso');
  })
  .reduce((acc, m) => {
    const amount = Number(m.amount || 0);
    if (m.type === 'income') return acc + amount;
    if (m.type === 'expense') return acc - amount;
    return acc;
  }, 0);

// expectedAmount and difference will be computed after we aggregate sales in the turn
let expectedAmount = 0;
let difference = 0;

  /* ------------------- Totales del turno ------------------- */
  const salesInTurn = useMemo(() => {
    if (!openedAt) return [];
    const start = new Date(openedAt);
    return (state.sales || []).filter((s) => {
      if (s.type === 'quote') return false;
      const when = new Date(s.timestamp);
      return when >= start;
    });
  }, [state.sales, openedAt]);

  // ------------------- Totales por método (calculado a partir de las ventas del turno)
  const computedByMethod = salesInTurn.reduce((acc, s) => {
    const method = s?.payment?.method ?? s?.paymentMethod ?? 'desconocido';
    const total = Number(s.total || 0);
    acc[method] = (acc[method] || 0) + total;
    if (method === 'mixed') {
      // intentar extraer la porción en efectivo si está disponible
      const cashPart = Number(s.payment?.cashAmount || s.payment?.cash || 0);
      acc.mixedCash = (acc.mixedCash || 0) + cashPart;
      acc.mixedTransfer = (acc.mixedTransfer || 0) + (total - cashPart);
    }
    return acc;
  }, {});

  totalCashSales = Number(computedByMethod.cash || 0);
  totalTransferSales = Number(computedByMethod.transfer || 0);
  totalMixedSales = Number(computedByMethod.mixed || 0);
  const cashFromMixedLocal = Number(computedByMethod.mixedCash || 0);

  // 💵 Solo efectivo en caja: apertura + efectivo + efectivo de mixto + mov. manuales
  expectedAmount = parseFloat(
    (
      Number(currentOpening || 0) +
      Number(totalCashSales || 0) +
      Number(cashFromMixedLocal || 0) +
      Number(movNet || 0)
    ).toFixed(2)
  );

  difference = parseFloat((Number(currentAmount || 0) - expectedAmount).toFixed(2));

  const subtotalTurno = salesInTurn.reduce((s, x) => s + Number(x.subtotal || 0), 0);
  const ivaTurno = salesInTurn.reduce((s, x) => s + Number(x.taxAmount || x.tax || 0), 0);
  const totalTurno = salesInTurn.reduce((s, x) => s + Number(x.total || 0), 0);
  const gananciaTurno = salesInTurn.reduce((s, x) => s + Number(x.profit || 0), 0);
  const cantidadVentas = salesInTurn.length;
  const promGanancia = cantidadVentas > 0 ? gananciaTurno / cantidadVentas : 0;

  const desgloseMetodo = salesInTurn.reduce((acc, s) => {
    const m = s?.payment?.method ?? s?.paymentMethod ?? 'desconocido';
    acc[m] = (acc[m] || 0) + Number(s.total || 0);
    return acc;
  }, {});

  /* ------------------- Función para imprimir ------------------- */
 const printReport = (closure) => {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) {
    toast({
      title: 'Pop-up bloqueado',
      description: 'Permití ventanas emergentes para imprimir.',
      variant: 'destructive',
    });
    return;
  }

  const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;

  const style = `
    <style>
      body{font-family: Arial, sans-serif; margin:24px; color:#111;}
      h1{font-size:20px; margin-bottom:10px;}
      h2{font-size:16px; margin-top:20px;}
      table{width:100%; border-collapse:collapse; margin-top:8px;}
      th,td{border:1px solid #ddd; padding:5px; text-align:right;}
      th{text-align:left; background:#f8f8f8;}
      .green{color:#16a34a;} .red{color:#dc2626;}
      .small{font-size:12px; color:#555;}
      ul{margin-top:4px; margin-bottom:8px; padding-left:20px;}
    </style>
  `;

  const html = `
    <!doctype html><html><head><meta charset="utf-8"><title>Arqueo de Caja</title>${style}</head><body>
    <h1>Arqueo de Caja</h1>
    <p class="small">Apertura: ${new Date(closure.openedAt).toLocaleString()}<br>
    Cierre: ${new Date(closure.closedAt).toLocaleString()}</p>

    <table>
      <tr><th>Inicial</th><th>Ventas Efectivo</th><th>Transferencia</th><th>Mixto (ef.)</th><th>Mov. Manuales</th><th>Esperado</th><th>Actual</th><th>Diferencia</th></tr>
      <tr>
        <td>${fmt(closure.openingAmount)}</td>
        <td>${fmt(closure.salesByType?.cash || 0)}</td>
        <td>${fmt(closure.salesByType?.transfer || 0)}</td>
        <td>${fmt(closure.cashFromMixed || 0)}</td>
        <td>${fmt(
          closure.movements
            ?.filter((m) => m.type === 'income' || m.type === 'expense')
            ?.reduce((a, m) => a + (m.type === 'income' ? m.amount : -m.amount), 0) || 0
        )}</td>
        <td>${fmt(closure.expectedAmount)}</td>
        <td>${fmt(closure.currentAmount)}</td>
        <td class="${closure.difference === 0 ? 'green' : 'red'}">${fmt(closure.difference)}</td>
      </tr>
    </table>

    <h2>Ventas del Día</h2>
    ${
      closure.sales?.length
        ? closure.sales
            .map(
              (s, i) => `
        <div>
          <strong>#${i + 1}</strong> — ${new Date(s.timestamp).toLocaleTimeString()} (${s.payment?.method || 'Desconocido'})
          <br>Cliente: ${s.customer?.name || '—'}
          <br>Subtotal: ${fmt(s.subtotal)} | IVA: ${fmt(s.taxAmount)} | Total: ${fmt(s.total)} | Ganancia: ${fmt(s.profit)}
          <ul>${(s.items || [])
            .map((p) => `<li>${p.name} x${p.quantity} — $${p.price.toFixed(2)} c/u</li>`)
            .join('')}</ul>
        </div>`
            )
            .join('')
        : '<p>Sin ventas registradas.</p>'
    }

    <h2>Movimientos Manuales</h2>
    ${
      closure.movements?.length
        ? `<ul>${closure.movements
            .map(
              (m) =>
                `<li>${new Date(m.timestamp).toLocaleTimeString()} — ${m.concept}: <strong class="${
                  m.type === 'income' ? 'green' : 'red'
                }">${m.type === 'income' ? '+' : '-'}${fmt(m.amount)}</strong></li>`
            )
            .join('')}</ul>`
        : '<p>Sin movimientos manuales.</p>'
    }

    </body></html>
  `;
  w.document.write(html);
  w.document.close();
  w.onload = () => w.print();
};


  /* ------------------- Acciones ------------------- */
  const handleOpenRegister = () => {
    if (Number(openingAmount) <= 0) {
      toast({
        title: 'Error',
        description: 'El monto inicial debe ser mayor a 0.',
        variant: 'destructive',
      });
      return;
    }
const fixedOpening = parseFloat(parseFloat(openingAmount).toFixed(2));
dispatch({ type: 'OPEN_CASH_REGISTER', payload: fixedOpening });
    toast({
      title: 'Caja abierta',
      description: `Caja abierta con un monto inicial de $${Number(openingAmount).toFixed(2)}`,
    });
    setOpeningAmount('');
  };

  const handleCloseRegister = () => {
    if (!isOpen) return;
    const closure = {
      openedAt,
      closedAt: new Date().toISOString(),
      openingAmount: currentOpening,
      salesByType: {
        cash: totalCashSales,
        transfer: totalTransferSales,
        mixed: totalMixedSales,
      },
      cashFromMixed: cashFromMixedLocal,
      currentAmount,
      expectedAmount,
      difference: parseFloat(difference.toFixed(2)),
      movements,
    };

closure.sales = salesInTurn;

    dispatch({ type: 'CLOSE_CASH_REGISTER', payload: closure });
    toast({
      title: 'Caja cerrada',
      description: `Caja cerrada con un monto final de $${Number(currentAmount).toFixed(2)}`,
    });
  };

  /* ------------------- Render ------------------- */
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gestión de Caja</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estado de Caja */}
        <div className="card-glass p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Estado de Caja</h2>

          {isOpen ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <Unlock className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-lg font-medium text-green-500">Caja Abierta</p>
                    <p className="text-sm text-muted-foreground">
                      Abierta el: {new Date(openedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Button size="sm" onClick={() => setIsMovementDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />Movimiento
                </Button>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Monto Inicial</span><span>${currentOpening.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Ventas Efectivo</span><span>${totalCashSales.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Mixto (efectivo)</span><span>${cashFromMixedLocal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Movimientos manuales</span><span>${movNet.toFixed(2)}</span></div>
                <div className="flex justify-between font-semibold border-t pt-2"><span>Esperado</span><span>${expectedAmount.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-lg"><span>Actual</span><span>${currentAmount.toFixed(2)}</span></div>
                <div className={`flex justify-between font-semibold ${difference === 0 ? 'text-green-500' : 'text-red-500'}`}>
                  <span>Diferencia</span><span>${difference.toFixed(2)}</span>
                </div>
              </div>

              {/* Lista de movimientos */}
              <div className="mt-4">
                <h3 className="font-semibold mb-2 flex items-center"><DollarSign className="mr-2 h-4 w-4" />Movimientos</h3>
                {movements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay movimientos manuales aún.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {[...movements].reverse().map((m, i) => (
                      <div key={i} className="flex justify-between bg-background/50 rounded px-2 py-1 text-sm">
                        <span>{m.concept}</span>
                        <span className={m.type === 'income' ? 'text-green-500' : 'text-red-500'}>
                          {m.type === 'income' ? '+' : '-'}${m.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button className="w-full bg-red-600 mt-5" onClick={handleCloseRegister}>
                <Lock className="h-4 w-4 mr-2" />Cerrar Caja
              </Button>
            {/* Resumen del día (sin gráfico) */}
<div className="mt-5 border-t pt-3">
  <h3 className="text-lg font-semibold mb-3">Resumen Diario</h3>

  <div className="space-y-1 text-sm">
    <div className="flex justify-between">
      <span>💵 Total Ventas</span>
      <span className="font-semibold">
        $
        {(
          totalCashSales +
          totalTransferSales +
          totalMixedSales
        ).toFixed(2)}
      </span>
    </div>

    {isAdmin && (
      <>
        <div className="flex justify-between">
          <span>📈 Ganancia Neta</span>
          <span className="text-green-500 font-semibold">
            +${gananciaTurno.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Promedio por venta</span>
          <span>${promGanancia.toFixed(2)}</span>
        </div>
      </>
    )}

    <div className="border-t mt-2 pt-2 text-xs">
      <p className="text-sm font-semibold mb-1">Desglose por método:</p>
      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span>Efectivo</span>
          <span>${totalCashSales.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Transferencia</span>
          <span>${totalTransferSales.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Mixto</span>
          <span>${totalMixedSales.toFixed(2)}</span>
        </div>
      </div>
    </div>
  </div>
</div>


            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Lock className="h-8 w-8 text-red-500" />
                <p className="text-lg text-red-500">Caja Cerrada</p>
              </div>
              <div>
                <Label htmlFor="openingAmount">Monto Inicial</Label>
                <Input
                  id="openingAmount"
                  type="number"
                  step="0.01"
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                />
              </div>
              <Button className="w-full bg-green-600" onClick={handleOpenRegister}>
                <Unlock className="h-4 w-4 mr-2" />Abrir Caja
              </Button>
            </div>
          )}
        </div>

        {/* Totales del turno */}
        <div className="card-glass p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Totales del Turno</h2>
          {salesInTurn.length === 0 ? (
            <p className="text-muted-foreground">No hay ventas aún.</p>
          ) : (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Ventas totales</span><span>{cantidadVentas}</span></div>
              <div className="flex justify-between"><span>Subtotal</span><span>${subtotalTurno.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>IVA</span><span>${ivaTurno.toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold"><span>Total</span><span>${totalTurno.toFixed(2)}</span></div>
              {isAdmin && (
                <>
                  <div className="flex justify-between text-base font-semibold border-t pt-2">
                    <span>Ganancia Neta</span>
                    <span className="text-green-500">+${gananciaTurno.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Promedio por venta</span><span>${promGanancia.toFixed(2)}</span></div>
                </>
              )}
              <div className="border-t mt-2 pt-2">
                <p className="text-sm font-semibold mb-1">Desglose por método:</p>
                <div className="space-y-0.5">
                  <div className="flex justify-between">
                    <span>Efectivo</span>
                    <span>${totalCashSales.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Transferencia</span>
                    <span>${totalTransferSales.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mixto (total)</span>
                    <span>${totalMixedSales.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mixto (efectivo)</span>
                    <span>${cashFromMixedLocal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mixto (transferencia)</span>
                    <span>${(totalMixedSales - cashFromMixedLocal).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="border-t mt-4 pt-2">
  <p className="text-sm font-semibold mb-1">Productos vendidos:</p>
  {salesInTurn.flatMap((s) => s.items || []).length === 0 ? (
    <p className="text-muted-foreground text-sm">Aún no se registran productos vendidos.</p>
  ) : (
    <div className="max-h-32 overflow-y-auto text-xs space-y-1">
      {salesInTurn
        .flatMap((s) => s.items || [])
        .reduce((acc, item) => {
          const existing = acc.find((a) => a.name === item.name);
          if (existing) existing.quantity += Number(item.quantity || 0);
          else acc.push({ name: item.name, quantity: Number(item.quantity || 0) });
          return acc;
        }, [])
        .map((it, i) => (
          <div key={i} className="flex justify-between border-b border-border/30 pb-1">
            <span>{it.name}</span>
            <span>x{it.quantity}</span>
          </div>
        ))}
    </div>
  )}
</div>

      </div>
{/* Detalle de ventas del día */}
<div className="card-glass p-6 rounded-lg mt-4">
  <h2 className="text-xl font-semibold mb-3">Detalle de Ventas del Día</h2>
  {salesInTurn.length === 0 ? (
    <p className="text-muted-foreground text-sm">No hay ventas registradas.</p>
  ) : (
    <div className="max-h-72 overflow-y-auto text-xs space-y-3">
     {salesInTurn.map((venta, i) => (
  <div key={i} className="border border-border/40 rounded-lg p-3 bg-background/40">
    <div className="flex justify-between items-center border-b border-border/30 pb-1 mb-1">
      <span className="font-semibold text-sm">Venta #{i + 1}</span>
      <span className="text-muted-foreground text-[11px]">
        {new Date(venta.timestamp).toLocaleTimeString()}
      </span>
    </div>

    <div className="text-xs space-y-1">
      <div className="flex justify-between"><span>Cliente:</span><span>{venta.customer?.name || '—'}</span></div>
      <div className="flex justify-between"><span>Método:</span><span className="capitalize">{venta.payment?.method || venta.paymentMethod || 'Desconocido'}</span></div>
      <div className="flex justify-between"><span>Subtotal:</span><span>${Number(venta.subtotal || 0).toFixed(2)}</span></div>
      <div className="flex justify-between"><span>IVA:</span><span>${Number(venta.taxAmount || venta.tax || 0).toFixed(2)}</span></div>
      <div className="flex justify-between"><span>Total:</span><span>${Number(venta.total || 0).toFixed(2)}</span></div>
      {isAdmin && <div className="flex justify-between text-green-500"><span>Ganancia:</span><span>+${Number(venta.profit || 0).toFixed(2)}</span></div>}

      {/* Detalle específico para ventas mixtas */}
      {((venta.payment?.method || venta.paymentMethod) === 'mixed') && (
        <>
          <div className="flex justify-between"><span>Mixto — Efectivo</span><span>${Number(((venta.payment?.cashAmount ?? venta.payment?.amountPaid) || 0)).toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Mixto — Transferencia</span><span>${Number(venta.payment?.transferAmount ?? (Number(venta.total || 0) - Number(((venta.payment?.cashAmount ?? venta.payment?.amountPaid) || 0)))).toFixed(2)}</span></div>
          {venta.notes && (
            <div className="flex justify-between text-xs text-muted-foreground"><span>Novedad</span><span className="text-right">{venta.notes}</span></div>
          )}
        </>
      )}
    </div>

    {venta.items?.length > 0 && (
      <ul className="pl-4 mt-2 list-disc text-muted-foreground space-y-0.5">
        {venta.items.map((p, j) => (
          <li key={j}>
            {p.name} — x{p.quantity} — ${Number(p.price || 0).toFixed(2)} c/u
          </li>
        ))}
      </ul>
    )}
  </div>
))}

    </div>
  )}
</div>

      {/* Historial de cierres */}
      <div className="card-glass p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-3 flex items-center">
          <History className="mr-2 h-5 w-5" />Historial de Cierres
        </h2>
        {state.cashClosures.length === 0 ? (
          <p className="text-muted-foreground">No hay cierres registrados.</p>
        ) : (
          <div className="space-y-3">
            {[...state.cashClosures].reverse().map((closure, i) => {
              const expanded = expandedClosure === i;
              return (
                <div key={i} className="bg-background/50 p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{new Date(closure.closedAt).toLocaleDateString()}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(closure.openedAt).toLocaleTimeString()} - {new Date(closure.closedAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button size="icon" variant="ghost" onClick={() => printReport(closure)}>
                        <Printer size={16} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setExpandedClosure(expanded ? null : i)}
                      >
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </Button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-2 border-t pt-2 text-xs space-y-1"
                      >
                        <div>Inicial: ${closure.openingAmount.toFixed(2)}</div>
                        <div>Efectivo: ${closure.salesByType?.cash?.toFixed(2)}</div>
                        <div>Transferencias: ${closure.salesByType?.transfer?.toFixed(2)}</div>
                        <div>Mixto (total): ${closure.salesByType?.mixed?.toFixed(2)}</div>
                        <div>Mixto (efectivo): ${closure.cashFromMixed?.toFixed(2)}</div>
                        <div>Mixto (transferencia): ${(
                          (closure.salesByType?.mixed || 0) - (closure.cashFromMixed || 0)
                        ).toFixed(2)}</div>
                        <div>Esperado: ${closure.expectedAmount.toFixed(2)}</div>
                        <div>Actual: ${closure.currentAmount.toFixed(2)}</div>
                        <div className="font-semibold border-t pt-1 mt-1">Movimientos:</div>
                        {closure.movements?.length > 0 ? (
                          closure.movements.map((m, j) => (
                            <div key={j} className="flex justify-between">
                              <span>{m.concept}</span>
                              <span className={m.type === 'income' ? 'text-green-500' : 'text-red-500'}>
                                {m.type === 'income' ? '+' : '-'}${m.amount.toFixed(2)}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-muted-foreground">Sin movimientos manuales.</div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CashMovementDialog isOpen={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen} />
    </div>
  );
}
