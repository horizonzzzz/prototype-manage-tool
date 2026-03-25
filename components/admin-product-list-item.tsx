'use client';

import React from 'react';
import { Button, List, Tag } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

import type { ProductListItem } from '@/lib/types';

type AdminProductListItemProps = {
  item: ProductListItem;
  selected: boolean;
  onSelect: (productKey: string) => void;
  onDelete: (item: ProductListItem) => void;
};

export function AdminProductListItem({ item, selected, onSelect, onDelete }: AdminProductListItemProps) {
  return (
    <List.Item
      className={`admin-product-list-item${selected ? ' is-selected' : ''}`}
      style={{ cursor: 'pointer' }}
      onClick={() => onSelect(item.key)}
    >
      <div className="admin-product-list-item-content">
        <div className="admin-product-list-item-main">
          <div className="admin-product-list-item-header">
            <div className="admin-product-list-item-title">
              <span className="admin-product-list-item-title-text" title={item.name}>
                {item.name}
              </span>
              <Tag className="admin-product-list-item-key-tag">{item.key}</Tag>
            </div>
            <div className="admin-product-list-item-actions">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(item);
                }}
              >
                删除
              </Button>
            </div>
          </div>
          <span className="admin-product-list-item-description">{item.publishedCount} 个已发布版本</span>
        </div>
      </div>
    </List.Item>
  );
}
