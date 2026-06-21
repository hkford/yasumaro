/**
 * contentExtractor スコアリング・候補探索
 * テキストスコア計算とメインコンテンツ候補要素の抽出
 */

import { isExcludedElement } from './classifier.js';

// 句読点（日本語・英語・中国語）
const SENTENCE_MARKERS = /[。.．,，、]/g;

/**
 * 候補要素とそのスコアを保持する
 */
interface ScoredElement {
    element: Element;
    score: number;
}

/**
 * クラス名やIDに基づいて初期ボーナス・減点を計算する
 */
function getClassWeight(element: Element): number {
    let weight = 0;
    const className = (element.className && typeof element.className === 'string') ? element.className.toLowerCase() : '';
    const id = (element.id || '').toLowerCase();
    const combined = `${className} ${id}`;

    // ボーナスキーワード
    if (combined.match(/article|content|body|main|story|blog|post/)) {
        weight += 25;
    }

    // 減点キーワード
    if (combined.match(/sidebar|comment|foot|nav|widget|related|extra|ad|sponsor|header/)) {
        weight -= 25;
    }

    return weight;
}

/**
 * リンク密度のペナルティを適用する
 */
function applyLinkDensityPenalty(element: Element, score: number): number {
    const rawText = element.textContent || '';
    const cleanText = rawText.replace(/\s+/g, '');
    if (!cleanText) return 0;

    let linkTextLength = 0;
    const links = element.querySelectorAll('a');
    links.forEach(link => {
        linkTextLength += (link.textContent || '').replace(/\s+/g, '').length;
    });

    // テキスト全体に対するリンクテキストの割合 (空白無視)
    const linkRatio = Math.min(linkTextLength / cleanText.length, 1.0);

    // リンク密度に基づいたペナルティ
    // 50%超えは大幅に減点
    if (linkRatio > 0.5) {
        return score * (1 - linkRatio) * 0.5;
    }

    // それ以外は連続的なペナルティ
    return score * (1 - linkRatio * linkRatio);
}

/**
 * メインコンテンツの候補要素を抽出 (Readability-inspired Bubbling Algorithm)
 */
export function findMainContentCandidates(): Element[] {
    const scoredElements = new Map<Element, number>();

    // 1. 本文らしき「ノード」をすべて見つける (P, またはテキストを含むDIV)
    const allParagraphs = document.querySelectorAll('p, div, section, article');

    allParagraphs.forEach(node => {
        const text = (node.textContent || '').trim();
        if (text.length < 25) return; // 短すぎるものは無視

        // このノード自体の基本スコアを計算
        let contentScore = 1; // 基本点

        // 句読点の数で文章らしさを評価 (1つにつき1点)
        const markerCount = (text.match(SENTENCE_MARKERS) || []).length;
        contentScore += markerCount;

        // 文字数ボーナス (100文字ごとにプラス)
        contentScore += Math.min(Math.floor(text.length / 100), 3);

        // 2. スコアを親に伝播（バブリング）させる
        let parent = node.parentElement;
        let depth = 0;
        while (parent && depth < 3) {
            if (isExcludedElement(parent)) break;

            const currentScore = scoredElements.get(parent) || 0;
            // 距離に応じて加算 (親: 100%, 祖父: 50%, 曽祖父: 25%)
            const addedScore = contentScore / (Math.pow(2, depth));

            // 初めてスコアがつく要素にはクラス名ボーナスも加算
            const initialWeight = currentScore === 0 ? getClassWeight(parent) : 0;

            scoredElements.set(parent, currentScore + addedScore + initialWeight);

            parent = parent.parentElement;
            depth++;
        }
    });

    // 3. 候補リストの作成と最終調整
    const candidates: ScoredElement[] = [];
    scoredElements.forEach((score, element) => {
        const tag = element.tagName.toLowerCase();

        // BODYとHTMLは広すぎるため、基本的には候補から除外する
        if (tag === 'body' || tag === 'html') return;

        // 全体のリンク密度で最終調整
        let finalScore = applyLinkDensityPenalty(element, score);

        // セマンティックタグ (article, main) への最終ボーナス
        if (tag === 'article' || tag === 'main') {
            finalScore *= 1.2;
        }

        // 最低閾値
        if (finalScore > 20) {
            candidates.push({ element, score: finalScore });
        }
    });

    // 4. スコア順にソートして上位を返す
    candidates.sort((a, b) => b.score - a.score);

    // 上位3つを返す。もし候補が全くなければ、bodyをフォールバックとして返す
    if (candidates.length === 0 && document.body) {
        return [document.body];
    }

    return candidates.slice(0, 3).map(c => c.element);
}

/**
 * 互換性のためのラップ関数
 */
export function calculateTextScore(element: Element): number {
    const text = (element.textContent || '').trim();
    if (text.length < 5) return 0;

    // バブリングを無視した簡易計算
    let score = text.length / 10;
    const markerCount = (text.match(SENTENCE_MARKERS) || []).length;
    score += markerCount * 5;

    return applyLinkDensityPenalty(element, score + getClassWeight(element));
}