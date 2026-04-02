<!-- template: react-component -->
<!-- required: component_name -->
<!-- optional: props, hooks, style_type -->

# React 组件模板

以下是标准的 React 函数组件结构，Agent 根据项目上下文和用户需求填充具体实现。

## 组件结构

```tsx
import React from 'react';
// Agent 根据项目风格添加样式导入（CSS Modules / Tailwind / styled-components）

interface {{component_name}}Props {
  // Agent 根据 props 参数生成类型定义
}

export const {{component_name}}: React.FC<{{component_name}}Props> = (props) => {
  // Agent 根据需求生成 hooks 和逻辑

  return (
    <div>
      {/* Agent 生成 JSX 结构 */}
    </div>
  );
};
```

## 测试结构

```tsx
import { render, screen } from '@testing-library/react';
import { {{component_name}} } from './{{component_name}}';

describe('{{component_name}}', () => {
  it('should render correctly', () => {
    render(<{{component_name}} />);
    // Agent 生成具体断言
  });
});
```
