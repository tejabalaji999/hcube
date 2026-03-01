package com.smartmigrate.writers.azureblob;

import com.azure.storage.blob.BlobClient;
import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.BlobServiceClient;
import com.azure.storage.blob.BlobServiceClientBuilder;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartmigrate.writers.DestinationWriter;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

public class AzureBlobWriter implements DestinationWriter {

    private final Map<String, Object> config;
    private final ObjectMapper mapper = new ObjectMapper();

    public AzureBlobWriter(Map<String, Object> config) {
        this.config = config;
    }

    @Override
    public int write(Map<String, List<Map<String, Object>>> data) throws Exception {
        String accountName = (String) config.get("accountName");
        String accountKey = (String) config.get("accountKey");
        String containerName = (String) config.get("containerName");
        String directoryPath = (String) config.getOrDefault("directoryPath", "smartmigrate");
        String format = (String) config.getOrDefault("format", "CSV");

        String connectionString = String.format(
                "DefaultEndpointsProtocol=https;AccountName=%s;AccountKey=%s;EndpointSuffix=core.windows.net",
                accountName, accountKey);

        BlobServiceClient serviceClient = new BlobServiceClientBuilder()
                .connectionString(connectionString)
                .buildClient();

        BlobContainerClient containerClient = serviceClient.getBlobContainerClient(containerName);
        if (!containerClient.exists()) {
            containerClient.create();
        }

        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        int totalRows = 0;

        for (Map.Entry<String, List<Map<String, Object>>> entry : data.entrySet()) {
            String tableName = entry.getKey();
            List<Map<String, Object>> rows = entry.getValue();
            if (rows.isEmpty()) continue;

            String blobPath = directoryPath + "/" + tableName + "_" + timestamp
                    + ("JSON".equalsIgnoreCase(format) ? ".json" : ".csv");
            byte[] content = "JSON".equalsIgnoreCase(format)
                    ? toJson(rows)
                    : toCsv(rows);

            BlobClient blobClient = containerClient.getBlobClient(blobPath);
            blobClient.upload(new ByteArrayInputStream(content), content.length, true);

            totalRows += rows.size();
        }
        return totalRows;
    }

    private byte[] toJson(List<Map<String, Object>> rows) throws Exception {
        return mapper.writerWithDefaultPrettyPrinter()
                .writeValueAsString(rows)
                .getBytes(StandardCharsets.UTF_8);
    }

    private byte[] toCsv(List<Map<String, Object>> rows) {
        if (rows.isEmpty()) return new byte[0];
        StringBuilder sb = new StringBuilder();
        List<String> headers = new ArrayList<>(rows.get(0).keySet());
        sb.append(String.join(",", headers)).append("\n");
        for (Map<String, Object> row : rows) {
            List<String> values = new ArrayList<>();
            for (String h : headers) {
                Object val = row.get(h);
                String s = val != null ? val.toString().replace("\"", "\"\"") : "";
                values.add("\"" + s + "\"");
            }
            sb.append(String.join(",", values)).append("\n");
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }
}
