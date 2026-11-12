/**
 * ============================================================================
 * COMERSYS — SERVICIO DE INVENTARIO, GRUPOS DINÁMICOS Y PRODUCTOS
 * ============================================================================
 */
(function (global) {
  'use strict';

  const { Storage, Validators, Formatters } = global.ComerSys.Core;

  const InventoryService = {
    /**
     * Lista todos los grupos con el conteo real de productos y unidades en stock.
     */
    getGroups(searchQuery = '') {
      const db = Storage.getState();
      const q = Validators.normalizeText(searchQuery);

      return db.groups
        .map((group) => {
          const groupProducts = db.products.filter((p) => Number(p.groupId) === Number(group.id));
          const totalUnits = groupProducts.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
          const inventoryValue = groupProducts.reduce(
            (acc, p) => acc + (Number(p.stock) || 0) * (Number(p.purchasePrice) || 0),
            0
          );
          return Object.assign({}, group, {
            productCount: groupProducts.length,
            totalUnits,
            inventoryValue: Validators.roundCurrency(inventoryValue)
          });
        })
        .filter((group) => {
          if (!q) return true;
          const matchGroup =
            Validators.normalizeText(group.name).includes(q) ||
            Validators.normalizeText(group.description || '').includes(q);
          if (matchGroup) return true;
          // También permite encontrar el grupo si contiene un producto que coincide con la búsqueda
          return db.products.some(
            (p) =>
              Number(p.groupId) === Number(group.id) &&
              (Validators.normalizeText(p.name).includes(q) ||
                Validators.normalizeText(p.code).includes(q))
          );
        });
    },

    /**
     * Obtiene un grupo por su ID.
     */
    getGroupById(groupId) {
      const db = Storage.getState();
      const group = db.groups.find((g) => Number(g.id) === Number(groupId));
      if (!group) return null;
      const products = db.products.filter((p) => Number(p.groupId) === Number(group.id));
      return Object.assign({}, group, {
        productCount: products.length
      });
    },

    /**
     * Crea un nuevo grupo dinámico de inventario validando que no exista duplicado.
     */
    createGroup(payload) {
      const name = String(payload.name || '').trim();
      const description = String(payload.description || '').trim();
      const icon = String(payload.icon || 'folder').trim();

      if (!name) {
        throw new Error('Ingrese el nombre del grupo.');
      }

      return Storage.transaction((db, storage) => {
        const normalized = Validators.normalizeText(name);
        const duplicate = db.groups.find((g) => Validators.normalizeText(g.name) === normalized);
        if (duplicate) {
          throw new Error(`Ya existe un grupo llamado "${duplicate.name}".`);
        }

        const newGroup = {
          id: storage.nextId('groups'),
          name,
          description,
          icon,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        db.groups.push(newGroup);
        return newGroup;
      });
    },

    /**
     * Actualiza un grupo existente.
     */
    updateGroup(groupId, payload) {
      const name = String(payload.name || '').trim();
      const description = String(payload.description || '').trim();
      const icon = String(payload.icon || 'folder').trim();

      if (!name) {
        throw new Error('El nombre del grupo es obligatorio.');
      }

      return Storage.transaction((db) => {
        const group = db.groups.find((g) => Number(g.id) === Number(groupId));
        if (!group) {
          throw new Error('No se encontró el grupo especificado.');
        }

        const normalized = Validators.normalizeText(name);
        const duplicate = db.groups.find(
          (g) => Number(g.id) !== Number(groupId) && Validators.normalizeText(g.name) === normalized
        );
        if (duplicate) {
          throw new Error(`Ya existe otro grupo con el nombre "${duplicate.name}".`);
        }

        group.name = name;
        group.description = description;
        group.icon = icon;
        group.updatedAt = new Date().toISOString();
        return group;
      });
    },

    /**
     * Elimina un grupo verificando que no tenga productos asociados.
     */
    deleteGroup(groupId) {
      return Storage.transaction((db) => {
        const idx = db.groups.findIndex((g) => Number(g.id) === Number(groupId));
        if (idx === -1) {
          throw new Error('El grupo no existe.');
        }
        const linkedProducts = db.products.filter((p) => Number(p.groupId) === Number(groupId));
        if (linkedProducts.length > 0) {
          throw new Error(
            `No se puede eliminar el grupo porque contiene ${linkedProducts.length} producto(s). Mueva o elimine sus productos primero.`
          );
        }
        const removed = db.groups.splice(idx, 1)[0];
        return removed;
      });
    },

    /**
     * Obtiene los productos de un grupo (o todos si `groupId` es null) con su ganancia calculada.
     */
    getProducts(groupId = null, searchQuery = '') {
      const db = Storage.getState();
      const q = Validators.normalizeText(searchQuery);
      const groupsMap = new Map(db.groups.map((g) => [Number(g.id), g.name]));

      return db.products
        .filter((p) => {
          if (groupId !== null && groupId !== undefined && groupId !== '') {
            if (Number(p.groupId) !== Number(groupId)) return false;
          }
          if (!q) return true;
          return (
            Validators.normalizeText(p.name).includes(q) ||
            Validators.normalizeText(p.code).includes(q) ||
            Validators.normalizeText(groupsMap.get(Number(p.groupId)) || '').includes(q)
          );
        })
        .map((p) => this._enrichProduct(p, groupsMap.get(Number(p.groupId)) || 'Sin grupo'));
    },

    /**
     * Obtiene un producto por su ID con ganancia y nombre de grupo.
     */
    getProductById(productId) {
      const db = Storage.getState();
      const product = db.products.find((p) => Number(p.id) === Number(productId));
      if (!product) return null;
      const group = db.groups.find((g) => Number(g.id) === Number(product.groupId));
      return this._enrichProduct(product, group ? group.name : 'Sin grupo');
    },

    _enrichProduct(product, groupName) {
      const purchasePrice = Validators.roundCurrency(product.purchasePrice);
      const salePrice = Validators.roundCurrency(product.salePrice);
      const profit = Validators.roundCurrency(salePrice - purchasePrice);
      const marginPercent =
        purchasePrice > 0 ? Math.round(((salePrice - purchasePrice) / purchasePrice) * 100) : 100;

      return Object.assign({}, product, {
        groupName,
        purchasePrice,
        salePrice,
        profit,
        marginPercent,
        stock: Number(product.stock) || 0
      });
    },

    /**
     * Genera un código sugerido automático para un producto según el nombre del grupo.
     */
    suggestProductCode(groupId) {
      const db = Storage.getState();
      const group = db.groups.find((g) => Number(g.id) === Number(groupId));
      let prefix = 'PR';
      if (group && group.name) {
        const words = group.name
          .trim()
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .split(/\s+/)
          .filter(Boolean);
        if (words.length >= 2) {
          prefix = (words[0][0] + words[1][0]).toUpperCase();
        } else if (words.length === 1 && words[0].length >= 2) {
          prefix = words[0].substring(0, 2).toUpperCase();
        }
      }
      const nextNum = db.products.length + 1;
      return `${prefix}-${String(nextNum).padStart(3, '0')}`;
    },

    /**
     * Registra un producto nuevo dentro de un grupo.
     * Si tiene stock inicial > 0 y `recordPurchase === true`, registra la compra en Finanzas.
     */
    createProduct(payload) {
      const groupId = Number(payload.groupId);
      const name = String(payload.name || '').trim();
      const code = String(payload.code || '').trim().toUpperCase();
      const stock = Number(payload.stock);
      const purchasePrice = Validators.roundCurrency(payload.purchasePrice);
      const salePrice = Validators.roundCurrency(payload.salePrice);
      const recordPurchase = payload.recordPurchase !== false;

      if (!groupId) throw new Error('Seleccione el grupo al que pertenece el producto.');
      if (!name) throw new Error('Ingrese el nombre del producto.');
      if (!code) throw new Error('Ingrese el código del producto.');
      if (!Number.isInteger(stock) || stock < 0) {
        throw new Error('El stock debe ser un número entero mayor o igual a 0.');
      }
      if (!Validators.isNonNegativeNumber(purchasePrice)) {
        throw new Error('El precio de compra debe ser un importe válido mayor o igual a 0.');
      }
      if (!Validators.isPositiveNumber(salePrice)) {
        throw new Error('El precio de venta debe ser mayor a 0.');
      }

      return Storage.transaction((db, storage) => {
        const group = db.groups.find((g) => Number(g.id) === groupId);
        if (!group) {
          throw new Error('El grupo seleccionado no existe.');
        }

        const normCode = Validators.normalizeIdentifier(code);
        const duplicateCode = db.products.find(
          (p) => Validators.normalizeIdentifier(p.code) === normCode
        );
        if (duplicateCode) {
          throw new Error(`El código "${code}" ya está asignado al producto "${duplicateCode.name}".`);
        }

        const normName = Validators.normalizeText(name);
        const duplicateNameInGroup = db.products.find(
          (p) => Number(p.groupId) === groupId && Validators.normalizeText(p.name) === normName
        );
        if (duplicateNameInGroup) {
          throw new Error(`Ya existe el producto "${name}" dentro del grupo "${group.name}".`);
        }

        const now = new Date().toISOString();
        const newProduct = {
          id: storage.nextId('products'),
          groupId,
          name,
          code,
          stock,
          purchasePrice,
          salePrice,
          createdAt: now,
          updatedAt: now
        };

        db.products.push(newProduct);

        // Si ingresa stock inicial con costo de compra y se marca registrar compra en Finanzas
        const totalPurchaseCost = Validators.roundCurrency(stock * purchasePrice);
        if (recordPurchase && stock > 0 && totalPurchaseCost > 0) {
          db.movements.push({
            id: storage.nextId('movements'),
            type: 'compra',
            category: 'Compra de Mercadería',
            direction: 'out',
            amount: totalPurchaseCost,
            paymentMethod: payload.paymentMethod || 'efectivo',
            date: Formatters.todayISO(),
            description: `Stock inicial: ${name} (${stock} u. x ${Formatters.currency(purchasePrice)})`,
            referenceType: 'product',
            referenceId: newProduct.id,
            createdAt: now
          });
        }

        return this._enrichProduct(newProduct, group.name);
      });
    },

    /**
     * Edita los datos de un producto existente.
     */
    updateProduct(productId, payload) {
      const groupId = Number(payload.groupId);
      const name = String(payload.name || '').trim();
      const code = String(payload.code || '').trim().toUpperCase();
      const stock = Number(payload.stock);
      const purchasePrice = Validators.roundCurrency(payload.purchasePrice);
      const salePrice = Validators.roundCurrency(payload.salePrice);

      if (!groupId) throw new Error('Seleccione un grupo válido.');
      if (!name) throw new Error('El nombre del producto es obligatorio.');
      if (!code) throw new Error('El código del producto es obligatorio.');
      if (!Number.isInteger(stock) || stock < 0) {
        throw new Error('El stock debe ser un número entero mayor o igual a 0.');
      }
      if (!Validators.isNonNegativeNumber(purchasePrice)) {
        throw new Error('El precio de compra no puede ser negativo.');
      }
      if (!Validators.isPositiveNumber(salePrice)) {
        throw new Error('El precio de venta debe ser mayor a 0.');
      }

      return Storage.transaction((db) => {
        const product = db.products.find((p) => Number(p.id) === Number(productId));
        if (!product) {
          throw new Error('Producto no encontrado.');
        }

        const group = db.groups.find((g) => Number(g.id) === groupId);
        if (!group) {
          throw new Error('El grupo seleccionado no existe.');
        }

        const normCode = Validators.normalizeIdentifier(code);
        const duplicateCode = db.products.find(
          (p) => Number(p.id) !== Number(productId) && Validators.normalizeIdentifier(p.code) === normCode
        );
        if (duplicateCode) {
          throw new Error(`El código "${code}" ya pertenece al producto "${duplicateCode.name}".`);
        }

        product.groupId = groupId;
        product.name = name;
        product.code = code;
        product.stock = stock;
        product.purchasePrice = purchasePrice;
        product.salePrice = salePrice;
        product.updatedAt = new Date().toISOString();

        return this._enrichProduct(product, group.name);
      });
    },

    /**
     * Registra una reposición / compra de stock para un producto existente.
     */
    restockProduct(productId, payload) {
      const quantityToAdd = Number(payload.quantity);
      const unitCost = Validators.roundCurrency(payload.purchasePrice);
      const newSalePrice = payload.salePrice !== undefined ? Validators.roundCurrency(payload.salePrice) : null;
      const recordInFinance = payload.recordPurchase !== false;
      const paymentMethod = payload.paymentMethod || 'efectivo';

      if (!Number.isInteger(quantityToAdd) || quantityToAdd <= 0) {
        throw new Error('La cantidad a ingresar debe ser un número entero mayor a 0.');
      }
      if (!Validators.isNonNegativeNumber(unitCost)) {
        throw new Error('El costo de compra unitario no es válido.');
      }

      return Storage.transaction((db, storage) => {
        const product = db.products.find((p) => Number(p.id) === Number(productId));
        if (!product) {
          throw new Error('Producto no encontrado.');
        }

        product.stock = (Number(product.stock) || 0) + quantityToAdd;
        product.purchasePrice = unitCost;
        if (newSalePrice !== null && newSalePrice > 0) {
          product.salePrice = newSalePrice;
        }
        product.updatedAt = new Date().toISOString();

        const totalPurchase = Validators.roundCurrency(quantityToAdd * unitCost);
        if (recordInFinance && totalPurchase > 0) {
          db.movements.push({
            id: storage.nextId('movements'),
            type: 'compra',
            category: 'Compra de Mercadería',
            direction: 'out',
            amount: totalPurchase,
            paymentMethod,
            date: Formatters.todayISO(),
            description: `Reposición de stock: ${product.name} (+${quantityToAdd} u. a ${Formatters.currency(unitCost)})`,
            referenceType: 'product',
            referenceId: product.id,
            createdAt: new Date().toISOString()
          });
        }

        const group = db.groups.find((g) => Number(g.id) === Number(product.groupId));
        return this._enrichProduct(product, group ? group.name : 'Sin grupo');
      });
    },

    /**
     * Elimina un producto del inventario.
     */
    deleteProduct(productId) {
      return Storage.transaction((db) => {
        const idx = db.products.findIndex((p) => Number(p.id) === Number(productId));
        if (idx === -1) {
          throw new Error('El producto no existe.');
        }
        return db.products.splice(idx, 1)[0];
      });
    }
  };

  global.ComerSys.Services.InventoryService = InventoryService;
})(window);
