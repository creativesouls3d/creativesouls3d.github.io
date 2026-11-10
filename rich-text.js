// Shared, allowlisted renderer for product descriptions copied from Word,
// Google Docs, or other rich text editors.
(function () {
  const allowedTags = new Set(["A", "B", "BLOCKQUOTE", "BR", "DIV", "EM", "FONT", "H2", "H3", "I", "LI", "OL", "P", "S", "SPAN", "STRIKE", "STRONG", "U", "UL"]);
  const safeColor = value => {
    const color = String(value || "").trim();
    if (/^#[\da-f]{3,8}$/i.test(color) || /^(?:rgb|rgba|hsl|hsla)\([\d.%\s,/+-]+\)$/i.test(color)) return color;
    if (/^[a-z]{3,20}$/i.test(color) && !["expression", "inherit", "initial", "unset", "currentcolor", "transparent"].includes(color.toLowerCase())) return color;
    return "";
  };

  function sanitizeProductDescription(value) {
    const source = String(value ?? "");
    if (!source) return "";
    const hasMarkup = /<\/?[a-z][^>]*>/i.test(source);
    if (!hasMarkup) {
      const escape = text => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
      return escape(source).replace(/\r\n?/g, "\n").replace(/\n/g, "<br>");
    }

    const template = document.createElement("template");
    template.innerHTML = source;
    const cleanNode = node => {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === Node.COMMENT_NODE) { child.remove(); return; }
        if (child.nodeType !== Node.ELEMENT_NODE) return;
        if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "SVG", "MATH"].includes(child.tagName)) { child.remove(); return; }
        cleanNode(child);
        if (!allowedTags.has(child.tagName)) {
          child.replaceWith(...child.childNodes);
          return;
        }

        const tag = child.tagName;
        const href = child.getAttribute("href");
        const styleParts = [];
        const style = child.getAttribute("style") || "";
        const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
        const sizeMatch = style.match(/(?:^|;)\s*font-size\s*:\s*([^;]+)/i);
        const weightMatch = style.match(/(?:^|;)\s*font-weight\s*:\s*([^;]+)/i);
        const fontStyleMatch = style.match(/(?:^|;)\s*font-style\s*:\s*([^;]+)/i);
        const decorationMatch = style.match(/(?:^|;)\s*text-decoration(?:-line)?\s*:\s*([^;]+)/i);
        const alignMatch = style.match(/(?:^|;)\s*text-align\s*:\s*([^;]+)/i);
        const lineHeightMatch = style.match(/(?:^|;)\s*line-height\s*:\s*([^;]+)/i)
          || style.match(/(?:^|;)\s*mso-line-height-alt\s*:\s*([^;]+)/i);
        const color = safeColor(colorMatch?.[1]);
        if (color) styleParts.push(`color:${color}`);
        const size = sizeMatch?.[1]?.trim();
        if (size && /^(?:\d+(?:\.\d+)?)(?:px|pt|em|rem|%)$/i.test(size)) styleParts.push(`font-size:${size}`);
        const weight = weightMatch?.[1]?.trim();
        if (weight && /^(?:bold|bolder|[1-9]00)$/i.test(weight)) styleParts.push("font-weight:bold");
        if (/^italic$/i.test(fontStyleMatch?.[1]?.trim() || "")) styleParts.push("font-style:italic");
        const decoration = decorationMatch?.[1] || "";
        if (/underline/i.test(decoration)) styleParts.push("text-decoration:underline");
        if (/line-through/i.test(decoration)) styleParts.push("text-decoration:line-through");
        const align = alignMatch?.[1]?.trim().toLowerCase();
        if (["left", "center", "right", "justify"].includes(align)) styleParts.push(`text-align:${align}`);
        const lineHeight = lineHeightMatch?.[1]?.trim();
        if (lineHeight && /^(?:normal|\d+(?:\.\d+)?|\d+(?:\.\d+)?(?:px|pt|em|rem|%))$/i.test(lineHeight)) styleParts.push(`line-height:${lineHeight}`);

        if (tag === "FONT") {
          const legacyColor = safeColor(child.getAttribute("color"));
          if (legacyColor && !styleParts.some(part => part.startsWith("color:"))) styleParts.push(`color:${legacyColor}`);
          const legacySize = child.getAttribute("size");
          const sizes = { "1": "10px", "2": "13px", "3": "16px", "4": "18px", "5": "24px", "6": "32px", "7": "48px" };
          if (sizes[legacySize] && !styleParts.some(part => part.startsWith("font-size:"))) styleParts.push(`font-size:${sizes[legacySize]}`);
        }

        [...child.attributes].forEach(attribute => child.removeAttribute(attribute.name));
        if (tag === "A") {
          if (href && /^(https?:|mailto:)/i.test(href.trim())) {
            if (styleParts.length) child.setAttribute("style", [...new Set(styleParts)].join(";"));
            child.setAttribute("href", href.trim());
            child.setAttribute("rel", "noopener noreferrer");
            child.setAttribute("target", "_blank");
          } else child.replaceWith(...child.childNodes);
        } else if (tag === "FONT") {
          const span = document.createElement("span");
          if (styleParts.length) span.setAttribute("style", [...new Set(styleParts)].join(";"));
          span.append(...child.childNodes);
          child.replaceWith(span);
        } else if (styleParts.length) {
          child.setAttribute("style", [...new Set(styleParts)].join(";"));
        }
      });
    };
    cleanNode(template.content);
    return template.innerHTML;
  }

  window.sanitizeProductDescription = sanitizeProductDescription;
})();
