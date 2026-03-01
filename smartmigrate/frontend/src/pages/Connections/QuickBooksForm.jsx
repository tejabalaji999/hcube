import React from 'react';
import { Form, Input, Select, Button, Divider, Alert, Space, Typography } from 'antd';
import { LinkOutlined } from '@ant-design/icons';

const { Text } = Typography;

export default function QuickBooksForm({ initialValues, onSave, onCancel }) {
  const [form] = Form.useForm();
  const cfg = initialValues?.config || {};

  const onFinish = (values) => {
    onSave({
      name: values.name,
      config: {
        clientId: values.clientId,
        clientSecret: values.clientSecret,
        environment: values.environment,
        entities: values.entities,
        realmId: cfg.realmId || '',
        accessToken: cfg.accessToken || '',
        refreshToken: cfg.refreshToken || '',
      },
    });
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

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onFinish}
      initialValues={{
        name: initialValues?.name || '',
        clientId: cfg.clientId || '',
        clientSecret: cfg.clientSecret || '',
        environment: cfg.environment || 'sandbox',
        entities: cfg.entities || ['Invoice', 'Customer', 'Account'],
      }}
    >
      <Form.Item label="Connection Name" name="name" rules={[{ required: true }]}>
        <Input placeholder="e.g. My QuickBooks Company" />
      </Form.Item>

      <Divider orientation="left" plain>OAuth App Credentials</Divider>

      <Alert
        type="info"
        showIcon
        message="Get these from your Intuit Developer account at developer.intuit.com"
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
          { value: 'sandbox', label: 'Sandbox (Testing)' },
          { value: 'production', label: 'Production' },
        ]} />
      </Form.Item>

      <Divider orientation="left" plain>Data to Sync</Divider>

      <Form.Item label="Entities" name="entities">
        <Select
          mode="multiple"
          options={[
            { value: 'Invoice', label: 'Invoices' },
            { value: 'Customer', label: 'Customers' },
            { value: 'Account', label: 'Accounts' },
            { value: 'Vendor', label: 'Vendors' },
            { value: 'Bill', label: 'Bills' },
            { value: 'Payment', label: 'Payments' },
            { value: 'Item', label: 'Items' },
          ]}
          placeholder="Select entities to sync"
        />
      </Form.Item>

      {initialValues?.id && (
        <>
          <Divider orientation="left" plain>OAuth Authorization</Divider>
          <div style={{ marginBottom: 16 }}>
            {cfg.accessToken ? (
              <Text type="success">✓ Connected to QuickBooks (Realm: {cfg.realmId})</Text>
            ) : (
              <Text type="warning">Not yet authorized. Click below to connect.</Text>
            )}
          </div>
          <Button icon={<LinkOutlined />} onClick={handleOAuth} style={{ marginBottom: 16 }} block>
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
