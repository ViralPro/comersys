/**
 * ============================================================================
 * COMERSYS — MÓDULO 1: INICIO Y DASHBOARD EJECUTIVO
 * ============================================================================
 */
(function (global) {
  'use strict';

  const { Validators, Formatters } = global.ComerSys.Core;
  const { FinanceService, InventoryService, ClientsService, SalesService } =
    global.ComerSys.Services;
  const { Icons, Charts } = global.ComerSys.UI;

  const DashboardModule = {
    render(container) {
      const summary = FinanceService.getFinancialSummary();
      const groups = InventoryService.getGroups();
      const products = InventoryService.getProducts();
      const clients = ClientsService.getClients();
      const clientsWithDebt = clients.filter((c) => c.pendingBalance > 0.009);
      const recentSales = SalesService.getSales().slice(0, 6);
      const series7d = FinanceService.getLast7DaysSeries();

      const collectionRate =
        summary.totalSold > 0
          ? Math.round((summary.totalCollected / summary.totalSold) * 100)
          : 0;

      container.innerHTML = `
        <!-- Fila 1: Indicadores Financieros Principales -->
        <div class="kpi-grid-4">
          <div class="kpi-card">
            <div class="kpi-card-top">
              <div class="kpi-card-top-left">
                <div class="kpi-icon-box green">${Icons.get('receipt')}</div>
                <div class="kpi-meta">
                  <span class="kpi-label">Total Vendido</span>
                  <span class="kpi-value">${Formatters.currency(summary.totalSold)}</span>
                </div>
              </div>
            </div>
            <div class="kpi-sub">
              <span class="text-success font-semibold">${summary.salesCount} venta(s)</span>
              <span>registradas en el sistema</span>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-card-top">
              <div class="kpi-card-top-left">
                <div class="kpi-icon-box blue">${Icons.get('wallet')}</div>
                <div class="kpi-meta">
                  <span class="kpi-label">Total Cobrado</span>
                  <span class="kpi-value">${Formatters.currency(summary.totalCollected)}</span>
                </div>
              </div>
            </div>
            <div class="kpi-sub">
              <span class="text-primary-blue font-semibold">${collectionRate}% de efectividad</span>
              <span>sobre lo vendido</span>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-card-top">
              <div class="kpi-card-top-left">
                <div class="kpi-icon-box red">${Icons.get('clock')}</div>
                <div class="kpi-meta">
                  <span class="kpi-label">Pendiente de Cobro</span>
                  <span class="kpi-value ${summary.totalPending > 0 ? 'text-danger' : ''}">${Formatters.currency(summary.totalPending)}</span>
                </div>
              </div>
            </div>
            <div class="kpi-sub">
              <span class="${summary.overdueDebtsCount > 0 ? 'text-danger font-semibold' : 'text-muted'}">
                ${summary.overdueDebtsCount > 0 ? `${summary.overdueDebtsCount} cuenta(s) atrasada(s)` : 'Sin cuentas vencidas'}
              </span>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-card-top">
              <div class="kpi-card-top-left">
                <div class="kpi-icon-box purple">${Icons.get('trendingUp')}</div>
                <div class="kpi-meta">
                  <span class="kpi-label">Ganancia Estimada</span>
                  <span class="kpi-value">${Formatters.currency(summary.estimatedProfit)}</span>
                </div>
              </div>
            </div>
            <div class="kpi-sub">
              <span class="text-success font-semibold">${Formatters.currency(summary.realizedProfit)}</span>
              <span>ya cobrados en caja</span>
            </div>
          </div>
        </div>

        <!-- Fila 2: Contadores Operativos (Acceso rápido interactivo) -->
        <div class="kpi-grid-4">
          <div class="kpi-card kpi-interactive kpi-stat-compact" data-nav-target="inventory">
            <div class="kpi-card-top-left">
              <div class="kpi-icon-box orange">${Icons.get('box')}</div>
              <div class="kpi-meta">
                <span class="kpi-label">Productos</span>
                <span class="kpi-value">${products.length}</span>
              </div>
            </div>
            <span class="kpi-stat-arrow">${Icons.get('chevronRight')}</span>
          </div>

          <div class="kpi-card kpi-interactive kpi-stat-compact" data-nav-target="inventory">
            <div class="kpi-card-top-left">
              <div class="kpi-icon-box blue">${Icons.get('layers')}</div>
              <div class="kpi-meta">
                <span class="kpi-label">Grupos</span>
                <span class="kpi-value">${groups.length}</span>
              </div>
            </div>
            <span class="kpi-stat-arrow">${Icons.get('chevronRight')}</span>
          </div>

          <div class="kpi-card kpi-interactive kpi-stat-compact" data-nav-target="clients">
            <div class="kpi-card-top-left">
              <div class="kpi-icon-box blue">${Icons.get('clients')}</div>
              <div class="kpi-meta">
                <span class="kpi-label">Clientes</span>
                <span class="kpi-value">${clients.length}</span>
              </div>
            </div>
            <span class="kpi-stat-arrow">${Icons.get('chevronRight')}</span>
          </div>

          <div class="kpi-card kpi-interactive kpi-stat-compact" data-nav-target="debts">
            <div class="kpi-card-top-left">
              <div class="kpi-icon-box red">${Icons.get('alertTriangle')}</div>
              <div class="kpi-meta">
                <span class="kpi-label">Clientes con Deudas</span>
                <span class="kpi-value ${clientsWithDebt.length > 0 ? 'text-danger' : ''}">${clientsWithDebt.length}</span>
              </div>
            </div>
            <span class="kpi-stat-arrow">${Icons.get('chevronRight')}</span>
          </div>
        </div>

        <!-- Fila 3: Gráfico de Ventas 7 Días + Últimas Ventas -->
        <div class="dashboard-bottom-grid">
          <div class="card">
            <div class="card-header">
              <div>
                <h2 class="card-title">Ventas de los últimos 7 días</h2>
                <p class="card-subtitle">Evolución diaria de operaciones confirmadas</p>
              </div>
            </div>
            <div class="card-body">
              <div class="chart-box" id="dashboard-sales-7d-chart"></div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div>
                <h2 class="card-title">Últimas Ventas</h2>
                <p class="card-subtitle">Operaciones más recientes</p>
              </div>
              <button type="button" class="btn btn-sm btn-secondary" data-nav-target="sales">
                Ver todas
              </button>
            </div>
            <div class="table-responsive">
              ${
                recentSales.length === 0
                  ? `
                    <div class="empty-state" style="padding:2.4rem 1.2rem;">
                      <div class="empty-state-icon">${Icons.get('sales')}</div>
                      <div class="empty-state-title">Sin ventas registradas</div>
                      <p class="empty-state-desc">Cree sus grupos y productos en Inventario y registre su primera venta comercial.</p>
                      <button type="button" class="btn btn-primary btn-sm" id="dash-empty-sale-btn">
                        ${Icons.get('plus')} Registrar venta
                      </button>
                    </div>
                  `
                  : `
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Cliente</th>
                          <th class="text-right">Total</th>
                          <th>Estado</th>
                          <th>Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${recentSales
                          .map(
                            (sale) => `
                          <tr style="cursor:pointer;" data-view-sale="${sale.id}">
                            <td class="font-semibold">${Validators.escapeHtml(sale.clientName)}</td>
                            <td class="text-right font-bold">${Formatters.currency(sale.total)}</td>
                            <td>${Formatters.statusBadge(sale.computedStatus)}</td>
                            <td class="text-muted">${Formatters.date(sale.date)}</td>
                          </tr>
                        `
                          )
                          .join('')}
                      </tbody>
                    </table>
                  `
              }
            </div>
          </div>
        </div>
      `;

      // Renderizar gráfico vectorial de los últimos 7 días
      const chartContainer = container.querySelector('#dashboard-sales-7d-chart');
      Charts.renderSalesLineChart(chartContainer, series7d);

      // Eventos de navegación rápida
      container.querySelectorAll('[data-nav-target]').forEach((el) => {
        el.addEventListener('click', () => {
          const target = el.getAttribute('data-nav-target');
          global.ComerSys.App.navigate(target);
        });
      });

      const emptySaleBtn = container.querySelector('#dash-empty-sale-btn');
      if (emptySaleBtn) {
        emptySaleBtn.addEventListener('click', () => {
          global.ComerSys.Modules.Sales.openSaleWizard();
        });
      }

      container.querySelectorAll('[data-view-sale]').forEach((row) => {
        row.addEventListener('click', () => {
          const saleId = Number(row.getAttribute('data-view-sale'));
          global.ComerSys.Modules.Sales.openSaleDetailModal(saleId);
        });
      });
    }
  };

  global.ComerSys.Modules.Dashboard = DashboardModule;
})(window);
