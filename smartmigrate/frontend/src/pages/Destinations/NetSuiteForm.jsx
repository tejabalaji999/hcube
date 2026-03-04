import React from 'react';
import { Form, Input, Button, Space, Alert } from 'antd';

export default function NetSuiteForm({ initialValues, onSave, onCancel }) {
  const [form] = Form.useForm();

  React.useEffect(() => {
    if (initialValues) {
      form.setFieldsValue({
        name:           initialValues.name,
        accountUrl:     initialValues.config?.accountUrl     || '',
        consumerKey:    initialValues.config?.consumerKey    || '',
        consumerSecret: initialValues.config?.consumerSecret || '',
        accessToken:    initialValues.config?.accessToken    || '',
        tokenSecret:    initialValues.config?.tokenSecret    || '',
      });
    }
  }, [initialValues, form]);

  const handleFinish = (values) => {
    onSave({
      name: values.name,
      config: {
        accountUrl:     values.accountUrl.trim(),
        consumerKey:    values.consumerKey.trim(),
        consumerSecret: values.consumerSecret.trim(),
        accessToken:    values.accessToken.trim(),
        tokenSecret:    values.tokenSecret.trim(),
      },
    });
  };

  return (
    <Form form={form} layout="vertical" onFinish={handleFinish}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="NetSuite TBA (Token-Based Authentication)"
        description={
          <span>
            Generate credentials in NetSuite under&nbsp;
            <b>Setup → Integration → Manage Integrations</b>&nbsp;
            and&nbsp;
            <b>Setup → Users/Roles → Access Tokens</b>.
            The account URL format is&nbsp;
            <code>https://&lt;accountId&gt;.suitetalk.api.netsuite.com</code>
          </span>
        }
      />

      <Form.Item
        label="Connection Name"
        name="name"
        rules={[{ required: true, message: 'Please enter a connection name' }]}
      >
        <Input placeholder="e.g. NetSuite Production" />
      </Form.Item>

      <Form.Item
        label="Account URL"
        name="accountUrl"
        rules={[{ required: true, message: 'Please enter the NetSuite account URL' }]}
      >
        <Input placeholder="https://3355888-sb1.suitetalk.api.netsuite.com" />
      </Form.Item>

      <Form.Item
        label="Consumer Key"
        name="consumerKey"
        rules={[{ required: true, message: 'Required' }]}
      >
        <Input.Password
          placeholder="Consumer key from NetSuite integration record"
          visibilityToggle
        />
      </Form.Item>

      <Form.Item
        label="Consumer Secret"
        name="consumerSecret"
        rules={[{ required: true, message: 'Required' }]}
      >
        <Input.Password
          placeholder="Consumer secret from NetSuite integration record"
          visibilityToggle
        />
      </Form.Item>

      <Form.Item
        label="Access Token"
        name="accessToken"
        rules={[{ required: true, message: 'Required' }]}
      >
        <Input.Password
          placeholder="Token ID from NetSuite access token record"
          visibilityToggle
        />
      </Form.Item>

      <Form.Item
        label="Token Secret"
        name="tokenSecret"
        rules={[{ required: true, message: 'Required' }]}
      >
        <Input.Password
          placeholder="Token secret from NetSuite access token record"
          visibilityToggle
        />
      </Form.Item>

      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" htmlType="submit">Save</Button>
      </Space>
    </Form>
  );
}
