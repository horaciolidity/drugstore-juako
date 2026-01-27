import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Package, Plus, Edit3, Trash2, Upload, Download, Search, Minus, AlertTriangle, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePOS } from '@/contexts/POSContext';
import { toast } from '@/components/ui/use-toast';

// Función de validación mejorada
const validateProduct = (product, products, editingId = null) => {
  const errors = [];

  // Validar código único
  const duplicateCode = products.find(p => 
    p.code === product.code && p.id !== editingId
  );
  if (duplicateCode) {
    errors.push(`El código "${product.code}" ya existe en el producto "${duplicateCode.name}"`);
  }

  // Validar campos requeridos
  if (!product.code?.trim()) errors.push("El código es requerido");
  if (!product.name?.trim()) errors.push("El nombre es requerido");
  
  // Validar precios
  if (product.price < 0) errors.push("El precio no puede ser negativo");
  if (product.cost < 0) errors.push("El costo no puede ser negativo");
  if (product.price < product.cost) {
    errors.push("El precio de venta no puede ser menor al costo");
  }

  // Validar stock
  if (product.stock < 0) errors.push("El stock no puede ser negativo");
  if (product.minStock < 0) errors.push("El stock mínimo no puede ser negativo");

  return errors;
};

export default function ProductManagement() {
  const { state, dispatch } = usePOS();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [validationErrors, setValidationErrors] = useState([]);
  
  const [newProduct, setNewProduct] = useState({
    code: '',
    name: '',
    price: '',
    cost: '',
    stock: '',
    unit: 'unidad',
    category: '',
    providerId: '',
    minStock: ''
  });

  // Obtener categorías únicas para el filtro
  const categories = useMemo(() => 
    [...new Set(state.products.map(p => p.category).filter(Boolean).sort())],
    [state.products]
  );

  // Productos filtrados y ordenados con useMemo para mejor rendimiento
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = state.products.filter(product => {
      const matchesSearch = 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;      
      return matchesSearch && matchesCategory;
    });

    // Ordenar alfabéticamente por nombre
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [state.products, searchQuery, categoryFilter]);

  // Paginación para manejar muchos productos
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50; // Mostrar 50 productos por página

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedProducts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedProducts.length / itemsPerPage);

  // Validar producto en tiempo real
  const validateInRealTime = useCallback((product, editingId = null) => {
    const errors = validateProduct(product, state.products, editingId);
    setValidationErrors(errors);
    return errors.length === 0;
  }, [state.products]);

  const resetForm = () => {
    setNewProduct({
      code: '',
      name: '',
      price: 0,
      cost: 0,
      stock: 0,
      unit: 'unidad',
      category: '',
      providerId: '',
      minStock: 0
    });
    setEditingProduct(null);
    setValidationErrors([]);
  };

  const handleSaveProduct = () => {
    if (!validateInRealTime(newProduct, editingProduct?.id)) {
      toast({ 
        title: "Errores de validación", 
        description: validationErrors.join(', '), 
        variant: "destructive" 
      });
      return;
    }

    // Sanitizar campos numéricos antes de enviar al reducer
    const sanitized = {
      ...newProduct,
      price: Number(newProduct.price === '' ? 0 : newProduct.price),
      cost: Number(newProduct.cost === '' ? 0 : newProduct.cost),
      stock: Number(newProduct.stock === '' ? 0 : newProduct.stock),
      minStock: Number(newProduct.minStock === '' ? 0 : newProduct.minStock),
    };

    if (editingProduct) {
      dispatch({ type: 'UPDATE_PRODUCT', payload: { id: editingProduct.id, updates: sanitized } });
      toast({ title: "Producto actualizado", description: `${sanitized.name} ha sido actualizado` });
    } else {
      dispatch({ type: 'ADD_PRODUCT', payload: sanitized });
      toast({ title: "Producto agregado", description: `${sanitized.name} ha sido agregado` });
    }

    setIsAddDialogOpen(false);
    resetForm();
    setCurrentPage(1); // Volver a primera página después de agregar
  };

  const handleEditProduct = (product) => {
    setNewProduct(product);
    setEditingProduct(product);
    setIsAddDialogOpen(true);
    validateInRealTime(product, product.id);
  };

  const handleDeleteProduct = (productId) => {
    const product = state.products.find(p => p.id === productId);
    if (product && window.confirm(`¿Estás seguro de eliminar el producto "${product.name}"?`)) {
      dispatch({ type: 'DELETE_PRODUCT', payload: productId });
      toast({ title: "Producto eliminado", description: "El producto ha sido eliminado" });
    }
  };

 // FUNCIÓN DE IMPORTACIÓN CORREGIDA - ACTUALIZA SOLO PRODUCTOS MODIFICADOS
