package com.smartmigrate.connectors.quickbooks;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartmigrate.connectors.SourceConnector;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.*;

public class QuickBooksConnector implements SourceConnector {

    private static final String QB_API_BASE_SANDBOX = "https://sandbox-quickbooks.api.intuit.com";
    private static final String QB_API_BASE_PROD = "https://quickbooks.api.intuit.com";

    private final Map<String, Object> config;
    private final ObjectMapper mapper = new ObjectMapper();

    public QuickBooksConnector(Map<String, Object> config) {
        this.config = config;
    }

    @Override
    public Map<String, List<Map<String, Object>>> extract() throws Exception {
        String accessToken = (String) config.get("accessToken");
        String realmId = (String) config.get("realmId");
        String environment = (String) config.getOrDefault("environment", "sandbox");

        @SuppressWarnings("unchecked")
        List<String> entities = (List<String>) config.getOrDefault("entities",
                List.of("Invoice", "Customer", "Account"));

        String baseUrl = "production".equalsIgnoreCase(environment) ? QB_API_BASE_PROD : QB_API_BASE_SANDBOX;

        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();

        for (String entity : entities) {
            result.put(entity, queryEntity(baseUrl, realmId, accessToken, entity));
        }

        return result;
    }

    private List<Map<String, Object>> queryEntity(String baseUrl, String realmId,
                                                    String accessToken, String entity) throws IOException, InterruptedException {
        String url = String.format("%s/v3/company/%s/query?query=SELECT%%20*%%20FROM%%20%s&minorversion=65",
                baseUrl, realmId, entity);

        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Authorization", "Bearer " + accessToken)
                .header("Accept", "application/json")
                .GET()
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("QuickBooks API error [" + response.statusCode() + "]: " + response.body());
        }

        JsonNode root = mapper.readTree(response.body());
        JsonNode queryResponse = root.path("QueryResponse");
        JsonNode entityArray = queryResponse.path(entity);

        List<Map<String, Object>> rows = new ArrayList<>();
        if (entityArray.isArray()) {
            for (JsonNode node : entityArray) {
                @SuppressWarnings("unchecked")
                Map<String, Object> row = mapper.convertValue(node, Map.class);
                rows.add(row);
            }
        }
        return rows;
    }
}
