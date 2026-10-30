-- ============================================================================
-- COMERSYS — ESQUEMA RELACIONAL MYSQL 8.0+ (PREPARADO PARA PRODUCCIÓN)
-- Motor: InnoDB | Charset: utf8mb4_unicode_ci
-- Espejo exacto de las entidades manejadas por `js/core/storage.js` y `js/services/*`
-- ============================================================================

CREATE DATABASE IF NOT EXISTS comersys_erp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE comersys_erp;

-- 1. Usuarios Administradores
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Configuración del Sistema
CREATE TABLE IF NOT EXISTS settings (
  id TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
  business_name VARCHAR(150) NOT NULL DEFAULT 'ComerSys',
  tax_id VARCHAR(50) DEFAULT '',
  phone VARCHAR(50) DEFAULT '',
  address VARCHAR(255) DEFAULT '',
  currency_symbol VARCHAR(10) NOT NULL DEFAULT '$',
  date_format VARCHAR(20) NOT NULL DEFAULT 'DD/MM/YYYY',
  low_stock_threshold INT UNSIGNED NOT NULL DEFAULT 5,
  dark_mode TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. Grupos Dinámicos de Inventario
CREATE TABLE IF NOT EXISTS inventory_groups (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(255) DEFAULT '',
  icon VARCHAR(40) NOT NULL DEFAULT 'folder',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 4. Productos
CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id INT UNSIGNED NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  purchase_price DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  sale_price DECIMAL(14, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_group FOREIGN KEY (group_id)
    REFERENCES inventory_groups(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_products_group (group_id),
  INDEX idx_products_name (name)
) ENGINE=InnoDB;

-- 5. Clientes
CREATE TABLE IF NOT EXISTS clients (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  document_id VARCHAR(40) DEFAULT '',
  phone VARCHAR(50) NOT NULL,
  address VARCHAR(255) DEFAULT '',
  email VARCHAR(120) DEFAULT '',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_clients_name (name),
  INDEX idx_clients_phone (phone)
) ENGINE=InnoDB;

-- 6. Notas de Clientes
CREATE TABLE IF NOT EXISTS client_notes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id INT UNSIGNED NOT NULL,
  note_text TEXT NOT NULL,
  note_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notes_client FOREIGN KEY (client_id)
    REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. Ventas (Cabecera)
CREATE TABLE IF NOT EXISTS sales (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  client_id INT UNSIGNED NULL,
  client_name VARCHAR(160) NOT NULL DEFAULT 'Consumidor Final',
  summary_concept VARCHAR(255) NOT NULL,
  subtotal DECIMAL(14, 2) NOT NULL,
  discount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  total DECIMAL(14, 2) NOT NULL,
  total_cost DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  estimated_profit DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  payment_mode ENUM('completo', 'parcial', 'cuotas') NOT NULL DEFAULT 'completo',
  payment_method VARCHAR(40) NOT NULL DEFAULT 'efectivo',
  paid_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  pending_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(30) NOT NULL DEFAULT 'pagado',
  sale_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sales_client FOREIGN KEY (client_id)
    REFERENCES clients(id) ON DELETE SET NULL,
  INDEX idx_sales_date (sale_date),
  INDEX idx_sales_client (client_id)
) ENGINE=InnoDB;

-- 8. Detalle de Líneas de Venta
CREATE TABLE IF NOT EXISTS sale_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NULL,
  product_code VARCHAR(50) NOT NULL,
  product_name VARCHAR(160) NOT NULL,
  quantity INT NOT NULL,
  unit_cost DECIMAL(14, 2) NOT NULL,
  unit_price DECIMAL(14, 2) NOT NULL,
  subtotal DECIMAL(14, 2) NOT NULL,
  profit DECIMAL(14, 2) NOT NULL,
  CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id)
    REFERENCES sales(id) ON DELETE CASCADE,
  CONSTRAINT fk_sale_items_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 9. Cuentas Financiadas y Deudas
CREATE TABLE IF NOT EXISTS debts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_id INT UNSIGNED NULL,
  client_id INT UNSIGNED NOT NULL,
  concept VARCHAR(255) NOT NULL,
  mode ENUM('parcial', 'cuotas') NOT NULL DEFAULT 'cuotas',
  original_sale_total DECIMAL(14, 2) NOT NULL,
  initial_payment DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(14, 2) NOT NULL,
  paid_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  pending_amount DECIMAL(14, 2) NOT NULL,
  installments_count INT UNSIGNED NOT NULL DEFAULT 1,
  frequency ENUM('mensual', 'quincenal', 'semanal') NOT NULL DEFAULT 'mensual',
  first_due_date DATE NOT NULL,
  next_due_date DATE NOT NULL,
  status ENUM('al_dia', 'pendiente', 'pago_parcial', 'atrasado', 'cancelado') NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_debts_sale FOREIGN KEY (sale_id)
    REFERENCES sales(id) ON DELETE SET NULL,
  CONSTRAINT fk_debts_client FOREIGN KEY (client_id)
    REFERENCES clients(id) ON DELETE RESTRICT,
  INDEX idx_debts_client (client_id),
  INDEX idx_debts_status (status)
) ENGINE=InnoDB;

-- 10. Cronograma de Cuotas
CREATE TABLE IF NOT EXISTS installments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  debt_id INT UNSIGNED NOT NULL,
  sale_id INT UNSIGNED NULL,
  client_id INT UNSIGNED NOT NULL,
  number INT UNSIGNED NOT NULL,
  total_installments INT UNSIGNED NOT NULL,
  amount DECIMAL(14, 2) NOT NULL,
  paid_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  pending_amount DECIMAL(14, 2) NOT NULL,
  due_date DATE NOT NULL,
  status ENUM('pendiente', 'pago_parcial', 'atrasado', 'cancelado') NOT NULL DEFAULT 'pendiente',
  paid_at DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_installments_debt FOREIGN KEY (debt_id)
    REFERENCES debts(id) ON DELETE CASCADE,
  INDEX idx_installments_due (due_date)
) ENGINE=InnoDB;

-- 11. Registro de Pagos / Cobros
CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id INT UNSIGNED NULL,
  sale_id INT UNSIGNED NULL,
  debt_id INT UNSIGNED NULL,
  installment_id INT UNSIGNED NULL,
  amount DECIMAL(14, 2) NOT NULL,
  payment_method VARCHAR(40) NOT NULL DEFAULT 'efectivo',
  payment_date DATE NOT NULL,
  notes VARCHAR(255) DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_client FOREIGN KEY (client_id)
    REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_debt FOREIGN KEY (debt_id)
    REFERENCES debts(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 12. Libro Diario de Movimientos Financieros
CREATE TABLE IF NOT EXISTS financial_movements (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type ENUM('cobro', 'ingreso', 'compra', 'egreso') NOT NULL,
  category VARCHAR(100) NOT NULL,
  direction ENUM('in', 'out') NOT NULL,
  amount DECIMAL(14, 2) NOT NULL,
  payment_method VARCHAR(40) NOT NULL DEFAULT 'efectivo',
  movement_date DATE NOT NULL,
  description VARCHAR(255) NOT NULL,
  reference_type VARCHAR(40) NULL,
  reference_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_movements_date (movement_date),
  INDEX idx_movements_type (type)
) ENGINE=InnoDB;
