# ============================================================================
# COMERSYS — SERVIDOR MULTI-TENANT & DUAL PORT (8000 CLIENTES / 8001 ADMIN)
# ============================================================================

Add-Type -AssemblyName System.Web
Add-Type -AssemblyName System.Security

$rootDir = "C:\Users\damian\Downloads\comersys-main"
$adminDir = [System.IO.Path]::Combine($rootDir, "admin-central")
$dbPath = [System.IO.Path]::Combine($rootDir, "data", "comersys_platform.json")

# ----------------------------------------------------------------------------
# 1. Criptografía Segura PBKDF2 (SHA-256 + 10.000 iteraciones + Salt 128-bit)
# ----------------------------------------------------------------------------
function Hash-Password([string]$password) {
    $saltBytes = New-Object byte[] 16
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($saltBytes)

    $pbkdf2 = New-Object System.Security.Cryptography.Rfc2898DeriveBytes($password, $saltBytes, 10000, [System.Security.Cryptography.HashAlgorithmName]::SHA256)
    $hashBytes = $pbkdf2.GetBytes(32)

    $saltHex = [BitConverter]::ToString($saltBytes) -replace '-'
    $hashHex = [BitConverter]::ToString($hashBytes) -replace '-'
    return "$($saltHex):$($hashHex)"
}

function Verify-Password([string]$password, [string]$storedHash) {
    if ([string]::IsNullOrWhiteSpace($storedHash)) { return $false }
    $parts = $storedHash.Split(':')
    if ($parts.Length -ne 2) {
        # Fallback de compatibilidad si es clave sin salt
        return ($password -eq $storedHash)
    }

    $saltHex = $parts[0]
    $expectedHashHex = $parts[1]
    if ($saltHex.Length -ne 32) { return $false }

    $saltBytes = New-Object byte[] 16
    for ($i = 0; $i -lt 32; $i += 2) {
        $saltBytes[$i / 2] = [Convert]::ToByte($saltHex.Substring($i, 2), 16)
    }

    $pbkdf2 = New-Object System.Security.Cryptography.Rfc2898DeriveBytes($password, $saltBytes, 10000, [System.Security.Cryptography.HashAlgorithmName]::SHA256)
    $calcBytes = $pbkdf2.GetBytes(32)
    $calcHex = [BitConverter]::ToString($calcBytes) -replace '-'
    return ($calcHex -eq $expectedHashHex)
}

# ----------------------------------------------------------------------------
# 2. Persistencia y Transacciones ACID Multi-Tenant
# ----------------------------------------------------------------------------
$dbLock = New-Object System.Object

function Get-Database() {
    [System.Threading.Monitor]::Enter($dbLock)
    try {
        if (-not (Test-Path $dbPath)) {
            throw "Base de datos multi-tenant no encontrada en: $dbPath"
        }
        $raw = [System.IO.File]::ReadAllText($dbPath, [System.Text.Encoding]::UTF8)
        return ($raw | ConvertFrom-Json)
    } finally {
        [System.Threading.Monitor]::Exit($dbLock)
    }
}

function Save-Database($db) {
    [System.Threading.Monitor]::Enter($dbLock)
    try {
        $db.meta.updatedAt = (Get-Date).ToUniversalTime().ToString("o")
        $json = ($db | ConvertTo-Json -Depth 20)
        [System.IO.File]::WriteAllText($dbPath, $json, [System.Text.Encoding]::UTF8)
    } finally {
        [System.Threading.Monitor]::Exit($dbLock)
    }
}

function Add-AuditLog($db, [string]$actor, [string]$action, [string]$targetTenant, [string]$details) {
    if (-not $db.auditLogs) { $db | Add-Member -MemberType NoteProperty -Name "auditLogs" -Value @() }
    $newLog = [PSCustomObject]@{
        id = [Guid]::NewGuid().ToString()
        timestamp = (Get-Date).ToUniversalTime().ToString("o")
        actor = $actor
        action = $action
        targetTenantId = $targetTenant
        details = $details
    }
    $db.auditLogs = @($newLog) + @($db.auditLogs)
}

