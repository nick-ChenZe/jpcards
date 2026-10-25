// Read-only browser probe. Run against an authenticated /history page, before and after scrolling.
(() => {
    const root = document.documentElement;
    const paper = document.querySelector('.hiyori-app');
    const nav = document.querySelector('.hiyori-nav');
    const chart = document.querySelector('.footprint-calendar') || document.querySelector('.footprint-board');
    if (!paper || !nav || !chart) throw new Error('Open an authenticated history page first.');
    const paperRect = paper.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    const issues = [];
    if (root.scrollWidth > root.clientWidth || paper.scrollWidth > paper.clientWidth) {
        issues.push('Paper content overflows horizontally');
    }
    if (root.scrollHeight > root.clientHeight + 1) {
        issues.push(`Outer page scrolls by ${root.scrollHeight - root.clientHeight}px`);
    }
    if (paperRect.top < -1 || paperRect.bottom > root.clientHeight + 1) {
        issues.push('Paper escapes the viewport while scrolling');
    }
    if (navRect.top < paperRect.top || navRect.bottom > paperRect.bottom + 1) {
        issues.push('Bottom navigation escapes the paper');
    }
    if (chart.scrollHeight > chart.clientHeight) {
        issues.push(`Heatmap has ${chart.scrollHeight - chart.clientHeight}px vertical overflow`);
    }
    if (chart.scrollWidth > chart.clientWidth) issues.push('Heatmap has horizontal overflow');
    const report = {
        pass: issues.length === 0,
        issues,
        viewportHeight: root.clientHeight,
        pageHeight: root.scrollHeight,
        chartHeight: chart.clientHeight
    };
    if (!report.pass) throw new Error(JSON.stringify(report));
    return report;
})();
