package com.smartmigrate.connectors;

import com.smartmigrate.connections.Connection;
import com.smartmigrate.connectors.mysql.MySqlConnector;
import com.smartmigrate.connectors.quickbooks.QuickBooksConnector;
import org.springframework.stereotype.Component;

@Component
public class ConnectorFactory {

    public SourceConnector get(Connection connection) {
        return switch (connection.getType()) {
            case MYSQL -> new MySqlConnector(connection.getConfig());
            case QUICKBOOKS -> new QuickBooksConnector(connection.getConfig());
        };
    }
}
