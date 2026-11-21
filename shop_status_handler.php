<?php
/**
 * Shop Status Auto-Migration and Real-Time Business Logic Handler
 * 
 * This script ensures the database structure exists and handles the smart-reset
 * rollover logic for vendor online/offline toggles across calendar days.
 */

// Define database connection constants - replace with your active MCB/MySQL server details
define('DB_HOST', 'localhost');
define('DB_USER', 'your_database_user');
define('DB_PASS', 'your_database_password');
define('DB_NAME', 'your_database_name');

function getDatabaseConnection() {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    if ($conn->connect_error) {
        die("Database connection failed: " . $conn->connect_error);
    }
    return $conn;
}

/**
 * STEP 1: Auto-Migration Structure Verification
 * Checks and provisions tables and missing columns cleanly.
 */
function verifyAndProvisionDatabaseStructure() {
    $db = getDatabaseConnection();

    // 1. Ensure 'restaurants' table exists
    $createRestaurantsTable = "CREATE TABLE IF NOT EXISTS `restaurants` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `name` varchar(255) NOT NULL,
        `is_manual_online` tinyint(1) NOT NULL DEFAULT 1,
        `last_status_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
    $db->query($createRestaurantsTable);

    // Patch columns into 'restaurants' if it existed beforehand without them
    $columnsCheck = $db->query("SHOW COLUMNS FROM `restaurants` LIKE 'is_manual_online'");
    if ($columnsCheck->num_rows == 0) {
        $db->query("ALTER TABLE `restaurants` ADD COLUMN `is_manual_online` tinyint(1) NOT NULL DEFAULT 1");
    }
    
    $columnsCheck = $db->query("SHOW COLUMNS FROM `restaurants` LIKE 'last_status_updated_at'");
    if ($columnsCheck->num_rows == 0) {
        $db->query("ALTER TABLE `restaurants` ADD COLUMN `last_status_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP");
    }

    // 2. Ensure 'restaurant_schedules' table exists
    $createSchedulesTable = "CREATE TABLE IF NOT EXISTS `restaurant_schedules` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `restaurant_id` int(11) NOT NULL,
        `day_of_week` varchar(15) NOT NULL,
        `is_closed_day` tinyint(1) NOT NULL DEFAULT 0,
        `opening_time` time NOT NULL DEFAULT '09:00:00',
        `closing_time` time NOT NULL DEFAULT '22:00:00',
        PRIMARY KEY (`id`),
        KEY `restaurant_id` (`restaurant_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
    $db->query($createSchedulesTable);

    $db->close();
}

/**
 * STEP 2: Smart Operational Evaluation Engine
 * Resolves final state and automatically auto-corrects previous-day manual clean-offs.
 */
function evaluateShopStatus($restaurantId) {
    $db = getDatabaseConnection();

    // Set timezone context explicitly to match your regional operations
    date_default_timezone_set('Asia/Kolkata');
    $currentDate = date('Y-m-d');
    $currentTime = date('H:i:s');
    $currentDay  = date('l'); // Outputs: Sunday, Monday, Tuesday, etc.

    // Fetch Restaurant Manual Control Configuration parameters
    $stmt = $db->prepare("SELECT `is_manual_online`, `last_status_updated_at` FROM `restaurants` WHERE `id` = ?");
    $stmt->bind_param("i", $restaurantId);
    $stmt->execute();
    $restaurantResult = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$restaurantResult) {
        $db->close();
        return "OFFLINE"; // Fallback safety state if record is missing
    }

    $isManualOnline = (bool)$restaurantResult['is_manual_online'];
    $lastUpdateDate = date('Y-m-d', strtotime($restaurantResult['last_status_updated_at']));

    // Date Rollover Routine: Auto-expire offline switches made on previous days
    if ($lastUpdateDate !== $currentDate && !$isManualOnline) {
        $isManualOnline = true; // Temporary execution context runtime override
        
        // Persist the state update back into the data layers cleanly
        $updateStmt = $db->prepare("UPDATE `restaurants` SET `is_manual_online` = 1, `last_status_updated_at` = NOW() WHERE `id` = ?");
        $updateStmt->bind_param("i", $restaurantId);
        $updateStmt->execute();
        $updateStmt->close();
    }

    // Fetch Target Timeline Configuration Rules matching the active day
    $stmt = $db->prepare("SELECT `is_closed_day`, `opening_time`, `closing_time` FROM `restaurant_schedules` WHERE `restaurant_id` = ? AND LOWER(`day_of_week`) = LOWER(?)");
    $stmt->bind_param("is", $restaurantId, $currentDay);
    $stmt->execute();
    $scheduleResult = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    $db->close();

    // Default structural fallback block if no custom rules are declared for today
    if (!$scheduleResult) {
        return ($isManualOnline) ? "ONLINE" : "OFFLINE";
    }

    $isClosedDay = (bool)$scheduleResult['is_closed_day'];
    $openingTime = $scheduleResult['opening_time'];
    $closingTime = $scheduleResult['closing_time'];

    // Evaluate Structural Conditions Hierarchy
    if ($isClosedDay) {
        return "OFFLINE"; // Today is flagged structural close
    }

    // Evaluate standard business operating timeframe windows
    if ($currentTime >= $openingTime && $currentTime <= $closingTime) {
        // Active business window is open. Respect explicit manual actions executed TODAY.
        if ($lastUpdateDate === $currentDate && !$isManualOnline) {
            return "OFFLINE";
        }
        return "ONLINE";
    }

    return "OFFLINE"; // Outside timeline operational windows
}

// Ensure database structures match schemas on file initialization execution safely
verifyAndProvisionDatabaseStructure();
?>
