package com.smartmigrate.destinations;

import com.smartmigrate.writers.netsuite.NetSuiteOAuthHelper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.DriverManager;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@Service
public class DestinationService {

    private final DestinationRepository repo;

    public DestinationService(DestinationRepository repo) {
        this.repo = repo;
    }

    public List<Destination> findAll() {
        return repo.findAll();
    }

    public Destination findById(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Destination not found"));
    }

    public Destination create(Destination destination) {
        destination.setStatus(Destination.DestinationStatus.PENDING);
        return repo.save(destination);
    }

    public Destination update(Long id, Destination updated) {
        Destination existing = findById(id);
        existing.setName(updated.getName());
        existing.setConfig(updated.getConfig());
        existing.setStatus(Destination.DestinationStatus.PENDING);
        return repo.save(existing);
    }

    public void delete(Long id) {
        findById(id);
        repo.deleteById(id);
    }

    public Map<String, Object> testDestination(Long id) {
        Destination dest = findById(id);
        try {
            switch (dest.getType()) {
                case AZURE_SQL   -> testAzureSql(dest.getConfig());
                case AZURE_BLOB  -> testAzureBlob(dest.getConfig());
                case MYSQL_CLOUD -> testMysqlCloud(dest.getConfig());
                case NETSUITE    -> testNetSuite(dest.getConfig());
            }
            dest.setStatus(Destination.DestinationStatus.ACTIVE);
            repo.save(dest);
            return Map.of("success", true, "message", "Destination reachable");
        } catch (Exception e) {
            dest.setStatus(Destination.DestinationStatus.ERROR);
            repo.save(dest);
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    private void testAzureSql(Map<String, Object> config) throws Exception {
        String server = (String) config.get("server");
        int port = Integer.parseInt(config.getOrDefault("port", 1433).toString());
        String database = (String) config.get("database");
        String username = (String) config.get("username");
        String password = (String) config.get("password");
        String url = String.format("jdbc:sqlserver://%s:%d;databaseName=%s;encrypt=true;trustServerCertificate=true",
                server, port, database);
        try (var ignored = DriverManager.getConnection(url, username, password)) {
            // opened successfully
        }
    }

    private void testMysqlCloud(Map<String, Object> config) throws Exception {
        String host = (String) config.get("host");
        int port = Integer.parseInt(config.getOrDefault("port", 3306).toString());
        String database = (String) config.get("database");
        String username = (String) config.get("username");
        String password = (String) config.get("password");
        String url = String.format("jdbc:mysql://%s:%d/%s?useSSL=true&requireSSL=true&allowPublicKeyRetrieval=true&serverTimezone=UTC",
                host, port, database);
        try (var ignored = DriverManager.getConnection(url, username, password)) {
            // opened successfully
        }
    }

    private void testNetSuite(Map<String, Object> config) throws Exception {
        String accountUrl = ((String) config.get("accountUrl")).strip();
        if (accountUrl.endsWith("/")) accountUrl = accountUrl.substring(0, accountUrl.length() - 1);

        String url = accountUrl + "/services/rest/record/v1/customer?limit=1&offset=0";
        String accountId = NetSuiteOAuthHelper.extractAccountId(accountUrl);

        System.out.println("[NetSuite] Test connection —————————————————————————");
        System.out.println("[NetSuite]   accountId   : " + accountId);
        System.out.println("[NetSuite]   url         : " + url);
        System.out.println("[NetSuite]   consumerKey : " + mask((String) config.get("consumerKey")));
        System.out.println("[NetSuite]   accessToken : " + mask((String) config.get("accessToken")));

        String authHeader = NetSuiteOAuthHelper.buildHeader("GET", url, config);
        System.out.println("[NetSuite]   Authorization: " + authHeader);

        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Authorization", authHeader)
                .header("Content-Type", "application/json")
                .GET()
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        System.out.println("[NetSuite]   HTTP status : " + response.statusCode());
        System.out.println("[NetSuite]   Response    : " + response.body());
        System.out.println("[NetSuite] —————————————————————————————————————————");

        if (response.statusCode() >= 400) {
            throw new Exception("NetSuite returned HTTP " + response.statusCode()
                    + ": " + response.body());
        }
    }

    /** Shows first 6 chars of a credential and masks the rest. */
    private static String mask(String value) {
        if (value == null || value.length() <= 6) return "***";
        return value.substring(0, 6) + "..." + value.substring(value.length() - 4);
    }

    private void testAzureBlob(Map<String, Object> config) throws Exception {
        String accountName = (String) config.get("accountName");
        String accountKey = (String) config.get("accountKey");
        String containerName = (String) config.get("containerName");
        if (accountName == null || accountKey == null || containerName == null) {
            throw new Exception("Missing required Azure Blob config fields.");
        }
        com.azure.storage.blob.BlobServiceClient client = new com.azure.storage.blob.BlobServiceClientBuilder()
                .connectionString(String.format("DefaultEndpointsProtocol=https;AccountName=%s;AccountKey=%s;EndpointSuffix=core.windows.net",
                        accountName, accountKey))
                .buildClient();
        client.getBlobContainerClient(containerName).exists();
    }
}
