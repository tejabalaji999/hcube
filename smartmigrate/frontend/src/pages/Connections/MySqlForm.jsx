import React, { useState, useMemo } from 'react';
import {
  Form, Input, InputNumber, Button, Divider, Space,
  Tree, Alert, Tag, Spin, Typography,
} from 'antd';
import { ReloadOutlined, TableOutlined } from '@ant-design/icons';
import { fetchSchema } from '../../api/connections';

const { Search } = Input;
const { Text } = Typography;

export default function MySqlForm({ initialValues, onSave, onCancel }) {
  const [form] = Form.useForm();
  const cfg = initialValues?.config || {};

  // ── Schema browser state ────────────────────────────────────────────────
  const [schema, setSchema]               = useState(null);   // { table: [col,...] }
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError]     = useState(null);
  const [searchText, setSearchText]       = useState('');
  const [expandedKeys, setExpandedKeys]   = useState([]);

  // Initialise checked keys from previously saved tableSchema
  const [checkedKeys, setCheckedKeys] = useState(() => {
    const ts = cfg.tableSchema || {};
    const keys = [];
    Object.entries(ts).forEach(([table, cols]) =>
      cols.forEach(col => keys.push(`${table}.${col}`))
    );
    return keys;
  });

  // ── Load schema from backend ────────────────────────────────────────────
  const loadSchema = async () => {
    setSchemaLoading(true);
    setSchemaError(null);
    try {
      const res = await fetchSchema(initialValues.id);
      const fetched = res.data;
      setSchema(fetched);
      setExpandedKeys(Object.keys(fetched));   // expand all tables by default

      // If no prior selection, pre-check everything
      if (checkedKeys.length === 0) {
        const allCols = [];
        Object.entries(fetched).forEach(([table, cols]) =>
          cols.forEach(col => allCols.push(`${table}.${col}`))
        );
        setCheckedKeys(allCols);
      }
    } catch (e) {
      setSchemaError(
        e.response?.data?.message ||
        'Failed to load schema. Check credentials and test the connection first.'
      );
    } finally {
      setSchemaLoading(false);
    }
  };

  // ── Tree data (rebuilds only when schema or search changes) ─────────────
  const treeData = useMemo(() => {
    if (!schema) return [];
    return Object.entries(schema)
      .filter(([table]) =>
        !searchText || table.toLowerCase().includes(searchText.toLowerCase())
      )
      .map(([table, cols]) => ({
        key: table,
        icon: <TableOutlined style={{ color: '#1890ff' }} />,
        title: table,
        children: cols.map(col => ({
          key: `${table}.${col}`,
          title: col,
        })),
      }));
  }, [schema, searchText]);

  // ── Selection summary ───────────────────────────────────────────────────
  const selectionSummary = useMemo(() => {
    if (!schema) return null;
    const tableSchema = buildTableSchema(checkedKeys);
    const tableCount  = Object.keys(tableSchema).length;
    const colCount    = Object.values(tableSchema).reduce((s, c) => s + c.length, 0);
    return { tableCount, colCount };
  }, [checkedKeys, schema]);

  // ── Save ────────────────────────────────────────────────────────────────
  const onFinish = (values) => {
    const tableSchema = buildTableSchema(checkedKeys);
    onSave({
      name: values.name,
      config: {
        host:        values.host,
        port:        values.port,
        database:    values.database,
        username:    values.username,
        password:    values.password,
        tableSchema: Object.keys(tableSchema).length > 0 ? tableSchema : undefined,
      },
    });
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onFinish}
      initialValues={{
        name:     initialValues?.name || '',
        host:     cfg.host            || 'localhost',
        port:     cfg.port            || 3306,
        database: cfg.database        || '',
        username: cfg.username        || '',
        password: cfg.password        || '',
      }}
    >
      <Form.Item label="Connection Name" name="name" rules={[{ required: true }]}>
        <Input placeholder="e.g. Production MySQL" />
      </Form.Item>

      <Divider orientation="left" plain>Database Connection</Divider>

      <Form.Item label="Host" name="host" rules={[{ required: true }]}>
        <Input placeholder="localhost or IP address" />
      </Form.Item>

      <Form.Item label="Port" name="port" rules={[{ required: true }]}>
        <InputNumber min={1} max={65535} style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item label="Database Name" name="database" rules={[{ required: true }]}>
        <Input placeholder="my_database" />
      </Form.Item>

      <Form.Item label="Username" name="username" rules={[{ required: true }]}>
        <Input placeholder="Database user" />
      </Form.Item>

      <Form.Item label="Password" name="password" rules={[{ required: true }]}>
        <Input.Password placeholder="Database password" />
      </Form.Item>

      {/* ── Schema browser — only available after the connection is saved ── */}
      {initialValues?.id ? (
        <>
          <Divider orientation="left" plain>Schema Selection</Divider>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadSchema}
              loading={schemaLoading}
            >
              {schema ? 'Refresh Schema' : 'Browse Schema'}
            </Button>

            {selectionSummary && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                <Tag color="blue">{selectionSummary.tableCount} tables</Tag>
                <Tag color="geekblue">{selectionSummary.colCount} columns selected</Tag>
              </Text>
            )}
          </div>

          {schemaError && (
            <Alert type="error" message={schemaError} showIcon style={{ marginBottom: 12 }} />
          )}

          {schemaLoading && !schema && (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin tip="Loading schema..." />
            </div>
          )}

          {schema && (
            <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, padding: '8px 12px' }}>
              <Search
                placeholder="Search tables..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                style={{ marginBottom: 8 }}
                size="small"
                allowClear
              />

              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                <Tree
                  checkable
                  showIcon
                  checkedKeys={checkedKeys}
                  expandedKeys={expandedKeys}
                  onExpand={setExpandedKeys}
                  onCheck={(keys) =>
                    setCheckedKeys(Array.isArray(keys) ? keys : keys.checked)
                  }
                  treeData={treeData}
                />
              </div>

              {treeData.length === 0 && searchText && (
                <Text type="secondary" style={{ padding: 8, display: 'block' }}>
                  No tables match "{searchText}"
                </Text>
              )}
            </div>
          )}

          {!schema && !schemaLoading && (
            <Alert
              type="info"
              showIcon
              message='Click "Browse Schema" to load tables and columns from the database.'
              style={{ marginBottom: 12 }}
            />
          )}
        </>
      ) : (
        <>
          <Divider orientation="left" plain>Schema Selection</Divider>
          <Alert
            type="info"
            showIcon
            message="Save the connection first, then re-open it to browse and select tables and columns."
          />
        </>
      )}

      <Divider />
      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" htmlType="submit">Save Connection</Button>
      </Space>
    </Form>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────
/**
 * Derive { table: [col,...] } from the flat list of checked Tree keys.
 * Column keys are "table.column"; table-level keys (no dot) are skipped
 * because their children already cover the selection.
 */
function buildTableSchema(checkedKeys) {
  const schema = {};
  checkedKeys.forEach(key => {
    const dotIdx = key.indexOf('.');
    if (dotIdx === -1) return;            // table-level key — skip
    const table = key.substring(0, dotIdx);
    const col   = key.substring(dotIdx + 1);
    if (!schema[table]) schema[table] = [];
    schema[table].push(col);
  });
  return schema;
}
