package com.smartmigrate.connections;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.sql.DriverManager;
import java.sql.ResultSet;
import java.util.*;

@Service
public class ConnectionService {

    private final ConnectionRepository repo;

    public ConnectionService(ConnectionRepository repo) {
        this.repo = repo;
    }

    public List<Connection> findAll() {
        return repo.findAll();
    }

    public Connection findById(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Connection not found"));
    }

    public Connection create(Connection connection) {
        connection.setStatus(Connection.ConnectionStatus.PENDING);
        return repo.save(connection);
    }

    public Connection update(Long id, Connection updated) {
        Connection existing = findById(id);
        existing.setName(updated.getName());
        existing.setConfig(updated.getConfig());
        existing.setStatus(Connection.ConnectionStatus.PENDING);
        return repo.save(existing);
    }

    public void delete(Long id) {
        findById(id);
        repo.deleteById(id);
    }

    // ── Test connection ──────────────────────────────────────────────────────

    public Map<String, Object> testConnection(Long id) {
        Connection conn = findById(id);
        try {
            switch (conn.getType()) {
                case MYSQL      -> testMysql(conn.getConfig());
                case MSSQL      -> testMsSql(conn.getConfig());
                case QUICKBOOKS -> testQuickBooks(conn);
            }
            conn.setStatus(Connection.ConnectionStatus.ACTIVE);
            repo.save(conn);
            return Map.of("success", true, "message", "Connection successful");
        } catch (Exception e) {
            conn.setStatus(Connection.ConnectionStatus.ERROR);
            repo.save(conn);
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    // ── Schema fetch (MySQL + MSSQL) ─────────────────────────────────────────

    /**
     * Introspects the remote database and returns every user table with its
     * ordered column list.  Supported for MYSQL and MSSQL connections only.
     *
     * MySQL  → keys are plain table names  (e.g. "customers")
     * MSSQL  → keys are schema-qualified   (e.g. "dbo.Customers")
     */
    public Map<String, List<String>> fetchSchema(Long id) {
        Connection conn = findById(id);
        return switch (conn.getType()) {
            case MYSQL  -> fetchMySqlSchema(conn.getConfig());
            case MSSQL  -> fetchMsSqlSchema(conn.getConfig());
            case QUICKBOOKS -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Schema browsing is not supported for QuickBooks connections.");
        };
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private void testMysql(Map<String, Object> config) throws Exception {
        String host     = (String) config.get("host");
        int    port     = Integer.parseInt(config.getOrDefault("port", 3306).toString());
        String database = (String) config.get("database");
        String username = (String) config.get("username");
        String password = (String) config.get("password");
        String url = String.format(
                "jdbc:mysql://%s:%d/%s?useSSL=false&allowPublicKeyRetrieval=true",
                host, port, database);
        try (var ignored = DriverManager.getConnection(url, username, password)) { /* ok */ }
    }

    private void testMsSql(Map<String, Object> config) throws Exception {
        try (var ignored = DriverManager.getConnection(buildMsSqlUrl(config),
                (String) config.get("username"),
                (String) config.get("password"))) { /* ok */ }
    }

    private void testQuickBooks(Connection conn) throws Exception {
        Map<String, Object> config = conn.getConfig();
        String authMode = (String) config.getOrDefault("authMode", "OAUTH");
        String realmId  = (String) config.get("realmId");

        if (realmId == null || realmId.isBlank()) {
            throw new Exception("Realm ID (Company ID) is required.");
        }

        if ("DIRECT_TOKEN".equalsIgnoreCase(authMode)) {
            com.smartmigrate.connectors.quickbooks.QuickBooksConnector connector =
                    new com.smartmigrate.connectors.quickbooks.QuickBooksConnector(config);
            connector.refreshAccessToken();
            String newRefreshToken = connector.getLatestRefreshToken();
            if (newRefreshToken != null && !newRefreshToken.isBlank()) {
                config.put("refreshToken", newRefreshToken);
            }
        } else {
            String accessToken = (String) config.get("accessToken");
            if (accessToken == null || accessToken.isBlank()) {
                throw new Exception("Not yet authorized. Please complete the OAuth flow.");
            }
        }
    }

    // ── Schema helpers ───────────────────────────────────────────────────────

    private Map<String, List<String>> fetchMySqlSchema(Map<String, Object> cfg) {
        String host     = (String) cfg.get("host");
        int    port     = Integer.parseInt(cfg.getOrDefault("port", 3306).toString());
        String database = (String) cfg.get("database");
        String username = (String) cfg.get("username");
        String password = (String) cfg.get("password");
        String url = String.format(
                "jdbc:mysql://%s:%d/%s?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC",
                host, port, database);

        Map<String, List<String>> schema = new LinkedHashMap<>();
        try (java.sql.Connection db = DriverManager.getConnection(url, username, password)) {
            try (ResultSet rs = db.getMetaData().getTables(database, null, "%", new String[]{"TABLE"})) {
                while (rs.next()) {
                    schema.put(rs.getString("TABLE_NAME"), new ArrayList<>());
                }
            }
            for (String table : schema.keySet()) {
                try (ResultSet rs = db.getMetaData().getColumns(database, null, table, "%")) {
                    while (rs.next()) {
                        schema.get(table).add(rs.getString("COLUMN_NAME"));
                    }
                }
            }
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Schema fetch failed: " + e.getMessage());
        }
        return schema;
    }

    private Map<String, List<String>> fetchMsSqlSchema(Map<String, Object> cfg) {
        String url      = buildMsSqlUrl(cfg);
        String username = (String) cfg.get("username");
        String password = (String) cfg.get("password");

        // Using INFORMATION_SCHEMA queries instead of JDBC metadata.
        // getMetaData().getColumns() with null catalog silently returns empty results
        // for many mssql-jdbc driver versions — INFORMATION_SCHEMA is always reliable.
        String tablesSql =
                "SELECT TABLE_SCHEMA, TABLE_NAME " +
                "FROM INFORMATION_SCHEMA.TABLES " +
                "WHERE TABLE_TYPE = 'BASE TABLE' " +
                "ORDER BY TABLE_SCHEMA, TABLE_NAME";

        String colsSql =
                "SELECT COLUMN_NAME " +
                "FROM INFORMATION_SCHEMA.COLUMNS " +
                "WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? " +
                "ORDER BY ORDINAL_POSITION";

        Map<String, List<String>> schema = new LinkedHashMap<>();
        try (java.sql.Connection db = DriverManager.getConnection(url, username, password)) {

            // 1 — Discover user tables
            try (java.sql.Statement stmt = db.createStatement();
                 ResultSet rs            = stmt.executeQuery(tablesSql)) {
                while (rs.next()) {
                    String fullName = rs.getString("TABLE_SCHEMA") + "." + rs.getString("TABLE_NAME");
                    schema.put(fullName, new ArrayList<>());
                }
            }

            // 2 — Discover columns for each table (one prepared statement, reused per table)
            try (java.sql.PreparedStatement ps = db.prepareStatement(colsSql)) {
                for (String tableRef : schema.keySet()) {
                    String[] parts = tableRef.split("\\.", 2);
                    ps.setString(1, parts[0]);   // TABLE_SCHEMA
                    ps.setString(2, parts[1]);   // TABLE_NAME
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) {
                            schema.get(tableRef).add(rs.getString("COLUMN_NAME"));
                        }
                    }
                }
            }

        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Schema fetch failed: " + e.getMessage());
        }
        return schema;
    }

    private static String buildMsSqlUrl(Map<String, Object> cfg) {
        String  host      = (String) cfg.get("host");
        int     port      = Integer.parseInt(cfg.getOrDefault("port", 1433).toString());
        String  database  = (String) cfg.get("database");
        String  instance  = (String) cfg.get("instance");
        boolean encrypt   = Boolean.parseBoolean(cfg.getOrDefault("encrypt",   "false").toString());
        boolean trustCert = Boolean.parseBoolean(cfg.getOrDefault("trustServerCertificate", "true").toString());

        String serverPart = (instance != null && !instance.isBlank())
                ? host + "\\" + instance
                : host;

        return String.format(
                "jdbc:sqlserver://%s:%d;databaseName=%s;encrypt=%b;trustServerCertificate=%b",
                serverPart, port, database, encrypt, trustCert);
    }

}
