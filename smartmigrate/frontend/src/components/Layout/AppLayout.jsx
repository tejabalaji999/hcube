import React, { useState } from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, theme } from 'antd';
import {
  ApiOutlined,
  DatabaseOutlined,
  SyncOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const { Header, Sider, Content } = Layout;

const SIDEBAR_BG      = '#0B1F35';
const ICON_COLOR      = '#FFFFFF';
const TEXT_COLOR      = '#D6E4FF';
const HOVER_BG        = '#1B365D';
const ACTIVE_BG       = '#2C5EA8';

const menuItems = [
  { key: '/connections',  icon: <ApiOutlined  style={{ color: ICON_COLOR }} />, label: 'Connections' },
  { key: '/destinations', icon: <DatabaseOutlined style={{ color: ICON_COLOR }} />, label: 'Destinations' },
  { key: '/syncs',        icon: <SyncOutlined style={{ color: ICON_COLOR }} />, label: 'Sync Jobs' },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate  = useNavigate();
  const location  = useLocation();
  const { logout } = useAuth();
  const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken();

  const userMenu = {
    items: [
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Logout',
        onClick: () => { logout(); navigate('/login'); },
      },
    ],
  };

  // Inline styles injected via a <style> tag to handle hover/active pseudo-states
  const sidebarCss = `
    .dt360-sider .ant-menu {
      background: transparent !important;
      border-inline-end: none !important;
    }
    .dt360-sider .ant-menu-item {
      color: ${TEXT_COLOR} !important;
      border-radius: 6px !important;
      margin: 2px 8px !important;
      width: calc(100% - 16px) !important;
      transition: background 0.2s ease !important;
    }
    .dt360-sider .ant-menu-item .ant-menu-item-icon,
    .dt360-sider .ant-menu-item .anticon {
      color: ${ICON_COLOR} !important;
      font-weight: bold !important;
    }
    .dt360-sider .ant-menu-item:hover {
      background: ${HOVER_BG} !important;
      color: ${TEXT_COLOR} !important;
    }
    .dt360-sider .ant-menu-item:hover .anticon {
      color: ${ICON_COLOR} !important;
    }
    .dt360-sider .ant-menu-item-selected {
      background: ${ACTIVE_BG} !important;
      color: #ffffff !important;
      font-weight: 650 !important;
    }
    .dt360-sider .ant-menu-item-selected .anticon {
      color: ${ICON_COLOR} !important;
    }
    .dt360-sider .ant-menu-inline-collapsed .ant-menu-item {
      margin: 2px auto !important;
    }
  `;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <style>{sidebarCss}</style>

      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        className="dt360-sider"
        style={{ background: SIDEBAR_BG }}
        width={220}
      >
        {/* Logo / app name */}
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 20px',
          fontSize: collapsed ? 20 : 18,
          fontWeight: 700,
          letterSpacing: 1,
          borderBottom: `1px solid rgba(255,255,255,0.1)`,
          gap: 10,
          color: TEXT_COLOR,
        }}>
          <SyncOutlined style={{ color: ICON_COLOR, fontSize: 22 }} />
          {!collapsed && 'DT360'}
        </div>

        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ marginTop: 8, background: 'transparent' }}
        />
      </Sider>

      <Layout>
        <Header style={{
          padding: '0 24px',
          background: colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,21,41,0.08)',
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16 }}
          />
          <Dropdown menu={userMenu} placement="bottomRight">
            <Avatar
              icon={<UserOutlined />}
              style={{ cursor: 'pointer', backgroundColor: '#1677ff' }}
            />
          </Dropdown>
        </Header>

        <Content style={{
          margin: '24px',
          padding: '24px',
          background: colorBgContainer,
          borderRadius: borderRadiusLG,
          minHeight: 'calc(100vh - 112px)',
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
