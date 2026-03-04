package com.smartmigrate.writers;

import com.smartmigrate.destinations.Destination;
import com.smartmigrate.writers.azureblob.AzureBlobWriter;
import com.smartmigrate.writers.azuresql.AzureSqlWriter;
import com.smartmigrate.writers.mysqlcloud.MySqlCloudWriter;
import com.smartmigrate.writers.netsuite.NetSuiteWriter;
import org.springframework.stereotype.Component;

@Component
public class WriterFactory {

    public DestinationWriter get(Destination destination) {
        return switch (destination.getType()) {
            case AZURE_SQL   -> new AzureSqlWriter(destination.getConfig());
            case AZURE_BLOB  -> new AzureBlobWriter(destination.getConfig());
            case MYSQL_CLOUD -> new MySqlCloudWriter(destination.getConfig());
            case NETSUITE    -> new NetSuiteWriter(destination.getConfig());
        };
    }
}
