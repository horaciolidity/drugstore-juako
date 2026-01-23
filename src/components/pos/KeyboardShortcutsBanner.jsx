
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Command } from 'lucide-react';

const shortcuts = [
  { key: 'F2', label: 'Buscar' },
  { key: 'F6', label: 'Efectivo' },
  { key: 'F7', label: 'Transferencia' },
  { key: 'F8', label: 'Presupuesto' },
  { key: 'F9', label: 'Remito' },
  { key: 'F10', label: 'Factura' },
  { key: 'Ctrl+P', label: 'Imprimir' },
];

const ShortcutItem = ({ shortcut }) => (
  <div className="flex items-center space-x-2">
    <kbd className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted border border-border rounded-md">{shortcut.key}</kbd>
    <span className="text-sm text-muted-foreground">{shortcut.label}</span>
  </div>
);

export default function KeyboardShortcutsBanner() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile FAB */}
      <div className="md:hidden fixed bottom-4 right-4 z-20">
        <Button size="icon" className="rounded-full w-14 h-14 bg-primary hover:bg-primary/90 shadow-lg" onClick={() => setIsOpen(!isOpen)}>
          <Command />
        </Button>
      </div>

      {/* Mobile Collapsible Banner */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="md:hidden fixed bottom-0 left-0 right-0 z-10 p-2 card-glass border-t border-border"
          >
            <div className="overflow-x-auto scrollbar-thin">
              <div className="flex items-center space-x-4 p-2 whitespace-nowrap">
                {shortcuts.map(s => <ShortcutItem key={s.key} shortcut={s} />)}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Banner */}
      <div className="hidden md:flex fixed bottom-0 left-0 right-0 h-14 bg-background/80 backdrop-blur-sm border-t border-border z-10 items-center justify-center space-x-8 px-4">
        {shortcuts.map(s => <ShortcutItem key={s.key} shortcut={s} />)}
      </div>
    </>
  );
}
