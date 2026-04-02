import { readFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', '..', '..', 'config', 'feishu-config.json');

const EVENT_TEMPLATES = {
  skill_completed: {
    title: (d) => `${d.skill || '任务'} 执行完成`,
    body: (d) => {
      let t = `**Skill**: ${d.skill}`;
      if (d.title) t += `\n**文档**: ${d.title}`;
      if (d.duration) t += `\n**耗时**: ${d.duration}`;
      return t;
    },
    color: 'green',
  },
  skill_failed: {
    title: (d) => `${d.skill || '任务'} 执行失败`,
    body: (d) => `**Skill**: ${d.skill}\n**错误**: ${d.error}`,
    color: 'red',
  },
  feishu_doc_created: {
    title: (d) => `飞书文档已创建`,
    body: (d) => `**标题**: ${d.title}`,
    color: 'green',
  },
  login_expiring: {
    title: () => `飞书登录态即将过期`,
    body: (d) => `**用户**: ${d.user}\n请运行 feishu-login.mjs 重新登录`,
    color: 'orange',
  },
  login_expired: {
    title: () => `飞书登录态已过期`,
    body: (d) => `**用户**: ${d.user}\n请立即重新登录`,
    color: 'red',
  },
  health_check_result: {
    title: (d) => `选择器健康检查 ${d.allPassed ? '通过' : '有失败'}`,
    body: (d) => {
      let t = `**通过**: ${d.passed}/${d.total}`;
      if (d.failed?.length) t += `\n**失败**: ${d.failed.join(', ')}`;
      return t;
    },
    color: 'blue',
  },
  task_analysis_completed: {
    title: () => `任务分析完成`,
    body: (d) => `**总任务数**: ${d.totalTasks || 0}`,
    color: 'blue',
  },
};

const HEADER_COLORS = { green: 'green', red: 'red', orange: 'orange', blue: 'blue' };

async function sendFeishu(config, event, data) {
  const tmpl = EVENT_TEMPLATES[event];
  const title = tmpl?.title(data) || event;
  const body = tmpl?.body(data) || JSON.stringify(data);
  const color = tmpl?.color || 'blue';

  const payload = {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: title },
        template: HEADER_COLORS[color] || 'blue',
      },
      elements: [
        { tag: 'div', text: { tag: 'lark_md', content: body } },
        { tag: 'note', elements: [{ tag: 'plain_text', content: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) }] },
        ...(data.url ? [{ tag: 'action', actions: [{ tag: 'button', text: { tag: 'plain_text', content: '查看详情' }, url: data.url, type: 'primary' }] }] : []),
      ],
    },
  };

  if (config.secret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const stringToSign = `${timestamp}\n${config.secret}`;
    const sign = crypto.createHmac('sha256', stringToSign).update('').digest('base64');
    payload.timestamp = timestamp;
    payload.sign = sign;
  }

  const res = await fetch(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`飞书 Webhook 失败: ${res.status}`);
  return res.json();
}

export async function sendNotification(event, data = {}, options = {}) {
  let config;
  try {
    config = JSON.parse(await readFile(CONFIG_PATH, 'utf-8'));
  } catch {
    return { status: 'skipped', reason: '配置文件不存在，跳过通知' };
  }

  const webhook = config.webhook;
  if (!webhook?.enabled) {
    return { status: 'skipped', reason: 'Webhook 未启用' };
  }

  if (webhook.events && webhook.events[event] === false) {
    return { status: 'skipped', reason: `事件 ${event} 未订阅` };
  }

  const channels = options.channel ? [options.channel] : (webhook.defaultChannels || ['feishu']);
  const results = [];

  for (const ch of channels) {
    const chConfig = webhook.channels?.[ch];
    if (!chConfig?.webhookUrl) {
      results.push({ channel: ch, status: 'skipped', reason: '未配置 webhookUrl' });
      continue;
    }
    try {
      if (ch === 'feishu') {
        await sendFeishu(chConfig, event, data);
      } else {
        await fetch(chConfig.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event, data, timestamp: new Date().toISOString() }),
        });
      }
      results.push({ channel: ch, status: 'ok' });
    } catch (error) {
      results.push({ channel: ch, status: 'error', error: error.message });
    }
  }

  return { status: results.every(r => r.status === 'ok') ? 'success' : 'partial', event, results };
}

export { EVENT_TEMPLATES };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < args.length; i += 2) {
    params[args[i].replace(/^--/, '')] = args[i + 1];
  }
  const { event, channel } = params;
  if (!event) { console.error('缺少 --event'); process.exit(1); }
  const data = params.data ? JSON.parse(params.data) : {};
  const result = await sendNotification(event, data, { channel });
  console.log(JSON.stringify(result));
}
