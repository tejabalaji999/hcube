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
