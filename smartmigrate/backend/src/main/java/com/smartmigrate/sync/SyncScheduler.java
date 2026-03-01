package com.smartmigrate.sync;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Runs every minute. Finds sync jobs whose nextRunAt has passed
 * and fires them off asynchronously.
 */
@Component
public class SyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(SyncScheduler.class);

    private final SyncService syncService;
    private final SyncLogRepository logRepo;
    private final SyncJobRepository jobRepo;

    public SyncScheduler(SyncService syncService,
                         SyncLogRepository logRepo,
                         SyncJobRepository jobRepo) {
        this.syncService = syncService;
        this.logRepo = logRepo;
        this.jobRepo = jobRepo;
    }

    @Scheduled(fixedDelay = 60_000)   // every 60 seconds
    public void runDueJobs() {
        List<SyncJob> dueJobs = syncService.findJobsDueForScheduledRun();
        if (dueJobs.isEmpty()) return;

        log.info("Scheduler found {} job(s) due for execution", dueJobs.size());

        for (SyncJob job : dueJobs) {
            log.info("Triggering scheduled sync for job '{}' (id={})", job.getName(), job.getId());
            try {
                SyncLog syncLog = new SyncLog();
                syncLog.setSyncJob(job);
                syncLog.setStatus(SyncLog.LogStatus.RUNNING);
                syncLog.setStartedAt(java.time.LocalDateTime.now());
                syncLog.setTriggeredBy("scheduler");
                SyncLog savedLog = logRepo.save(syncLog);

                job.setStatus(SyncJob.SyncStatus.RUNNING);
                jobRepo.save(job);

                syncService.executeAsync(job, savedLog);
            } catch (Exception e) {
                log.error("Failed to trigger scheduled sync for job id={}: {}", job.getId(), e.getMessage());
            }
        }
    }
}
