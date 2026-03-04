-- SmartMigrate Metadata Database Schema
-- Run this manually against your local MySQL instance:
--   mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS smartmigrate;
USE smartmigrate;

-- -------------------------------------------------------
-- Users (seeded with static admin account)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id         BIGINT       PRIMARY KEY AUTO_INCREMENT,
    username   VARCHAR(50)  NOT NULL UNIQUE,
    password   VARCHAR(100) NOT NULL,
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Seed admin user (password: admin123)
INSERT IGNORE INTO users (username, password) VALUES ('admin', 'admin123');

-- -------------------------------------------------------
-- Connections (Sources)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS connections (
    id         BIGINT       PRIMARY KEY AUTO_INCREMENT,
    name       VARCHAR(100) NOT NULL,
    type       ENUM('QUICKBOOKS','MYSQL') NOT NULL,
    config     JSON         NOT NULL,
    status     ENUM('ACTIVE','ERROR','PENDING') DEFAULT 'PENDING',
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- -------------------------------------------------------
-- Destinations
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS destinations (
    id         BIGINT       PRIMARY KEY AUTO_INCREMENT,
    name       VARCHAR(100) NOT NULL,
    type       ENUM('AZURE_SQL','AZURE_BLOB','MYSQL_CLOUD') NOT NULL,
    config     JSON         NOT NULL,
    status     ENUM('ACTIVE','ERROR','PENDING') DEFAULT 'PENDING',
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- -------------------------------------------------------
-- Sync Jobs
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_jobs (
    id             BIGINT       PRIMARY KEY AUTO_INCREMENT,
    name           VARCHAR(100) NOT NULL,
    connection_id  BIGINT       NOT NULL,
    destination_id BIGINT       NOT NULL,
    status         ENUM('IDLE','RUNNING','SUCCESS','FAILED') DEFAULT 'IDLE',
    enabled        TINYINT(1)   NOT NULL DEFAULT 1,
    schedule_type  ENUM('MANUAL','HOURLY','EVERY_6H','DAILY','WEEKLY') NOT NULL DEFAULT 'MANUAL',
    next_run_at    TIMESTAMP    NULL,
    last_run_at    TIMESTAMP    NULL,
    created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (connection_id)  REFERENCES connections(id)  ON DELETE CASCADE,
    FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE CASCADE
);

-- -------------------------------------------------------
-- Sync Logs
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_logs (
    id                  BIGINT    PRIMARY KEY AUTO_INCREMENT,
    sync_job_id         BIGINT    NOT NULL,
    status              ENUM('RUNNING','SUCCESS','FAILED') NOT NULL,
    rows_synced         INT       DEFAULT 0,
    error_message       TEXT,
    started_at          TIMESTAMP NOT NULL,
    finished_at         TIMESTAMP NULL,
    extract_duration_ms BIGINT    DEFAULT 0,
    load_duration_ms    BIGINT    DEFAULT 0,
    triggered_by        VARCHAR(50) DEFAULT 'admin',
    FOREIGN KEY (sync_job_id) REFERENCES sync_jobs(id) ON DELETE CASCADE
);

-- -------------------------------------------------------
-- Migration (run if tables already exist)
-- Note: IF NOT EXISTS is not supported for ADD COLUMN in MySQL < 8.0.3
-- Run each line individually; ignore Error 1060 (duplicate column) if already added.
-- -------------------------------------------------------
-- ALTER TABLE sync_jobs ADD COLUMN enabled TINYINT(1) NOT NULL DEFAULT 1;
-- ALTER TABLE sync_jobs ADD COLUMN schedule_type ENUM('MANUAL','HOURLY','EVERY_6H','DAILY','WEEKLY') NOT NULL DEFAULT 'MANUAL';
-- ALTER TABLE sync_jobs ADD COLUMN next_run_at TIMESTAMP NULL;
-- ALTER TABLE sync_logs ADD COLUMN extract_duration_ms BIGINT DEFAULT 0;
-- ALTER TABLE sync_logs ADD COLUMN load_duration_ms BIGINT DEFAULT 0;
-- ALTER TABLE sync_logs ADD COLUMN triggered_by VARCHAR(50) DEFAULT 'admin';
-- ALTER TABLE connections MODIFY COLUMN type ENUM('QUICKBOOKS','MYSQL','MSSQL') NOT NULL;
-- ALTER TABLE destinations MODIFY COLUMN type ENUM('AZURE_SQL','AZURE_BLOB','MYSQL_CLOUD','NETSUITE') NOT NULL;
-- ALTER TABLE sync_jobs ADD COLUMN config JSON NULL;
