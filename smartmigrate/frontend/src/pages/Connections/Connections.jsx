import React, { useEffect, useState } from 'react';
import {
  Button, Card, Col, Row, Typography, Space, Drawer, Tag,
  Popconfirm, message, Empty, Spin,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined,
  CheckCircleOutlined, ApiOutlined, TableOutlined,
} from '@ant-design/icons';
import {
  getConnections, deleteConnection, testConnection, createConnection, updateConnection,
} from '../../api/connections';
import StatusBadge from '../../components/common/StatusBadge';
import QuickBooksForm from './QuickBooksForm';
import MySqlForm      from './MySqlForm';
import MsSqlForm      from './MsSqlForm';
import SchemaDrawer   from './SchemaDrawer';

const { Title, Text } = Typography;

const TYPE_LABELS = {
  QUICKBOOKS: 'QuickBooks',
  MYSQL:      'MySQL',
  MSSQL:      'SQL Server',
};

const TYPE_ICONS = {
  QUICKBOOKS: '🟢',
  MYSQL:      '🐬',
  MSSQL:      '🗄️',
};

const TYPE_COLORS = {
  QUICKBOOKS: 'green',
  MYSQL:      'blue',
  MSSQL:      'volcano',
};

// Types that support schema selection
const DB_TYPES = ['MYSQL', 'MSSQL'];

export default function Connections() {
  const [connections, setConnections]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [drawerType, setDrawerType]     = useState(null);
  const [editing, setEditing]           = useState(null);
  const [testing, setTesting]           = useState({});

  // Schema drawer
  const [schemaConn, setSchemaConn]     = useState(null);
  const [schemaOpen, setSchemaOpen]     = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getConnections();
      setConnections(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setDrawerType(null);
    setDrawerOpen(true);
  };

  const openEdit = (conn) => {
    setEditing(conn);
    setDrawerType(conn.type);
    setDrawerOpen(true);
  };

  const openSchema = (conn) => {
    setSchemaConn(conn);
    setSchemaOpen(true);
  };

  const handleDelete = async (id) => {
    await deleteConnection(id);
    message.success('Connection deleted');
    load();
  };

  const handleTest = async (id) => {
    setTesting(prev => ({ ...prev, [id]: true }));
    try {
      const res = await testConnection(id);
      if (res.data.success) message.success(res.data.message);
      else                  message.error(res.data.message);
      load();
    } finally {
      setTesting(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleSave = async (values) => {
    if (editing) {
      await updateConnection(editing.id, { name: values.name, type: editing.type, config: values.config });
      message.success('Connection updated');
    } else {
      await createConnection({ name: values.name, type: drawerType, config: values.config });
      message.success('Connection created');
    }
    setDrawerOpen(false);
    load();
  };

  const handleSchemaSaved = () => {
    message.success('Schema selection saved');
    load();
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Connections</Title>
          <Text type="secondary">Manage your data source connections</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
          Add Connection
        </Button>
      </div>

      {/* Connection cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : connections.length === 0 ? (
        <Empty description="No connections yet. Add your first source." />
      ) : (
        <Row gutter={[16, 16]}>
          {connections.map((conn) => {
            const isDb = DB_TYPES.includes(conn.type);
            const ts   = conn.config?.tableSchema;
            const tableCount = ts ? Object.keys(ts).length : null;

            return (
              <Col xs={24} sm={12} lg={8} key={conn.id}>
                <Card
                  hoverable
                  actions={[
                    <Button
                      type="link" size="small" icon={<CheckCircleOutlined />}
                      loading={testing[conn.id]}
                      onClick={() => handleTest(conn.id)}
                    >
                      Test
                    </Button>,
                    ...(isDb ? [
                      <Button
                        type="link" size="small" icon={<TableOutlined />}
                        onClick={() => openSchema(conn)}
                      >
                        Schema
                      </Button>,
                    ] : []),
                    <Button
                      type="link" size="small" icon={<EditOutlined />}
                      onClick={() => openEdit(conn)}
                    >
                      Edit
                    </Button>,
                    <Popconfirm
                      title="Delete this connection?"
                      onConfirm={() => handleDelete(conn.id)}
                      okText="Delete"
                      okType="danger"
                    >
                      <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                        Delete
                      </Button>
                    </Popconfirm>,
                  ]}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                      <span style={{ fontSize: 20 }}>{TYPE_ICONS[conn.type]}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{conn.name}</div>
                        <Tag color={TYPE_COLORS[conn.type]} style={{ marginTop: 2 }}>
                          {TYPE_LABELS[conn.type]}
                        </Tag>
                      </div>
                    </Space>
                    <StatusBadge status={conn.status} />
                    {isDb && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {tableCount !== null
                          ? `${tableCount} table${tableCount !== 1 ? 's' : ''} configured`
                          : 'No schema configured — click Schema'}
                      </Text>
                    )}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Created {new Date(conn.createdAt).toLocaleDateString()}
                    </Text>
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Edit / New connection drawer */}
      <Drawer
        title={editing ? 'Edit Connection' : 'Add Connection'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={480}
        destroyOnClose
      >
        {/* Type picker — shown when creating a new connection */}
        {!drawerType && !editing ? (
          <div style={{ padding: '20px 0' }}>
            <Text strong>Select source type:</Text>
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col span={12}>
                <Card
                  hoverable
                  onClick={() => setDrawerType('QUICKBOOKS')}
                  style={{ textAlign: 'center', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 32 }}>🟢</div>
                  <div style={{ fontWeight: 600, marginTop: 8 }}>QuickBooks</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Accounting &amp; Finance</Text>
                </Card>
              </Col>
              <Col span={12}>
                <Card
                  hoverable
                  onClick={() => setDrawerType('MYSQL')}
                  style={{ textAlign: 'center', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 32 }}>🐬</div>
                  <div style={{ fontWeight: 600, marginTop: 8 }}>MySQL</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Relational Database</Text>
                </Card>
              </Col>
              <Col span={12}>
                <Card
                  hoverable
                  onClick={() => setDrawerType('MSSQL')}
                  style={{ textAlign: 'center', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 32 }}>🗄️</div>
                  <div style={{ fontWeight: 600, marginTop: 8 }}>SQL Server</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>On-Premises MSSQL</Text>
                </Card>
              </Col>
            </Row>
          </div>
        ) : drawerType === 'QUICKBOOKS' ? (
          <QuickBooksForm
            initialValues={editing}
            onSave={handleSave}
            onCancel={() => setDrawerOpen(false)}
          />
        ) : drawerType === 'MYSQL' ? (
          <MySqlForm
            initialValues={editing}
            onSave={handleSave}
            onCancel={() => setDrawerOpen(false)}
          />
        ) : (
          <MsSqlForm
            initialValues={editing}
            onSave={handleSave}
            onCancel={() => setDrawerOpen(false)}
          />
        )}
      </Drawer>

      {/* Schema selection drawer — full width, separate from edit */}
      {schemaConn && (
        <SchemaDrawer
          connection={schemaConn}
          open={schemaOpen}
          onClose={() => setSchemaOpen(false)}
          onSaved={handleSchemaSaved}
        />
      )}
    </div>
  );
}