function Validate-SuperAdmin($request, $db) {
    $auth = $request.Headers["Authorization"]
    if ([string]::IsNullOrWhiteSpace($auth) -or -not $auth.StartsWith("Bearer ")) {
        return $null
    }
    $token = $auth.Substring(7).Trim()
    if (-not $token) { return $null }

    if (-not $db.sessions) { return $null }
    $sess = $db.sessions.$token
    if (-not $sess -or $sess.role -ne "superadmin") {
        return $null
    }
    return $sess
}

# ----------------------------------------------------------------------------
# 3. Tipos MIME y Servidor HTTP
# ----------------------------------------------------------------------------
$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2"= "font/woff2"
    ".ttf"  = "font/ttf"
}

function Send-Response($response, [int]$statusCode, [string]$contentType, [byte[]]$bytes) {
    $response.StatusCode = $statusCode
    $response.ContentType = $contentType
    $response.ContentLength64 = $bytes.Length
    $response.AddHeader("Access-Control-Allow-Origin", "*")
    $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
    $response.AddHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-Id")
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
    $response.Close()
}

function Send-Json($response, [int]$statusCode, $data) {
    $json = ($data | ConvertTo-Json -Depth 10)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    Send-Response $response $statusCode "application/json; charset=utf-8" $bytes
}

function Send-File($response, [string]$filePath) {
    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
    $mime = "application/octet-stream"
    if ($mimeTypes.ContainsKey($ext)) { $mime = $mimeTypes[$ext] }
    $bytes = [System.IO.File]::ReadAllBytes($filePath)
    Send-Response $response 200 $mime $bytes
}

function Read-Body($request) {
    if (-not $request.HasEntityBody) { return "" }
    $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
    return $reader.ReadToEnd()
}

# Inicializar Listener en puertos 8000 y 8001
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8000/")
$listener.Prefixes.Add("http://127.0.0.1:8000/")
$listener.Prefixes.Add("http://localhost:8001/")
$listener.Prefixes.Add("http://127.0.0.1:8001/")

try {
    $listener.Start()
    Write-Output "=========================================================="
    Write-Output "  COMERSYS MULTI-TENANT DUAL SERVER ACTIVO"
    Write-Output "  -> Puerto 8000: ComerSys Cliente (http://localhost:8000/)"
    Write-Output "  -> Puerto 8001: Admin Central    (http://localhost:8001/)"
    Write-Output "=========================================================="
} catch {
    Write-Error ("No se pudo iniciar el listener: " + $_)
    exit 1
}

