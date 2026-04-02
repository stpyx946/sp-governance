/**
 * 飞书甘特图生成 - 纯函数库
 *
 * 从 work-helper/scripts/feishu-gantt.mjs 提取
 */

/**
 * 计算日期范围内的所有日期
 */
export function getDatesInRange(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * 生成甘特图 ASCII 艺术
 * @param {Array} tasks - 任务列表
 * @returns {string} ASCII 甘特图
 */
export function generateGanttChart(tasks) {
  if (!tasks || tasks.length === 0) {
    return '（无任务数据）';
  }

  // 收集所有日期，确定时间范围
  const allDates = [];
  tasks.forEach(task => {
    const dates = getDatesInRange(task.start, task.end);
    dates.forEach(d => allDates.push(d));
  });

  if (allDates.length === 0) {
    return '（日期范围无效）';
  }

  // 找到最早和最晚日期
  const minDate = new Date(Math.min(...allDates));
  const maxDate = new Date(Math.max(...allDates));

  // 生成日期刻度行（每周一个刻度）
  const weeks = [];
  const current = new Date(minDate);
  current.setDate(current.getDate() - current.getDay()); // 回到周日开始

  while (current <= maxDate) {
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    weeks.push(`${month}-${day}`);
    current.setDate(current.getDate() + 7);
  }

  // 生成表头
  const taskColWidth = 10;
  const ownerColWidth = 6;
  const header =
    '任务名称'.padEnd(taskColWidth) +
    '负责人'.padEnd(ownerColWidth) +
    weeks.map(w => w).join(' ');

  const lines = [header];

  // 为每个任务生成一行
  tasks.forEach(task => {
    const taskName = String(task.name).slice(0, taskColWidth).padEnd(taskColWidth);
    const owner = String(task.owner).slice(0, ownerColWidth).padEnd(ownerColWidth);

    // 生成进度条
    const taskStartDate = new Date(task.start);
    const taskEndDate = new Date(task.end);
    const progress = task.progress || 0;

    let bar = '';
    const current2 = new Date(minDate);

    while (current2 <= maxDate) {
      const isInRange = current2 >= taskStartDate && current2 <= taskEndDate;

      if (isInRange) {
        // 计算这一天在任务进度中的位置
        const dayOffset = Math.floor((current2 - taskStartDate) / (1000 * 60 * 60 * 24));
        const totalTaskDays = Math.ceil((taskEndDate - taskStartDate) / (1000 * 60 * 60 * 24)) + 1;
        const progressThreshold = (progress / 100) * totalTaskDays;

        bar += dayOffset < progressThreshold ? '█' : '░';
      } else {
        bar += ' ';
      }

      current2.setDate(current2.getDate() + 1);
    }

    lines.push(taskName + owner + bar + ' ' + progress + '%');
  });

  return lines.join('\n');
}
