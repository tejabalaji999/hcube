package com.smartmigrate.sync;

import com.smartmigrate.connections.ConnectionRepository;
import com.smartmigrate.destinations.DestinationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/syncs")
public class SyncController {

    private final SyncService service;
    private final ConnectionRepository connectionRepository;
    private final DestinationRepository destinationRepository;

    public SyncController(SyncService service,
                          ConnectionRepository connectionRepository,
                          DestinationRepository destinationRepository) {
        this.service = service;
        this.connectionRepository = connectionRepository;
        this.destinationRepository = destinationRepository;
    }

    @GetMapping
    public List<SyncJob> getAll() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public SyncJob getById(@PathVariable Long id) {
        return service.findById(id);
    }

    @PostMapping
    public ResponseEntity<SyncJob> create(@RequestBody CreateSyncRequest req) {
        SyncJob job = new SyncJob();
        job.setName(req.name());
        job.setConnection(connectionRepository.findById(req.connectionId())
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Connection not found")));
        job.setDestination(destinationRepository.findById(req.destinationId())
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Destination not found")));
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(job));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** Trigger a manual sync run. */
    @PostMapping("/{id}/run")
    public ResponseEntity<Map<String, Object>> run(@PathVariable Long id) {
        SyncLog log = service.triggerRun(id, "admin");
        return ResponseEntity.accepted().body(Map.of(
                "message", "Sync started",
                "logId", log.getId(),
                "jobId", id
        ));
    }

    /** Get all logs for a job. */
    @GetMapping("/{id}/logs")
    public List<SyncLog> getLogs(@PathVariable Long id) {
        return service.getLogs(id);
    }

    /** Get aggregated stats for the detail page. */
    @GetMapping("/{id}/stats")
    public Map<String, Object> getStats(@PathVariable Long id) {
        return service.getStats(id);
    }

    /** Toggle enabled / disabled. */
    @PutMapping("/{id}/toggle")
    public SyncJob toggle(@PathVariable Long id) {
        return service.toggle(id);
    }

    /** Update the schedule type for a job. */
    @PutMapping("/{id}/schedule")
    public SyncJob updateSchedule(@PathVariable Long id, @RequestBody ScheduleRequest req) {
        return service.updateSchedule(id, req.scheduleType());
    }

    public record CreateSyncRequest(String name, Long connectionId, Long destinationId) {}
    public record ScheduleRequest(SyncJob.ScheduleType scheduleType) {}
}
