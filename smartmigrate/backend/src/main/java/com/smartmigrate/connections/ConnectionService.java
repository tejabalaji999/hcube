package com.smartmigrate.connections;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.sql.DriverManager;
import java.util.List;
import java.util.Map;

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
                testQuickBooks(conn.getConfig());
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

    private void testQuickBooks(Map<String, Object> config) throws Exception {
        String accessToken = (String) config.get("accessToken");
        String realmId = (String) config.get("realmId");
        if (accessToken == null || accessToken.isBlank() || realmId == null || realmId.isBlank()) {
            throw new Exception("Missing accessToken or realmId. Please complete OAuth authorization.");
        }
    }
}
