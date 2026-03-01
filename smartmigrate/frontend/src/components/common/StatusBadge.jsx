import React from 'react';
import { Badge, Tag } from 'antd';

const STATUS_MAP = {
  ACTIVE:   { color: 'success',   text: 'Active' },
  PENDING:  { color: 'processing', text: 'Pending' },
  ERROR:    { color: 'error',     text: 'Error' },
  IDLE:     { color: 'default',   text: 'Idle' },
  RUNNING:  { color: 'processing', text: 'Running' },
  SUCCESS:  { color: 'success',   text: 'Success' },
  FAILED:   { color: 'error',     text: 'Failed' },
};

export default function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || { color: 'default', text: status };
  return <Badge status={s.color} text={s.text} />;
}

export function StatusTag({ status }) {
  const colorMap = {
    ACTIVE: 'green', PENDING: 'blue', ERROR: 'red',
    IDLE: 'default', RUNNING: 'processing', SUCCESS: 'green', FAILED: 'red',
  };
  return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
}
