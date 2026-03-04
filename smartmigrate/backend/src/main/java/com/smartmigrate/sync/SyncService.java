package com.smartmigrate.sync;

import com.smartmigrate.connections.Connection;
import com.smartmigrate.connections.ConnectionRepository;
import com.smartmigrate.connectors.ConnectorFactory;
import com.smartmigrate.connectors.SourceConnector;
import com.smartmigrate.connectors.quickbooks.QuickBooksConnector;
import com.smartmigrate.writers.DestinationWriter;
import com.smartmigrate.writers.WriterFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SyncService {

    private final SyncJobRepository jobRepo;
    private final SyncLogRepository logRepo;
    private final ConnectorFactory connectorFactory;
    private final WriterFactory writerFactory;
    private final ConnectionRepository connectionRepository;

    public SyncService(SyncJobRepository jobRepo,
                       SyncLogRepository logRepo,
                       ConnectorFactory connectorFactory,
                       WriterFactory writerFactory,
                       ConnectionRepository connectionRepository) {
        this.jobRepo = jobRepo;
        this.logRepo = logRepo;
        this.connectorFactory = connectorFactory;
        this.writerFactory = writerFactory;
        this.connectionRepository = connectionRepository;
    }

    public List<SyncJob> findAll() {
        return jobRepo.findAll();
    }

    public SyncJob findById(Long id) {
        return jobRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sync job not found"));
    }

    public SyncJob create(SyncJob job) {
        job.setStatus(SyncJob.SyncStatus.IDLE);
        job.setEnabled(true);
        job.setScheduleType(SyncJob.ScheduleType.MANUAL);
        return jobRepo.save(job);
    }

    public void delete(Long id) {
        findById(id);
        jobRepo.deleteById(id);
    }

    public List<SyncLog> getLogs(Long jobId) {
        findById(jobId);
        return logRepo.findBySyncJobIdOrderByStartedAtDesc(jobId);
    }

    /** Toggle enabled/disabled on a job. */
    public SyncJob toggle(Long id) {
        SyncJob job = findById(id);
        job.setEnabled(!job.isEnabled());
        if (!job.isEnabled()) {
            job.setNextRunAt(null);
        } else {
            job.setNextRunAt(computeNextRun(job.getScheduleType(), LocalDateTime.now()));
        }
        return jobRepo.save(job);
    }

    /** Update schedule type and recompute next run. */
    public SyncJob updateSchedule(Long id, SyncJob.ScheduleType scheduleType) {
        SyncJob job = findById(id);
        job.setScheduleType(scheduleType);
        job.setNextRunAt(scheduleType == SyncJob.ScheduleType.MANUAL
                ? null
                : computeNextRun(scheduleType, LocalDateTime.now()));
        return jobRepo.save(job);
    }

    /** Stats for the job detail page. */
    public Map<String, Object> getStats(Long id) {
        SyncJob job = findById(id);
        LocalDateTime fourteenDaysAgo = LocalDateTime.now().minusDays(14);

        long totalRuns    = logRepo.countBySyncJobId(id);
        long successCount = logRepo.countBySyncJobIdAndStatus(id, SyncLog.LogStatus.SUCCESS);
        long failedCount  = logRepo.countBySyncJobIdAndStatus(id, SyncLog.LogStatus.FAILED);
        Double avgSecs    = logRepo.avgDurationSeconds(id, fourteenDaysAgo);

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("lastRunAt",       job.getLastRunAt());
        stats.put("scheduleType",    job.getScheduleType());
        stats.put("nextRunAt",       job.getNextRunAt());
        stats.put("enabled",         job.isEnabled());
        stats.put("totalRuns",       totalRuns);
        stats.put("successCount",    successCount);
        stats.put("failedCount",     failedCount);
        stats.put("avgDurationSecs", avgSecs != null ? Math.round(avgSecs) : 0);
        return stats;
    }

    /** Trigger a manual async sync run. */
    public SyncLog triggerRun(Long jobId, String triggeredBy) {
        SyncJob job = findById(jobId);

        if (job.getStatus() == SyncJob.SyncStatus.RUNNING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Sync job is already running");
        }

        SyncLog log = new SyncLog();
        log.setSyncJob(job);
        log.setStatus(SyncLog.LogStatus.RUNNING);
        log.setStartedAt(LocalDateTime.now());
        log.setTriggeredBy(triggeredBy);
        SyncLog savedLog = logRepo.save(log);

        job.setStatus(SyncJob.SyncStatus.RUNNING);
        jobRepo.save(job);

        executeAsync(job, savedLog);
        return savedLog;
    }

    @Async
    public void executeAsync(SyncJob job, SyncLog log) {
        try {
            // Extract phase
            long extractStart = System.currentTimeMillis();
            SourceConnector connector = connectorFactory.get(job.getConnection());
            Map<String, List<Map<String, Object>>> data = connector.extract();
            long extractDuration = System.currentTimeMillis() - extractStart;

            // If QuickBooks DIRECT_TOKEN, persist the new refresh token Intuit returned
            persistNewRefreshTokenIfNeeded(connector, job.getConnection());

            // Apply job-level field mappings (QB field names → destination field names)
            data = applyFieldMappings(data, job.getConfig());

            // Filter to the configured source entity and re-key by destination object
            // (e.g. keeps only "Employee" rows and re-keys as "employee" for NetSuite writer)
            data = filterAndRekeyForDestination(data, job.getConfig());

            // Inject NetSuite-required fields (e.g. subsidiary) into every row
            data = injectJobDefaults(data, job.getConfig());

            // Load phase
            long loadStart = System.currentTimeMillis();
            DestinationWriter writer = writerFactory.get(job.getDestination());
            int rows = writer.write(data);
            long loadDuration = System.currentTimeMillis() - loadStart;

            log.setExtractDurationMs(extractDuration);
            log.setLoadDurationMs(loadDuration);
            log.setStatus(SyncLog.LogStatus.SUCCESS);
            log.setRowsSynced(rows);
            job.setStatus(SyncJob.SyncStatus.SUCCESS);

        } catch (Exception e) {
            log.setStatus(SyncLog.LogStatus.FAILED);
            log.setErrorMessage(e.getMessage());
            job.setStatus(SyncJob.SyncStatus.FAILED);
        } finally {
            LocalDateTime now = LocalDateTime.now();
            log.setFinishedAt(now);
            job.setLastRunAt(now);
            if (job.getScheduleType() != SyncJob.ScheduleType.MANUAL && job.isEnabled()) {
                job.setNextRunAt(computeNextRun(job.getScheduleType(), now));
            }
            logRepo.save(log);
            jobRepo.save(job);
        }
    }

    public static LocalDateTime computeNextRun(SyncJob.ScheduleType type, LocalDateTime from) {
        return switch (type) {
            case HOURLY   -> from.plusHours(1);
            case EVERY_6H -> from.plusHours(6);
            case DAILY    -> from.plusDays(1);
            case WEEKLY   -> from.plusWeeks(1);
            default       -> null;
        };
    }

    /**
     * After a QuickBooks DIRECT_TOKEN extract, Intuit returns a new refresh token.
     * This must be saved back to the connection config so the next sync uses it.
     */
    private void persistNewRefreshTokenIfNeeded(SourceConnector connector, Connection connection) {
        if (!(connector instanceof QuickBooksConnector qbConnector)) return;

        String authMode = (String) connection.getConfig().getOrDefault("authMode", "OAUTH");
        if (!"DIRECT_TOKEN".equalsIgnoreCase(authMode)) return;

        String newRefreshToken = qbConnector.getLatestRefreshToken();
        if (newRefreshToken == null || newRefreshToken.isBlank()) return;

        connectionRepository.findById(connection.getId()).ifPresent(conn -> {
            conn.getConfig().put("refreshToken", newRefreshToken);
            connectionRepository.save(conn);
        });
    }

    /**
     * Injects NetSuite-required fields into every row based on job config.
     *
     * subsidiaryId → { "subsidiary": { "id": N } }  (NetSuite ref object format)
     */
    private Map<String, List<Map<String, Object>>> injectJobDefaults(
            Map<String, List<Map<String, Object>>> data,
            Map<String, Object> jobConfig) {

        if (jobConfig == null) return data;

        Object rawSubId = jobConfig.get("subsidiaryId");
        if (rawSubId == null) return data;

        int subsidiaryId;
        try {
            subsidiaryId = Integer.parseInt(rawSubId.toString());
        } catch (NumberFormatException e) {
            System.err.println("[SyncService] Invalid subsidiaryId value: " + rawSubId);
            return data;
        }

        Map<String, Object> subsidiaryRef = Map.of("id", subsidiaryId);
        System.out.println("[SyncService] Injecting subsidiary id=" + subsidiaryId + " into all rows");

        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        for (Map.Entry<String, List<Map<String, Object>>> entry : data.entrySet()) {
            List<Map<String, Object>> enriched = entry.getValue().stream().map(row -> {
                Map<String, Object> newRow = new LinkedHashMap<>(row);
                newRow.put("subsidiary", subsidiaryRef);
                return newRow;
            }).collect(Collectors.toList());
            result.put(entry.getKey(), enriched);
        }
        return result;
    }

    /** Save / replace the job-level config (field mappings, entity config, etc.). */
    public SyncJob updateConfig(Long id, Map<String, Object> config) {
        SyncJob job = findById(id);
        job.setConfig(config);
        return jobRepo.save(job);
    }

    /**
     * Applies job-level field mappings to the extracted data.
     *
     * Config keys used:
     *   sourceEntity    — e.g. "Customer"  (only rows for this entity are remapped)
     *   fieldMappings   — Map&lt;sourceField, destField&gt;
     *
     * Complex QB sub-objects (email address, phone number, postal address) are
     * automatically flattened to their primary string value before mapping.
     */
    private Map<String, List<Map<String, Object>>> applyFieldMappings(
            Map<String, List<Map<String, Object>>> data,
            Map<String, Object> jobConfig) {

        if (jobConfig == null) return data;

        @SuppressWarnings("unchecked")
        Map<String, String> fieldMappings = (Map<String, String>) jobConfig.get("fieldMappings");
        if (fieldMappings == null || fieldMappings.isEmpty()) return data;

        String sourceEntity = (String) jobConfig.get("sourceEntity"); // e.g. "Customer"

        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        for (Map.Entry<String, List<Map<String, Object>>> entry : data.entrySet()) {
            String entityKey = entry.getKey();
            List<Map<String, Object>> rows = entry.getValue();

            // Only remap the entity that has mappings configured
            if (sourceEntity != null && !sourceEntity.equalsIgnoreCase(entityKey)) {
                result.put(entityKey, rows);
                continue;
            }

            List<Map<String, Object>> mappedRows = rows.stream().map(row -> {
                Map<String, Object> mappedRow = new LinkedHashMap<>();
                for (Map.Entry<String, String> mapping : fieldMappings.entrySet()) {
                    String srcField  = mapping.getKey();
                    String destField = mapping.getValue();
                    if (destField == null || destField.isBlank()) continue;
                    Object rawVal = row.get(srcField);
                    Object val    = flattenQbValue(rawVal);
                    if (val != null) mappedRow.put(destField, sanitizeValue(val));
                }
                return mappedRow;
            }).collect(Collectors.toList());

            result.put(entityKey, mappedRows);
        }
        return result;
    }

    /**
     * Filters the extracted data to only the job's configured sourceEntity and
     * re-keys it by destinationObject so the writer hits the correct endpoint.
     *
     * Without this, a QB connection that extracts Customer + Invoice + Employee
     * would cause the writer to POST all three entity types to the destination,
     * even though the sync job is only configured for one.
     *
     * Example: sourceEntity="Employee", destinationObject="employee"
     *   input:  { "Customer": [...], "Invoice": [...], "Employee": [...] }
     *   output: { "employee": [...] }  ← only the configured entity, keyed for NS
     */
    private Map<String, List<Map<String, Object>>> filterAndRekeyForDestination(
            Map<String, List<Map<String, Object>>> data,
            Map<String, Object> jobConfig) {

        if (jobConfig == null) return data;

        String sourceEntity      = (String) jobConfig.get("sourceEntity");
        String destinationObject = (String) jobConfig.get("destinationObject");

        // Only apply when a specific entity is configured (QB→NS jobs)
        if (sourceEntity == null) return data;

        List<Map<String, Object>> rows = data.entrySet().stream()
                .filter(e -> sourceEntity.equalsIgnoreCase(e.getKey()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(Collections.emptyList());

        String outputKey = (destinationObject != null && !destinationObject.isBlank())
                ? destinationObject
                : sourceEntity.toLowerCase();

        System.out.println("[SyncService] Filtered to entity='" + sourceEntity
                + "' → destination key='" + outputKey + "'  rows=" + rows.size());

        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        result.put(outputKey, rows);
        return result;
    }

    /**
     * Flattens common QuickBooks nested value types to a plain String:
     *   { "Address": "..." }           → email address string
     *   { "FreeFormNumber": "..." }    → phone number string
     *   { "Line1": ..., "City": ... }  → comma-joined address string
     *   Any other Map                  → null  (skip complex objects)
     *   Scalar values                  → toString()
     */
    @SuppressWarnings("unchecked")
    private Object flattenQbValue(Object val) {
        if (val == null) return null;
        if (!(val instanceof Map)) return val.toString();

        Map<String, Object> m = (Map<String, Object>) val;
        if (m.containsKey("Address"))       return m.get("Address");
        if (m.containsKey("FreeFormNumber")) return m.get("FreeFormNumber");
        if (m.containsKey("Line1")) {
            return List.of("Line1", "City", "CountrySubDivisionCode", "PostalCode")
                    .stream()
                    .map(k -> m.getOrDefault(k, "").toString())
                    .filter(s -> !s.isBlank())
                    .collect(Collectors.joining(", "));
        }
        return null;
    }

    /**
     * Strips leading/trailing whitespace and trailing punctuation (commas, semicolons)
     * from String values. Non-string values are returned unchanged.
     *
     * Prevents malformed values like "user@example.com," from reaching NetSuite
     * and causing UNEXPECTED_ERROR (HTTP 500) responses.
     */
    private Object sanitizeValue(Object val) {
        if (!(val instanceof String s)) return val;
        // trim whitespace then strip any trailing commas or semicolons
        s = s.strip();
        s = s.replaceAll("[,;]+$", "");
        return s.strip(); // trim again in case punctuation had trailing space
    }

    /** Used by SyncScheduler to find jobs due for a scheduled run. */
    public List<SyncJob> findJobsDueForScheduledRun() {
        return jobRepo.findAll().stream()
                .filter(j -> j.isEnabled()
                        && j.getScheduleType() != SyncJob.ScheduleType.MANUAL
                        && j.getStatus() != SyncJob.SyncStatus.RUNNING
                        && j.getNextRunAt() != null
                        && !j.getNextRunAt().isAfter(LocalDateTime.now()))
                .toList();
    }
}
