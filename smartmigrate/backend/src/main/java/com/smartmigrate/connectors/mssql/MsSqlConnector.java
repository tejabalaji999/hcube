package com.smartmigrate.connectors.mssql;

import com.smartmigrate.connectors.SourceConnector;

import java.sql.*;
import java.util.*;
import java.util.stream.Collectors;

public class MsSqlConnector implements SourceConnector {

    private final Map<String, Object> config;

    public MsSqlConnector(Map<String, Object> config) {
        this.config = config;
    }

    @Override
    public Map<String, List<Map<String, Object>>> extract() throws Exception {
        String url      = buildJdbcUrl();
        String username = (String) config.get("username");
        String password = (String) config.get("password");

        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();

        try (Connection conn = DriverManager.getConnection(url, username, password)) {

            @SuppressWarnings("unchecked")
            Map<String, List<String>> tableSchema =
                    (Map<String, List<String>>) config.get("tableSchema");

            if (tableSchema != null && !tableSchema.isEmpty()) {
                // Selective sync — only chosen tables and columns
                for (Map.Entry<String, List<String>> entry : tableSchema.entrySet()) {
                    result.put(entry.getKey(),
                            extractTable(conn, entry.getKey(), entry.getValue()));
                }
            } else {
                // Full sync — discover all user tables
                for (String table : discoverTables(conn)) {
                    result.put(table, extractTable(conn, table, null));
                }
            }
        }
        return result;
    }

    // ── JDBC URL builder ────────────────────────────────────────────────────

    private String buildJdbcUrl() {
        String  host       = (String) config.get("host");
        int     port       = Integer.parseInt(config.getOrDefault("port", 1433).toString());
        String  database   = (String) config.get("database");
        String  instance   = (String) config.get("instance");
        boolean encrypt    = Boolean.parseBoolean(
                config.getOrDefault("encrypt", "false").toString());
        boolean trustCert  = Boolean.parseBoolean(
                config.getOrDefault("trustServerCertificate", "true").toString());

        // Named instance is appended to host before the port (SQL Server convention)
        String serverPart = (instance != null && !instance.isBlank())
                ? host + "\\" + instance
                : host;

        return String.format(
                "jdbc:sqlserver://%s:%d;databaseName=%s;encrypt=%b;trustServerCertificate=%b",
                serverPart, port, database, encrypt, trustCert);
    }

    // ── Schema discovery ────────────────────────────────────────────────────

    /** Returns user table names as "schema.table" (e.g. "dbo.Customers"). */
    private List<String> discoverTables(Connection conn) throws SQLException {
        List<String> tables = new ArrayList<>();
        String sql = "SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES " +
                     "WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME";
        try (Statement stmt = conn.createStatement();
             ResultSet rs   = stmt.executeQuery(sql)) {
            while (rs.next()) {
                tables.add(rs.getString("TABLE_SCHEMA") + "." + rs.getString("TABLE_NAME"));
            }
        }
        return tables;
    }

    // ── Data extraction ─────────────────────────────────────────────────────

    /**
     * Extracts rows from a table reference (format: "schema.table" or "table").
     * Only selected columns are fetched when {@code columns} is non-null and non-empty.
     */
    private List<Map<String, Object>> extractTable(Connection conn, String tableRef,
                                                    List<String> columns) throws SQLException {
        List<Map<String, Object>> rows = new ArrayList<>();

        String colClause = (columns == null || columns.isEmpty())
                ? "*"
                : columns.stream()
                         .map(c -> "[" + c + "]")
                         .collect(Collectors.joining(", "));

        // "dbo.Customers" → "[dbo].[Customers]"
        String qualifiedTable = Arrays.stream(tableRef.split("\\.", 2))
                .map(p -> "[" + p + "]")
                .collect(Collectors.joining("."));

        String sql = "SELECT " + colClause + " FROM " + qualifiedTable;

        try (Statement stmt = conn.createStatement();
             ResultSet rs   = stmt.executeQuery(sql)) {

            ResultSetMetaData meta     = rs.getMetaData();
            int               colCount = meta.getColumnCount();

            while (rs.next()) {
                Map<String, Object> row = new LinkedHashMap<>();
                for (int i = 1; i <= colCount; i++) {
                    row.put(meta.getColumnName(i), rs.getObject(i));
                }
                rows.add(row);
            }
        }
        return rows;
    }
}
