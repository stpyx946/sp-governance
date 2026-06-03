// stopwords.mjs — built-in stopwords for capability matching tokenizer
//
// Users can extend via sp.json::config.discovery.stopwords_extra.
// Use buildStopwordSet(extra) to compose runtime set.
// Always returns a fresh Set; consumer mutations never affect the module-scoped STOPWORDS.

export const STOPWORDS = new Set([
  // 中文虚词
  '的', '了', '是', '我', '你', '他', '她', '它', '这', '那',
  '请', '帮', '让', '把', '在', '与', '和', '或', '及', '但',
  '吗', '呢', '吧', '啊', '哦', '嗯',
  // English
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'this', 'that', 'these', 'those',
  'and', 'or', 'but', 'so', 'nor', 'yet',
  'to', 'for', 'of', 'in', 'on', 'at', 'by', 'with', 'from',
  'as', 'if', 'than', 'then',
  'i', 'me', 'my', 'we', 'us', 'our', 'you', 'your', 'he', 'she', 'it',
  'do', 'does', 'did', 'doing',
  'have', 'has', 'had', 'having',
]);

export function buildStopwordSet(extra = []) {
  const set = new Set(STOPWORDS);  // always copy
  if (Array.isArray(extra)) {
    for (const w of extra) {
      if (typeof w !== 'string') continue;
      const t = w.trim().toLowerCase();  // trim + lowercase (also addresses LOW finding)
      if (t.length > 0) set.add(t);
    }
  }
  return set;
}
