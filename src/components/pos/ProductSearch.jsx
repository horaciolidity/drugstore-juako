import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Package, Plus, Scale, Ruler, Droplets, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { usePOS } from '@/contexts/POSContext';
import { toast } from '@/components/ui/use-toast';

// Función para validar productos y detectar problemas (usa map de códigos para evitar O(n^2))
const validateProduct = (product, allProducts, codeCounts = {}) => {
  const issues = [];

  const codeKey = (product.code || '').toLowerCase();
  const duplicate = codeKey && (codeCounts[codeKey] || 0) > 1;
  if (duplicate) {
    issues.push({ type: 'error', message: `Código duplicado: ${product.code}` });
  }

  if (!product.code?.toString().trim()) {
    issues.push({ type: 'error', message: 'Código de producto vacío' });
  }

  if (!product.name?.toString().trim()) {
    issues.push({ type: 'error', message: 'Nombre de producto vacío' });
  }

  if (Number(product.price) < 0) {
    issues.push({ type: 'error', message: 'Precio negativo' });
  }

  if (Number(product.cost) < 0) {
    issues.push({ type: 'error', message: 'Costo negativo' });
  }

  if (Number(product.price) < Number(product.cost)) {
    issues.push({ type: 'warning', message: 'Precio menor al costo' });
  }

  if (Number(product.stock) < 0) {
    issues.push({ type: 'error', message: 'Stock negativo' });
  }

  if (Number(product.minStock) < 0) {
    issues.push({ type: 'error', message: 'Stock mínimo negativo' });
  }

  if (Number(product.stock) <= Number(product.minStock) && Number(product.stock) > 0) {
    issues.push({ type: 'warning', message: `Stock bajo (${product.stock} ${product.unit})` });
  }

  if (Number(product.stock) === 0) {
    issues.push({ type: 'error', message: 'Stock agotado' });
  }

  if (!product.category?.toString().trim()) {
    issues.push({ type: 'warning', message: 'Sin categoría asignada' });
  }

  if (!product.providerId) {
    issues.push({ type: 'warning', message: 'Sin proveedor asignado' });
  }

  return { ...product, issues, hasErrors: issues.some(i => i.type === 'error'), hasWarnings: issues.some(i => i.type === 'warning'), isValid: issues.length === 0 };
};

