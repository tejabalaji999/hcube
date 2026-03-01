import React from 'react';
import { Form, Input, Button, Divider, Space, Select } from 'antd';

export default function AzureBlobForm({ initialValues, onSave, onCancel }) {
  const [form] = Form.useForm();
  const cfg = initialValues?.config || {};

  const onFinish = (values) => {
    onSave({
      name: values.name,
      config: {
        accountName: values.accountName,
        accountKey: values.accountKey,
        containerName: values.containerName,
        directoryPath: values.directoryPath,
        format: values.format,
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
        accountName: cfg.accountName || '',
        accountKey: cfg.accountKey || '',
        containerName: cfg.containerName || '',
        directoryPath: cfg.directoryPath || 'smartmigrate',
        format: cfg.format || 'CSV',
      }}
    >
      <Form.Item label="Destination Name" name="name" rules={[{ required: true }]}>
        <Input placeholder="e.g. Azure Data Lake" />
      </Form.Item>

      <Divider orientation="left" plain>Storage Account</Divider>

      <Form.Item label="Storage Account Name" name="accountName" rules={[{ required: true }]}>
        <Input placeholder="mystorageaccount" />
      </Form.Item>

      <Form.Item label="Account Key" name="accountKey" rules={[{ required: true }]}>
        <Input.Password placeholder="Storage account access key" />
      </Form.Item>

      <Form.Item label="Container Name" name="containerName" rules={[{ required: true }]}>
        <Input placeholder="my-container" />
      </Form.Item>

      <Divider orientation="left" plain>Output Settings</Divider>

      <Form.Item label="Directory Path" name="directoryPath">
        <Input placeholder="smartmigrate/data" />
      </Form.Item>

      <Form.Item label="File Format" name="format">
        <Select options={[
          { value: 'CSV',  label: 'CSV (.csv)' },
          { value: 'JSON', label: 'JSON (.json)' },
        ]} />
      </Form.Item>

      <Divider />
      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" htmlType="submit">Save Destination</Button>
      </Space>
    </Form>
  );
}
