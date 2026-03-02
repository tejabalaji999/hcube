package com.smartmigrate.connectors.quickbooks;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartmigrate.connectors.SourceConnector;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.*;

public class QuickBooksConnector implements SourceConnector {

    private static final String QB_API_BASE_SANDBOX = "https://sandbox-quickbooks.api.intuit.com";
    private static final String QB_API_BASE_PROD    = "https://quickbooks.api.intuit.com";
    private static final String QB_TOKEN_ENDPOINT   = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

    private final Map<String, Object> config;
    private final ObjectMapper mapper = new ObjectMapper();

    /** Holds the latest refresh token returned by Intuit after a token exchange. */
    private String latestRefreshToken;

    public QuickBooksConnector(Map<String, Object> config) {
        this.config = config;
    }

    /** Returns the new refresh token obtained during the last token refresh call. */
    public String getLatestRefreshToken() {
        return latestRefreshToken;
    }

    /** Pair of tokens returned by Intuit on a refresh call. */
    public record TokenPair(String accessToken, String refreshToken) {}

    /**
     * Calls Intuit token endpoint using the stored refresh token.
     * Returns both the new access token and the new refresh token.
     * Also stores the new refresh token in {@code latestRefreshToken}.
     */
    public TokenPair refreshTokenPair() throws Exception {
        String clientId     = (String) config.get("clientId");
        String clientSecret = (String) config.get("clientSecret");
        String refreshToken = (String) config.get("refreshToken");

        if (clientId == null || clientSecret == null || refreshToken == null) {
            throw new RuntimeException("Missing clientId, clientSecret or refreshToken in connection config.");
        }

        String credentials = Base64.getEncoder().encodeToString(
                (clientId + ":" + clientSecret).getBytes(StandardCharsets.UTF_8));

        String body = "grant_type=refresh_token&refresh_token="
                + URLEncoder.encode(refreshToken, StandardCharsets.UTF_8);

        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(QB_TOKEN_ENDPOINT))
                .header("Authorization", "Basic " + credentials)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("Token refresh failed [" + response.statusCode() + "]: " + response.body());
        }

        JsonNode json = mapper.readTree(response.body());
        String newAccessToken  = json.path("access_token").asText();
        String newRefreshToken = json.path("refresh_token").asText();

        if (newAccessToken.isBlank()) {
            throw new RuntimeException("Token refresh returned empty access_token: " + response.body());
        }

        // Store so callers can persist the new refresh token
        latestRefreshToken = newRefreshToken.isBlank() ? null : newRefreshToken;

        return new TokenPair(newAccessToken, latestRefreshToken);
    }

    /**
     * Convenience method — refreshes tokens and returns only the access token.
     * The new refresh token is available via {@code getLatestRefreshToken()}.
     */
    public String refreshAccessToken() throws Exception {
        return refreshTokenPair().accessToken();
    }

    @Override
    public Map<String, List<Map<String, Object>>> extract() throws Exception {
        String realmId     = (String) config.get("realmId");
        String environment = (String) config.getOrDefault("environment", "sandbox");
        String authMode    = (String) config.getOrDefault("authMode", "OAUTH");

        @SuppressWarnings("unchecked")
        List<String> entities = (List<String>) config.getOrDefault("entities",
                List.of("Invoice", "Customer", "Account"));

        String accessToken;

        if ("DIRECT_TOKEN".equalsIgnoreCase(authMode)) {
            // Refresh — new refresh token stored in latestRefreshToken for the caller to persist
            TokenPair pair = refreshTokenPair();
            accessToken = pair.accessToken();
        } else {
            accessToken = (String) config.get("accessToken");
            if (accessToken == null || accessToken.isBlank()) {
                throw new RuntimeException("No access token found. Please complete the OAuth authorization flow.");
            }
        }

        String baseUrl = "production".equalsIgnoreCase(environment)
                ? QB_API_BASE_PROD : QB_API_BASE_SANDBOX;

        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        for (String entity : entities) {
            try {
                result.put(entity, queryEntity(baseUrl, realmId, accessToken, entity));
            } catch (Exception e) {
                // Log per-entity failure but continue syncing remaining entities
                System.err.println("[QuickBooks] Failed to fetch entity '" + entity + "': " + e.getMessage());
                result.put(entity, Collections.emptyList());
            }
        }
        return result;
    }

    private static final int MAX_PAGE_SIZE = 500;

    private List<Map<String, Object>> queryEntity(String baseUrl, String realmId,
                                                   String accessToken, String entity)
            throws IOException, InterruptedException {

        List<Map<String, Object>> allRows  = new ArrayList<>();
        HttpClient                client   = HttpClient.newHttpClient();
        int                       startPos = 1;

        while (true) {
            // QuickBooks query with explicit pagination params.
            // Must use %20 for spaces — QuickBooks rejects + (form-encoding) in query strings.
            String query = String.format(
                    "SELECT * FROM %s STARTPOSITION %d MAXRESULTS %d",
                    entity, startPos, MAX_PAGE_SIZE);

            String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8)
                    .replace("+", "%20");

            String url = String.format(
                    "%s/v3/company/%s/query?query=%s&minorversion=65",
                    baseUrl, realmId, encodedQuery);

            // Diagnostic log — visible in backend console (token not printed)
            System.out.println("[QB] GET " + baseUrl + "/v3/company/" + realmId
                    + "/query?query=" + query + "&minorversion=65");

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Authorization", "Bearer " + accessToken)
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            System.out.println("[QB] Response " + response.statusCode()
                    + " for entity=" + entity + " startPos=" + startPos);

            if (response.statusCode() != 200) {
                System.err.println("[QB] Error body: " + response.body());
                throw new RuntimeException(
                        "QuickBooks API error [" + response.statusCode() + "] entity=" + entity
                        + ": " + response.body());
            }

            JsonNode root          = mapper.readTree(response.body());
            JsonNode queryResponse = root.path("QueryResponse");
            JsonNode entityArray   = queryResponse.path(entity);

            int pageCount = 0;
            if (entityArray.isArray()) {
                for (JsonNode node : entityArray) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> row = mapper.convertValue(node, Map.class);
                    allRows.add(row);
                    pageCount++;
                }
            }

            // If we got fewer rows than the page size, we've reached the last page
            if (pageCount < MAX_PAGE_SIZE) break;

            startPos += MAX_PAGE_SIZE;
        }

        return allRows;
    }
}
