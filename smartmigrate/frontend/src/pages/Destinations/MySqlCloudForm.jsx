import React from 'react';
import { Form, Input, InputNumber, Button, Divider, Space } from 'antd';

export default function MySqlCloudForm({ initialValues, onSave, onCancel }) {
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
        host: cfg.host || '',
        port: cfg.port || 3306,
        database: cfg.database || '',
        username: cfg.username || '',
        password: cfg.password || '',
        schema: cfg.schema || '',
      }}
    >
      <Form.Item label="Destination Name" name="name" rules={[{ required: true }]}>
        <Input placeholder="e.g. Azure MySQL Cloud" />
      </Form.Item>

      <Divider orientation="left" plain>MySQL Server</Divider>

      <Form.Item label="Host" name="host" rules={[{ required: true }]}
        help="e.g. myserver.mysql.database.azure.com">
        <Input placeholder="myserver.mysql.database.azure.com" />
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

      <Form.Item label="Target Schema / Database" name="schema"
        help="Leave blank to use the Database Name above">
        <Input placeholder="Optional — defaults to Database Name" />
      </Form.Item>

      <Divider />
      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" htmlType="submit">Save Destination</Button>
      </Space>
    </Form>
  );
}
