-- ============================================================================
-- AI Smart Energy Management System - MySQL 8 Database Schema
-- Normalized relational schema with strict constraints, indexes, and seed data
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `energy_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `energy_db`;

-- 1. USERS & AUTHENTICATION TABLE
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(36) PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `role` ENUM('admin', 'operator', 'viewer') NOT NULL DEFAULT 'operator',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_email` (`email`)
) ENGINE=InnoDB;

-- 2. IOT HARDWARE DEVICES TABLE
CREATE TABLE IF NOT EXISTS `devices` (
  `id` VARCHAR(64) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `device_type` VARCHAR(50) NOT NULL DEFAULT 'ESP32_DEVKIT_V1',
  `operating_voltage` DECIMAL(6, 2) NOT NULL DEFAULT 5.00,
  `mac_address` VARCHAR(17) NULL,
  `ip_address` VARCHAR(45) NULL,
  `status` ENUM('online', 'offline', 'simulated') NOT NULL DEFAULT 'simulated',
  `firmware_version` VARCHAR(20) DEFAULT '1.0.4',
  `last_seen` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. TELEMETRY READINGS TABLE (High Frequency Time-Series)
CREATE TABLE IF NOT EXISTS `telemetry_readings` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `device_id` VARCHAR(64) NOT NULL,
  `timestamp` TIMESTAMP NOT NULL,
  `current_amperes` DECIMAL(8, 4) NOT NULL,
  `voltage_volts` DECIMAL(8, 2) NULL,
  `is_voltage_measured` BOOLEAN NOT NULL DEFAULT FALSE,
  `power_watts` DECIMAL(10, 4) NOT NULL,
  `is_power_estimated` BOOLEAN NOT NULL DEFAULT TRUE,
  `cumulative_energy_kwh` DECIMAL(12, 6) NOT NULL,
  `motion_detected` BOOLEAN NOT NULL DEFAULT FALSE,
  `ambient_light_adc` INT NOT NULL DEFAULT 0,
  `light_state` BOOLEAN NOT NULL DEFAULT FALSE,
  `fan_state` BOOLEAN NOT NULL DEFAULT FALSE,
  `fan_speed_percent` INT NOT NULL DEFAULT 0,
  `rssi_dbm` INT NULL,
  CONSTRAINT `fk_telemetry_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE,
  INDEX `idx_telemetry_device_time` (`device_id`, `timestamp` DESC)
) ENGINE=InnoDB;

-- 4. APPLIANCE CONFIRMED STATES TABLE
CREATE TABLE IF NOT EXISTS `appliance_states` (
  `device_id` VARCHAR(64) PRIMARY KEY,
  `light_on` BOOLEAN NOT NULL DEFAULT FALSE,
  `light_mode` ENUM('manual', 'auto') NOT NULL DEFAULT 'auto',
  `auto_light_reason` VARCHAR(255) NULL,
  `fan_on` BOOLEAN NOT NULL DEFAULT FALSE,
  `fan_speed_percent` INT NOT NULL DEFAULT 0,
  `fan_mode` ENUM('manual', 'auto') NOT NULL DEFAULT 'manual',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_appliance_state_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. CONTROL COMMANDS & ACKNOWLEDGEMENT AUDIT LOG
CREATE TABLE IF NOT EXISTS `control_commands` (
  `command_id` VARCHAR(64) PRIMARY KEY,
  `device_id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(36) NULL,
  `action` VARCHAR(50) NOT NULL,
  `command_value` JSON NOT NULL,
  `status` ENUM('pending', 'acknowledged', 'timeout', 'failed') NOT NULL DEFAULT 'pending',
  `roundtrip_ms` INT NULL,
  `error_details` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `acknowledged_at` TIMESTAMP NULL,
  CONSTRAINT `fk_cmd_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE,
  INDEX `idx_cmd_status` (`status`, `created_at` DESC)
) ENGINE=InnoDB;

-- 6. SMART AUTOMATION RULES TABLE
CREATE TABLE IF NOT EXISTS `automation_rules` (
  `id` VARCHAR(64) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `condition_type` VARCHAR(50) NOT NULL,
  `motion_required` BOOLEAN DEFAULT TRUE,
  `light_threshold` INT DEFAULT 350,
  `inactivity_timeout_sec` INT DEFAULT 45,
  `current_threshold_a` DECIMAL(6, 3) NULL,
  `action_target` ENUM('light', 'fan', 'buzzer') NOT NULL,
  `action_value` JSON NOT NULL,
  `trigger_count` INT NOT NULL DEFAULT 0,
  `last_triggered` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 7. DAILY ENERGY SUMMARIES (Pre-Aggregated for Analytics & ML Training)
CREATE TABLE IF NOT EXISTS `daily_energy_summaries` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `device_id` VARCHAR(64) NOT NULL,
  `summary_date` DATE NOT NULL,
  `total_kwh` DECIMAL(10, 4) NOT NULL,
  `peak_power_w` DECIMAL(10, 2) NOT NULL,
  `light_kwh` DECIMAL(10, 4) NOT NULL,
  `fan_kwh` DECIMAL(10, 4) NOT NULL,
  `idle_kwh` DECIMAL(10, 4) NOT NULL,
  `light_runtime_hours` DECIMAL(5, 2) NOT NULL DEFAULT 0.0,
  `fan_runtime_hours` DECIMAL(5, 2) NOT NULL DEFAULT 0.0,
  `day_of_week` TINYINT NOT NULL,
  `is_weekend` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_device_date` (`device_id`, `summary_date`),
  INDEX `idx_summary_date` (`summary_date`)
) ENGINE=InnoDB;

