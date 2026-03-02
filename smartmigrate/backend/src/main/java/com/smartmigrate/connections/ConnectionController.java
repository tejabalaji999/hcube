package com.smartmigrate.connections;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/connections")
public class ConnectionController {

    private final ConnectionService service;

    public ConnectionController(ConnectionService service) {
        this.service = service;
    }

    @GetMapping
    public List<Connection> getAll() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public Connection getById(@PathVariable Long id) {
        return service.findById(id);
    }

    @PostMapping
    public ResponseEntity<Connection> create(@RequestBody Connection connection) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(connection));
    }

    @PutMapping("/{id}")
    public Connection update(@PathVariable Long id, @RequestBody Connection connection) {
        return service.update(id, connection);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/test")
    public Map<String, Object> test(@PathVariable Long id) {
        return service.testConnection(id);
    }

    @GetMapping("/{id}/schema")
    public Map<String, List<String>> getSchema(@PathVariable Long id) {
        return service.fetchSchema(id);
    }
}
