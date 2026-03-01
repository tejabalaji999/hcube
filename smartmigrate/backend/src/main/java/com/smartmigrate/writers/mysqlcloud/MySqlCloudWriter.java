package com.smartmigrate.writers.mysqlcloud;

import com.smartmigrate.writers.DestinationWriter;

import java.sql.*;
import java.util.*;

public class MySqlCloudWriter implements DestinationWriter {

    private final Map<String, Object> config;

    public MySqlCloudWriter(Map<String, Object> config) {
        this.config = config;
    }

    @Override
    public int write(Map<String, List<Map<String, Object>>> data) throws Exception {
        String host = (String) config.get("host");
        int port = Integer.parseInt(config.getOrDefault("port", 3306).toString());
        String database = (String) config.get("database");
        String username = (String) config.get("username");
        String password = (String) config.get("password");
        String schema = (String) config.getOrDefault("schema", database);

        String url = String.format(
                "jdbc:mysql://%s:%d/%s?useSSL=true&requireSSL=true&allowPublicKeyRetrieval=true&serverTimezone=UTC",
                host, port, schema);

        int totalRows = 0;

        try (Connection conn = DriverManager.getConnection(url, username, password)) {
            conn.setAutoCommit(false);
            for (Map.Entry<String, List<Map<String, Object>>> entry : data.entrySet()) {
                String tableName = entry.getKey();
                List<Map<String, Object>> rows = entry.getValue();
                if (rows.isEmpty()) continue;

                ensureTableExists(conn, tableName, rows.get(0));
                totalRows += insertRows(conn, tableName, rows);
            }
            conn.commit();
        }
        return totalRows;
    }

    private void ensureTableExists(Connection conn, String tableName,
                                    Map<String, Object> sampleRow) throws SQLException {
        StringBuilder ddl = new StringBuilder();
        ddl.append("CREATE TABLE IF NOT EXISTS `").append(tableName).append("` (");
        ddl.append("`_sm_id` BIGINT PRIMARY KEY AUTO_INCREMENT, ");
        for (String col : sampleRow.keySet()) {
            ddl.append("`").append(col).append("` LONGTEXT, ");
        }
        ddl.setLength(ddl.length() - 2);
        ddl.append(")");

        try (Statement stmt = conn.createStatement()) {
            stmt.execute(ddl.toString());
        }
    }

    private int insertRows(Connection conn, String tableName,
                            List<Map<String, Object>> rows) throws SQLException {
        if (rows.isEmpty()) return 0;

        Set<String> cols = rows.get(0).keySet();
        String colList = String.join(", ", cols.stream().map(c -> "`" + c + "`").toList());
        String paramList = String.join(", ", cols.stream().map(c -> "?").toList());
        String sql = String.format("INSERT INTO `%s` (%s) VALUES (%s)", tableName, colList, paramList);

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
