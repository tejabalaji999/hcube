package com.smartmigrate.writers.netsuite;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartmigrate.writers.DestinationWriter;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Writes records to NetSuite via the SuiteTalk REST Record API using OAuth 1.0a (TBA).
 *
 * Each key in the data map is treated as the NetSuite record type
 * (e.g. "customer", "invoice").  Field names must already be mapped to
 * NetSuite field IDs before reaching this writer — the SyncService applies
 * the job-level fieldMappings before calling write().
 */
public class NetSuiteWriter implements DestinationWriter {

    private final Map<String, Object> config;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public NetSuiteWriter(Map<String, Object> config) {
        this.config = config;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .build();
        this.objectMapper = new ObjectMapper();
    }

    @Override
    public int write(Map<String, List<Map<String, Object>>> data) throws Exception {
        String accountUrl = ((String) config.get("accountUrl")).strip();
        if (accountUrl.endsWith("/")) accountUrl = accountUrl.substring(0, accountUrl.length() - 1);

        int totalRows = 0;

        System.out.println("[NetSuiteWriter] Starting write — " + data.size() + " object(s)");
        data.forEach((e, rows) ->
            System.out.println("[NetSuiteWriter]   object='" + e + "'  rows=" + rows.size()));

        for (Map.Entry<String, List<Map<String, Object>>> entry : data.entrySet()) {
            // Key may come as "Customer" — NS API expects lowercase "customer"
            String nsObject = entry.getKey().toLowerCase();
            List<Map<String, Object>> rows = entry.getValue();

            if (rows.isEmpty()) {
                System.out.println("[NetSuiteWriter]   SKIPPED (empty) object=" + entry.getKey());
                continue;
            }

            String endpointUrl = accountUrl + "/services/rest/record/v1/" + nsObject;
            System.out.println("[NetSuiteWriter] Endpoint: " + endpointUrl);

            int objectRows   = 0;
            int skippedRows  = 0;
            for (int rowIdx = 0; rowIdx < rows.size(); rowIdx++) {
                Map<String, Object> row = rows.get(rowIdx);
                // Remove null values — NetSuite rejects null fields in some contexts
                row.entrySet().removeIf(e -> e.getValue() == null);

                String payload    = objectMapper.writeValueAsString(row);
                // Pass body so oauth_body_hash is computed over the actual payload
                String authHeader = NetSuiteOAuthHelper.buildHeader("POST", endpointUrl, config, payload);

                System.out.println("[NetSuiteWriter] ——— POST row " + (rowIdx + 1) + "/" + rows.size()
                        + "  object=" + nsObject + " ———");
                System.out.println("[NetSuiteWriter]   URL    : " + endpointUrl);
                System.out.println("[NetSuiteWriter]   Payload: " + payload);

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(endpointUrl))
                        .header("Authorization", authHeader)
                        .header("Content-Type", "application/json")
                        .header("Prefer", "transient")
                        .POST(HttpRequest.BodyPublishers.ofString(payload))
                        .build();

                HttpResponse<String> response = httpClient.send(request,
                        HttpResponse.BodyHandlers.ofString());

                int status = response.statusCode();
                System.out.println("[NetSuiteWriter]   HTTP   : " + status);
                System.out.println("[NetSuiteWriter]   Body   : " + response.body());

                if (status == 200 || status == 201 || status == 204) {
                    objectRows++;
                    totalRows++;
                } else if (status == 400 || status == 500) {
                    // 400 — validation error (missing mandatory fields, bad values)
                    // 500 — NetSuite UNEXPECTED_ERROR, often caused by malformed field
                    //        values (e.g. trailing comma in email) that bypass NS validation.
                    // Both are data-quality issues: skip the record and continue.
                    skippedRows++;
                    System.err.println("[NetSuiteWriter] SKIPPED row " + (rowIdx + 1)
                            + " — HTTP " + status + ": " + response.body());
                    System.err.println("[NetSuiteWriter]   Skipped payload: " + payload);
                } else {
                    // 401 / 403 / other — auth or infrastructure error, stop the sync
                    throw new Exception("[NetSuiteWriter] Fatal HTTP " + status
                            + "  object=" + nsObject + "  body=" + response.body());
                }
            }
            System.out.println("[NetSuiteWriter]   object=" + nsObject
                    + "  written=" + objectRows + "  skipped=" + skippedRows);
        }

        System.out.println("[NetSuiteWriter] Completed — totalRows=" + totalRows);
        return totalRows;
    }
}
