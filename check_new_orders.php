<?php
/**
 * check_new_orders.php
 * ─────────────────────────────────────────────────────────────────────────────
 * Real-Time New Order Notification Endpoint
 *
 * Called by the vendor dashboard every 10 seconds via JavaScript fetch().
 * Returns a JSON response telling the frontend whether a new pending order
 * has arrived since the last time this endpoint was checked.
 *
 * Responses:
 *   GET  → { "has_new_order": true|false, "count": N, "checked_since": "..." }
 *   POST → { "acknowledged": true, "timestamp": "..." }   (resets the timer)
 *
 * ── HOW THE "SMART RESET" WORKS ─────────────────────────────────────────────
 *   • On first load, a session timestamp is saved as "last seen" baseline.
 *   • Every GET poll checks for orders NEWER than that timestamp.
 *   • When the siren plays (frontend), it fires a POST to acknowledge.
 *   • The POST updates the session timestamp, silencing repeat alerts for
 *     that same order on the next poll cycles.
 *
 * ── SETUP ────────────────────────────────────────────────────────────────────
 *   1. Fill in your database credentials below.
 *   2. Make sure $_SESSION['vendor_id'] is set when your vendor logs in.
 *   3. Your 'orders' table needs: vendor_id, status, created_at columns.
 */

// ─── Response Headers ─────────────────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');

// ─── Database Credentials ─────────────────────────────────────────────────────
// *** Replace these with your actual values ***
define('DB_HOST', 'localhost');
define('DB_USER', 'your_database_user');
define('DB_PASS', 'your_database_password');
define('DB_NAME', 'your_database_name');

// ─── Session ──────────────────────────────────────────────────────────────────
session_start();

// Set a baseline timestamp on the very first visit so we don't alert on
// ALL existing old pending orders the moment the page loads.
if (!isset($_SESSION['last_order_check_time'])) {
    $_SESSION['last_order_check_time'] = date('Y-m-d H:i:s');
}

// ─── POST: Acknowledge (called by JS after siren plays) ───────────────────────
// Advances the "last seen" window forward so the siren won't re-fire for the
// same order on the next poll cycle.
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $_SESSION['last_order_check_time'] = date('Y-m-d H:i:s');
    echo json_encode([
        'acknowledged' => true,
        'timestamp'    => $_SESSION['last_order_check_time']
    ]);
    exit;
}

// ─── Vendor ID ────────────────────────────────────────────────────────────────
// In production this should ONLY come from the session (set during login).
// The GET param fallback is for local testing ONLY — remove before going live.
$vendor_id = isset($_SESSION['vendor_id']) ? (int) $_SESSION['vendor_id'] : null;

if (!$vendor_id && isset($_GET['vendor_id'])) {
    // ⚠️  TESTING ONLY — remove this block before production deployment
    $vendor_id = (int) $_GET['vendor_id'];
}

if (!$vendor_id) {
    echo json_encode([
        'has_new_order' => false,
        'error'         => 'No vendor session. Please log in first.',
        'hint'          => 'Set $_SESSION["vendor_id"] in your login handler.'
    ]);
    exit;
}

// ─── Database Connection ──────────────────────────────────────────────────────
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode([
        'has_new_order' => false,
        'error'         => 'Database connection failed.'
        // Never expose $conn->connect_error to the client in production
    ]);
    exit;
}

// Set server timezone to match your region (IST here; adjust as needed)
$conn->query("SET time_zone = '+05:30'");

// ─── Query: New Pending Orders Since Last Check ───────────────────────────────
$last_check = $_SESSION['last_order_check_time'];

$stmt = $conn->prepare(
    "SELECT COUNT(*) AS new_order_count
       FROM `orders`
      WHERE `vendor_id`  = ?
        AND `status`     = 'pending'
        AND `created_at` > ?
      LIMIT 1"
);

if (!$stmt) {
    http_response_code(500);
    echo json_encode(['has_new_order' => false, 'error' => 'Query preparation failed.']);
    $conn->close();
    exit;
}

$stmt->bind_param('is', $vendor_id, $last_check);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();
$conn->close();

// ─── JSON Response ────────────────────────────────────────────────────────────
$count         = (int) $row['new_order_count'];
$has_new_order = $count > 0;

echo json_encode([
    'has_new_order' => $has_new_order,
    'count'         => $count,
    'checked_since' => $last_check
]);
exit;
?>
