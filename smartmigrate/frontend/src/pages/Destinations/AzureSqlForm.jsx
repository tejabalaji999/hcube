import React from 'react';
import { Form, Input, InputNumber, Button, Divider, Space } from 'antd';

export default function AzureSqlForm({ initialValues, onSave, onCancel }) {
  const [form] = Form.useForm();
  const cfg = initialValues?.config || {};

  const onFinish = (values) => {
    onSave({
      name: values.name,
      config: {
        server: values.server,
        port: values.port,
        database: values.database,
        username: values.username,
        password: values.password,
        schema: values.schema,
      },
    });
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onFinish}
      initialValues={{
        name: initialValues?.name || '',
        server: cfg.server || '',
        port: cfg.port || 1433,
        database: cfg.database || '',
        username: cfg.username || '',
        password: cfg.password || '',
        schema: cfg.schema || 'dbo',
      }}
    >
      <Form.Item label="Destination Name" name="name" rules={[{ required: true }]}>
        <Input placeholder="e.g. Azure SQL Warehouse" />
      </Form.Item>

      <Divider orientation="left" plain>Azure SQL Server</Divider>

      <Form.Item label="Server" name="server" rules={[{ required: true }]}
        help="e.g. myserver.database.windows.net">
        <Input placeholder="yourserver.database.windows.net" />
      </Form.Item>

      <Form.Item label="Port" name="port" rules={[{ required: true }]}>
        <InputNumber min={1} max={65535} style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item label="Database Name" name="database" rules={[{ required: true }]}>
        <Input placeholder="my_database" />
      </Form.Item>

      <Form.Item label="Username" name="username" rules={[{ required: true }]}>
        <Input placeholder="Database username" />
      </Form.Item>

      <Form.Item label="Password" name="password" rules={[{ required: true }]}>
        <Input.Password placeholder="Database password" />
      </Form.Item>

      <Form.Item label="Schema" name="schema">
        <Input placeholder="dbo" />
      </Form.Item>

      <Divider />
      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" htmlType="submit">Save Destination</Button>
      </Space>
    </Form>
  );
}
