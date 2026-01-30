/**
 * Normalize guide data to a UI-friendly, stable schema.
 * This prevents blank rendering when older static guides use legacy fields.
 */

export function normalizeGuide(rawGuide, options = {}) {
  if (!rawGuide) return rawGuide;

  const guide = { ...rawGuide };
  const packageId =
    guide.packageId ||
    guide.packageName ||
    guide.name ||
    guide.id ||
    options.packageId;

  if (packageId && !guide.packageId) {
    guide.packageId = packageId;
  }

  if (!guide.title) {
    guide.title = packageId ? `${packageId} 구현 가이드` : '구현 가이드';
  }

  if (!guide.description) {
    guide.description = guide.overview?.what || guide.overview?.why || '';
  }

  if (!guide.difficulty) {
    guide.difficulty = '기본';
  }

  if (!guide.estimatedTime) {
    guide.estimatedTime = '30분';
  }

  if (Array.isArray(guide.coreConcepts)) {
    guide.coreConcepts = guide.coreConcepts.map((concept) => ({
      ...concept,
      term: concept.term || concept.name || '',
      explanation: concept.explanation || concept.description || '',
    }));
  }

  if (Array.isArray(guide.steps)) {
    guide.steps = guide.steps.map((step, index) => {
      const normalized = { ...step };

      if (!normalized.stepNumber) {
        normalized.stepNumber = index + 1;
      }

      if (typeof normalized.code === 'string') {
        normalized.code = {
          language: 'text',
          content: normalized.code,
        };
      } else if (normalized.code && typeof normalized.code === 'object') {
        if (!normalized.code.content && typeof normalized.code.code === 'string') {
          normalized.code = { ...normalized.code, content: normalized.code.code };
        }
      }

      if (!normalized.substeps && Array.isArray(normalized.subSteps)) {
        normalized.substeps = normalized.subSteps.map((substep) => {
          if (typeof substep === 'string') return substep;
          if (!substep || typeof substep !== 'object') return '';
          return [substep.title, substep.description].filter(Boolean).join(' - ');
        }).filter(Boolean);
      }

      return normalized;
    });
  }

  return guide;
}