export default function ProductSearch({ searchQuery }) {
  const { state, addToCart } = usePOS();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [issuesDialogOpen, setIssuesDialogOpen] = useState(false);
  const [productsWithIssues, setProductsWithIssues] = useState([]);
  const [lastScannedCode, setLastScannedCode] = useState('');

  // Productos validados y enriquecidos con información de problemas
  const validatedProducts = useMemo(() => {
    // Construir mapa de conteo de códigos para detectar duplicados de forma eficiente
    const codeCounts = {};
    state.products.forEach(p => {
      const key = (p.code || '').toLowerCase();
      if (!key) return;
      codeCounts[key] = (codeCounts[key] || 0) + 1;
    });

    return state.products.map(product => validateProduct(product, state.products, codeCounts));
  }, [state.products]);

  // Productos con problemas (para el diálogo de reporte)
  const problematicProducts = useMemo(() => {
    return validatedProducts.filter(product => !product.isValid);
  }, [validatedProducts]);

  // Estadísticas de problemas
  const issuesStats = useMemo(() => {
    const errors = validatedProducts.filter(p => p.hasErrors).length;
    const warnings = validatedProducts.filter(p => p.hasWarnings && !p.hasErrors).length;
    const totalProblems = validatedProducts.reduce((sum, p) => sum + p.issues.length, 0);
    
    return { errors, warnings, totalProblems, totalProducts: validatedProducts.length };
  }, [validatedProducts]);

  // Efecto para auto-agregar producto cuando se escanea código exacto
  React.useEffect(() => {
    if (!searchQuery.trim() || searchQuery === lastScannedCode) return;

    const query = searchQuery.trim().toLowerCase();
    
    // Buscar coincidencia exacta de código de barras
    const exactMatch = validatedProducts.find(
      product => product.code.toLowerCase() === query
    );

    if (exactMatch && exactMatch.stock > 0) {
      // Auto-agregar el producto al carrito
      addToCart(exactMatch, 1);
      setLastScannedCode(query);
      
      // Opcional: mostrar feedback visual
      toast({ 
        title: 'Producto escaneado', 
        description: `${exactMatch.name} agregado al carrito` 
      });
    }
  }, [searchQuery, validatedProducts, lastScannedCode, addToCart]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return validatedProducts.slice(0, 12);

    const query = searchQuery.toLowerCase();

    return validatedProducts.filter(product => {
      const providerName = (state.providers.find(p => p.id === product.providerId)?.name || '').toLowerCase();
      return (
        (product.name || '').toLowerCase().includes(query) ||
        (product.code || '').toLowerCase().includes(query) ||
        (product.category || '').toLowerCase().includes(query) ||
        (providerName).includes(query) ||
        (product.id || '').toString().toLowerCase().includes(query)
      );
    });
  }, [searchQuery, validatedProducts, state.providers]);

  const handleProductClick = (product) => {
    if (product.unit === 'unidad') {
      addToCart(product, 1);
    } else {
      setSelectedProduct(product);
      setQuantity(1);
      setCustomPrice('');
      setIsDialogOpen(true);
    }
  };

  const handleAddWithQuantity = () => {
    if (!selectedProduct) return;
    
    const qty = parseFloat(quantity);
    const price = customPrice ? parseFloat(customPrice) : selectedProduct.price;
    
    if (qty <= 0) {
      toast({ title: "Error", description: "La cantidad debe ser mayor a 0", variant: "destructive" });
      return;
    }

    if (customPrice && price <= 0) {
      toast({ title: "Error", description: "El precio debe ser mayor a 0", variant: "destructive" });
      return;
    }

    addToCart(selectedProduct, qty, customPrice ? price : null);
    setIsDialogOpen(false);
    setSelectedProduct(null);
  };

  const getUnitIcon = (unit) => {
    switch (unit) {
      case 'kg': return <Scale className="h-4 w-4" />;
      case 'metro': return <Ruler className="h-4 w-4" />;
      case 'litro': return <Droplets className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const getStockColor = (product) => {
    if (product.stock === 0) return 'text-red-500';
    if (product.stock <= product.minStock) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getStatusIcon = (product) => {
    if (product.hasErrors) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    if (product.hasWarnings) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const showIssuesReport = () => {
    setProductsWithIssues(problematicProducts);
    setIssuesDialogOpen(true);
  };

  return (
    <>
      {/* Banner de advertencia de problemas */}
      {issuesStats.errors > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <h4 className="text-red-800 font-semibold">
                  Se detectaron problemas en {issuesStats.errors} productos
                </h4>
                <p className="text-red-700 text-sm">
                  {issuesStats.errors} errores críticos • {issuesStats.warnings} advertencias
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={showIssuesReport}
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              Ver detalles
            </Button>
          </div>
        </motion.div>
      )}

      {issuesStats.warnings > 0 && issuesStats.errors === 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <h4 className="text-yellow-800 font-semibold">
                  Advertencias en {issuesStats.warnings} productos
                </h4>
                <p className="text-yellow-700 text-sm">
                  Revisa los productos marcados para mejorar la gestión de inventario
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={showIssuesReport}
              className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
            >
              Ver detalles
            </Button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto scrollbar-thin">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full text-center py-8">
            <Package className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? 'No se encontraron productos' : 'No hay productos disponibles'}
            </p>
          </div>
        ) : (
          filteredProducts.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`card-glass p-4 rounded-lg hover:bg-accent transition-colors cursor-pointer group relative ${
                product.hasErrors ? 'border-l-4 border-l-red-500' : 
                product.hasWarnings ? 'border-l-4 border-l-yellow-500' : ''
              }`}
              onClick={() => handleProductClick(product)}
            >
              {/* Indicador de estado */}
              <div className="absolute top-2 right-2">
                {getStatusIcon(product)}
              </div>

              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {getUnitIcon(product.unit)}
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    {product.category || 'Sin categoría'}
                  </span>
                </div>
                <span className={`text-xs font-medium ${getStockColor(product)}`}>
                  {product.stock} {product.unit}
                </span>
              </div>
              
              <h3 className="font-medium mb-1 group-hover:text-primary transition-colors pr-6">
                {product.name}
              </h3>
              
              <p className="text-muted-foreground text-sm mb-2">
                Código: {product.code}
              </p>

              {/* Badges de problemas (solo muestra los primeros 2) */}
              {product.issues.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {product.issues.slice(0, 2).map((issue, idx) => (
                    <Badge 
                      key={idx}
                      variant={issue.type === 'error' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {issue.type === 'error' ? 'Error' : 'Advertencia'}
                    </Badge>
                  ))}
                  {product.issues.length > 2 && (
                    <Badge variant="outline" className="text-xs">
                      +{product.issues.length - 2} más
                    </Badge>
                  )}
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <span className="text-primary font-semibold">
                  ${product.price.toFixed(2)}
                </span>
                <Button
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleProductClick(product);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Diálogo para agregar productos con cantidad */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="card-glass border-border">
          <DialogHeader>
            <DialogTitle>
              Agregar {selectedProduct?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="quantity">
                Cantidad ({selectedProduct?.unit})
              </Label>
              <Input
                id="quantity"
                type="number"
                step={selectedProduct?.unit === 'unidad' ? '1' : '0.1'}
                min="0.1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                autoFocus
              />
            </div>
            
            <div>
              <Label htmlFor="customPrice">
                Precio personalizado (opcional)
              </Label>
              <Input
                id="customPrice"
                type="number"
                step="0.01"
                min="0"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder={`Precio actual: $${selectedProduct?.price.toFixed(2)}`}
              />
            </div>
            
            <div className="flex space-x-2">
              <Button
                onClick={handleAddWithQuantity}
                className="flex-1"
              >
                Agregar al carrito
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de reporte de problemas */}
      <Dialog open={issuesDialogOpen} onOpenChange={setIssuesDialogOpen}>
        <DialogContent className="card-glass border-border max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Reporte de Problemas en Productos</DialogTitle>
            <DialogDescription>
              {issuesStats.totalProblems} problemas detectados en {issuesStats.totalProducts} productos
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {productsWithIssues.map((product) => (
              <div key={product.id} className="border rounded-lg p-4 bg-background/50">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold">{product.name}</h4>
                    <p className="text-sm text-muted-foreground">Código: {product.code}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-sm font-medium ${getStockColor(product)}`}>
                      Stock: {product.stock} {product.unit}
                    </span>
                    {getStatusIcon(product)}
                  </div>
                </div>
                
                <div className="space-y-2">
                  {product.issues.map((issue, index) => (
                    <div 
                      key={index}
                      className={`flex items-start space-x-2 p-2 rounded text-sm ${
                        issue.type === 'error' 
                          ? 'bg-red-50 text-red-800 border border-red-200' 
                          : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                      }`}
                    >
                      {issue.type === 'error' ? 
                        <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /> : 
                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      }
                      <span>{issue.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {productsWithIssues.length === 0 && (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-muted-foreground">¡Excelente! No se detectaron problemas en los productos.</p>
              </div>
            )}
          </div>
          
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {issuesStats.errors > 0 && (
                <span className="text-red-600 font-medium">
                  {issuesStats.errors} error(es) crítico(s) • 
                </span>
              )}
              {issuesStats.warnings > 0 && (
                <span className="text-yellow-600 font-medium">
                  {' '}{issuesStats.warnings} advertencia(s)
                </span>
              )}
            </div>
            <Button 
              variant="outline" 
              onClick={() => setIssuesDialogOpen(false)}
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}