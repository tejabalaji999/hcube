import React from 'react';
import { Form, Input, InputNumber, Button, Divider, Space, Select } from 'antd';

export default function MySqlForm({ initialValues, onSave, onCancel }) {
  const [form] = Form.useForm();
  const cfg = initialValues?.config || {};

  const onFinish = (values) => {
    onSave({
      name: values.name,
      config: {
        host: values.host,
        port: values.port,
        database: values.database,
        username: values.username,
        password: values.password,
        tables: values.tables || [],
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
        host: cfg.host || 'localhost',
        port: cfg.port || 3306,
        database: cfg.database || '',
        username: cfg.username || '',
        password: cfg.password || '',
        tables: cfg.tables || [],
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

      <Divider orientation="left" plain>Tables to Sync</Divider>

      <Form.Item
        label="Tables"
        name="tables"
        help="Leave empty to sync all tables"
      >
        <Select
          mode="tags"
          placeholder="Type table names and press Enter (or leave empty for all)"
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Divider />
      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" htmlType="submit">Save Connection</Button>
      </Space>
    </Form>
  );
}
