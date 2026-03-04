import React from 'react';
import {
  Form, Input, InputNumber, Button, Divider, Space, Switch, Alert, Row, Col,
} from 'antd';

export default function MsSqlForm({ initialValues, onSave, onCancel }) {
  const [form] = Form.useForm();
  const cfg = initialValues?.config || {};

  const onFinish = (values) => {
    onSave({
      name: values.name,
      config: {
        host:                  values.host,
        port:                  values.port,
        instance:              values.instance || '',
        database:              values.database,
        username:              values.username,
        password:              values.password,
        encrypt:               values.encrypt,
        trustServerCertificate: values.trustServerCertificate,
      },
    });
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onFinish}
      initialValues={{
        name:                   initialValues?.name  || '',
        host:                   cfg.host             || '',
        port:                   cfg.port             || 1433,
        instance:               cfg.instance         || '',
        database:               cfg.database         || '',
        username:               cfg.username         || '',
        password:               cfg.password         || '',
        encrypt:                cfg.encrypt          ?? false,
        trustServerCertificate: cfg.trustServerCertificate ?? true,
      }}
    >
      <Form.Item label="Connection Name" name="name" rules={[{ required: true }]}>
        <Input placeholder="e.g. On-Prem SQL Server" />
      </Form.Item>

      <Divider orientation="left" plain>Server</Divider>

      <Row gutter={12}>
        <Col span={16}>
          <Form.Item label="Host" name="host" rules={[{ required: true }]}>
            <Input placeholder="192.168.1.10 or server.domain.com" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="Port" name="port" rules={[{ required: true }]}>
            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        label="Named Instance"
        name="instance"
        help='Leave blank for default instance. e.g. "SQLEXPRESS" or "MSSQLSERVER"'
      >
        <Input placeholder="SQLEXPRESS  (optional)" />
      </Form.Item>

      <Form.Item label="Database" name="database" rules={[{ required: true }]}>
        <Input placeholder="MyDatabase" />
      </Form.Item>

      <Divider orientation="left" plain>Authentication</Divider>

      <Alert
        type="info"
        showIcon
        message="SQL Server Authentication only. Windows/NTLM integrated security is not supported."
        style={{ marginBottom: 16 }}
      />

      <Form.Item label="Username" name="username" rules={[{ required: true }]}>
        <Input placeholder="sa or db_user" />
      </Form.Item>

      <Form.Item label="Password" name="password" rules={[{ required: true }]}>
        <Input.Password placeholder="SQL Server password" />
      </Form.Item>

      <Divider orientation="left" plain>Encryption</Divider>

      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="Encrypt Connection"
            name="encrypt"
            valuePropName="checked"
            help="Enable SSL/TLS for the connection"
          >
            <Switch />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="Trust Server Certificate"
            name="trustServerCertificate"
            valuePropName="checked"
            help="Accept self-signed certificates (recommended for on-prem)"
          >
            <Switch />
          </Form.Item>
        </Col>
      </Row>

      {initialValues?.id && (
        <Alert
          type="info"
          showIcon
          message='Use the "Schema" button on the connection card to select tables and columns.'
          style={{ marginBottom: 12 }}
        />
      )}

      <Divider />
      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" htmlType="submit">Save Connection</Button>
      </Space>
    </Form>
  );
}
