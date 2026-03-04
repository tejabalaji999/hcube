import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Drawer, Input, Button, Space, Tag, Spin, Alert,
  Typography, Tree, Switch, Tooltip, Divider,
} from 'antd';
import {
  ReloadOutlined,
  PlusSquareOutlined, MinusSquareOutlined,
  CheckSquareOutlined, BorderOutlined,
} from '@ant-design/icons';
import { fetchSchema, updateConnection } from '../../api/connections';

const { Search } = Input;
const { Text } = Typography;

// ── Key scheme ────────────────────────────────────────────────────────────────
// Table node key : exact table name from schema  e.g. "customers" / "dbo.Orders"
// Column node key: "<tableKey>||<colName>"        e.g. "customers||id"
// Schema group key (MSSQL only): "__grp__<schema>" e.g. "__grp__dbo"
//
// Using "||" as separator prevents ambiguity with dots that appear in MSSQL keys.

const COL_SEP    = '||';
const GRP_PREFIX = '__grp__';

const colKey      = (tableKey, col)  => `${tableKey}${COL_SEP}${col}`;
const grpKey      = (schemaName)     => `${GRP_PREFIX}${schemaName}`;
const isColKey    = (key)            => key.includes(COL_SEP);
const isGrpKey    = (key)            => key.startsWith(GRP_PREFIX);

