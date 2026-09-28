/**
 * Extracts text from a DOM Selection or Range inside a PDF viewer with proper
 * line breaks and inter-word spacing.
 *
 * In PDF.js, text runs are rendered in absolutely-positioned spans without
 * literal newline characters. A standard Range.toString() or Selection.toString()
 * flattens all lines into a single continuous line.
 *
 * This utility:
 * 1. Traverses all text spans AND <br> elements (which PDF.js injects for line breaks).
 * 2. Ignores loose whitespace text nodes between container tags that could corrupt line geometry.
 * 3. Inspects visual geometry (bounding client rects) to accurately detect line breaks,
 *    paragraph breaks, and word spacing across spans.
 */

interface TextItem {
  type: 'text' | 'br';
  text: string;
  top: number;
  bottom: number;
  left: number;
  right: number;
  height: number;
  pageEl: Element | null;
}

function isNodeWithinRange(node: Node, range: Range): boolean {
  try {
    if (range.intersectsNode(node)) {
      return true;
    }
  } catch {
    // Some engines throw if node has different root or on certain text node boundaries
  }

  try {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length || 0;
      return range.comparePoint(node, 0) <= 0 && range.comparePoint(node, len) >= 0;
    } else {
      const parent = node.parentNode;
      if (parent) {
        const idx = Array.prototype.indexOf.call(parent.childNodes, node);
        if (idx !== -1) {
          return range.comparePoint(parent, idx) <= 0 && range.comparePoint(parent, idx + 1) >= 0;
        }
      }
    }
  } catch {
    // ignore
  }

  return false;
}

export function extractRangeTextWithLineBreaks(range: Range): string {
  if (range.collapsed) return '';

  const container = range.commonAncestorContainer;
  const root = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
  if (!root) return range.toString();

  // If start and end are in the exact same text node and it's a leaf text node inside a span, single line fragment
  if (
    range.startContainer === range.endContainer &&
    range.startContainer.nodeType === Node.TEXT_NODE &&
    range.startContainer.parentElement?.tagName === 'SPAN'
  ) {
    const text = range.startContainer.textContent || '';
    return text.slice(range.startOffset, range.endOffset);
  }

  const treeWalker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.nodeName === 'BR') {
            return isNodeWithinRange(node, range) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_SKIP;
        }

        if (node.nodeType === Node.TEXT_NODE) {
          const parent = node.parentElement;
          const isSpanOrChild = Boolean(parent && (parent.tagName === 'SPAN' || parent.closest('.textLayer span')));

          // Ignore raw whitespace text nodes that are direct children of container divs (like textLayer or page)
          if (!isSpanOrChild && (!node.textContent || node.textContent.trim().length === 0)) {
            return NodeFilter.FILTER_REJECT;
          }

          return isNodeWithinRange(node, range) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_SKIP;
      }
    }
  );

  const items: TextItem[] = [];
  let currentNode = treeWalker.nextNode();

  while (currentNode) {
    if (currentNode.nodeName === 'BR') {
      items.push({
        type: 'br',
        text: '\n',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        height: 16,
        pageEl: (currentNode as Element).closest('.page')
      });
      currentNode = treeWalker.nextNode();
      continue;
    }

    const fullText = currentNode.textContent || '';
    if (fullText.length > 0) {
      let start = 0;
      let end = fullText.length;

      if (currentNode === range.startContainer) {
        start = range.startOffset;
      }
      if (currentNode === range.endContainer) {
        end = range.endOffset;
      }

      const subText = fullText.slice(start, end);
      const parentEl = currentNode.parentElement;
      const isSpan = parentEl && (parentEl.tagName === 'SPAN' || parentEl.closest('.textLayer span'));

      // Skip whitespace-only text if not within an actual text span
      if (subText.length > 0 && (isSpan || subText.trim().length > 0)) {
        let top = 0;
        let bottom = 0;
        let left = 0;
        let right = 0;
        let height = 16;
        const pageEl = parentEl?.closest('.page') || null;

        try {
          const subRange = document.createRange();
          subRange.setStart(currentNode, start);
          subRange.setEnd(currentNode, end);
          const rect = subRange.getBoundingClientRect();
          if (rect.height > 0 && rect.height < 150) {
            top = rect.top;
            bottom = rect.bottom;
            left = rect.left;
            right = rect.right;
            height = rect.height;
          } else if (parentEl && parentEl.tagName === 'SPAN') {
            const pRect = parentEl.getBoundingClientRect();
            top = pRect.top;
            bottom = pRect.bottom;
            left = pRect.left;
            right = pRect.right;
            height = pRect.height > 0 && pRect.height < 150 ? pRect.height : 16;
          }
        } catch {
          if (parentEl && parentEl.tagName === 'SPAN') {
            const pRect = parentEl.getBoundingClientRect();
            top = pRect.top;
            bottom = pRect.bottom;
            left = pRect.left;
            right = pRect.right;
            height = pRect.height > 0 && pRect.height < 150 ? pRect.height : 16;
          }
        }

        items.push({
          type: 'text',
          text: subText,
          top,
          bottom,
          left,
          right,
          height: height > 0 && height < 150 ? height : 16,
          pageEl
        });
      }
    }
    currentNode = treeWalker.nextNode();
  }

  if (items.length === 0) {
    return range.toString();
  }

  let result = '';
  let prevItem: TextItem | null = null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (item.type === 'br') {
      // Direct newline from PDF.js <br>
      result = result.replace(/[ \t]+$/, '') + '\n';
      prevItem = item;
      continue;
    }

    if (!prevItem) {
      result += item.text;
      prevItem = item;
      continue;
    }

    if (prevItem.type === 'br') {
      // After an explicit line break, just append without extra leading space
      result += item.text;
      prevItem = item;
      continue;
    }

    const isDifferentPage = Boolean(item.pageEl && prevItem.pageEl && item.pageEl !== prevItem.pageEl);
    const avgHeight = (item.height + prevItem.height) / 2 || 14;
    const isNewLine = isDifferentPage || Math.abs(item.top - prevItem.top) > avgHeight * 0.45;

    if (isNewLine) {
      // Check if vertical distance represents an intentional paragraph gap
      const verticalGap = item.top - prevItem.bottom;
      const isParagraphBreak = verticalGap > avgHeight * 0.7 && !isDifferentPage;

      result = result.replace(/[ \t]+$/, '') + (isParagraphBreak ? '\n\n' : '\n') + item.text;
    } else {
      // Same line: check if space is needed between items
      const horizontalGap = item.left - prevItem.right;
      const needsSpace = horizontalGap > 1.5 && !prevItem.text.endsWith(' ') && !item.text.startsWith(' ');
      if (needsSpace) {
        result += ' ' + item.text;
      } else {
        result += item.text;
      }
    }

    prevItem = item;
  }

  return result.trim().length > 0 ? result : range.toString();
}

/**
 * Returns formatted text with line breaks from the current window selection if available.
 */
export function getSelectionTextWithLineBreaks(
  selection: Selection | null = typeof window !== 'undefined' ? window.getSelection() : null
): string | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  try {
    const texts: string[] = [];
    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i);
      const text = extractRangeTextWithLineBreaks(range);
      if (text) texts.push(text);
    }
    return texts.join('\n');
  } catch {
    return selection.toString() || null;
  }
}
