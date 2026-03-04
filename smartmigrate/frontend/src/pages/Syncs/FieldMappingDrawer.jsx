import React, { useState, useEffect, useMemo } from 'react';
import {
  Drawer, Table, Select, Button, Space, Tag, Typography,
  Tooltip, message, InputNumber, Form, Divider,
} from 'antd';
import {
  ThunderboltOutlined, ClearOutlined,
} from '@ant-design/icons';
import { updateSyncConfig } from '../../api/syncs';

const { Text } = Typography;

// ── Static field catalogs ─────────────────────────────────────────────────────

const QB_FIELDS_BY_ENTITY = {
  Customer: [
    'Id', 'DisplayName', 'GivenName', 'MiddleName', 'FamilyName',
    'CompanyName', 'PrintOnCheckName', 'Active',
    'PrimaryEmailAddr', 'PrimaryPhone', 'AlternatePhone', 'Mobile', 'Fax',
    'BillAddr', 'ShipAddr', 'Notes', 'Balance',
  ],
  Invoice: [
    'Id', 'DocNumber', 'TxnDate', 'DueDate', 'TotalAmt', 'Balance',
    'CustomerRef', 'BillEmail', 'CustomerMemo', 'PrivateNote',
    'BillAddr', 'ShipAddr',
  ],
  Vendor: [
    'Id', 'DisplayName', 'GivenName', 'FamilyName', 'CompanyName',
    'PrimaryEmailAddr', 'PrimaryPhone', 'Mobile', 'Fax',
    'BillAddr', 'TaxIdentifier', 'AcctNum',
  ],
  Payment: [
    'Id', 'TxnDate', 'TotalAmt', 'CustomerRef', 'DepositToAccountRef',
    'Memo', 'PaymentMethodRef',
  ],
  Account: [
    'Id', 'Name', 'AccountType', 'AccountSubType', 'Classification',
    'CurrencyRef', 'CurrentBalance', 'Description', 'Active',
  ],
  Item: [
    'Id', 'Name', 'Type', 'Description', 'Active',
    'UnitPrice', 'PurchaseCost', 'QtyOnHand', 'TrackQtyOnHand',
    'IncomeAccountRef', 'ExpenseAccountRef',
  ],
  Employee: [
    'Id', 'DisplayName', 'GivenName', 'MiddleName', 'FamilyName',
    'PrintOnCheckName', 'Active', 'PrimaryEmailAddr', 'PrimaryPhone',
    'Mobile', 'PrimaryAddr', 'HiredDate', 'ReleasedDate',
    'Gender', 'BillableTime', 'BillRate',
  ],
};

const NS_FIELDS_BY_OBJECT = {
  customer: [
    { value: 'companyName',    label: 'Company Name' },
    { value: 'firstName',      label: 'First Name' },
    { value: 'lastName',       label: 'Last Name' },
    { value: 'middleName',     label: 'Middle Name' },
    { value: 'salutation',     label: 'Salutation' },
    { value: 'email',          label: 'Email' },
    { value: 'altEmail',       label: 'Alt Email' },
    { value: 'phone',          label: 'Phone' },
    { value: 'altPhone',       label: 'Alt Phone' },
    { value: 'fax',            label: 'Fax' },
    { value: 'mobilePhone',    label: 'Mobile Phone' },
    { value: 'addr1',          label: 'Address Line 1' },
    { value: 'addr2',          label: 'Address Line 2' },
    { value: 'city',           label: 'City' },
    { value: 'state',          label: 'State / Province' },
    { value: 'zip',            label: 'Postal Code' },
    { value: 'country',        label: 'Country' },
    { value: 'comments',       label: 'Comments / Notes' },
    { value: 'isPerson',       label: 'Is Person (Individual)' },
  ],
  vendor: [
    { value: 'companyName',    label: 'Company Name' },
    { value: 'firstName',      label: 'First Name' },
    { value: 'lastName',       label: 'Last Name' },
    { value: 'email',          label: 'Email' },
    { value: 'phone',          label: 'Phone' },
    { value: 'fax',            label: 'Fax' },
    { value: 'addr1',          label: 'Address Line 1' },
    { value: 'city',           label: 'City' },
    { value: 'state',          label: 'State' },
    { value: 'zip',            label: 'Postal Code' },
    { value: 'comments',       label: 'Comments' },
    { value: 'taxIdNum',       label: 'Tax ID' },
    { value: 'acctNumber',     label: 'Account Number' },
  ],
  employee: [
    { value: 'firstName',      label: 'First Name' },
    { value: 'middleName',     label: 'Middle Name' },
    { value: 'lastName',       label: 'Last Name' },
    { value: 'salutation',     label: 'Salutation' },
    { value: 'initials',       label: 'Initials' },
    { value: 'email',          label: 'Email' },
    { value: 'phone',          label: 'Phone' },
    { value: 'mobilePhone',    label: 'Mobile Phone' },
    { value: 'addr1',          label: 'Address Line 1' },
    { value: 'city',           label: 'City' },
    { value: 'state',          label: 'State / Province' },
    { value: 'zip',            label: 'Postal Code' },
    { value: 'country',        label: 'Country' },
    { value: 'hireDate',       label: 'Hire Date' },
    { value: 'releaseDate',    label: 'Release Date' },
    { value: 'gender',         label: 'Gender' },
    { value: 'comments',       label: 'Comments / Notes' },
    { value: 'billableTime',   label: 'Billable Time' },
    { value: 'billingRate',    label: 'Billing Rate' },
  ],
};

