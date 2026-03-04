import React, { useState } from 'react';
import {
  Form, Input, Select, Button, Divider, Alert, Space,
  Typography, Segmented, Tag,
} from 'antd';
import { LinkOutlined, KeyOutlined, ApiOutlined } from '@ant-design/icons';

const { Text } = Typography;

const ENTITY_OPTIONS = [
  { value: 'Invoice',  label: 'Invoices' },
  { value: 'Customer', label: 'Customers' },
  { value: 'Account',  label: 'Accounts' },
  { value: 'Vendor',   label: 'Vendors' },
  { value: 'Bill',     label: 'Bills' },
  { value: 'Payment',  label: 'Payments' },
  { value: 'Item',     label: 'Items' },
  { value: 'Employee', label: 'Employees' },
];

export default function QuickBooksForm({ initialValues, onSave, onCancel }) {
  const [form] = Form.useForm();
  const cfg = initialValues?.config || {};

  // Detect saved mode, default to OAUTH
  const [authMode, setAuthMode] = useState(cfg.authMode || 'OAUTH');

  const onFinish = (values) => {
    const base = {
      name: values.name,
      config: {
        authMode,
        clientId:     values.clientId,
        clientSecret: values.clientSecret,
        environment:  values.environment,
        entities:     values.entities,
        realmId:      values.realmId || cfg.realmId || '',
      },
    };

    if (authMode === 'DIRECT_TOKEN') {
      base.config.refreshToken = values.refreshToken;
    } else {
      // Preserve any existing OAuth tokens
      base.config.accessToken  = cfg.accessToken  || '';
      base.config.refreshToken = cfg.refreshToken || '';
    }

    onSave(base);
  };

  const handleOAuth = () => {
    if (!initialValues?.id) {
      alert('Save the connection first, then click Connect to authorize via OAuth.');
      return;
    }
    window.open(
      `http://localhost:8080/api/oauth/quickbooks/authorize?connectionId=${initialValues.id}`,
      '_blank'
    );
  };

  const handleModeChange = (val) => {
    setAuthMode(val);
    form.resetFields(['refreshToken', 'realmId']);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onFinish}
      initialValues={{
        name:         initialValues?.name || '',
        clientId:     cfg.clientId     || '',
        clientSecret: cfg.clientSecret || '',
        environment:  cfg.environment  || 'sandbox',
        entities:     cfg.entities     || ['Invoice', 'Customer', 'Account'],
        realmId:      cfg.realmId      || '',
        refreshToken: cfg.refreshToken || '',
      }}
    >
      <Form.Item label="Connection Name" name="name" rules={[{ required: true }]}>
        <Input placeholder="e.g. My QuickBooks Company" />
      </Form.Item>

      {/* Auth mode toggle */}
      <Form.Item label="Authorization Mode">
        <Segmented
          value={authMode}
          onChange={handleModeChange}
          options={[
            {
              value: 'OAUTH',
              icon: <ApiOutlined />,
              label: 'OAuth Flow',
            },
            {
              value: 'DIRECT_TOKEN',
              icon: <KeyOutlined />,
              label: 'Direct Token',
            },
          ]}
          block
        />
        <div style={{ marginTop: 8 }}>
          {authMode === 'DIRECT_TOKEN' ? (
            <Alert
              type="success"
              showIcon
              message="Paste your existing refresh token — no browser redirect needed."
            />
          ) : (
            <Alert
              type="info"
              showIcon
              message="Redirects to Intuit to authorize. Requires a registered redirect URI."
            />
          )}
        </div>
      </Form.Item>

      <Divider orientation="left" plain>App Credentials</Divider>

      <Alert
        type="info"
        showIcon
        message={<>Get these from <Text strong>developer.intuit.com</Text> → Your App → Keys & OAuth</>}
        style={{ marginBottom: 16 }}
      />

      <Form.Item label="Client ID" name="clientId" rules={[{ required: true }]}>
        <Input placeholder="Intuit App Client ID" />
      </Form.Item>

      <Form.Item label="Client Secret" name="clientSecret" rules={[{ required: true }]}>
        <Input.Password placeholder="Intuit App Client Secret" />
      </Form.Item>

      <Form.Item label="Environment" name="environment">
        <Select options={[
          { value: 'sandbox',    label: 'Sandbox (Testing)' },
          { value: 'production', label: 'Production' },
        ]} />
      </Form.Item>

      {/* DIRECT TOKEN fields */}
      {authMode === 'DIRECT_TOKEN' && (
        <>
          <Divider orientation="left" plain>Token Details</Divider>

          <Form.Item
            label="Realm ID (Company ID)"
            name="realmId"
            rules={[{ required: true, message: 'Realm ID is required' }]}
            help="Found in the URL when logged into QuickBooks: qbo.intuit.com/app/homepage?companyId=XXXXXXX"
          >
            <Input placeholder="e.g. 9341454978631385" />
          </Form.Item>

          <Form.Item
            label="Refresh Token"
            name="refreshToken"
            rules={[{ required: true, message: 'Refresh Token is required' }]}
            help="Long-lived token (100 days). Used to obtain a fresh access token on every sync."
          >
            <Input.Password placeholder="Paste your QuickBooks refresh token" />
          </Form.Item>

          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="The refresh token expires after 100 days of inactivity. Each sync renews it automatically."
          />
        </>
      )}

      <Divider orientation="left" plain>Data to Sync</Divider>

      <Form.Item label="Entities" name="entities">
        <Select
          mode="multiple"
          options={ENTITY_OPTIONS}
          placeholder="Select QuickBooks entities to sync"
        />
      </Form.Item>

      {/* OAUTH flow section — only when editing a saved connection */}
      {authMode === 'OAUTH' && initialValues?.id && (
        <>
          <Divider orientation="left" plain>OAuth Authorization</Divider>
          <div style={{ marginBottom: 12 }}>
            {cfg.accessToken ? (
              <Space>
                <Tag color="success">Connected</Tag>
                <Text type="secondary">Realm: {cfg.realmId}</Text>
              </Space>
            ) : (
              <Text type="warning">Not yet authorized. Click below to connect.</Text>
            )}
          </div>
          <Button icon={<LinkOutlined />} onClick={handleOAuth} block style={{ marginBottom: 16 }}>
            {cfg.accessToken ? 'Re-authorize with QuickBooks' : 'Connect QuickBooks (OAuth)'}
          </Button>
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
