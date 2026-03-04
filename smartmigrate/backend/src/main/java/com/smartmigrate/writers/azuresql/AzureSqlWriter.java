package com.smartmigrate.writers.azuresql;

import com.smartmigrate.writers.DestinationWriter;

import java.sql.*;
import java.util.*;

public class AzureSqlWriter implements DestinationWriter {

    private final Map<String, Object> config;

    public AzureSqlWriter(Map<String, Object> config) {
        this.config = config;
    }

    @Override
    public int write(Map<String, List<Map<String, Object>>> data) throws Exception {
        String server = (String) config.get("server");
        int port = Integer.parseInt(config.getOrDefault("port", 1433).toString());
        String database = (String) config.get("database");
        String username = (String) config.get("username");
        String password = (String) config.get("password");
        String schema = (String) config.getOrDefault("schema", "dbo");

        String url = String.format(
                "jdbc:sqlserver://%s:%d;databaseName=%s;encrypt=true;trustServerCertificate=true",
                server, port, database);

        int totalRows = 0;

        System.out.println("[AzureSqlWriter] Starting write — " + data.size() + " table(s) in data map");
        data.forEach((t, rows) ->
            System.out.println("[AzureSqlWriter]   table='" + t + "'  rows=" + rows.size()));

        try (Connection conn = DriverManager.getConnection(url, username, password)) {
            conn.setAutoCommit(false);
            for (Map.Entry<String, List<Map<String, Object>>> entry : data.entrySet()) {
                String sourceKey = entry.getKey();
                List<Map<String, Object>> rows = entry.getValue();
                // Strip source schema prefix if present (e.g. "dbo.APCCS" → "APCCS")
                String tableName = sourceKey.contains(".")
                        ? sourceKey.substring(sourceKey.lastIndexOf('.') + 1)
                        : sourceKey;
                System.out.println("[AzureSqlWriter] Processing sourceKey='" + sourceKey
                        + "'  tableName='" + tableName + "'  rows=" + rows.size());
                if (rows.isEmpty()) {
                    System.out.println("[AzureSqlWriter]   SKIPPED (empty rows)");
                    continue;
                }

                ensureTableExists(conn, schema, tableName, rows.get(0));
                totalRows += upsertRows(conn, schema, tableName, rows);
                System.out.println("[AzureSqlWriter]   Done — running total=" + totalRows);
            }
            conn.commit();
            System.out.println("[AzureSqlWriter] Committed — totalRows=" + totalRows);
        }
        return totalRows;
    }

    private void ensureTableExists(Connection conn, String schema, String tableName,
                                    Map<String, Object> sampleRow) throws SQLException {
        StringBuilder ddl = new StringBuilder();
        ddl.append("IF NOT EXISTS (SELECT * FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id ")
           .append("WHERE s.name = '").append(schema).append("' AND t.name = '").append(tableName).append("') ")
           .append("CREATE TABLE [").append(schema).append("].[").append(tableName).append("] (");
        ddl.append("[_sm_id] BIGINT IDENTITY(1,1) PRIMARY KEY, ");
        for (String col : sampleRow.keySet()) {
            ddl.append("[").append(col).append("] NVARCHAR(MAX), ");
        }
        // Remove trailing comma+space
        ddl.setLength(ddl.length() - 2);
        ddl.append(")");

        System.out.println("[AzureSqlWriter] DDL: " + ddl);
        try (Statement stmt = conn.createStatement()) {
            stmt.execute(ddl.toString());
        }
    }

    private int upsertRows(Connection conn, String schema, String tableName,
                            List<Map<String, Object>> rows) throws SQLException {
        if (rows.isEmpty()) return 0;

        Set<String> cols = rows.get(0).keySet();
        String colList = String.join(", ", cols.stream().map(c -> "[" + c + "]").toList());
        String paramList = String.join(", ", cols.stream().map(c -> "?").toList());
        String sql = String.format("INSERT INTO [%s].[%s] (%s) VALUES (%s)", schema, tableName, colList, paramList);
        System.out.println("[AzureSqlWriter] INSERT template: " + sql);

        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            for (Map<String, Object> row : rows) {
                int i = 1;
                for (String col : cols) {
                    Object val = row.get(col);
                    ps.setString(i++, val != null ? val.toString() : null);
                }
                ps.addBatch();
            }
            ps.executeBatch();
        }
        return rows.size();
    }
}
