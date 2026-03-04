import React, { useEffect, useState, useCallback } from 'react';
import {
  Button, Table, Typography, Space, Drawer, Form, Input, InputNumber,
  Select, Popconfirm, message, Tag, Modal, Timeline, Spin, Empty, Tooltip,
} from 'antd';
import {
  PlusOutlined, PlayCircleOutlined, DeleteOutlined,
  HistoryOutlined, ReloadOutlined, ApartmentOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getSyncs, createSync, deleteSync, runSync, getSyncLogs } from '../../api/syncs';
import FieldMappingDrawer from './FieldMappingDrawer';
import { getConnections } from '../../api/connections';
import { getDestinations } from '../../api/destinations';
import { StatusTag } from '../../components/common/StatusBadge';

const { Title, Text } = Typography;

export default function Syncs() {
  const [syncs, setSyncs] = useState([]);
  const [connections, setConnections] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logsModal, setLogsModal] = useState({ open: false, jobId: null, jobName: '' });
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [mapJob, setMapJob] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  // Watch selected connection / destination in create drawer
  const selectedConnId  = Form.useWatch('connectionId',  form);
  const selectedDestId  = Form.useWatch('destinationId', form);
  const selectedConn    = connections.find(c => c.id === selectedConnId);
  const selectedDest    = destinations.find(d => d.id === selectedDestId);
  const isQbSource      = selectedConn?.type  === 'QUICKBOOKS';
  const isNsDest        = selectedDest?.type  === 'NETSUITE';
  const qbEntities      = selectedConn?.config?.entities?.length
                            ? selectedConn.config.entities
                            : ['Customer', 'Invoice', 'Payment', 'Vendor', 'Account', 'Item', 'Employee'];
  const nsObjects       = ['customer', 'invoice', 'vendor', 'account',
                           'inventoryItem', 'salesOrder', 'purchaseOrder', 'employee'];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [syncRes, connRes, destRes] = await Promise.all([
        getSyncs(), getConnections(), getDestinations(),
      ]);
      setSyncs(syncRes.data);
      setConnections(connRes.data);
      setDestinations(destRes.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRun = async (id) => {
    setRunning((prev) => ({ ...prev, [id]: true }));
    try {
      await runSync(id);
      message.success('Sync started');
      setTimeout(load, 1500);
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to start sync');
    } finally {
      setRunning((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = async (id) => {
    await deleteSync(id);
    message.success('Sync job deleted');
    load();
  };

  const openLogs = async (job) => {
    setLogsModal({ open: true, jobId: job.id, jobName: job.name });
    setLogsLoading(true);
    try {
      const res = await getSyncLogs(job.id);
      setLogs(res.data);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleCreate = async (values) => {
    await createSync({
      name:              values.name,
      connectionId:      values.connectionId,
      destinationId:     values.destinationId,
      sourceEntity:      values.sourceEntity      || null,
      destinationObject: values.destinationObject || null,
      subsidiaryId:      values.subsidiaryId      || null,
    });
    message.success('Sync job created');
    setDrawerOpen(false);
    form.resetFields();
    load();
  };

  const openMap = (job) => { setMapJob(job); setMapOpen(true); };
  const handleMapSaved = () => { message.success('Field mappings saved'); load(); };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => navigate(`/syncs/${record.id}`)}>
          {text}
        </Button>
      ),
    },
    {
      title: 'Source',
      key: 'source',
      render: (_, r) => {
        const icons = { QUICKBOOKS: '🟢', MYSQL: '🐬', MSSQL: '🗄️' };
        const entity = r.config?.sourceEntity;
        return (
          <Space>
            <span>{icons[r.connection?.type] || '🔌'}</span>
            <div>
              <Text>{r.connection?.name}</Text>
              {entity && <div><Text type="secondary" style={{ fontSize: 11 }}>{entity}</Text></div>}
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Destination',
      key: 'dest',
      render: (_, r) => {
        const icons = { AZURE_SQL: '🔷', AZURE_BLOB: '☁️', MYSQL_CLOUD: '🐬', NETSUITE: '🟣' };
        const obj = r.config?.destinationObject;
        return (
          <Space>
            <span>{icons[r.destination?.type] || '📦'}</span>
            <div>
              <Text>{r.destination?.name}</Text>
              {obj && <div><Text type="secondary" style={{ fontSize: 11 }}>{obj}</Text></div>}
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s) => <StatusTag status={s} />,
    },
    {
      title: 'Last Run',
      dataIndex: 'lastRunAt',
      key: 'lastRunAt',
      render: (d) => d ? new Date(d).toLocaleString() : <Text type="secondary">Never</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="primary" size="small" icon={<PlayCircleOutlined />}
            loading={running[record.id]}
            disabled={record.status === 'RUNNING'}
            onClick={() => handleRun(record.id)}
          >
            Run
          </Button>
          <Button size="small" icon={<HistoryOutlined />} onClick={() => openLogs(record)}>
            Logs
          </Button>
          {record.connection?.type === 'QUICKBOOKS' && record.destination?.type === 'NETSUITE' && (
            <Button size="small" icon={<ApartmentOutlined />} onClick={() => openMap(record)}>
              Map Fields
            </Button>
          )}
          <Popconfirm title="Delete this sync job?" onConfirm={() => handleDelete(record.id)} okText="Delete" okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const logColor = { RUNNING: 'blue', SUCCESS: 'green', FAILED: 'red' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Sync Jobs</Title>
          <Text type="secondary">Configure and run your ETL pipelines</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>New Sync Job</Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={syncs}
        rowKey="id"
        loading={loading}
        locale={{ emptyText: <Empty description="No sync jobs yet. Create one to get started." /> }}
        pagination={{ pageSize: 10 }}
      />

      {/* Create Sync Drawer */}
      <Drawer
        title="New Sync Job"
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); form.resetFields(); }}
        width={440}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="Job Name" name="name" rules={[{ required: true }]}>
            <Input placeholder="e.g. MySQL to Azure SQL Daily" />
          </Form.Item>

          <Form.Item label="Source Connection" name="connectionId" rules={[{ required: true }]}>
            <Select
              placeholder="Select a source connection"
              options={connections.map((c) => {
                const icons = { QUICKBOOKS: '🟢', MYSQL: '🐬', MSSQL: '🗄️' };
                return { value: c.id, label: `${icons[c.type] || '🔌'} ${c.name}` };
              })}
            />
          </Form.Item>

          <Form.Item label="Destination" name="destinationId" rules={[{ required: true }]}>
            <Select
              placeholder="Select a destination"
              options={destinations.map((d) => {
                const icons = { AZURE_SQL: '🔷', AZURE_BLOB: '☁️', MYSQL_CLOUD: '🐬', NETSUITE: '🟣' };
                return { value: d.id, label: `${icons[d.type] || '📦'} ${d.name}` };
              })}
            />
          </Form.Item>

          {/* Entity / object selectors — shown only for QB → NetSuite */}
          {isQbSource && (
            <Form.Item
              label="Source Entity (QuickBooks)"
              name="sourceEntity"
              rules={[{ required: isNsDest, message: 'Required for NetSuite destination' }]}
            >
              <Select
                placeholder="Select QB entity to sync"
                options={qbEntities.map(e => ({ value: e, label: e }))}
              />
            </Form.Item>
          )}
          {isNsDest && (
            <Form.Item
              label="Destination Object (NetSuite)"
              name="destinationObject"
              rules={[{ required: true, message: 'Required' }]}
            >
              <Select
                placeholder="Select NetSuite record type"
                options={nsObjects.map(o => ({ value: o, label: o }))}
              />
            </Form.Item>
          )}
          {isNsDest && (
            <Form.Item
              label="Subsidiary ID"
              name="subsidiaryId"
              rules={[{ required: true, message: 'Subsidiary ID is required for NetSuite' }]}
              tooltip="Internal NetSuite Subsidiary ID. Find it in Setup → Company → Subsidiaries."
            >
              <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 1" />
            </Form.Item>
          )}

          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit">Create Job</Button>
          </Space>
        </Form>
      </Drawer>

      {/* Field Mapping Drawer */}
      {mapJob && (
        <FieldMappingDrawer
          job={mapJob}
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          onSaved={handleMapSaved}
        />
      )}

      {/* Logs Modal */}
      <Modal
        title={`Sync Logs — ${logsModal.jobName}`}
        open={logsModal.open}
        onCancel={() => setLogsModal({ open: false, jobId: null, jobName: '' })}
        footer={null}
        width={560}
      >
        {logsLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : logs.length === 0 ? (
          <Empty description="No runs yet." />
        ) : (
          <Timeline
            items={logs.map((log) => ({
              color: logColor[log.status] || 'gray',
              children: (
                <div>
                  <Space>
                    <Tag color={logColor[log.status]}>{log.status}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(log.startedAt).toLocaleString()}
                    </Text>
                  </Space>
                  {log.status === 'SUCCESS' && (
                    <div><Text>{log.rowsSynced} rows synced</Text></div>
                  )}
                  {log.status === 'FAILED' && (
                    <div><Text type="danger" style={{ fontSize: 12 }}>{log.errorMessage}</Text></div>
                  )}
                  {log.finishedAt && (
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Finished: {new Date(log.finishedAt).toLocaleString()}
                      </Text>
                    </div>
                  )}
                </div>
              ),
            }))}
          />
        )}
      </Modal>
    </div>
  );
}
