package com.smartmigrate.connections;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.sql.DriverManager;
import java.sql.ResultSet;
import java.util.*;;

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

    public Map<String, Object> testConnection(Long id) {
        Connection conn = findById(id);
        try {
            if (conn.getType() == Connection.ConnectionType.MYSQL) {
                testMysql(conn.getConfig());
            } else {
                testQuickBooks(conn);   // pass entity so we can save new refresh token
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

    /**
     * Connects to the MySQL database and returns every table with its ordered column list.
     * Only supported for MYSQL-type connections.
     */
    public Map<String, List<String>> fetchSchema(Long id) {
        Connection conn = findById(id);
        if (conn.getType() != Connection.ConnectionType.MYSQL) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Schema browsing is only supported for MySQL connections.");
        }
        Map<String, Object> cfg = conn.getConfig();
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
            // Discover tables
            try (ResultSet rs = db.getMetaData().getTables(database, null, "%", new String[]{"TABLE"})) {
                while (rs.next()) {
                    schema.put(rs.getString("TABLE_NAME"), new ArrayList<>());
                }
            }
            // Discover columns for each table (ordered by ordinal position)
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

    private void testMysql(Map<String, Object> config) throws Exception {
        String host = (String) config.get("host");
        int port = Integer.parseInt(config.getOrDefault("port", 3306).toString());
        String database = (String) config.get("database");
        String username = (String) config.get("username");
        String password = (String) config.get("password");
        String url = String.format("jdbc:mysql://%s:%d/%s?useSSL=false&allowPublicKeyRetrieval=true", host, port, database);
        try (var ignored = DriverManager.getConnection(url, username, password)) {
            // connection opened successfully
        }
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

            // Refresh — throws if credentials are invalid
            connector.refreshAccessToken();

            // Persist the new refresh token Intuit returned
            String newRefreshToken = connector.getLatestRefreshToken();
            if (newRefreshToken != null && !newRefreshToken.isBlank()) {
                config.put("refreshToken", newRefreshToken);
                // conn.config is the same map reference — will be saved by the caller
            }
        } else {
            String accessToken = (String) config.get("accessToken");
            if (accessToken == null || accessToken.isBlank()) {
                throw new Exception("Not yet authorized. Please complete the OAuth flow.");
            }
        }
    }
}
