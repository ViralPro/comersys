<?php
/**
 * ============================================================================
 * COMERSYS — CONECTOR PDO Y TRANSACCIONES ACID PARA FUTURA INTEGRACIÓN PHP+MYSQL
 * ============================================================================
 * La interfaz de ComerSys fue diseñada con desacoplamiento total entre la capa
 * de presentación (`js/modules/*`) y la capa de persistencia (`js/core/api.js`).
 * Para migrar a servidor PHP + MySQL:
 * 1. Importar `schema.sql` en MySQL 8.0+.
 * 2. Configurar las credenciales en este archivo.
 * 3. Cambiar `DATA_DRIVER: 'PHP_MYSQL'` en `js/core/config.js`.
 */

declare(strict_types=1);

namespace ComerSys\Backend;

use PDO;
use PDOException;

class Database
{
    private static ?PDO $instance = null;

    public static function getConnection(): PDO
    {
        if (self::$instance === null) {
            $host = getenv('DB_HOST') ?: '127.0.0.1';
            $port = getenv('DB_PORT') ?: '3306';
            $db   = getenv('DB_NAME') ?: 'comersys_erp';
            $user = getenv('DB_USER') ?: 'root';
            $pass = getenv('DB_PASS') ?: '';

            $dsn = "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4";

            self::$instance = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        }

        return self::$instance;
    }

    /**
     * Ejecuta una operación comercial atómica (ej. Venta + Descuento de Stock + Cuotas).
     * Si cualquier paso lanza excepción, realiza ROLLBACK automático sin afectar el stock.
     */
    public static function transaction(callable $callback)
    {
        $pdo = self::getConnection();
        $pdo->beginTransaction();
        try {
            $result = $callback($pdo);
            $pdo->commit();
            return $result;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }
}
