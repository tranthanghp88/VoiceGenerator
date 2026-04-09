export function hasSuspiciousQuestionMarks(text: string) {
  return /\?[\u0300-\u036f]|[A-Za-zÀ-ỹĐđ]\?[A-Za-zÀ-ỹĐđ]|\?{2,}/.test(text);
}

function countMatches(text: string, re: RegExp) {
  return (text.match(re) || []).length;
}

function tryLatin1ToUtf8(text: string) {
  try {
    const bytes = Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return text;
  }
}

export function fixMojibake(value: any) {
  const text = String(value ?? '').replace(/^\uFEFF/, '').replace(/\u00A0/g, ' ').trim();
  if (!text) return '';

  const normalized = text.normalize('NFC');
  const looksBroken = /[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝãâäåæçèéêëìíîïñòóôõöøùúûüý]|�/.test(normalized);
  if (!looksBroken) return normalized;

  const repaired = tryLatin1ToUtf8(normalized).trim();
  return (repaired || normalized).normalize('NFC');
}

export function normalizeText(value: any) {
  return fixMojibake(value)
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function scoreDecodedText(text: string) {
  const normalized = String(text || '').replace(/^\uFEFF/, '').normalize('NFC');

  const replacementCount = countMatches(normalized, /�/g);
  const mojibakeCount = countMatches(normalized, /[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝãâäåæçèéêëìíîïñòóôõöøùúûüý]/g);
  const suspiciousQuestionCount = countMatches(normalized, /\?[\u0300-\u036f]|[A-Za-zÀ-ỹĐđ]\?(?=[A-Za-zÀ-ỹĐđ])|\?{2,}/g);
  const controlCharCount = countMatches(normalized, /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g);
  const badSequenceCount = countMatches(normalized, /(?:ThI|H\u01b0\?|N\?|s\?̣|h\u01b0\?̀|\uFFFD)/g);
  const vietnameseCharCount = countMatches(normalized, /[ăâđêôơưĂÂĐÊÔƠƯàáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹÀÁẠẢÃÈÉẸẺẼÌÍỊỈĨÒÓỌỎÕÙÚỤỦŨỲÝỴỶỸ]/g);

  return (
    replacementCount * 80 +
    suspiciousQuestionCount * 60 +
    mojibakeCount * 30 +
    controlCharCount * 20 +
    badSequenceCount * 80 -
    vietnameseCharCount * 1.5
  );
}

export function decodeImportBuffer(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const decoders = ['utf-8', 'windows-1258', 'windows-1252', 'iso-8859-1'];

  const decodeWith = (encoding: string) => {
    const decoder = new TextDecoder(encoding as any, { fatal: false });
    return decoder.decode(bytes).replace(/^\uFEFF/, '');
  };

  let bestText = '';
  let bestScore = Number.POSITIVE_INFINITY;

  for (const encoding of decoders) {
    try {
      const decoded = decodeWith(encoding);
      const repaired = fixMojibake(decoded);
      const score = Math.min(scoreDecodedText(decoded), scoreDecodedText(repaired));
      const candidate = scoreDecodedText(repaired) <= scoreDecodedText(decoded) ? repaired : decoded;
      if (score < bestScore) {
        bestScore = score;
        bestText = candidate;
      }
      if (score <= 0) break;
    } catch {
      // continue
    }
  }

  return normalizeText(bestText || decodeWith('utf-8'));
}
