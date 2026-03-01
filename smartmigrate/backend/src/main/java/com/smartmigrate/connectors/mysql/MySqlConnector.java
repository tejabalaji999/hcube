package com.smartmigrate.connectors.mysql;

import com.smartmigrate.connectors.SourceConnector;

import java.sql.*;
import java.util.*;

public class MySqlConnector implements SourceConnector {

    private final Map<String, Object> config;

    public MySqlConnector(Map<String, Object> config) {
        this.config = config;
    }

    @Override
    public Map<String, List<Map<String, Object>>> extract() throws Exception {
        String host = (String) config.get("host");
        int port = Integer.parseInt(config.getOrDefault("port", 3306).toString());
        String database = (String) config.get("database");
        String username = (String) config.get("username");
        String password = (String) config.get("password");

        @SuppressWarnings("unchecked")
        List<String> tables = (List<String>) config.getOrDefault("tables", List.of());

        String url = String.format("jdbc:mysql://%s:%d/%s?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC",
                host, port, database);

        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();

        try (Connection conn = DriverManager.getConnection(url, username, password)) {
            List<String> targetTables = tables.isEmpty() ? discoverTables(conn, database) : tables;

            for (String table : targetTables) {
                result.put(table, extractTable(conn, table));
            }
        }
        return result;
    }

    private List<String> discoverTables(Connection conn, String database) throws SQLException {
        List<String> tables = new ArrayList<>();
        try (ResultSet rs = conn.getMetaData().getTables(database, null, "%", new String[]{"TABLE"})) {
            while (rs.next()) {
                tables.add(rs.getString("TABLE_NAME"));
            }
        }
        return tables;
    }

    private List<Map<String, Object>> extractTable(Connection conn, String table) throws SQLException {
        List<Map<String, Object>> rows = new ArrayList<>();
        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT * FROM `" + table + "`")) {
            ResultSetMetaData meta = rs.getMetaData();
            int colCount = meta.getColumnCount();
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
