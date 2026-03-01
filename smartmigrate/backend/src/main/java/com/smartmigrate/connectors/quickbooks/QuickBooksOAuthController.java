package com.smartmigrate.connectors.quickbooks;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartmigrate.connections.Connection;
import com.smartmigrate.connections.ConnectionRepository;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/oauth/quickbooks")
public class QuickBooksOAuthController {

    @Value("${app.quickbooks.client-id}")
    private String clientId;

    @Value("${app.quickbooks.client-secret}")
    private String clientSecret;

    @Value("${app.quickbooks.redirect-uri}")
    private String redirectUri;

    @Value("${app.quickbooks.environment}")
    private String environment;

    private final ConnectionRepository connectionRepository;
    private final ObjectMapper mapper = new ObjectMapper();

    public QuickBooksOAuthController(ConnectionRepository connectionRepository) {
        this.connectionRepository = connectionRepository;
    }

    /**
     * Step 1: Redirect user to Intuit OAuth consent page.
     * Call: GET /api/oauth/quickbooks/authorize?connectionId=123
     */
    @GetMapping("/authorize")
    public void authorize(@RequestParam Long connectionId,
                          HttpServletResponse response) throws IOException {
        String scope = "com.intuit.quickbooks.accounting";
        String authUrl = "https://appcenter.intuit.com/connect/oauth2"
                + "?client_id=" + clientId
                + "&redirect_uri=" + URLEncoder.encode(redirectUri, StandardCharsets.UTF_8)
                + "&response_type=code"
                + "&scope=" + URLEncoder.encode(scope, StandardCharsets.UTF_8)
                + "&state=" + connectionId;
        response.sendRedirect(authUrl);
    }

    /**
     * Step 2: Intuit redirects back here with auth code.
     * Exchange for tokens and store them on the connection config.
     */
    @GetMapping("/callback")
    public void callback(@RequestParam String code,
                         @RequestParam String realmId,
                         @RequestParam String state,
                         HttpServletResponse response) throws Exception {
        Long connectionId = Long.parseLong(state);

        // Exchange auth code for tokens
        String tokenUrl = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
        String credentials = Base64.getEncoder().encodeToString(
                (clientId + ":" + clientSecret).getBytes(StandardCharsets.UTF_8));

        String body = "grant_type=authorization_code"
                + "&code=" + URLEncoder.encode(code, StandardCharsets.UTF_8)
                + "&redirect_uri=" + URLEncoder.encode(redirectUri, StandardCharsets.UTF_8);

        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(tokenUrl))
                .header("Authorization", "Basic " + credentials)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> tokenResponse = client.send(request, HttpResponse.BodyHandlers.ofString());
        JsonNode tokens = mapper.readTree(tokenResponse.body());

        // Update connection config with tokens
        Optional<Connection> opt = connectionRepository.findById(connectionId);
        if (opt.isPresent()) {
            Connection conn = opt.get();
            Map<String, Object> config = conn.getConfig();
            config.put("accessToken", tokens.path("access_token").asText());
            config.put("refreshToken", tokens.path("refresh_token").asText());
            config.put("realmId", realmId);
            conn.setConfig(config);
            conn.setStatus(Connection.ConnectionStatus.ACTIVE);
            connectionRepository.save(conn);
        }

        // Redirect back to frontend
        response.sendRedirect("http://localhost:3000/connections?oauth=success&id=" + connectionId);
    }
}