-- 8. MACHINE LEARNING PREDICTIONS ARCHIVE
CREATE TABLE IF NOT EXISTS `monthly_predictions` (
  `id` VARCHAR(64) PRIMARY KEY,
  `device_id` VARCHAR(64) NOT NULL,
  `target_month` VARCHAR(7) NOT NULL, -- '2026-10'
  `forecast_total_kwh` DECIMAL(10, 3) NOT NULL,
  `remaining_days_kwh` DECIMAL(10, 3) NOT NULL,
  `estimated_bill_inr` DECIMAL(10, 2) NOT NULL,
  `confidence_lower_kwh` DECIMAL(10, 3) NOT NULL,
  `confidence_upper_kwh` DECIMAL(10, 3) NOT NULL,
  `model_name` VARCHAR(50) NOT NULL,
  `mae` DECIMAL(8, 4) NOT NULL,
  `rmse` DECIMAL(8, 4) NOT NULL,
  `r2_score` DECIMAL(6, 4) NOT NULL,
  `training_samples` INT NOT NULL,
  `data_source` ENUM('physical', 'simulated', 'hybrid') NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 9. ELECTRICITY TARIFFS & SLAB CONFIGURATION
CREATE TABLE IF NOT EXISTS `electricity_tariffs` (
  `id` VARCHAR(64) PRIMARY KEY,
  `provider_name` VARCHAR(150) NOT NULL,
  `state_region` VARCHAR(100) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `is_slab_based` BOOLEAN NOT NULL DEFAULT TRUE,
  `flat_rate_per_kwh` DECIMAL(8, 2) NOT NULL DEFAULT 4.50,
  `fixed_charges_inr` DECIMAL(8, 2) NOT NULL DEFAULT 80.00,
  `electricity_duty_pct` DECIMAL(5, 2) NOT NULL DEFAULT 9.00,
  `fuel_surcharge_per_unit` DECIMAL(6, 3) NOT NULL DEFAULT 0.350,
  `slabs_json` JSON NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 10. SYSTEM & HARDWARE SETTINGS
CREATE TABLE IF NOT EXISTS `user_settings` (
  `user_id` VARCHAR(36) PRIMARY KEY,
  `active_device_id` VARCHAR(64) NOT NULL,
  `active_tariff_id` VARCHAR(64) NOT NULL,
  `simulation_mode` BOOLEAN NOT NULL DEFAULT TRUE,
  `mqtt_broker_host` VARCHAR(255) DEFAULT 'localhost',
  `mqtt_broker_port` INT DEFAULT 1883,
  `mqtt_topic_prefix` VARCHAR(100) DEFAULT 'energy/device1',
  `telemetry_interval_sec` INT DEFAULT 2,
  `overcurrent_alert_amps` DECIMAL(5, 2) DEFAULT 1.80,
  `gpio_pinout_json` JSON NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert Default Demo Device
INSERT INTO `devices` (`id`, `name`, `device_type`, `operating_voltage`, `status`, `firmware_version`)
VALUES ('esp32-energy-devkit-01', 'Lab ESP32 Energy Monitor', 'ESP32_DEVKIT_V1', 5.00, 'simulated', '1.0.4')
ON DUPLICATE KEY UPDATE `name`=`name`;

-- Insert Initial Appliance State
INSERT INTO `appliance_states` (`device_id`, `light_on`, `light_mode`, `auto_light_reason`, `fan_on`, `fan_speed_percent`, `fan_mode`)
VALUES ('esp32-energy-devkit-01', 1, 'auto', 'Smart Night Lighting rule active', 1, 65, 'manual')
ON DUPLICATE KEY UPDATE `light_on`=1;

-- Insert Standard Indian Tariff Models
INSERT INTO `electricity_tariffs` (`id`, `provider_name`, `state_region`, `category`, `is_slab_based`, `flat_rate_per_kwh`, `fixed_charges_inr`, `electricity_duty_pct`, `fuel_surcharge_per_unit`, `slabs_json`, `is_active`)
VALUES
('tneb_domestic', 'TANGEDCO / TNEB', 'Tamil Nadu', 'Domestic (Single Phase)', 1, 4.20, 50.00, 5.00, 0.250, 
 '[{"minUnits": 0, "maxUnits": 100, "ratePerUnit": 0.0}, {"minUnits": 101, "maxUnits": 200, "ratePerUnit": 2.25}, {"minUnits": 201, "maxUnits": 400, "ratePerUnit": 4.50}, {"minUnits": 401, "maxUnits": null, "ratePerUnit": 6.00}]', 1),
('bescom_domestic', 'BESCOM', 'Karnataka', 'Domestic (Single Phase)', 1, 4.50, 85.00, 9.00, 0.350,
 '[{"minUnits": 0, "maxUnits": 50, "ratePerUnit": 4.15}, {"minUnits": 51, "maxUnits": 100, "ratePerUnit": 5.60}, {"minUnits": 101, "maxUnits": 200, "ratePerUnit": 7.15}, {"minUnits": 201, "maxUnits": null, "ratePerUnit": 8.20}]', 0),
('prototype_flat', 'Lab Flat Rate', 'Universal', 'Domestic (Single Phase)', 0, 4.50, 60.00, 5.00, 0.000, '[]', 0)
ON DUPLICATE KEY UPDATE `is_active`=`is_active`;

-- Insert Default Automation Rules
INSERT INTO `automation_rules` (`id`, `name`, `description`, `enabled`, `condition_type`, `motion_required`, `light_threshold`, `action_target`, `action_value`, `trigger_count`)
VALUES
('rule-pir-dark-light', 'Smart Night Lighting', 'Turn light ON when motion is detected and ambient light < 350', 1, 'motion_and_dark', 1, 350, 'light', 'true', 24),
('rule-inactivity-off', 'Auto-Off Inactivity Timer', 'Turn light OFF when no motion detected for 45s', 1, 'inactivity_timeout', 0, 0, 'light', 'false', 19),
('rule-overcurrent-trip', 'Hardware Overcurrent Alert', 'Sound buzzer when current > 1.8A on 5V rail', 1, 'overcurrent_protection', 0, 0, 'buzzer', 'true', 0)
ON DUPLICATE KEY UPDATE `name`=`name`;