const importProducts = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.csv,.txt';
  
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop().toLowerCase();

    // Mensaje más claro sobre lo que hará
    if (!window.confirm(
      `¿Importar productos desde ${file.name}?\n\n` +
      `• Se actualizarán los productos existentes que coincidan por código\n` +
      `• Se agregarán productos nuevos\n` +
      `• Los productos que no estén en el archivo se mantendrán`
    )) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let importedProducts = [];
        const fileContent = event.target.result;

        switch (fileExtension) {
          case 'json':
            importedProducts = JSON.parse(fileContent);
            break;

          case 'csv':
            importedProducts = parseCSV(fileContent);
            break;

          case 'txt':
            importedProducts = parseTXT(fileContent);
            break;

          default:
            throw new Error('Formato de archivo no soportado');
        }

        if (!Array.isArray(importedProducts)) {
          // Soportar objetos JSON con campo `products`
          if (importedProducts && typeof importedProducts === 'object' && Array.isArray(importedProducts.products)) {
            importedProducts = importedProducts.products;
          } else {
            throw new Error('El archivo debe contener un array de productos o un objeto con la propiedad "products"');
          }
        }

        // Normalizar claves comunes de archivos (soporta encabezados en español/inglés y variantes)
        const normalizeKey = (k) => String(k || '').toLowerCase().normalize('NFD').replace(/[ -\u036f]/g, '').replace(/[^a-z0-9]/g, '');
        const headerAliases = {
          code: ['code', 'codigo', 'cod', 'codigo', 'codi'],
          name: ['name', 'nombre', 'descripcion', 'description'],
          price: ['price', 'precio', 'valor'],
          cost: ['cost', 'costo'],
          stock: ['stock', 'existencia', 'cantidad'],
          unit: ['unit', 'unidad'],
          category: ['category', 'categoria', 'categoria'],
          minStock: ['minstock', 'stockminimo', 'stockminimo'],
          provider: ['provider', 'proveedor']
        };

        const normalizeImported = (raw) => {
          const out = { code: '', name: '', price: 0, cost: 0, stock: 0, unit: 'unidad', category: '', minStock: 0, providerId: '' };
          Object.keys(raw || {}).forEach(k => {
            const nk = normalizeKey(k);
            const v = raw[k];
            for (const target in headerAliases) {
              if (headerAliases[target].some(a => a === nk)) {
                if (target === 'provider') {
                  const provName = String(v || '').trim().toLowerCase();
                  const prov = state.providers.find(p => (p.name || '').toLowerCase() === provName);
                  if (prov) out.providerId = prov.id;
                } else if (['price', 'cost', 'stock', 'minStock'].includes(target)) {
                  const num = parseFloat(String(v).replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
                  out[target] = num;
                } else {
                  out[target] = String(v || '').trim();
                }
              }
            }
          });
          return out;
        };

        importedProducts = importedProducts.map(normalizeImported);

        // Detectar duplicados en archivo
        const codeCounts = {};
        importedProducts.forEach(p => {
          const k = (p.code || '').toString().trim();
          if (!k) return;
          codeCounts[k] = (codeCounts[k] || 0) + 1;
        });
        const fileDuplicates = Object.keys(codeCounts).filter(k => codeCounts[k] > 1);

        // Validar cada producto y separar válidos/invalidos para permitir import parcial
        const invalidItems = [];
        const validItems = [];
        importedProducts.forEach((p, idx) => {
          const errs = [];
          if (!p.code || !String(p.code).trim()) errs.push('código requerido');
          if (!p.name || !String(p.name).trim()) errs.push('nombre requerido');
          if (isNaN(p.price) || Number(p.price) < 0) errs.push('precio inválido');
          if (isNaN(p.cost) || Number(p.cost) < 0) errs.push('costo inválido');
          if (isNaN(p.stock) || Number(p.stock) < 0) errs.push('stock inválido');
          if (isNaN(p.minStock) || Number(p.minStock) < 0) errs.push('stock mínimo inválido');

          if (errs.length > 0) {
            invalidItems.push({ index: idx + 1, code: p.code, name: p.name, errors: errs });
          } else {
            validItems.push(p);
          }
        });

        if (invalidItems.length > 0 && validItems.length === 0) {
          // Si NO hay items válidos, informar y abortar
          toast({
            title: 'Errores en los datos importados',
            description: `${invalidItems.length} producto(s) inválido(s). Revise el archivo.`,
            variant: 'destructive',
          });
          // Guardar issues para banner
          dispatch({ type: 'SET_IMPORT_ISSUES', payload: { duplicates: fileDuplicates, invalids: invalidItems } });
          return;
        }

        let added = 0;
        let updated = 0;
        let unchanged = 0;

        // LÓGICA: Actualizar solo productos modificados, procesando solo `validItems`
        const processingInvalids = [];
        validItems.forEach(importedProduct => {
          // Validar contra las reglas del formulario para evitar rechazos silenciosos del reducer
          const formErrors = validateProduct(importedProduct, state.products, null);
          if (formErrors.length > 0) {
            processingInvalids.push({ code: importedProduct.code, name: importedProduct.name, errors: formErrors });
            return;
          }

          const existingProduct = state.products.find(p => p.code === importedProduct.code);

          if (existingProduct) {
            // Verificar si realmente hay cambios antes de actualizar
            const hasChanges =
              existingProduct.name !== importedProduct.name ||
              Number(existingProduct.price) !== Number(importedProduct.price) ||
              Number(existingProduct.cost) !== Number(importedProduct.cost) ||
              Number(existingProduct.stock) !== Number(importedProduct.stock) ||
              existingProduct.unit !== importedProduct.unit ||
              existingProduct.category !== importedProduct.category ||
              Number(existingProduct.minStock) !== Number(importedProduct.minStock);

            if (hasChanges) {
              dispatch({
                type: 'UPDATE_PRODUCT',
                payload: {
                  id: existingProduct.id,
                  updates: {
                    ...importedProduct,
                    // Mantener el ID original y providerId
                    id: existingProduct.id,
                    providerId: importedProduct.providerId || existingProduct.providerId
                  }
                }
              });
              updated++;
            } else {
              unchanged++;
            }
          } else {
            // Agregar nuevo producto
            dispatch({
              type: 'ADD_PRODUCT',
              payload: {
                ...importedProduct,
                id: Date.now().toString() // Generar nuevo ID
              }
            });
            added++;
          }
        });

        // Merge any processing invalids into fileInvalids
        const fileInvalids = (typeof invalidItems !== 'undefined' ? invalidItems : []).map(i => ({ code: i.code, name: i.name, index: i.index, errors: i.errors }));
        processingInvalids.forEach(pi => fileInvalids.push({ code: pi.code, name: pi.name, errors: pi.errors }));

        // Si existieron invalidItems, guardarlos para mostrar en banner
        const fileInvalids = (typeof invalidItems !== 'undefined' ? invalidItems : []).map(i => ({ code: i.code, name: i.name, index: i.index, errors: i.errors }));

        toast({
          title: "Importación completada",
          description: `${added} nuevos, ${updated} actualizados, ${unchanged} sin cambios`
        });

        // Limpiar issues si la importación fue exitosa
        dispatch({ type: 'SET_IMPORT_ISSUES', payload: { duplicates: [], invalids: [] } });

      } catch (error) {
        console.error('Error importing products:', error);
        toast({
          title: "Error al importar",
          description: error.message || "Formato de archivo inválido",
          variant: "destructive"
        });
      }
    };

    reader.readAsText(file);
  };

  input.click();
};