# ----------------------------------------------------------------------------
# 4. Bucle Principal de Atención de Solicitudes
# ----------------------------------------------------------------------------
while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        $port = $request.Url.Port
        $path = $request.Url.LocalPath
        $method = $request.HttpMethod

        # Manejo de Preflight CORS
        if ($method -eq "OPTIONS") {
            Send-Response $response 204 "text/plain" (New-Object byte[] 0)
            continue
        }

        # ====================================================================
        # PUERTO 8001 — COMERSYS ADMINISTRACIÓN CENTRAL (SUPERADMIN EXCLUSIVO)
        # ====================================================================
        if ($port -eq 8001) {
            # 1. API: Login Oficial de SuperAdmin (Cuenta Maestra)
            if ($path -eq "/api/admin/auth/login" -and $method -eq "POST") {
                $body = Read-Body $request | ConvertFrom-Json
                $db = Get-Database
                $user = $body.username.Trim().ToLower()
                $pass = $body.password

                $masterUser = $db.superadmin.username.ToLower()
                $masterEmail = if ($db.superadmin.email) { $db.superadmin.email.ToLower() } else { "farchettodamian685@gmail.com" }

                $isMaster = ($user -eq $masterUser -or $user -eq $masterEmail)
                if ($isMaster -and (Verify-Password $pass $db.superadmin.passwordHash)) {
                    $token = [Guid]::NewGuid().ToString("N")
                    if (-not $db.sessions) { $db | Add-Member -MemberType NoteProperty -Name "sessions" -Value (New-Object PSObject) }
                    $db.sessions | Add-Member -MemberType NoteProperty -Name $token -Value @{
                        role = "superadmin"
                        username = $db.superadmin.username
                        email = $masterEmail
                        displayName = $db.superadmin.displayName
                        isOwner = $true
                        createdAt = (Get-Date).ToString("o")
                    } -Force
                    $db.superadmin.lastLoginAt = (Get-Date).ToUniversalTime().ToString("o")
                    Add-AuditLog $db $db.superadmin.username "SUPERADMIN_LOGIN" "SYSTEM" ("Inicio de sesión oficial del Administrador General (" + $masterEmail + ").")
                    Save-Database $db

                    Send-Json $response 200 @{
                        token = $token
                        username = $db.superadmin.username
                        email = $masterEmail
                        displayName = $db.superadmin.displayName
                        role = "SUPERADMINISTRADOR"
                        isOwner = $true
                        mustChangePassword = [bool]$db.superadmin.mustChangePassword
                    }
                } else {
                    Send-Json $response 401 @{ error = "Credenciales de Administrador General inválidas." }
                }
                continue
            }

            # ----------------------------------------------------------------
            # SEGURIDAD SERVIDOR: Verificación Obligatoria de Token SuperAdmin
            # ----------------------------------------------------------------
            $isStaticRoute = ($method -eq "GET" -and -not $path.StartsWith("/api/admin/"))
            if (-not $isStaticRoute) {
                $superSession = Validate-SuperAdmin $request $db
                if (-not $superSession) {
                    Send-Json $response 401 @{ error = "Acceso denegado. Se requiere autenticación válida de SuperAdministrador." }
                    continue
                }
            }

            # 2. API: Cambio Obligatorio de Contraseña de SuperAdmin
            if ($path -eq "/api/admin/auth/change-password" -and $method -eq "POST") {
                $body = Read-Body $request | ConvertFrom-Json
                $db = Get-Database

                $curr = $body.currentPassword
                $newP = $body.newPassword

                if (-not (Verify-Password $curr $db.superadmin.passwordHash)) {
                    Send-Json $response 400 @{ error = "La contraseña actual no es correcta." }
                    continue
                }

                $db.superadmin.passwordHash = Hash-Password $newP
                $db.superadmin.mustChangePassword = $false
                Add-AuditLog $db $db.superadmin.username "SUPERADMIN_PASSWORD_CHANGED" "SYSTEM" "Contraseña de SuperAdmin actualizada con éxito (PBKDF2)."
                Save-Database $db

                Send-Json $response 200 @{ ok = $true; message = "Contraseña actualizada correctamente." }
                continue
            }

            # 3. API: Listado de Negocios, Suscripciones y Métricas Globales
            if ($path -eq "/api/admin/tenants" -and $method -eq "GET") {
                $db = Get-Database
                $resultList = @()
                $globalRevenue = 0

                foreach ($t in $db.tenants) {
                    $tData = $db.tenantData.$($t.id)
                    $prodsCount = 0
                    $salesCount = 0
                    $rev = 0

                    if ($tData) {
                        if ($tData.products) { $prodsCount = $tData.products.Count }
                        if ($tData.sales) {
                            $salesCount = $tData.sales.Count
                            foreach ($s in $tData.sales) { $rev += [double]$s.total }
                        }
                    }
                    $globalRevenue += $rev

                    # Buscar usuario del tenant
                    $tUser = ($db.users | Where-Object { $_.tenantId -eq $t.id })[0]
                    $uname = if ($tUser) { $tUser.username } else { "" }

                    $sub = $t.subscription
                    if (-not $sub) {
                        $sub = [PSCustomObject]@{
                            plan = "Profesional"
                            price = 35000
                            paymentStatus = "paid"
                            renewalDate = (Get-Date).AddMonths(1).ToString("yyyy-MM-dd")
                            notes = ""
                        }
                    }

                    $resultList += @{
                        id = $t.id
                        businessName = $t.businessName
                        ownerName = $t.ownerName
                        taxId = $t.taxId
                        phone = $t.phone
                        email = $t.email
                        status = $t.status
                        suspensionReason = if ($t.suspensionReason) { $t.suspensionReason } else { "" }
                        subscription = $sub
                        createdAt = $t.createdAt
                        username = $uname
                        stats = @{
                            products = $prodsCount
                            sales = $salesCount
                            revenue = $rev
                        }
                    }
                }

                Send-Json $response 200 @{
                    tenants = $resultList
                    metrics = @{
                        totalTenants = $db.tenants.Count
                        activeTenants = ($db.tenants | Where-Object { $_.status -eq 'active' }).Count
                        suspendedTenants = ($db.tenants | Where-Object { $_.status -eq 'suspended' }).Count
                        closedTenants = ($db.tenants | Where-Object { $_.status -eq 'closed' }).Count
                        globalRevenue = $globalRevenue
                    }
                }
                continue
            }

            # 4. API: Crear Nuevo Negocio Cliente
            if ($path -eq "/api/admin/tenants/create" -and $method -eq "POST") {
                $body = Read-Body $request | ConvertFrom-Json
                $db = Get-Database

                $cleanUser = $body.username.Trim().ToLower()

                # Impedir que se usen nombres reservados o la cuenta maestra
                if ($cleanUser -eq "administrador" -or $cleanUser -eq "admin" -or $cleanUser -eq "superadmin" -or $cleanUser -eq "superadministrador") {
                    Send-Json $response 400 @{ error = "El nombre de usuario '@$cleanUser' está reservado exclusivamente para la Administración General." }
                    continue
                }

                if ($body.email -and $body.email.Trim().ToLower() -eq $db.superadmin.email.ToLower()) {
                    Send-Json $response 400 @{ error = "El correo electrónico pertenece a la cuenta maestra del propietario de ComerSys." }
                    continue
                }

                # Verificar usuario único
                $existsUser = $db.users | Where-Object { $_.username.ToLower() -eq $cleanUser }
                if ($existsUser) {
                    Send-Json $response 400 @{ error = "El nombre de usuario '@$cleanUser' ya se encuentra registrado." }
                    continue
                }

                $tId = "tenant_" + [Guid]::NewGuid().ToString("N").Substring(0, 8)
                $now = (Get-Date).ToUniversalTime().ToString("o")

                $plan = if ($body.plan) { $body.plan } else { "Profesional" }
                $price = if ($body.price) { [double]$body.price } else { 35000 }

                $newTenant = [PSCustomObject]@{
                    id = $tId
                    businessName = $body.businessName
                    ownerName = $body.ownerName
                    taxId = $body.taxId
                    phone = $body.phone
                    email = $body.email
                    status = "active"
                    suspensionReason = ""
                    subscription = [PSCustomObject]@{
                        plan = $plan
                        price = $price
                        paymentStatus = "paid"
                        renewalDate = (Get-Date).AddMonths(1).ToString("yyyy-MM-dd")
                        notes = if ($body.notes) { $body.notes } else { "" }
                    }
                    createdAt = $now
                    updatedAt = $now
                    notes = $body.notes
                }

                $newUser = [PSCustomObject]@{
                    id = ($db.users.Count + 1)
                    tenantId = $tId
                    username = $cleanUser
                    passwordHash = Hash-Password $body.password
                    displayName = $body.businessName
                    role = "admin"
                    createdAt = $now
                }

                # Espacio de información completamente aislado para el nuevo negocio
                $newTenantData = [PSCustomObject]@{
                    meta = [PSCustomObject]@{
                        version = "1.0.0"
                        createdAt = $now
                        updatedAt = $now
                        sequences = [PSCustomObject]@{
                            groups = 0; products = 0; clients = 0; sales = 0; debts = 0; installments = 0; payments = 0; movements = 0
                        }
                    }
                    settings = [PSCustomObject]@{
                        businessName = $body.businessName
                        taxId = $body.taxId
                        phone = $body.phone
                        address = ""
                        currencySymbol = "$"
                        currencyCode = "ARS"
                        dateFormat = "DD/MM/YYYY"
                        lowStockThreshold = 5
                        darkMode = $false
                    }
                    groups = @()
                    products = @()
                    clients = @()
                    sales = @()
                    debts = @()
                    installments = @()
                    payments = @()
                    movements = @()
                }

                $db.tenants = @($db.tenants) + @($newTenant)
                $db.users = @($db.users) + @($newUser)
                $db.tenantData | Add-Member -MemberType NoteProperty -Name $tId -Value $newTenantData -Force

                Add-AuditLog $db $db.superadmin.username "TENANT_CREATED" $tId ("Nuevo negocio registrado: " + $body.businessName + " (Usuario: @" + $cleanUser + " / Plan: " + $plan + ")")
                Save-Database $db

                Send-Json $response 201 @{ ok = $true; tenantId = $tId; message = "Negocio comercial creado exitosamente." }
                continue
            }

            # 5. API: Cambiar Estado de Cuenta (Activar, Suspender, Cerrar)
            if ($path -eq "/api/admin/tenants/status" -and $method -eq "POST") {
                $body = Read-Body $request | ConvertFrom-Json
                $db = Get-Database
                $target = ($db.tenants | Where-Object { $_.id -eq $body.tenantId })[0]

                if (-not $target) {
                    Send-Json $response 404 @{ error = "Negocio no encontrado." }
                    continue
                }

                $oldStatus = $target.status
                $target.status = $body.status
                $target.updatedAt = (Get-Date).ToUniversalTime().ToString("o")

                if ($body.status -eq "active") {
                    $target.suspensionReason = ""
                    if ($target.subscription) { $target.subscription.paymentStatus = "paid" }
                    Add-AuditLog $db $db.superadmin.username "TENANT_STATUS_CHANGED" $target.id ("Cuenta reactivada: " + $target.businessName + " (Acceso restaurado)")
                } elseif ($body.status -eq "suspended") {
                    $reason = if ($body.reason) { $body.reason } else { "MANUAL" }
                    $target.suspensionReason = $reason
                    if ($reason -eq "FALTA_DE_PAGO" -and $target.subscription) {
                        $target.subscription.paymentStatus = "overdue"
                    }
                    Add-AuditLog $db $db.superadmin.username "TENANT_STATUS_CHANGED" $target.id ("Cuenta suspendida: " + $target.businessName + " (Motivo: " + $reason + ")")
                } else {
                    Add-AuditLog $db $db.superadmin.username "TENANT_STATUS_CHANGED" $target.id ("Cambio de estado en " + $target.businessName + ": " + $oldStatus + " -> " + $body.status)
                }

                Save-Database $db
                Send-Json $response 200 @{ ok = $true; status = $target.status; reason = $target.suspensionReason }
                continue
            }

            # 6. API: Control y Actualización de Suscripción Comercial
            if ($path -eq "/api/admin/tenants/subscription" -and $method -eq "POST") {
                $body = Read-Body $request | ConvertFrom-Json
                $db = Get-Database
                $target = ($db.tenants | Where-Object { $_.id -eq $body.tenantId })[0]

                if (-not $target) {
                    Send-Json $response 404 @{ error = "Comercio no encontrado." }
                    continue
                }

                if (-not $target.subscription) {
                    $target | Add-Member -MemberType NoteProperty -Name "subscription" -Value (New-Object PSObject) -Force
                }

                $target.subscription.plan = $body.plan
                $target.subscription.price = [double]$body.price
                $target.subscription.paymentStatus = $body.paymentStatus
                $target.subscription.renewalDate = $body.renewalDate
                $target.subscription.notes = $body.notes
                $target.updatedAt = (Get-Date).ToUniversalTime().ToString("o")

                # Si se marca como vencido o impago, se puede reflejar en el motivo
                if ($body.paymentStatus -eq "overdue") {
                    $target.suspensionReason = "FALTA_DE_PAGO"
                }

                Add-AuditLog $db $db.superadmin.username "TENANT_SUBSCRIPTION_UPDATED" $target.id ("Suscripción actualizada para " + $target.businessName + ": Plan " + $body.plan + " / Estado: " + $body.paymentStatus)
                Save-Database $db

                Send-Json $response 200 @{ ok = $true; subscription = $target.subscription }
                continue
            }

            # 7. API: Supervisión e Inspección Detallada del Comercio
            if ($path -eq "/api/admin/tenants/inspect" -and $method -eq "GET") {
                $tId = $request.QueryString["tenantId"]
                $db = Get-Database
                $target = ($db.tenants | Where-Object { $_.id -eq $tId })[0]

                if (-not $target) {
                    Send-Json $response 404 @{ error = "Comercio no encontrado." }
                    continue
                }

                $tUser = ($db.users | Where-Object { $_.tenantId -eq $tId })[0]
                $tData = $db.tenantData.$tId

                $prodsCount = 0
                $clientsCount = 0
                $salesCount = 0
                $totalRevenue = 0
                $recentSales = @()

                if ($tData) {
                    if ($tData.products) { $prodsCount = $tData.products.Count }
                    if ($tData.clients) { $clientsCount = $tData.clients.Count }
                    if ($tData.sales) {
                        $salesCount = $tData.sales.Count
                        foreach ($s in $tData.sales) { $totalRevenue += [double]$s.total }
                        # Últimas 10 ventas
                        $recentSales = ($tData.sales | Select-Object -Last 10)
                    }
                }

                Send-Json $response 200 @{
                    tenant = @{
                        id = $target.id
                        businessName = $target.businessName
                        ownerName = $target.ownerName
                        taxId = $target.taxId
                        phone = $target.phone
                        email = $target.email
                        status = $target.status
                        username = if ($tUser) { $tUser.username } else { "" }
                        subscription = $target.subscription
                    }
                    stats = @{
                        productsCount = $prodsCount
                        clientsCount = $clientsCount
                        salesCount = $salesCount
                        totalRevenue = $totalRevenue
                    }
                    recentSales = $recentSales
                }
                continue
            }

            # 8. API: Restablecer Contraseña de Negocio
            if ($path -eq "/api/admin/tenants/reset-password" -and $method -eq "POST") {
                $body = Read-Body $request | ConvertFrom-Json
                $db = Get-Database
                $tUser = ($db.users | Where-Object { $_.tenantId -eq $body.tenantId })[0]

                if (-not $tUser) {
                    Send-Json $response 404 @{ error = "Usuario del negocio no encontrado." }
                    continue
                }

                $tUser.passwordHash = Hash-Password $body.newPassword
                Add-AuditLog $db $db.superadmin.username "TENANT_PASSWORD_RESET" $body.tenantId ("Contraseña restablecida para el usuario @" + $tUser.username)
                Save-Database $db

                Send-Json $response 200 @{ ok = $true; message = "Contraseña restablecida correctamente." }
                continue
            }

            # 9. API: Consultar Auditoría
            if ($path -eq "/api/admin/audit" -and $method -eq "GET") {
                $db = Get-Database
                Send-Json $response 200 @{ logs = $db.auditLogs }
                continue
            }

            # 10. API: Respaldo Completo de la Plataforma
            if ($path -eq "/api/admin/backup" -and $method -eq "GET") {
                $raw = [System.IO.File]::ReadAllText($dbPath, [System.Text.Encoding]::UTF8)
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($raw)
                $response.AddHeader("Content-Disposition", "attachment; filename=comersys_platform_backup.json")
                Send-Response $response 200 "application/json; charset=utf-8" $bytes
                continue
            }

            # Servir Archivos Estáticos de la Administración Central (admin-central/)
            $cleanRel = $path.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
            if ([string]::IsNullOrWhiteSpace($cleanRel)) { $cleanRel = "index.html" }
            $fullPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($adminDir, $cleanRel))

            if ($fullPath.StartsWith($adminDir) -and (Test-Path $fullPath -PathType Leaf)) {
                Send-File $response $fullPath
            } else {
                $fallbackPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($rootDir, $cleanRel))
                if ($fallbackPath.StartsWith($rootDir) -and (Test-Path $fallbackPath -PathType Leaf)) {
                    Send-File $response $fallbackPath
                } else {
                    Send-Response $response 404 "text/plain" ([System.Text.Encoding]::UTF8.GetBytes("404 Not Found - Admin Central"))
                }
            }
            continue
        }

        # ====================================================================
        # PUERTO 8000 — COMERSYS CLIENTE (SISTEMA COMERCIAL MULTI-TENANT)
        # ====================================================================
        if ($port -eq 8000) {
            # Bloqueo estricto: el puerto 8000 NO tiene acceso al panel de administración central
            if ($path.ToLower().Contains("admin-central")) {
                Send-Response $response 403 "text/plain" ([System.Text.Encoding]::UTF8.GetBytes("403 Forbidden - Panel Central no disponible en este puerto."))
                continue
            }

            # 1. API: Autenticación de Negocio Cliente
            if ($path -eq "/api/v1/auth/login" -and $method -eq "POST") {
                $body = Read-Body $request | ConvertFrom-Json
                $cleanUser = $body.username.Trim().ToLower()
                $pass = $body.password
                $db = Get-Database

                $user = ($db.users | Where-Object { $_.username.ToLower() -eq $cleanUser })[0]
                # Compatibilidad con alias administrador / admin
                if (-not $user -and ($cleanUser -eq "admin" -or $cleanUser -eq "administrador")) {
                    $user = ($db.users | Where-Object { $_.username.ToLower() -eq "administrador" -or $_.username.ToLower() -eq "admin" })[0]
                }

                if (-not $user -or (-not (Verify-Password $pass $user.passwordHash))) {
                    Send-Json $response 401 @{ error = "Usuario o contraseña incorrectos." }
                    continue
                }

                # Validar Estado del Negocio (Aislamiento y Reglas Comerciales)
                $tenant = ($db.tenants | Where-Object { $_.id -eq $user.tenantId })[0]
                if (-not $tenant) {
                    Send-Json $response 403 @{ error = "Espacio comercial no encontrado." }
                    continue
                }

                if ($tenant.status -eq "suspended") {
                    $msg = "Su cuenta comercial ha sido temporalmente SUSPENDIDA. Comuníquese con la Administración Central de ComerSys."
                    if ($tenant.suspensionReason -eq "FALTA_DE_PAGO") {
                        $msg = "Su cuenta comercial se encuentra SUSPENDIDA POR FALTA DE PAGO. Por favor comuníquese con la Administración Central (farchettodamian685@gmail.com) para regularizar su suscripción."
                    }
                    Send-Json $response 403 @{
                        error = $msg
                        suspended = $true
                        reason = $tenant.suspensionReason
                    }
                    continue
                }

                if ($tenant.status -eq "closed") {
                    Send-Json $response 403 @{
                        error = "Esta cuenta comercial ha sido cerrada definitivamente. Comuníquese con el Administrador General (farchettodamian685@gmail.com)."
                        closed = $true
                    }
                    continue
                }

                # Cargar exclusivamente los datos del Tenant Aislado
                $tData = $db.tenantData.$($tenant.id)
                $token = [Guid]::NewGuid().ToString("N")

                Send-Json $response 200 @{
                    session = @{
                        userId = $user.id
                        tenantId = $tenant.id
                        businessName = $tenant.businessName
                        username = $user.username
                        displayName = $user.displayName
                        role = $user.role
                        token = $token
                        loggedInAt = (Get-Date).ToUniversalTime().ToString("o")
                    }
                    tenantData = $tData
                }
                continue
            }

            # 2. API: Sincronización Transaccional de Datos del Tenant
            if ($path -eq "/api/v1/tenant/sync" -and $method -eq "POST") {
                $body = Read-Body $request | ConvertFrom-Json
                $tId = $body.tenantId
                $db = Get-Database

                $tenant = ($db.tenants | Where-Object { $_.id -eq $tId })[0]
                if (-not $tenant -or $tenant.status -ne "active") {
                    Send-Json $response 403 @{ error = "Operación denegada. Negocio no activo." }
                    continue
                }

                # Guardar datos aislados de este tenant
                $db.tenantData | Add-Member -MemberType NoteProperty -Name $tId -Value $body.data -Force
                Save-Database $db
                Send-Json $response 200 @{ ok = $true; syncedAt = (Get-Date).ToUniversalTime().ToString("o") }
                continue
            }

            # Servir Archivos Estáticos de ComerSys Cliente (SPA)
            $cleanRel = $path.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
            if ([string]::IsNullOrWhiteSpace($cleanRel)) { $cleanRel = "index.html" }
            $fullPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($rootDir, $cleanRel))

            if ($fullPath.StartsWith($rootDir) -and (Test-Path $fullPath -PathType Leaf)) {
                Send-File $response $fullPath
            } else {
                Send-Response $response 404 "text/plain" ([System.Text.Encoding]::UTF8.GetBytes("404 Not Found"))
            }
            continue
        }

        # Puerto no reconocido
        Send-Response $response 400 "text/plain" ([System.Text.Encoding]::UTF8.GetBytes("400 Bad Request"))

    } catch {
        # Log silencioso de excepciones en el listener
    }
}
