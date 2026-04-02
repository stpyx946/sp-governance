<!-- template: api-controller -->
<!-- required: entity_name, fields -->
<!-- optional: framework (express/nestjs/spring) -->

# API Controller 模板

Agent 根据项目框架（Express / NestJS / Spring Boot）和实体定义生成完整的 CRUD Controller。

## Express (Node.js) 结构

```typescript
import { Router, Request, Response } from 'express';
import { {{entity_name}}Service } from './{{entity_name}}.service';

const router = Router();

// GET /api/{{entity_name_lower}}s
router.get('/', async (req: Request, res: Response) => {
  // Agent 生成列表查询逻辑（分页、筛选）
});

// GET /api/{{entity_name_lower}}s/:id
router.get('/:id', async (req: Request, res: Response) => {
  // Agent 生成详情查询逻辑
});

// POST /api/{{entity_name_lower}}s
router.post('/', async (req: Request, res: Response) => {
  // Agent 生成创建逻辑（参数校验、业务处理）
});

// PUT /api/{{entity_name_lower}}s/:id
router.put('/:id', async (req: Request, res: Response) => {
  // Agent 生成更新逻辑
});

// DELETE /api/{{entity_name_lower}}s/:id
router.delete('/:id', async (req: Request, res: Response) => {
  // Agent 生成删除逻辑
});

export default router;
```

## DTO 结构

```typescript
// Agent 根据 fields 参数生成
export interface Create{{entity_name}}Dto {
  // {{fields}}
}

export interface Update{{entity_name}}Dto {
  // Partial<Create{{entity_name}}Dto>
}

export interface {{entity_name}}Response {
  id: string;
  // {{fields}}
  createdAt: Date;
  updatedAt: Date;
}
```

## Service 结构

```typescript
export class {{entity_name}}Service {
  async findAll(query: QueryParams): Promise<PaginatedResult<{{entity_name}}>> {}
  async findById(id: string): Promise<{{entity_name}} | null> {}
  async create(dto: Create{{entity_name}}Dto): Promise<{{entity_name}}> {}
  async update(id: string, dto: Update{{entity_name}}Dto): Promise<{{entity_name}}> {}
  async delete(id: string): Promise<void> {}
}
```