// FUNCIÓN PARA PARSEAR CSV (detecta delimitador y mantiene encabezados para normalización posterior)
const parseCSV = (csvContent) => {
  const lines = csvContent.split('\n').filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  // Detectar delimitador: elegir ';' si aparece más que ',' en la primera línea
  const firstLine = lines[0];
  const delim = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';

  const headers = lines[0].split(delim).map(header => header.trim().replace(/"/g, ''));

  return lines.slice(1).map(line => {
    const values = line.split(delim).map(value => value.trim().replace(/"/g, ''));
    const product = {};

    headers.forEach((header, index) => {
      let value = values[index] || '';

      product[header] = value;
    });

    return product;
  });
};

// PARSER DE TXT MEJORADO
const parseTXT = (txtContent) => {
  const products = [];
  const sections = txtContent.split('----------------------------------------');
  
  sections.forEach(section => {
    if (!section.trim()) return;
    
    const lines = section.split('\n').filter(line => line.trim());
    const product = {
      code: '',
      name: '',
      price: 0,
      cost: 0,
      stock: 0,
      unit: 'unidad',
      category: '',
      minStock: 0,
      providerId: ''
    };
    
    lines.forEach(line => {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex === -1) return;
      
      const key = line.substring(0, separatorIndex).trim();
      const value = line.substring(separatorIndex + 1).trim();
      
      const cleanKey = key.toLowerCase();
      
      switch (cleanKey) {
        case 'código':
          product.code = value;
          break;
        case 'nombre':
          product.name = value;
          break;
        case 'proveedor':
          // Buscar proveedor por nombre para obtener ID
          const provider = state.providers.find(p => 
            p.name.toLowerCase() === value.toLowerCase()
          );
          if (provider) {
            product.providerId = provider.id;
          }
          break;
        case 'precio':
          product.price = parseFloat(value.replace('$', '').replace(',', '')) || 0;
          break;
        case 'costo':
          product.cost = parseFloat(value.replace('$', '').replace(',', '')) || 0;
          break;
        case 'stock':
          const stockMatch = value.match(/([\d.]+)\s*(\w+)/);
          if (stockMatch) {
            product.stock = parseFloat(stockMatch[1]) || 0;
            product.unit = stockMatch[2] || 'unidad';
          } else {
            product.stock = parseFloat(value) || 0;
          }
          break;
        case 'categoría':
          product.category = value !== 'N/A' ? value : '';
          break;
        case 'stock mínimo':
          product.minStock = parseInt(value) || 0;
          break;
      }
    });
    
    // Solo agregar si tiene código y nombre
    if (product.code && product.name) {
      products.push(product);
    }
  });
  
  return products;
};

// VALIDAR PRODUCTOS IMPORTADOS - MEJORADA
const validateImportedProducts = (products) => {
  const errors = [];
  const seenCodes = new Set();

  products.forEach((product, index) => {
    // Validar código único en el archivo
    if (seenCodes.has(product.code)) {
      errors.push(`Código duplicado en archivo: "${product.code}" en línea ${index + 1}`);
    }
    seenCodes.add(product.code);

    // Validar campos requeridos
    if (!product.code?.trim()) {
      errors.push(`Línea ${index + 1}: código requerido`);
    }
    if (!product.name?.trim()) {
      errors.push(`Línea ${index + 1}: nombre requerido`);
    }

    // Validar números
    if (isNaN(product.price) || product.price < 0) {
      errors.push(`Línea ${index + 1}: precio inválido`);
    }
    if (isNaN(product.cost) || product.cost < 0) {
      errors.push(`Línea ${index + 1}: costo inválido`);
    }
    if (isNaN(product.stock) || product.stock < 0) {
      errors.push(`Línea ${index + 1}: stock inválido`);
    }
    if (isNaN(product.minStock) || product.minStock < 0) {
      errors.push(`Línea ${index + 1}: stock mínimo inválido`);
    }
  });

  return errors;
};

  // CORRECCIÓN CRÍTICA: Select de Proveedor corregido
  const ProviderSelect = () => (
    <Select 
      value={newProduct.providerId || "none"} 
      onValueChange={(value) => {
        const updated = { 
          ...newProduct, 
          providerId: value === "none" ? "" : value 
        };
        setNewProduct(updated);
        validateInRealTime(updated, editingProduct?.id);
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="Seleccionar proveedor..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Sin proveedor</SelectItem>
        {state.providers.map(p => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const exportProducts = (format = 'json') => {
    try {
      let dataStr, mimeType, extension;
      
      if (format === 'csv') {
        const headers = ['Código', 'Nombre', 'Proveedor', 'Precio', 'Costo', 'Stock', 'Unidad', 'Categoría', 'Stock Mínimo'];
        const csvData = state.products.map(p => [
          p.code,
          p.name,
          state.providers.find(prov => prov.id === p.providerId)?.name || 'N/A',
          p.price,
          p.cost,
          p.stock,
          p.unit,
          p.category,
          p.minStock
        ]);
        
        const csvContent = [headers, ...csvData]
          .map(row => row.map(field => `"${field}"`).join(','))
          .join('\n');
        
        dataStr = csvContent;
        mimeType = 'text/csv;charset=utf-8;';
        extension = 'csv';
      } else if (format === 'txt') {
        // Formato TXT - más legible para humanos
        const txtContent = state.products.map(p => {
          const provider = state.providers.find(prov => prov.id === p.providerId)?.name || 'N/A';
          return [
            `Código: ${p.code}`,
            `Nombre: ${p.name}`,
            `Proveedor: ${provider}`,
            `Precio: $${p.price.toFixed(2)}`,
            `Costo: $${p.cost.toFixed(2)}`,
            `Stock: ${p.stock} ${p.unit}`,
            `Categoría: ${p.category || 'N/A'}`,
            `Stock Mínimo: ${p.minStock}`,
            `Margen: ${p.price > 0 ? (((p.price - p.cost) / p.price * 100).toFixed(1)) : 0}%`,
            '----------------------------------------'
          ].join('\n');
        }).join('\n\n');

        // Cabecera del archivo
        dataStr = `INVENTARIO - ${state.settings.companyName}\n` +
                  `Fecha: ${new Date().toLocaleDateString()}\n` +
                  `Total productos: ${state.products.length}\n` +
                  '========================================\n\n' +
                  txtContent;
        
        mimeType = 'text/plain;charset=utf-8;';
        extension = 'txt';
      } else {
        dataStr = JSON.stringify(state.products, null, 2);
        mimeType = 'application/json';
        extension = 'json';
      }

      const dataBlob = new Blob([dataStr], { type: mimeType });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `productos.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({ title: `Productos exportados a ${format.toUpperCase()}` });
    } catch (error) {
      console.error('Error exporting products:', error);
      toast({ 
        title: "Error al exportar", 
        description: "No se pudieron exportar los productos", 
        variant: "destructive" 
      });
    }
  };

  const adjustStock = (productId, adjustment) => {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;
    
    const newStock = Math.max(0, product.stock + adjustment);
    dispatch({ type: 'UPDATE_PRODUCT', payload: { id: productId, updates: { stock: newStock } } });
    toast({ 
      title: "Stock ajustado", 
      description: `${product.name}: ${product.stock} → ${newStock}` 
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Gestión de Productos 
          <span className="text-sm text-muted-foreground ml-2">
            ({state.products.length} productos totales)
          </span>
        </h1>
        <div className="flex space-x-2">
          {/* BOTÓN DE IMPORTACIÓN AGREGADO AQUÍ */}
          <Button onClick={importProducts} variant="outline">
            <Upload className="h-4 w-4 mr-2" />Importar Productos
          </Button>
          <Button onClick={() => exportProducts('txt')} variant="outline">
            <Download className="h-4 w-4 mr-2" />Exportar TXT
          </Button>
          <Button onClick={() => exportProducts('csv')} variant="outline">
            <Download className="h-4 w-4 mr-2" />Exportar CSV
          </Button>
          <Button onClick={() => exportProducts('json')} variant="outline">
            <Download className="h-4 w-4 mr-2" />Exportar JSON
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />Nuevo Producto
              </Button>
            </DialogTrigger>
            <DialogContent className="card-glass border-border max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
              </DialogHeader>
              
              {/* Mostrar errores de validación */}
              {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-800 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-semibold">Errores de validación:</span>
                  </div>
                  <ul className="text-red-700 text-sm list-disc list-inside space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">Código *</Label>
                  <Input 
                    id="code" 
                    value={newProduct.code} 
                    onChange={(e) => {
                      const updated = { ...newProduct, code: e.target.value };
                      setNewProduct(updated);
                      validateInRealTime(updated, editingProduct?.id);
                    }}
                    className={validationErrors.some(e => e.includes('código')) ? 'border-red-500' : ''}
                  />
                </div>
                <div>
                  <Label htmlFor="name">Nombre *</Label>
                  <Input 
                    id="name" 
                    value={newProduct.name} 
                    onChange={(e) => {
                      const updated = { ...newProduct, name: e.target.value };
                      setNewProduct(updated);
                      validateInRealTime(updated, editingProduct?.id);
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="price">Precio</Label>
                  <Input 
                    id="price" 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    value={newProduct.price} 
                    onChange={(e) => {
                      const updated = { ...newProduct, price: e.target.value === '' ? '' : parseFloat(e.target.value) };
                      setNewProduct(updated);
                      validateInRealTime(updated, editingProduct?.id);
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="cost">Costo</Label>
                  <Input 
                    id="cost" 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    value={newProduct.cost} 
                    onChange={(e) => {
                      const updated = { ...newProduct, cost: e.target.value === '' ? '' : parseFloat(e.target.value) };
                      setNewProduct(updated);
                      validateInRealTime(updated, editingProduct?.id);
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="stock">Stock</Label>
                  <Input 
                    id="stock" 
                    type="number" 
                    min="0" 
                    value={newProduct.stock} 
                    onChange={(e) => {
                      const updated = { ...newProduct, stock: e.target.value === '' ? '' : parseFloat(e.target.value) };
                      setNewProduct(updated);
                      validateInRealTime(updated, editingProduct?.id);
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="unit">Unidad</Label>
                  <Select 
                    value={newProduct.unit} 
                    onValueChange={(value) => {
                      const updated = { ...newProduct, unit: value };
                      setNewProduct(updated);
                      validateInRealTime(updated, editingProduct?.id);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unidad">Unidad</SelectItem>
                      <SelectItem value="kg">Kilogramo</SelectItem>
                      <SelectItem value="metro">Metro</SelectItem>
                      <SelectItem value="litro">Litro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="category">Categoría</Label>
                  <Input 
                    id="category" 
                    value={newProduct.category} 
                    onChange={(e) => {
                      const updated = { ...newProduct, category: e.target.value };
                      setNewProduct(updated);
                      validateInRealTime(updated, editingProduct?.id);
                    }}
                    list="categories" 
                  />
                  <datalist id="categories">
                    {categories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <Label htmlFor="providerId">Proveedor</Label>
                  <ProviderSelect />
                </div>
                <div>
                  <Label htmlFor="minStock">Stock mínimo</Label>
                  <Input 
                    id="minStock" 
                    type="number" 
                    min="0" 
                    value={newProduct.minStock} 
                    onChange={(e) => {
                      const updated = { ...newProduct, minStock: e.target.value === '' ? '' : parseFloat(e.target.value) };
                      setNewProduct(updated);
                      validateInRealTime(updated, editingProduct?.id);
                    }}
                  />
                </div>
              </div>
              <div className="flex space-x-2 mt-4">
                <Button 
                  onClick={handleSaveProduct} 
                  className="flex-1"
                  disabled={validationErrors.length > 0}
                >
                  {editingProduct ? 'Actualizar' : 'Agregar'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => { 
                    setIsAddDialogOpen(false); 
                    resetForm(); 
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filtros mejorados */}
      <div className="card-glass p-4 rounded-lg">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex items-center space-x-4 flex-1">
            <Search className="h-5 w-5 text-primary" />
            <Input 
              placeholder="Buscar productos por nombre, código o categoría..." 
              value={searchQuery} 
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1); // Resetear a primera página al buscar
              }} 
              className="flex-1" 
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-primary" />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(searchQuery || categoryFilter) && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('');
                  setCurrentPage(1);
                }}
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          Mostrando {paginatedProducts.length} de {filteredAndSortedProducts.length} productos
        </div>
      </div>

      {/* Tabla con paginación */}
      <div className="card-glass p-6 rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-muted-foreground p-2">Código</th>
                <th className="text-left text-muted-foreground p-2">Nombre</th>
                <th className="text-left text-muted-foreground p-2">Proveedor</th>
                <th className="text-right text-muted-foreground p-2">Precio</th>
                <th className="text-right text-muted-foreground p-2">Stock</th>
                <th className="text-right text-muted-foreground p-2">Margen</th>
                <th className="text-center text-muted-foreground p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.map((product, index) => {
                const margin = product.price > 0 ? ((product.price - product.cost) / product.price * 100) : 0;
                const stockColor = product.stock <= product.minStock ? 
                  (product.stock === 0 ? 'text-red-500' : 'text-yellow-500') : 'text-green-500';
                const provider = state.providers.find(p => p.id === product.providerId);
                
                return (
                  <motion.tr 
                    key={product.id} 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: index * 0.05 }} 
                    className="border-b border-border/50 hover:bg-accent"
                  >
                    <td className="p-3 text-muted-foreground font-mono">{product.code}</td>
                    <td className="p-3 font-medium">{product.name}</td>
                    <td className="p-3 text-muted-foreground">{provider?.name || 'N/A'}</td>
                    <td className="p-3 text-right">${product.price.toFixed(2)}</td>
                    <td className={`p-3 text-right font-medium ${stockColor}`}>
                      {product.stock} {product.unit}
                      {product.stock <= product.minStock && (
                        <AlertTriangle className="h-3 w-3 inline ml-1" />
                      )}
                    </td>
                    <td className="p-3 text-right text-green-500">{margin.toFixed(1)}%</td>
                    <td className="p-3">
                      <div className="flex items-center justify-center space-x-1">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => adjustStock(product.id, -1)} 
                          className="h-8 w-8 text-red-500"
                        >
                          <Minus size={16} />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => adjustStock(product.id, 1)} 
                          className="h-8 w-8 text-green-500"
                        >
                          <Plus size={16} />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => handleEditProduct(product)} 
                          className="h-8 w-8 text-primary"
                        >
                          <Edit3 size={16} />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => handleDeleteProduct(product.id)} 
                          className="h-8 w-8 text-red-500"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
          
          {paginatedProducts.length === 0 && (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-muted-foreground">No se encontraron productos</p>
            </div>
          )}
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
            <div className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}