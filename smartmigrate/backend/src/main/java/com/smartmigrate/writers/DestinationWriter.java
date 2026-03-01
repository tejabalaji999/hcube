package com.smartmigrate.writers;

import java.util.List;
import java.util.Map;

public interface DestinationWriter {
    /**
     * Write extracted data to destination.
     * @param data Map of tableName → list of rows
     * @return total rows written
     */
    int write(Map<String, List<Map<String, Object>>> data) throws Exception;
}
