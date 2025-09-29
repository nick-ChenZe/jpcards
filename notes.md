# 共享类型与 Monorepo 设计说明

为实现前后端共享 TypeScript 类型（例如 Card），本项目调整为 npm workspaces 的 monorepo 结构，并新增共享类型包。

## 根目录
- package.json（启用 workspaces：包含 backend、frontend、packages/*）

## 共享类型包
- packages/types
  - package.json（name: @jpcards/types）
  - index.d.ts（导出 Difficulty、Card、CardCreate）

## 前后端接入方式
- 前端：在 tsconfig.app.json 中通过 paths 映射 "@jpcards/types" -> "../packages/types"，组件直接 `import type { Card } from '@jpcards/types'`。
- 后端：在 tsconfig.json 增加 typeRoots 指向 "../packages/types"，路由中 `import type { Card } from '@jpcards/types'` 或直接指向 d.ts 文件。

## 约定
- Card 的难度枚举 Difficulty：'Easy' | 'Normal' | 'Hard'
- 新增卡片时可选 difficulty，后端默认值为 'Normal'，与数据库 CHECK 约束一致。

这样可以确保前后端在类型层面保持一致，避免接口演进时的类型偏差。