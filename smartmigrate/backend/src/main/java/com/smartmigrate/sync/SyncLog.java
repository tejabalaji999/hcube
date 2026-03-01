package com.smartmigrate.sync;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Table(name = "sync_logs")
@Data
public class SyncLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sync_job_id", nullable = false)
    private SyncJob syncJob;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LogStatus status;

    @Column(name = "rows_synced")
    private int rowsSynced = 0;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "finished_at")
    private LocalDateTime finishedAt;

    @Column(name = "extract_duration_ms")
    private Long extractDurationMs = 0L;

    @Column(name = "load_duration_ms")
    private Long loadDurationMs = 0L;

    @Column(name = "triggered_by")
    private String triggeredBy = "admin";

    public enum LogStatus { RUNNING, SUCCESS, FAILED }
}
