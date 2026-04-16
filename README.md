# 内丰 ERP（前端）

Vue 3 + Vite + Pinia + Element Plus 的生产订单与流程管理前端，数据默认保存在浏览器本地（演示/联调用途）。

## 本地运行

```bash
npm install
npm run dev
```

## 生产构建

根路径部署：

```bash
npm run build
```

子路径部署（例如 Nginx `location /rich_full/`）需指定资源前缀：

```bash
npm run build:rich_full
```

或：

```bash
npm run build -- --base /你的子路径/
```

详见 `vite.config.js` 内注释。路由已使用 `import.meta.env.BASE_URL`。

## 默认登录（本地种子用户）

见 `src/stores/users.js` 中默认账号（如 `admin` / `admin123`），上线前请改为真实鉴权与密码策略。

## 项目开发文档

为便于后续二次开发，请优先阅读：

- `docs/DEVELOPMENT_GUIDE.md`

该文档包含：

- 各模块功能与代码位置说明
- 新增模块 / 新增页面的接入步骤
- 新增操作权限与审批流的实现方式
- 页面查看权限、内容查看权限、操作执行权限的控制与调整方法

实战模板（按步骤照抄）：

- `docs/MODULE_TEMPLATE_AFTERSALES.md`（示例：新增售后模块）
