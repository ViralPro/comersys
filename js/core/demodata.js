/**
 * ============================================================================
 * COMERSYS — GENERADOR DE DATOS DE DEMOSTRACIÓN COMERCIAL
 * ============================================================================
 * Proporciona un catálogo realista para documentación, capacitación y pruebas.
 */
(function (global) {
  'use strict';

  const { Config } = global.ComerSys;
  const { Storage } = global.ComerSys.Core;

  const DemoData = {
    seed() {
      const now = new Date();
      const isoNow = now.toISOString();

      function getDaysAgoDate(days) {
        const d = new Date(now.getTime() - days * 24 * 3600 * 1000);
        return d.toISOString().split('T')[0];
      }

      function getDaysFutureDate(days) {
        const d = new Date(now.getTime() + days * 24 * 3600 * 1000);
        return d.toISOString().split('T')[0];
      }

      const groups = [
        { id: 1, name: 'Telefonía y Celulares', description: 'Smartphones liberados y accesorios oficiales', createdAt: isoNow },
        { id: 2, name: 'Informática y Audio', description: 'Notebooks, periféricos y auriculares de alta gama', createdAt: isoNow },
        { id: 3, name: 'Indumentaria y Calzado', description: 'Moda urbana y calzado deportivo premium', createdAt: isoNow }
      ];

      const products = [
        { id: 1, groupId: 1, code: 'CEL-SAM-S23', name: 'Samsung Galaxy S23 Ultra 256GB', description: 'Cámara 200MP, Phantom Black', purchasePrice: 950000, salePrice: 1350000, stock: 8, minStock: 2, createdAt: isoNow },
        { id: 2, groupId: 1, code: 'CEL-IPH-14P', name: 'iPhone 14 Pro Max 128GB', description: 'Pantalla Super Retina XDR, Space Black', purchasePrice: 1100000, salePrice: 1580000, stock: 5, minStock: 2, createdAt: isoNow },
        { id: 3, groupId: 2, code: 'AUD-SNY-XM5', name: 'Auriculares Sony WH-1000XM5 ANC', description: 'Cancelación de ruido activa, 30hs batería', purchasePrice: 280000, salePrice: 420000, stock: 14, minStock: 4, createdAt: isoNow },
        { id: 4, groupId: 2, code: 'NOT-MAC-M2', name: 'Apple MacBook Air 13" Chip M2', description: '8GB RAM, 256GB SSD, Gris Espacial', purchasePrice: 1250000, salePrice: 1790000, stock: 3, minStock: 2, createdAt: isoNow },
        { id: 5, groupId: 3, code: 'ZAP-NIK-AIR', name: 'Zapatillas Nike Air Jordan Retro', description: 'Calzado deportivo urbano premium', purchasePrice: 85000, salePrice: 145000, stock: 16, minStock: 5, createdAt: isoNow },
        { id: 6, groupId: 3, code: 'IND-CAM-URB', name: 'Campera Térmica Softshell Impermeable', description: 'Talles M/L/XL, respirable y cortaviento', purchasePrice: 48000, salePrice: 89000, stock: 22, minStock: 6, createdAt: isoNow }
      ];

      const clients = [
        { id: 1, name: 'Carlos Andrés Martínez', phone: '+54 9 11 4872-9102', documentId: '32.445.190', address: 'Av. Santa Fe 1840, CABA', notes: 'Cliente preferencial. Pagos en cuotas mensuales.', createdAt: isoNow },
        { id: 2, name: 'Mariana Lucía Beltrán', phone: '+54 9 11 6512-3388', documentId: '27-35894120-4', address: 'Calle Florida 620, Rosario', notes: 'Cuenta corriente corporativa habilitada.', createdAt: isoNow },
        { id: 3, name: 'Gonzalo Ezequiel Romero', phone: '+54 9 341 550-9944', documentId: '29.870.312', address: 'San Martín 450, Córdoba', notes: 'Compras al contado en tecnología.', createdAt: isoNow },
        { id: 4, name: 'Sofía Antonella Ruiz', phone: '+54 9 261 411-8720', documentId: '34.120.985', address: 'Belgrano 980, Mendoza', notes: 'Excelente historial de cumplimiento.', createdAt: isoNow }
      ];

      const sales = [
        {
          id: 1,
          code: 'V-0001',
          date: getDaysAgoDate(3),
          clientId: 3,
          clientName: 'Gonzalo Ezequiel Romero',
          paymentMode: 'completo',
          paymentMethod: 'efectivo',
          items: [
            { productId: 3, code: 'AUD-SNY-XM5', name: 'Auriculares Sony WH-1000XM5 ANC', quantity: 1, unitCost: 280000, unitPrice: 420000, subtotal: 420000, profit: 140000 }
          ],
          summaryConcept: 'Auriculares Sony WH-1000XM5 ANC',
          subtotal: 420000,
          discount: 0,
          total: 420000,
          totalCost: 280000,
          estimatedProfit: 140000,
          paidAmount: 420000,
          pendingAmount: 0,
          status: 'pagado',
          notes: 'Venta presencial al contado'
        },
        {
          id: 2,
          code: 'V-0002',
          date: getDaysAgoDate(2),
          clientId: 1,
          clientName: 'Carlos Andrés Martínez',
          paymentMode: 'cuotas',
          paymentMethod: 'transferencia',
          items: [
            { productId: 1, code: 'CEL-SAM-S23', name: 'Samsung Galaxy S23 Ultra 256GB', quantity: 1, unitCost: 950000, unitPrice: 1350000, subtotal: 1350000, profit: 400000 }
          ],
          summaryConcept: 'Samsung Galaxy S23 Ultra 256GB',
          subtotal: 1350000,
          discount: 0,
          total: 1350000,
          totalCost: 950000,
          estimatedProfit: 400000,
          paidAmount: 600000,
          pendingAmount: 750000,
          status: 'pendiente',
          debtId: 1,
          notes: 'Plan 4 cuotas mensuales. Anticipo $350.000 + Cuota #1 cobrada.'
        },
        {
          id: 3,
          code: 'V-0003',
          date: getDaysAgoDate(0),
          clientId: 2,
          clientName: 'Mariana Lucía Beltrán',
          paymentMode: 'completo',
          paymentMethod: 'transferencia',
          items: [
            { productId: 5, code: 'ZAP-NIK-AIR', name: 'Zapatillas Nike Air Jordan Retro', quantity: 2, unitCost: 85000, unitPrice: 145000, subtotal: 290000, profit: 120000 }
          ],
          summaryConcept: 'Zapatillas Nike Air Jordan Retro (x2)',
          subtotal: 290000,
          discount: 0,
          total: 290000,
          totalCost: 170000,
          estimatedProfit: 120000,
          paidAmount: 290000,
          pendingAmount: 0,
          status: 'pagado',
          notes: 'Transferencia bancaria inmediata confirmada'
        }
      ];

      const installments = [
        { id: 1, debtId: 1, clientId: 1, number: 1, amount: 250000, paidAmount: 250000, pendingAmount: 0, dueDate: getDaysAgoDate(1), status: 'cancelado', paidAt: isoNow },
        { id: 2, debtId: 1, clientId: 1, number: 2, amount: 250000, paidAmount: 0, pendingAmount: 250000, dueDate: getDaysFutureDate(28), status: 'pendiente' },
        { id: 3, debtId: 1, clientId: 1, number: 3, amount: 250000, paidAmount: 0, pendingAmount: 250000, dueDate: getDaysFutureDate(58), status: 'pendiente' },
        { id: 4, debtId: 1, clientId: 1, number: 4, amount: 250000, paidAmount: 0, pendingAmount: 250000, dueDate: getDaysFutureDate(88), status: 'pendiente' }
      ];

      const debts = [
        {
          id: 1,
          saleId: 2,
          clientId: 1,
          clientName: 'Carlos Andrés Martínez',
          concept: 'Venta V-0002: Samsung Galaxy S23 Ultra 256GB',
          totalAmount: 1000000,
          paidAmount: 250000,
          pendingAmount: 750000,
          installmentsCount: 4,
          frequency: 'mensual',
          status: 'al_dia',
          firstDueDate: getDaysAgoDate(1),
          nextDueDate: getDaysFutureDate(28),
          createdAt: getDaysAgoDate(2) + 'T10:00:00.000Z',
          updatedAt: isoNow
        }
      ];

      const payments = [
        { id: 1, type: 'venta', saleId: 1, clientId: 3, clientName: 'Gonzalo Ezequiel Romero', amount: 420000, paymentMethod: 'efectivo', date: getDaysAgoDate(3) },
        { id: 2, type: 'entrega_inicial', saleId: 2, debtId: 1, clientId: 1, clientName: 'Carlos Andrés Martínez', amount: 350000, paymentMethod: 'transferencia', date: getDaysAgoDate(2) },
        { id: 3, type: 'cuota', saleId: 2, debtId: 1, installmentId: 1, clientId: 1, clientName: 'Carlos Andrés Martínez', amount: 250000, paymentMethod: 'transferencia', date: getDaysAgoDate(1) },
        { id: 4, type: 'venta', saleId: 3, clientId: 2, clientName: 'Mariana Lucía Beltrán', amount: 290000, paymentMethod: 'transferencia', date: getDaysAgoDate(0) }
      ];

      const movements = [
        { id: 1, date: getDaysAgoDate(3), type: 'ingreso', description: 'Cobro Venta V-0001 (Gonzalo Ezequiel Romero)', amount: 420000, paymentMethod: 'efectivo' },
        { id: 2, date: getDaysAgoDate(2), type: 'ingreso', description: 'Entrega inicial Venta V-0002 (Carlos Andrés Martínez)', amount: 350000, paymentMethod: 'transferencia' },
        { id: 3, date: getDaysAgoDate(1), type: 'ingreso', description: 'Cobro Cuota #1 Venta V-0002 (Carlos Andrés Martínez)', amount: 250000, paymentMethod: 'transferencia' },
        { id: 4, date: getDaysAgoDate(0), type: 'ingreso', description: 'Cobro Venta V-0003 (Mariana Lucía Beltrán)', amount: 290000, paymentMethod: 'transferencia' }
      ];

      const db = {
        meta: {
          version: Config.APP_VERSION,
          createdAt: isoNow,
          updatedAt: isoNow,
          sequences: {
            groups: 3,
            products: 6,
            clients: 4,
            sales: 3,
            debts: 1,
            installments: 4,
            payments: 4,
            movements: 4
          }
        },
        users: [
          { id: 1, username: 'administrador', passwordHash: 'admin123', displayName: 'Administrador', role: 'admin', createdAt: isoNow }
        ],
        settings: Object.assign({}, Config.DEFAULT_SETTINGS, { businessName: 'ComerSys' }),
        groups,
        products,
        clients,
        sales,
        debts,
        installments,
        payments,
        movements
      };

      localStorage.setItem(Config.STORAGE_KEY, JSON.stringify(db));
      Storage.init();
      return db;
    }
  };

  global.ComerSys.DemoData = DemoData;
})(window);
