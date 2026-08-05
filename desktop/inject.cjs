const fs = require('fs');
let code = fs.readFileSync('node_modules/react-pdf-highlighter/dist/src/components/PdfHighlighter.js', 'utf8');
code = code.replace(
  '__publicField(this, "scrollTo", (highlight) => {',
  '__publicField(this, "scrollTo", (highlight) => { console.log("SCROLLTO CALLED!", highlight.position.pageNumber); try { const pv = this.viewer.getPageView(highlight.position.pageNumber - 1); console.log("pageView exists?", !!pv); console.log("viewport exists?", !!(pv && pv.viewport)); } catch(e) { console.error("ERROR in scrollTo:", e.message); }'
);
fs.writeFileSync('node_modules/react-pdf-highlighter/dist/src/components/PdfHighlighter.js', code);
