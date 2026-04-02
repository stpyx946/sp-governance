/**
 * 里程碑视图生成 - 纯函数库
 *
 * 从 work-helper/scripts/feishu-milestone.mjs 提取
 */

export const STATUS_MAP = {
  completed: { emoji: '✅', text: '已完成' },
  in_progress: { emoji: '🔄', text: '进行中' },
  pending: { emoji: '⏳', text: '待开始' },
};

export const DEFAULT_MILESTONES = [
  { name: '需求冻结', date: '2026-04-10', deliverables: 'PRD文档、原型图', status: 'completed' },
  { name: '设计定稿', date: '2026-04-25', deliverables: 'UI设计稿、高保真原型', status: 'in_progress' },
  { name: '开发完成', date: '2026-05-20', deliverables: '前后端代码、接口文档', status: 'pending' },
  { name: '测试通过', date: '2026-06-05', deliverables: '测试报告、Bug修复', status: 'pending' },
  { name: '正式上线', date: '2026-06-15', deliverables: '生产环境部署、用户手册', status: 'pending' },
];

/**
 * 生成里程碑 Markdown 视图
 * @param {string} projectName - 项目名称
 * @param {Array} milestones - 里程碑列表
 * @returns {string} Markdown 格式的里程碑视图
 */
export function generateMilestone(projectName, milestones) {
  const lines = [
    `# ${projectName} - 项目里程碑`,
    '',
  ];

  for (const m of milestones) {
    const { emoji, text } = STATUS_MAP[m.status] || STATUS_MAP.pending;
    lines.push(`### ${emoji} ${m.name} (${m.date})`);
    lines.push(`**交付物**：${m.deliverables}`);
    lines.push(`**状态**：${text}`);
    lines.push('');
  }

  return lines.join('\n');
}
