import React, { useEffect, useState } from 'react';
import {
  Button, Card, Col, Row, Typography, Space, Drawer,
  Popconfirm, message, Empty, Spin, Tag,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, CheckCircleOutlined } from '@ant-design/icons';
import {
  getDestinations, deleteDestination, testDestination, createDestination, updateDestination,
} from '../../api/destinations';
import StatusBadge from '../../components/common/StatusBadge';
import AzureSqlForm from './AzureSqlForm';
import AzureBlobForm from './AzureBlobForm';
import MySqlCloudForm from './MySqlCloudForm';

const { Title, Text } = Typography;

const TYPE_META = {
  AZURE_SQL:   { icon: '🔷', label: 'Azure SQL',    color: 'blue' },
  AZURE_BLOB:  { icon: '☁️',  label: 'Azure Blob',   color: 'cyan' },
  MYSQL_CLOUD: { icon: '🐬', label: 'MySQL Cloud',  color: 'green' },
};

export default function Destinations() {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState(null);
  const [editing, setEditing] = useState(null);
  const [testing, setTesting] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await getDestinations();
      setDestinations(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setDrawerType(null); setDrawerOpen(true); };
  const openEdit = (dest) => { setEditing(dest); setDrawerType(dest.type); setDrawerOpen(true); };

  const handleDelete = async (id) => {
    await deleteDestination(id);
    message.success('Destination deleted');
    load();
  };

  const handleTest = async (id) => {
    setTesting((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await testDestination(id);
      res.data.success ? message.success(res.data.message) : message.error(res.data.message);
      load();
    } finally {
      setTesting((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleSave = async (values) => {
    if (editing) {
      await updateDestination(editing.id, { name: values.name, type: editing.type, config: values.config });
      message.success('Destination updated');
    } else {
      await createDestination({ name: values.name, type: drawerType, config: values.config });
      message.success('Destination created');
    }
    setDrawerOpen(false);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Destinations</Title>
          <Text type="secondary">Manage your data destination targets</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>Add Destination</Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : destinations.length === 0 ? (
        <Empty description="No destinations yet. Add your first target." />
      ) : (
        <Row gutter={[16, 16]}>
          {destinations.map((dest) => {
            const meta = TYPE_META[dest.type] || {};
            return (
              <Col xs={24} sm={12} lg={8} key={dest.id}>
                <Card
                  hoverable
                  actions={[
                    <Button type="link" size="small" icon={<CheckCircleOutlined />}
                      loading={testing[dest.id]} onClick={() => handleTest(dest.id)}>Test</Button>,
                    <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(dest)}>Edit</Button>,
                    <Popconfirm title="Delete this destination?" onConfirm={() => handleDelete(dest.id)} okText="Delete" okType="danger">
                      <Button type="link" size="small" danger icon={<DeleteOutlined />}>Delete</Button>
                    </Popconfirm>,
                  ]}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                      <span style={{ fontSize: 20 }}>{meta.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{dest.name}</div>
                        <Tag color={meta.color} style={{ marginTop: 2 }}>{meta.label}</Tag>
                      </div>
                    </Space>
                    <StatusBadge status={dest.status} />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Created {new Date(dest.createdAt).toLocaleDateString()}
                    </Text>
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      <Drawer
        title={editing ? 'Edit Destination' : 'Add Destination'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={480}
        destroyOnClose
      >
        {!drawerType && !editing ? (
          <div style={{ padding: '20px 0' }}>
            <Text strong>Select destination type:</Text>
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col span={12}>
                <Card hoverable onClick={() => setDrawerType('AZURE_SQL')} style={{ textAlign: 'center', cursor: 'pointer' }}>
                  <div style={{ fontSize: 32 }}>🔷</div>
                  <div style={{ fontWeight: 600, marginTop: 8 }}>Azure SQL</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Managed SQL Database</Text>
                </Card>
              </Col>
              <Col span={12}>
                <Card hoverable onClick={() => setDrawerType('AZURE_BLOB')} style={{ textAlign: 'center', cursor: 'pointer' }}>
                  <div style={{ fontSize: 32 }}>☁️</div>
                  <div style={{ fontWeight: 600, marginTop: 8 }}>Azure Blob</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>ADLS / Blob Storage</Text>
                </Card>
              </Col>
              <Col span={12}>
                <Card hoverable onClick={() => setDrawerType('MYSQL_CLOUD')} style={{ textAlign: 'center', cursor: 'pointer' }}>
                  <div style={{ fontSize: 32 }}>🐬</div>
                  <div style={{ fontWeight: 600, marginTop: 8 }}>MySQL Cloud</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Cloud MySQL Database</Text>
                </Card>
              </Col>
            </Row>
          </div>
        ) : drawerType === 'AZURE_SQL' ? (
          <AzureSqlForm initialValues={editing} onSave={handleSave} onCancel={() => setDrawerOpen(false)} />
        ) : drawerType === 'AZURE_BLOB' ? (
          <AzureBlobForm initialValues={editing} onSave={handleSave} onCancel={() => setDrawerOpen(false)} />
        ) : (
          <MySqlCloudForm initialValues={editing} onSave={handleSave} onCancel={() => setDrawerOpen(false)} />
        )}
      </Drawer>
    </div>
  );
}
