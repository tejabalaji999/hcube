package com.smartmigrate.destinations;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/destinations")
public class DestinationController {

    private final DestinationService service;

    public DestinationController(DestinationService service) {
        this.service = service;
    }

    @GetMapping
    public List<Destination> getAll() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public Destination getById(@PathVariable Long id) {
        return service.findById(id);
    }

    @PostMapping
    public ResponseEntity<Destination> create(@RequestBody Destination destination) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(destination));
    }

    @PutMapping("/{id}")
    public Destination update(@PathVariable Long id, @RequestBody Destination destination) {
        return service.update(id, destination);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/test")
    public Map<String, Object> test(@PathVariable Long id) {
        return service.testDestination(id);
    }
}