function parseColKey(key) {
  const idx = key.indexOf(COL_SEP);
  return { tableKey: key.substring(0, idx), col: key.substring(idx + COL_SEP.length) };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Detect MSSQL-style schema (table names contain dots, e.g. "dbo.Customers"). */
function isMsSql(schema) {
  return Object.keys(schema).some(k => k.includes('.'));
}

/** Derive { tableKey: [col,...] } from the flat checked-keys array. */
function buildTableSchema(checkedKeys) {
  const ts = {};
  checkedKeys.forEach(key => {
    if (!isColKey(key)) return;
    const { tableKey, col } = parseColKey(key);
    if (!ts[tableKey]) ts[tableKey] = [];
    ts[tableKey].push(col);
  });
  return ts;
}

/** Build initial checked keys from a previously saved tableSchema. */
function initCheckedKeys(tableSchema) {
  const keys = [];
  Object.entries(tableSchema || {}).forEach(([tableKey, cols]) =>
    cols.forEach(col => keys.push(colKey(tableKey, col)))
  );
  return keys;
}

/** All expandable node keys (schema groups + table keys). */
function allExpandableKeys(schema) {
  const keys = [];
  if (isMsSql(schema)) {
    const seen = new Set();
    Object.keys(schema).forEach(t => {
      const grp = t.substring(0, t.indexOf('.'));
      if (!seen.has(grp)) { seen.add(grp); keys.push(grpKey(grp)); }
    });
  }
  Object.keys(schema).forEach(t => keys.push(t));
  return keys;
}

/** All column-level keys (used for Select All). */
function allColKeys(schema) {
  const keys = [];
  Object.entries(schema).forEach(([t, cols]) =>
    cols.forEach(col => keys.push(colKey(t, col)))
  );
  return keys;
}

// ── Tree data builder ─────────────────────────────────────────────────────────

function buildTreeData(schema, checkedKeys, searchText, showSelectedOnly) {
  const checkedSet = new Set(checkedKeys);
  const q = searchText.toLowerCase();

  /** True if this table should appear given current search + filter settings. */
  const visible = (tableKey, cols) => {
    const nameMatch = !q || tableKey.toLowerCase().includes(q);
    if (showSelectedOnly) {
      return nameMatch && cols.some(col => checkedSet.has(colKey(tableKey, col)));
    }
    return nameMatch;
  };

  /** Build a single table node with its column children. */
  const tableNode = (tableKey, cols) => {
    const selCount  = cols.filter(col => checkedSet.has(colKey(tableKey, col))).length;
    // For MSSQL strip schema prefix in display: "dbo.Customers" → "Customers"
    const dotIdx    = tableKey.lastIndexOf('.');
    const label     = dotIdx > -1 ? tableKey.substring(dotIdx + 1) : tableKey;

    return {
      key: tableKey,
      title: (
        <span>
          <span style={{ fontWeight: 500 }}>{label}</span>
          <Tag
            color={selCount > 0 ? 'blue' : 'default'}
            style={{ marginLeft: 6, fontSize: 11, padding: '0 4px', lineHeight: '16px' }}
          >
            {selCount}/{cols.length}
          </Tag>
        </span>
      ),
      children: cols.map(col => ({
        key:    colKey(tableKey, col),
        title:  <Text style={{ fontSize: 13 }}>{col}</Text>,
        isLeaf: true,
      })),
    };
  };

  if (isMsSql(schema)) {
    // ── 3-level tree: schema group → table → column ──
    const groups = {};
    Object.entries(schema).forEach(([tableKey, cols]) => {
      if (!visible(tableKey, cols)) return;
      const grp = tableKey.substring(0, tableKey.indexOf('.'));
      if (!groups[grp]) groups[grp] = [];
      groups[grp].push(tableNode(tableKey, cols));
    });

    return Object.entries(groups).map(([grpName, tables]) => {
      const selTables = tables.filter(t =>
        t.children.some(c => checkedSet.has(c.key))
      ).length;
      return {
        key: grpKey(grpName),
        title: (
          <span>
            <span style={{ fontWeight: 600, color: '#333' }}>{grpName}</span>
            <Tag
              color="geekblue"
              style={{ marginLeft: 6, fontSize: 11, padding: '0 4px', lineHeight: '16px' }}
            >
              {selTables}/{tables.length} tables
            </Tag>
          </span>
        ),
        children: tables,
      };
    });
  }

  // ── 2-level tree: table → column (MySQL) ──
  return Object.entries(schema)
    .filter(([tableKey, cols]) => visible(tableKey, cols))
    .map(([tableKey, cols]) => tableNode(tableKey, cols));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SchemaDrawer({ connection, open, onClose, onSaved }) {
  const [schema,       setSchema]       = useState(null);
  const [checkedKeys,  setCheckedKeys]  = useState([]);
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [searchText,   setSearchText]   = useState('');
  const [showSelected, setShowSelected] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState(null);

  // ── Open: reset state + load ───────────────────────────────────────────────
  useEffect(() => {
    if (open && connection) {
      setSearchText('');
      setShowSelected(false);
      setError(null);
      setCheckedKeys(initCheckedKeys(connection.config?.tableSchema));
      loadSchema();
    }
  }, [open, connection]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSchema = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res     = await fetchSchema(connection.id);
      const fetched = res.data;
      setSchema(fetched);
      // Expand schema groups (MSSQL) + first 10 tables by default so the
      // structure is immediately visible without expanding everything at once.
      const allKeys  = allExpandableKeys(fetched);
      const grpKeys  = allKeys.filter(isGrpKey);
      const tblKeys  = allKeys.filter(k => !isGrpKey(k)).slice(0, 10);
      setExpandedKeys([...grpKeys, ...tblKeys]);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load schema. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }, [connection]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tree data ──────────────────────────────────────────────────────────────
  const treeData = useMemo(() => {
    if (!schema) return [];
    return buildTreeData(schema, checkedKeys, searchText, showSelected);
  }, [schema, checkedKeys, searchText, showSelected]);

  // ── Bulk actions ───────────────────────────────────────────────────────────
  const expandAll   = () => schema && setExpandedKeys(allExpandableKeys(schema));
  const collapseAll = () => setExpandedKeys([]);
  const selectAll   = () => schema && setCheckedKeys(allColKeys(schema));
  const clearAll    = () => setCheckedKeys([]);

  // ── Check handler ──────────────────────────────────────────────────────────
  const onCheck = useCallback(keys =>
    setCheckedKeys(Array.isArray(keys) ? keys : keys.checked),
  []);

  // ── Summary ────────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const ts = buildTableSchema(checkedKeys);
    return {
      tableCount: Object.keys(ts).length,
      colCount:   Object.values(ts).reduce((s, c) => s + c.length, 0),
    };
  }, [checkedKeys]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateConnection(connection.id, {
        name:   connection.name,
        type:   connection.type,
        config: { ...connection.config, tableSchema: buildTableSchema(checkedKeys) },
      });
      onSaved();
      onClose();
    } catch {
      setError('Failed to save schema selection.');
    } finally {
      setSaving(false);
    }
  };

  // ── Tree height — fills available space, enables virtual scrolling ─────────
  // Drawer header ≈55px, toolbar ≈110px, footer ≈55px, error/padding ≈20px
  const treeHeight = Math.max(300, window.innerHeight - 260);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Drawer
      title={`Configure Schema — ${connection?.name || ''}`}
      open={open}
      onClose={onClose}
      width="72vw"
      styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' } }}
      footer={
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space wrap>
            <Tag color="blue">{summary.tableCount} tables selected</Tag>
            <Tag color="geekblue">{summary.colCount} columns selected</Tag>
            {schema && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                of {Object.keys(schema).length} tables total
              </Text>
            )}
          </Space>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>
              Save Schema
            </Button>
          </Space>
        </Space>
      }
    >
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
        <Search
          placeholder="Search tables..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          allowClear
          style={{ marginBottom: 10 }}
        />

        <Space wrap size={[6, 6]}>
          {/* Expand / collapse */}
          <Button size="small" icon={<PlusSquareOutlined />}  onClick={expandAll}>
            Expand All
          </Button>
          <Button size="small" icon={<MinusSquareOutlined />} onClick={collapseAll}>
            Collapse All
          </Button>

          <Divider type="vertical" style={{ margin: 0 }} />

          {/* Select / clear */}
          <Button size="small" icon={<CheckSquareOutlined />} onClick={selectAll}>
            Select All
          </Button>
          <Button size="small" icon={<BorderOutlined />}      onClick={clearAll}>
            Clear All
          </Button>

          <Divider type="vertical" style={{ margin: 0 }} />

          {/* Show selected only */}
          <Tooltip title="Hide tables with no columns selected">
            <Space size={4} style={{ cursor: 'default' }}>
              <Switch size="small" checked={showSelected} onChange={setShowSelected} />
              <Text style={{ fontSize: 12 }}>Selected only</Text>
            </Space>
          </Tooltip>

          {/* Refresh */}
          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={loadSchema}
            title="Re-fetch schema from database"
          />
        </Space>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <Alert
          type="error"
          message={error}
          showIcon
          closable
          style={{ margin: '8px 16px', flexShrink: 0 }}
          onClose={() => setError(null)}
        />
      )}

      {/* ── Tree / loading / empty ───────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '8px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <Spin size="large" tip="Loading schema..." />
          </div>

        ) : schema ? (
          treeData.length > 0 ? (
            <Tree
              checkable
              showLine={{ showLeafIcon: false }}
              checkedKeys={checkedKeys}
              expandedKeys={expandedKeys}
              onExpand={setExpandedKeys}
              onCheck={onCheck}
              treeData={treeData}
              // height enables Ant Design's built-in virtual scrolling —
              // only visible rows are rendered regardless of tree size.
              height={treeHeight}
              style={{ fontSize: 13 }}
            />
          ) : (
            <div style={{ textAlign: 'center', paddingTop: 60 }}>
              <Text type="secondary">
                {showSelected
                  ? 'No tables with selected columns. Toggle "Selected only" to see all.'
                  : `No tables match "${searchText}"`}
              </Text>
            </div>
          )

        ) : !loading ? (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <Text type="secondary">Schema not loaded.</Text>
            <br />
            <Button style={{ marginTop: 12 }} icon={<ReloadOutlined />} onClick={loadSchema}>
              Load Schema
            </Button>
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}
