// stopwords.mjs — built-in stopwords for capability matching tokenizer
//
// Users can extend via sp.json::config.discovery.stopwords_extra.
// Use buildStopwordSet(extra) to compose runtime set.

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
  if (!Array.isArray(extra) || extra.length === 0) return STOPWORDS;
  const set = new Set(STOPWORDS);
  for (const w of extra) {
    if (typeof w === 'string' && w.length > 0) set.add(w.toLowerCase());
  }
  return set;
}