// ── Default auto-mappings per QB entity ──────────────────────────────────────

const AUTO_MAP_DEFAULTS = {
  Customer: {
    GivenName:        'firstName',
    MiddleName:       'middleName',
    FamilyName:       'lastName',
    CompanyName:      'companyName',
    DisplayName:      'companyName',
    PrimaryEmailAddr: 'email',
    PrimaryPhone:     'phone',
    AlternatePhone:   'altPhone',
    Mobile:           'mobilePhone',
    Fax:              'fax',
    Notes:            'comments',
  },
  Vendor: {
    GivenName:        'firstName',
    FamilyName:       'lastName',
    CompanyName:      'companyName',
    DisplayName:      'companyName',
    PrimaryEmailAddr: 'email',
    PrimaryPhone:     'phone',
    Fax:              'fax',
    Notes:            'comments',
    TaxIdentifier:    'taxIdNum',
    AcctNum:          'acctNumber',
  },
  Employee: {
    GivenName:        'firstName',
    MiddleName:       'middleName',
    FamilyName:       'lastName',
    PrimaryEmailAddr: 'email',
    PrimaryPhone:     'phone',
    Mobile:           'mobilePhone',
    HiredDate:        'hireDate',
    ReleasedDate:     'releaseDate',
    Gender:           'gender',
    BillRate:         'billingRate',
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function FieldMappingDrawer({ job, open, onClose, onSaved }) {
  const [mappings,    setMappings]    = useState({});
  const [subsidiaryId, setSubsidiaryId] = useState(null);
  const [saving,      setSaving]      = useState(false);

  const sourceEntity    = job?.config?.sourceEntity    || 'Customer';
  const destinationObj  = job?.config?.destinationObject || 'customer';

  const qbFields  = QB_FIELDS_BY_ENTITY[sourceEntity]   || [];
  const nsOptions = NS_FIELDS_BY_OBJECT[destinationObj] || [];

  // Load saved config when drawer opens
  useEffect(() => {
    if (open && job) {
      setMappings(job.config?.fieldMappings || {});
      setSubsidiaryId(job.config?.subsidiaryId ?? null);
    }
  }, [open, job]);

  // Mapped count for summary tag
  const mappedCount = useMemo(
    () => Object.values(mappings).filter(v => v && v.trim()).length,
    [mappings],
  );

  const setField = (qbField, nsField) =>
    setMappings(prev => ({ ...prev, [qbField]: nsField || '' }));

  const handleAutoMap = () => {
    const defaults = AUTO_MAP_DEFAULTS[sourceEntity] || {};
    const auto = {};
    qbFields.forEach(f => { if (defaults[f]) auto[f] = defaults[f]; });
    setMappings(auto);
    message.success('Auto-mapped ' + Object.keys(auto).length + ' fields');
  };

  const handleClear = () => setMappings({});

  const handleSave = async () => {
    if (!subsidiaryId) {
      message.error('Subsidiary ID is required for NetSuite.');
      return;
    }
    // Only persist non-empty mappings
    const clean = Object.fromEntries(
      Object.entries(mappings).filter(([, v]) => v && v.trim()),
    );
    setSaving(true);
    try {
      await updateSyncConfig(job.id, {
        ...job.config,
        subsidiaryId,
        fieldMappings: clean,
      });
      onSaved();
      onClose();
    } catch {
      message.error('Failed to save mappings.');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: (
        <Space>
          <span>QuickBooks</span>
          <Tag color="green" style={{ fontSize: 11 }}>{sourceEntity}</Tag>
        </Space>
      ),
      dataIndex: 'qbField',
      width: '45%',
      render: (field) => (
        <Text style={{ fontFamily: 'monospace', fontSize: 13 }}>{field}</Text>
      ),
    },
    {
      title: '→',
      width: 32,
      align: 'center',
      render: () => <Text type="secondary">→</Text>,
    },
    {
      title: (
        <Space>
          <span>NetSuite</span>
          <Tag color="purple" style={{ fontSize: 11 }}>{destinationObj}</Tag>
        </Space>
      ),
      dataIndex: 'qbField',
      width: '55%',
      render: (field) => (
        <Select
          allowClear
          size="small"
          placeholder="— not mapped —"
          style={{ width: '100%' }}
          value={mappings[field] || undefined}
          onChange={(val) => setField(field, val)}
          options={nsOptions.map(o => ({ value: o.value, label: `${o.label} (${o.value})` }))}
          showSearch
          filterOption={(input, option) =>
            option.label.toLowerCase().includes(input.toLowerCase())
          }
        />
      ),
    },
  ];

  const tableData = qbFields.map(f => ({ key: f, qbField: f }));

  return (
    <Drawer
      title={
        <Space>
          <span>Field Mapping</span>
          <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
            {job?.name}
          </Text>
        </Space>
      }
      open={open}
      onClose={onClose}
      width="70vw"
      styles={{ body: { padding: '0', display: 'flex', flexDirection: 'column' } }}
      footer={
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space>
            <Tag color="blue">{mappedCount} / {qbFields.length} fields mapped</Tag>
          </Space>
          <Space>
            <Tooltip title="Fill in suggested mappings based on common field names">
              <Button icon={<ThunderboltOutlined />} onClick={handleAutoMap}>Auto-Map</Button>
            </Tooltip>
            <Button icon={<ClearOutlined />} onClick={handleClear}>Clear All</Button>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>
              Save Mappings
            </Button>
          </Space>
        </Space>
      }
    >
      {/* Info strip */}
      <div style={{
        padding: '10px 16px',
        background: '#fafafa',
        borderBottom: '1px solid #f0f0f0',
        flexShrink: 0,
        fontSize: 12,
        color: '#666',
      }}>
        Map each QuickBooks <b>{sourceEntity}</b> field to a NetSuite&nbsp;
        <b>{destinationObj}</b> field. Unmapped fields are discarded.
        Click <b>Auto-Map</b> to apply suggested defaults, then fine-tune as needed.
      </div>

      {/* Subsidiary ID */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #f0f0f0',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap' }}>
          Subsidiary ID
          <span style={{ color: '#ff4d4f', marginLeft: 2 }}>*</span>
        </span>
        <Tooltip title="The internal NetSuite Subsidiary ID. Find it in Setup → Company → Subsidiaries.">
          <InputNumber
            min={1}
            style={{ width: 140 }}
            placeholder="e.g. 1"
            value={subsidiaryId}
            onChange={setSubsidiaryId}
            status={!subsidiaryId ? 'error' : ''}
          />
        </Tooltip>
        {!subsidiaryId && (
          <span style={{ color: '#ff4d4f', fontSize: 12 }}>
            Required — mandatory for all NetSuite POST requests
          </span>
        )}
      </div>

      {/* Mapping table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
        <Table
          size="small"
          pagination={false}
          columns={columns}
          dataSource={tableData}
          style={{ fontSize: 13 }}
        />
      </div>
    </Drawer>
  );
}
