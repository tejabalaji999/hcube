package com.smartmigrate;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableAsync
@EnableScheduling
public class SmartMigrateApplication {
    public static void main(String[] args) {
        SpringApplication.run(SmartMigrateApplication.class, args);
    }
}
