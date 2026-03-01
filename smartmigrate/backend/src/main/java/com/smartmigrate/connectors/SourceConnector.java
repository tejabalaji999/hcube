package com.smartmigrate.connectors;

import java.util.List;
import java.util.Map;

public interface SourceConnector {
    /**
     * Extract data from source.
     * Returns a list of tables, each table being a list of rows (Map of column→value).
     */
    Map<String, List<Map<String, Object>>> extract() throws Exception;
}
