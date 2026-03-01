import React, { useEffect, useState, useCallback } from 'react';
import {
  Button, Typography, Space, Tabs, Statistic, Row, Col, Card,
  Table, Tag, Switch, Select, message, Spin, Breadcrumb, Badge,
  Tooltip, Alert,
} from 'antd';
import {
  ArrowLeftOutlined, PlayCircleOutlined, ReloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getSync, runSync, getSyncLogs, getSyncStats, toggleSync, updateSchedule,
} from '../../api/syncs';

const { Title, Text } = Typography;

const SCHEDULE_OPTIONS = [
  { value: 'MANUAL',   label: 'Manual only' },
  { value: 'HOURLY',   label: 'Every hour' },
  { value: 'EVERY_6H', label: 'Every 6 hours' },
  { value: 'DAILY',    label: 'Every day' },
  { value: 'WEEKLY',   label: 'Every week' },
];

const TIME_RANGES = [
  { label: '1 Hour',  hours: 1 },
  { label: '1 Day',   hours: 24 },
  { label: '3 Days',  hours: 72 },
  { label: '1 Week',  hours: 168 },
];

const STATUS_COLOR = { SUCCESS: '#52c41a', FAILED: '#ff4d4f', RUNNING: '#1677ff' };

function fmtDuration(ms) {
  if (!ms || ms === 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function fmtDatetime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString();
}

// -------------------------------------------------------
// Timeline component — CSS bars on a time axis
// -------------------------------------------------------
function SyncTimeline({ logs, rangeHours }) {
  const now = Date.now();
  const rangeStart = now - rangeHours * 3600 * 1000;

  const inRange = logs.filter((l) => {
    const t = new Date(l.startedAt).getTime();
    return t >= rangeStart && t <= now;
  });

  const toPercent = (dt) =>
    ((new Date(dt).getTime() - rangeStart) / (now - rangeStart)) * 100;

  const barWidth = (log) => {
    const start = new Date(log.startedAt).getTime();
    const end = log.finishedAt ? new Date(log.finishedAt).getTime() : Date.now();
    return Math.max(0.3, ((end - start) / (now - rangeStart)) * 100);
  };

  // Tick marks
  const ticks = 6;
  const tickLabels = Array.from({ length: ticks + 1 }, (_, i) => {
    const t = new Date(rangeStart + (i / ticks) * (now - rangeStart));
    return rangeHours <= 1
      ? t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : rangeHours <= 24
      ? t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : t.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  });

  return (
    <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: '16px 16px 8px', marginBottom: 24 }}>
      {/* Tick labels */}
      <div style={{ position: 'relative', height: 18, marginBottom: 6 }}>
        {tickLabels.map((label, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${(i / ticks) * 100}%`,
              transform: 'translateX(-50%)',
              fontSize: 10,
              color: '#8c8c8c',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Extract row */}
      <div style={{ marginBottom: 4 }}>
        <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'inline-block', width: 56 }}>Extract</Text>
        <div style={{ position: 'relative', height: 16, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden', display: 'inline-block', width: 'calc(100% - 60px)' }}>
          {inRange.map((log) => (
            <Tooltip key={log.id} title={`Extract: ${fmtDuration(log.extractDurationMs)}`}>
              <div
                style={{
                  position: 'absolute',
                  left: `${toPercent(log.startedAt)}%`,
                  width: `${barWidth(log)}%`,
                  height: '100%',
                  background: STATUS_COLOR[log.status] || '#d9d9d9',
                  opacity: 0.85,
                  borderRadius: 2,
                  cursor: 'pointer',
                }}
              />
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Load row */}
      <div>
        <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'inline-block', width: 56 }}>Load</Text>
        <div style={{ position: 'relative', height: 16, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden', display: 'inline-block', width: 'calc(100% - 60px)' }}>
          {inRange.map((log) => {
            if (!log.extractDurationMs) return null;
            const loadStart = new Date(new Date(log.startedAt).getTime() + (log.extractDurationMs || 0));
            return (
              <Tooltip key={log.id} title={`Load: ${fmtDuration(log.loadDurationMs)}`}>
                <div
                  style={{
                    position: 'absolute',
                    left: `${toPercent(loadStart)}%`,
                    width: `${Math.max(0.3, ((log.loadDurationMs || 0) / (now - rangeStart)) * 100)}%`,
                    height: '100%',
                    background: STATUS_COLOR[log.status] || '#d9d9d9',
                    opacity: 0.7,
                    borderRadius: 2,
                    cursor: 'pointer',
                  }}
                />
              </Tooltip>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 8, display: 'flex', gap: 16 }}>
        <Space size={4}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#52c41a' }} /><Text style={{ fontSize: 11 }}>Success</Text></Space>
        <Space size={4}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#ff4d4f' }} /><Text style={{ fontSize: 11 }}>Failed</Text></Space>
        <Space size={4}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#1677ff' }} /><Text style={{ fontSize: 11 }}>Running</Text></Space>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Events table
// -------------------------------------------------------
function EventsTable({ logs }) {
  const columns = [
    {
      title: 'Event',
      key: 'event',
      render: (_, r) => {
        if (r.status === 'SUCCESS') return <Space><CheckCircleOutlined style={{ color: '#52c41a' }} /><Text style={{ color: '#52c41a' }}>Successful sync</Text></Space>;
        if (r.status === 'FAILED')  return <Space><CloseCircleOutlined style={{ color: '#ff4d4f' }} /><Text style={{ color: '#ff4d4f' }}>Failed sync</Text></Space>;
        return <Space><ClockCircleOutlined style={{ color: '#1677ff' }} /><Text>Running</Text></Space>;
      },
    },
    {
      title: 'Start Time',
      dataIndex: 'startedAt',
      key: 'startedAt',
      render: (v) => <Text style={{ fontSize: 13 }}>{fmtDatetime(v)}</Text>,
    },
    {
      title: 'End Time',
      dataIndex: 'finishedAt',
      key: 'finishedAt',
      render: (v) => <Text style={{ fontSize: 13 }}>{fmtDatetime(v)}</Text>,
    },
    {
      title: 'Sync Duration',
      key: 'duration',
      render: (_, r) => {
        if (!r.finishedAt) return <Tag color="processing">Running</Tag>;
        const ms = new Date(r.finishedAt) - new Date(r.startedAt);
        return <Text strong>{fmtDuration(ms)}</Text>;
      },
    },
    {
      title: 'Extract',
      dataIndex: 'extractDurationMs',
      key: 'extract',
      render: (v) => <Text>{fmtDuration(v)}</Text>,
    },
    {
      title: 'Load',
      dataIndex: 'loadDurationMs',
      key: 'load',
      render: (v) => <Text>{fmtDuration(v)}</Text>,
    },
    {
      title: 'Loaded Rows',
      dataIndex: 'rowsSynced',
      key: 'rowsSynced',
      render: (v) => <Text>{v ?? 0}</Text>,
    },
    {
      title: 'Triggered By',
      dataIndex: 'triggeredBy',
      key: 'triggeredBy',
      render: (v) => <Tag>{v || 'admin'}</Tag>,
    },
  ];

  // Group by date
  const grouped = logs.reduce((acc, log) => {
    const date = new Date(log.startedAt).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {});

  return (
    <>
      {Object.entries(grouped).map(([date, rows]) => (
        <div key={date} style={{ marginBottom: 24 }}>
          <div style={{ background: '#f5f5f5', padding: '6px 12px', borderRadius: 4, marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>{date}</Text>
          </div>
          <Table
            columns={columns}
            dataSource={rows}
            rowKey="id"
            pagination={false}
            size="small"
            showHeader={true}
          />
        </div>
      ))}
    </>
  );
}

// -------------------------------------------------------
// Main SyncDetail page
// -------------------------------------------------------
export default function SyncDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [job, setJob]         = useState(null);
  const [stats, setStats]     = useState(null);
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [rangeIdx, setRangeIdx] = useState(1);  // default 1 Day

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [jobRes, statsRes, logsRes] = await Promise.all([
        getSync(id), getSyncStats(id), getSyncLogs(id),
      ]);
      setJob(jobRes.data);
      setStats(statsRes.data);
      setLogs(logsRes.data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleRun = async () => {
    setRunning(true);
    try {
      await runSync(id);
      message.success('Sync started');
      setTimeout(load, 1500);
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to start sync');
    } finally {
      setRunning(false);
    }
  };

  const handleToggle = async () => {
    const updated = await toggleSync(id);
    setJob(updated.data);
    setStats((s) => ({ ...s, enabled: updated.data.enabled }));
    message.success(updated.data.enabled ? 'Job enabled' : 'Job disabled');
  };

  const handleScheduleChange = async (val) => {
    const updated = await updateSchedule(id, val);
    setJob(updated.data);
    setStats((s) => ({ ...s, scheduleType: val, nextRunAt: updated.data.nextRunAt }));
    message.success('Schedule updated');
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  if (!job) return <Alert type="error" message="Sync job not found" />;

  const scheduleLabel = SCHEDULE_OPTIONS.find((o) => o.value === job.scheduleType)?.label || 'Manual only';
  const sourceType  = job.connection?.type === 'QUICKBOOKS' ? '🟢 QuickBooks' : '🐬 MySQL';
  const destType    = job.destination?.type === 'AZURE_SQL' ? '🔷 Azure SQL' : job.destination?.type === 'AZURE_BLOB' ? '☁️ Azure Blob' : '🐬 MySQL Cloud';

  const avgMs = stats?.avgDurationSecs ? stats.avgDurationSecs * 1000 : null;

  const statusBadge = job.enabled
    ? <Badge status="success" text="Active" />
    : <Badge status="default" text="Disabled" />;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Breadcrumb items={[
          { title: <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/syncs')} style={{ padding: 0 }}>Sync Jobs</Button> },
          { title: job.name },
        ]} />
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 16, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>{job.name}</Title>
          <Space style={{ marginTop: 4 }}>
            <Text type="secondary">{sourceType} — {job.connection?.name}</Text>
            <Text type="secondary">→</Text>
            <Text type="secondary">{destType} — {job.destination?.name}</Text>
          </Space>
        </div>

        <Space wrap>
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {job.enabled ? scheduleLabel : 'Disabled'}
            </Text>
            {statusBadge}
          </Space>
          <Switch
            checked={job.enabled}
            onChange={handleToggle}
            checkedChildren="Enabled"
            unCheckedChildren="Disabled"
          />
          <Select
            value={job.scheduleType}
            options={SCHEDULE_OPTIONS}
            onChange={handleScheduleChange}
            style={{ width: 150 }}
            size="small"
          />
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={running}
            disabled={!job.enabled || job.status === 'RUNNING'}
            onClick={handleRun}
          >
            Sync Now
          </Button>
          <Button icon={<ReloadOutlined />} onClick={load} size="small" />
        </Space>
      </div>

      <Tabs
        defaultActiveKey="status"
        items={[
          {
            key: 'status',
            label: 'Status',
            children: (
              <div>
                {/* Stat Cards */}
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                  <Col xs={12} sm={6}>
                    <Card size="small">
                      <Statistic
                        title="Last Synced"
                        value={stats?.lastRunAt ? new Date(stats.lastRunAt).toLocaleString() : 'Never'}
                        valueStyle={{ fontSize: 14 }}
                      />
                    </Card>
                  </Col>
                  <Col xs={12} sm={6}>
                    <Card size="small">
                      <Statistic
                        title="Avg Sync Duration (14d)"
                        value={avgMs ? fmtDuration(avgMs) : '—'}
                        valueStyle={{ fontSize: 14 }}
                      />
                    </Card>
                  </Col>
                  <Col xs={12} sm={6}>
                    <Card size="small">
                      <Statistic
                        title="Sync Frequency"
                        value={scheduleLabel}
                        valueStyle={{ fontSize: 14 }}
                      />
                    </Card>
                  </Col>
                  <Col xs={12} sm={6}>
                    <Card size="small">
                      <Row gutter={8}>
                        <Col span={8}>
                          <Statistic title="Total" value={stats?.totalRuns ?? 0} valueStyle={{ fontSize: 16 }} />
                        </Col>
                        <Col span={8}>
                          <Statistic title="OK" value={stats?.successCount ?? 0} valueStyle={{ fontSize: 16, color: '#52c41a' }} />
                        </Col>
                        <Col span={8}>
                          <Statistic title="Fail" value={stats?.failedCount ?? 0} valueStyle={{ fontSize: 16, color: '#ff4d4f' }} />
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                </Row>

                {/* Next run info */}
                {stats?.nextRunAt && job.enabled && (
                  <Alert
                    type="info"
                    showIcon
                    message={`Next scheduled run: ${new Date(stats.nextRunAt).toLocaleString()}`}
                    style={{ marginBottom: 16 }}
                  />
                )}

                {/* Timeline range selector */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text strong>Sync Activity</Text>
                  <Space>
                    {TIME_RANGES.map((r, i) => (
                      <Button
                        key={r.label}
                        size="small"
                        type={rangeIdx === i ? 'primary' : 'default'}
                        onClick={() => setRangeIdx(i)}
                      >
                        {r.label}
                      </Button>
                    ))}
                  </Space>
                </div>

                <SyncTimeline logs={logs} rangeHours={TIME_RANGES[rangeIdx].hours} />

                {/* Events table */}
                <Text strong style={{ display: 'block', marginBottom: 12 }}>Run History</Text>
                {logs.length === 0 ? (
                  <Alert type="info" message="No sync runs yet. Click 'Sync Now' to start." />
                ) : (
                  <EventsTable logs={logs} />
                )}
              </div>
            ),
          },
          {
            key: 'logs',
            label: 'Logs',
            children: (
              <Table
                dataSource={logs}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 20 }}
                columns={[
                  { title: 'ID',      dataIndex: 'id',          key: 'id',     width: 60 },
                  { title: 'Status',  dataIndex: 'status',      key: 'status', render: (s) => <Tag color={s === 'SUCCESS' ? 'green' : s === 'FAILED' ? 'red' : 'blue'}>{s}</Tag> },
                  { title: 'Started', dataIndex: 'startedAt',   key: 'start',  render: fmtDatetime },
                  { title: 'Ended',   dataIndex: 'finishedAt',  key: 'end',    render: fmtDatetime },
                  { title: 'Rows',    dataIndex: 'rowsSynced',  key: 'rows' },
                  { title: 'Extract', dataIndex: 'extractDurationMs', key: 'ext', render: fmtDuration },
                  { title: 'Load',    dataIndex: 'loadDurationMs',    key: 'load', render: fmtDuration },
                  { title: 'By',      dataIndex: 'triggeredBy', key: 'by',     render: (v) => <Tag>{v}</Tag> },
                  { title: 'Error',   dataIndex: 'errorMessage', key: 'err',   render: (v) => v ? <Text type="danger" style={{ fontSize: 12 }}>{v}</Text> : '—' },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
