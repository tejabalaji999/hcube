package com.smartmigrate.sync;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SyncLogRepository extends JpaRepository<SyncLog, Long> {

    List<SyncLog> findBySyncJobIdOrderByStartedAtDesc(Long syncJobId);

    List<SyncLog> findBySyncJobIdAndStartedAtAfterOrderByStartedAtDesc(Long syncJobId, LocalDateTime after);

    long countBySyncJobIdAndStatus(Long syncJobId, SyncLog.LogStatus status);

    long countBySyncJobId(Long syncJobId);

    @Query("SELECT AVG(TIMESTAMPDIFF(SECOND, l.startedAt, l.finishedAt)) FROM SyncLog l " +
           "WHERE l.syncJob.id = :jobId AND l.status = 'SUCCESS' AND l.startedAt > :after AND l.finishedAt IS NOT NULL")
    Double avgDurationSeconds(@Param("jobId") Long jobId, @Param("after") LocalDateTime after);
}
