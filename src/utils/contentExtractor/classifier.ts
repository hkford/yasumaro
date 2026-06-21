/**
 * contentExtractor 分類器
 * 要素の除外判定・アジアコンテンツ判定に使用する定数と述語関数
 */

/**
 * 除外するセクメンタルコンテンツのロール属性
 * HTMLテキスト抽出の際、ナビゲーションやバナー等の補助的UI要素を除外するために使用
 */
export const EXCLUDED_ROLES = new Set([
    'navigation',    // ナビゲーションメニュー
    'banner',        // ヘッダー/バナー
    'contentinfo',   // フッター
    'complementary', // サイドバー
    'doc-credit',    // 著者情報等
    'doc-endnotes',  // 注釈
    'doc-footnotes'  // 脚注
]);

/**
 * 除外するタグ名
 */
export const EXCLUDED_TAGS = new Set([
    'nav',
    'aside',
    'footer',
    'header'
]);

/**
 * 除外するクラス名パターン（大文字小文字を区別しない）
 */
export const EXCLUDED_CLASS_PATTERNS = [
    'sidebar',
    'nav',
    'navigation',
    'menu',
    'breadcrumb',
    'cookie',
    'ad',
    'advertisement',
    'banner',
    'footer',
    'header'
];

/**
 * アジア圏のWebサイトでよく使用されるコンテンツを示すクラス名パターン
 * 東アジアの网站（ウェブサイト）で使用される主要なコンテンツ識別子
 */
export const ASIA_CONTENT_CLASS_PATTERNS = [
    // 日本語・中国語・韓国語共通
    'content',
    'article',
    'post',
    'entry',
    'article-body',
    'article-content',
    'post-content',
    'entry-content',
    'main-content',
    'story',
    'text',
    // 中国語固有
    'article_main',
    'trs_editor',
    'nr-col',
    // 韓国語固有
    'article_view',
    'article_body',
    'view_content',
    // 共通
    'blog-content',
    'news-content',
    'product-detail',
    'description'
];

/**
 * アジア圏のWebサイトでよく使用されるIDパターン
 */
export const ASIA_CONTENT_ID_PATTERNS = [
    'content',
    'article',
    'post',
    'entry',
    'main',
    'article-content',
    'article-body',
    'post-content',
    'main-content',
    'text',
    'article_view',
    'article_main'
];

/**
 * 要素からクラス名文字列を安全に取得する（SVG等のAnimatedString対策）
 */
function getClassName(element: Element): string {
    const classes = element.className;
    if (typeof classes === 'string') {
        return classes;
    }
    // SVGAnimatedString など、文字列でない場合は baseVal を使用するか空文字を返す
    if (classes && typeof classes === 'object' && 'baseVal' in classes) {
        return (classes as { baseVal: string }).baseVal || '';
    }
    return '';
}

/**
 * 要素が除外対象かどうかを判定
 * @internal テスト用にエクスポート
 */
export function isExcludedElement(element: Element): boolean {
    // タグ名で除外
    if (EXCLUDED_TAGS.has(element.tagName.toLowerCase())) {
        return true;
    }

    // role属性で除外
    const role = element.getAttribute('role');
    if (role && EXCLUDED_ROLES.has(role.toLowerCase())) {
        return true;
    }

    // aria-hiddenで除外
    if (element.getAttribute('aria-hidden') === 'true') {
        return true;
    }

    // クラス名パターンで除外
    const className = getClassName(element).toLowerCase();
    if (className) {
        for (const pattern of EXCLUDED_CLASS_PATTERNS) {
            if (className.includes(pattern)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Check if an element is an Asian content structure
 * @param element - Element to check
 * @returns true if it's an Asian content structure
 */
export function isAsianContentElement(element: Element): boolean {
    // Check if DOM is available (for Node.js/test environments)
    if (typeof document === 'undefined') return false;

    const className = getClassName(element).toLowerCase();
    const id = (element.id || '').toLowerCase();

    // Check by class name
    if (className) {
        // Tailwind等の "text-gray-500" や "contents" (display: contents) などへの誤爆を防ぐため
        // クラス名を分割して完全一致または特定のキーワードを含むかチェック
        const classList = className.split(/\s+/);
        for (const pattern of ASIA_CONTENT_CLASS_PATTERNS) {
            for (const cls of classList) {
                // 完全一致、または "article-" 等の特定の接頭辞を持つ場合
                if (cls === pattern || (pattern.length > 4 && (cls.startsWith(`${pattern}-`) || cls.endsWith(`-${pattern}`)))) {
                    return true;
                }
            }
        }
    }

    // Check by ID (exact match, or prefix/suffix match)
    for (const pattern of ASIA_CONTENT_ID_PATTERNS) {
        // Exact match, or content- prefix or -content suffix
        if (id === pattern || id.startsWith('content-') || id.endsWith('-content')) {
            return true;
        }
    }

    return false;
}