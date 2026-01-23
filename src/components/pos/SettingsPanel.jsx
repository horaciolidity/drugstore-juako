// src/components/pos/SettingsPanel.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Save,
  Upload,
  Download,
  AlertTriangle,
  Sun,
  Moon,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { usePOS } from '@/contexts/POSContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { useTheme } from '@/contexts/ThemeContext';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

export default function SettingsPanel() {
  const { state, dispatch } = usePOS();
  const { isAdmin, setPasswords } = useAuth();
  const [settings, setSettings] = useState(state.settings);
  const { theme, setTheme } = useTheme();
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [newAdminPass, setNewAdminPass] = useState('');
  const [newEmployeePass, setNewEmployeePass] = useState('');

  const handleSave = () => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
    toast({
      title: 'Configuración guardada',
      description:
        'Los datos de la empresa y documentos se actualizaron correctamente.'
    });
  };

  const handleUpdatePasswords = () => {
    if (!newAdminPass.trim() || !newEmployeePass.trim()) {
      toast({
        title: 'Error',
        description: 'Las contraseñas no pueden estar vacías',
        variant: 'destructive'
      });
      return;
    }

    const success = setPasswords(newAdminPass, newEmployeePass);
    if (success) {
      setNewAdminPass('');
      setNewEmployeePass('');
      setPasswordDialog(false);
    }
  };

  const handleSettingsChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleDocumentSettingsChange = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      document: { ...prev.document, [key]: value }
    }));
  };

  const handleWatermarkChange = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      document: {
        ...prev.document,
        watermark: { ...prev.document.watermark, [key]: value }
      }
    }));
  };

  const exportData = () => {
    try {
      const dataToExport = { ...state, cart: undefined };
      const dataStr = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `FerrePOS_Backup_${new Date()
        .toISOString()
        .split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast({
        title: 'Datos exportados',
        description: 'Copia de seguridad creada correctamente.'
      });
    } catch (error) {
      toast({
        title: 'Error al exportar',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const importData = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          dispatch({ type: 'LOAD_DATA', payload: imported });
          setSettings(imported.settings || state.settings);
          toast({
            title: 'Importación completada',
            description: 'Los datos se restauraron correctamente.'
          });
        } catch {
          toast({
            title: 'Error al importar',
            description: 'Archivo de copia inválido.',
            variant: 'destructive'
          });
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Configuración del Sistema</h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="border-yellow-500 text-yellow-600 hover:bg-yellow-500/10">
                  <Lock className="h-4 w-4 mr-2" />
                  Cambiar Contraseñas
                </Button>
              </DialogTrigger>
              <DialogContent className="card-glass border-border">
                <DialogHeader>
                  <DialogTitle>Cambiar Contraseñas</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="adminPass">Contraseña Admin</Label>
                    <Input
                      id="adminPass"
                      type="password"
                      placeholder="Nueva contraseña para admin"
                      value={newAdminPass}
                      onChange={(e) => setNewAdminPass(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="employeePass">Contraseña Empleado</Label>
                    <Input
                      id="employeePass"
                      type="password"
                      placeholder="Nueva contraseña para empleado"
                      value={newEmployeePass}
                      onChange={(e) => setNewEmployeePass(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleUpdatePasswords}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                  >
                    Guardar Contraseñas
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Sun className="h-5 w-5" />
          <Switch
            checked={theme === 'dark'}
            onCheckedChange={(c) => setTheme(c ? 'dark' : 'light')}
          />
          <Moon className="h-5 w-5" />
        </div>
      </div>

      {/* ==================== DATOS EMPRESA ==================== */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-glass p-6 rounded-lg"
      >
        <h2 className="text-xl font-semibold mb-4">Datos de la Empresa</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Nombre Comercial</Label>
            <Input
              value={settings.companyName}
              onChange={(e) =>
                handleSettingsChange('companyName', e.target.value)
              }
            />
          </div>
          <div>
            <Label>Dirección</Label>
            <Input
              value={settings.address}
              onChange={(e) => handleSettingsChange('address', e.target.value)}
            />
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input
              value={settings.phone}
              onChange={(e) => handleSettingsChange('phone', e.target.value)}
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={settings.email || ''}
              onChange={(e) => handleSettingsChange('email', e.target.value)}
            />
          </div>
          <div>
            <Label>CUIT</Label>
            <Input
              value={settings.cuit || ''}
              onChange={(e) => handleSettingsChange('cuit', e.target.value)}
            />
          </div>
          <div>
            <Label>Condición IVA</Label>
            <Select
              value={settings.ivaCondition || 'CF'}
              onValueChange={(v) => handleSettingsChange('ivaCondition', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CF">Consumidor Final</SelectItem>
                <SelectItem value="RI">Responsable Inscripto</SelectItem>
                <SelectItem value="M">Monotributista</SelectItem>
                <SelectItem value="EX">Exento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ==== TASA DE IVA ==== */}
          <div>
            <Label>Tasa de IVA (%)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={Number(settings.taxRate ?? 0)}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                handleSettingsChange('taxRate', isNaN(val) ? 0 : val);
              }}
              onBlur={(e) => {
                const val = parseFloat(e.target.value);
                handleSettingsChange('taxRate', isNaN(val) ? 0 : val);
              }}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Ingresá 0 si tus precios no incluyen IVA.
            </p>
          </div>
        </div>
      </motion.div>

      {/* ==================== PERSONALIZACIÓN ==================== */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card-glass p-6 rounded-lg"
      >
        <h2 className="text-xl font-semibold mb-4">
          Personalización de Documentos
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <Label>Logo URL</Label>
            <Input
              placeholder="https://..."
              value={settings.document.logoUrl}
              onChange={(e) =>
                handleDocumentSettingsChange('logoUrl', e.target.value)
              }
            />
          </div>
          <div>
            <Label>Pie de página legal</Label>
            <Input
              value={settings.document.legalFooter}
              onChange={(e) =>
                handleDocumentSettingsChange('legalFooter', e.target.value)
              }
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch
              id="showQr"
              checked={settings.document.showQr}
              onCheckedChange={(c) =>
                handleDocumentSettingsChange('showQr', c)
              }
            />
            <Label htmlFor="showQr">Mostrar QR en comprobantes</Label>
          </div>
        </div>

        <h3 className="text-lg font-semibold mt-6 mb-4">
          Marca de Agua (Remitos)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <Label>Texto</Label>
            <Input
              placeholder="Ej: NO VÁLIDO"
              value={settings.document.watermark.text}
              onChange={(e) =>
                handleWatermarkChange('text', e.target.value)
              }
            />
          </div>
          <div>
            <Label>Opacidad ({settings.document.watermark.opacity})</Label>
            <Slider
              value={[settings.document.watermark.opacity]}
              onValueChange={([v]) => handleWatermarkChange('opacity', v)}
              max={1}
              step={0.1}
            />
          </div>
          <div>
            <Label>Rotación ({settings.document.watermark.rotation}°)</Label>
            <Slider
              value={[settings.document.watermark.rotation]}
              onValueChange={([v]) => handleWatermarkChange('rotation', v)}
              max={360}
              step={1}
            />
          </div>
        </div>
      </motion.div>

      {/* ==================== PARÁMETROS ==================== */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card-glass p-6 rounded-lg"
      >
        <h2 className="text-xl font-semibold mb-4">Parámetros Generales</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="flex items-center">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Umbral de Recompra (días)
            </Label>
            <Input
              type="number"
              min="1"
              value={settings.restockThreshold || 30}
              onChange={(e) =>
                handleSettingsChange(
                  'restockThreshold',
                  parseInt(e.target.value) || 30
                )
              }
            />
          </div>
        </div>
      </motion.div>

      {/* ==================== BACKUP ==================== */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card-glass p-6 rounded-lg"
      >
        <h2 className="text-xl font-semibold mb-4">Gestión de Datos</h2>
        <div className="flex flex-col md:flex-row gap-4">
          <Button onClick={exportData} variant="outline" className="flex-1">
            <Download className="h-4 w-4 mr-2" />
            Exportar Backup
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <label className="cursor-pointer flex items-center justify-center">
              <Upload className="h-4 w-4 mr-2" />
              Importar Backup
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={importData}
              />
            </label>
          </Button>
        </div>
      </motion.div>

      {/* ==================== GUARDAR ==================== */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex justify-end mt-6"
      >
        <Button size="lg" onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Guardar Configuración
        </Button>
      </motion.div>
    </div>
  );
}
