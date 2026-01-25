import { useState, useEffect, useMemo } from 'react';
import './GuideModal.css';
import SimpleMarkdown from './SimpleMarkdown';
import { clearGuideCache } from '../services/guideApi';

function GuideModal({ guide: rawGuide, onClose, onRefresh }) {
  // Default to expanding ALL steps
  const [expandedSteps, setExpandedSteps] = useState([]);
  const [copiedCode, setCopiedCode] = useState(null);

  // plainText가 JSON 형태면 파싱하여 구조화된 가이드로 변환
  const guide = useMemo(() => {
    if (!rawGuide) return null;

    // plainText가 있고 JSON처럼 보이면 파싱 시도
    if (rawGuide.plainText && typeof rawGuide.plainText === 'string') {
      const trimmed = rawGuide.plainText.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          // 파싱 성공하면 구조화된 가이드로 변환
          return { ...rawGuide, ...parsed, plainText: null };
        } catch {
          // 파싱 실패하면 그대로 유지
        }
      }
    }
    return rawGuide;
  }, [rawGuide]);

  useEffect(() => {
    if (guide && guide.steps) {
      setExpandedSteps(guide.steps.map((_, i) => i));
    }
  }, [guide]);

  if (!guide) return null;

  const toggleStep = (stepIndex) => {
    setExpandedSteps(prev =>
      prev.includes(stepIndex)
        ? prev.filter(i => i !== stepIndex)
        : [...prev, stepIndex]
    );
  };

  const toggleAll = () => {
    if (expandedSteps.length === guide.steps.length) {
      setExpandedSteps([]);
    } else {
      setExpandedSteps(guide.steps.map((_, i) => i));
    }
  };

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('복사 실패:', err);
    }
  };

  return (
    <div className="guide-modal-overlay" onClick={onClose}>
      <div className="guide-modal" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="guide-modal-header">
          <div className="guide-header-content">
            <h2>{guide.title}</h2>
            <p className="guide-description">{guide.description}</p>
            <div className="guide-meta">
              <span className="badge badge-difficulty">{guide.difficulty}</span>
              <span className="badge badge-time">⏱️ {guide.estimatedTime}</span>
              {/* 캐시 출처 표시 */}
              {guide.source && (
                <span className={`badge badge-source ${guide.source}`}>
                  {guide.source === 'browser-cache' && '⚡ 브라우저 캐시'}
                  {guide.source === 'cache' && '💾 서버 캐시'}
                  {guide.source === 'generated' && '🤖 AI 생성'}
                  {guide.source === 'fallback' && '📋 기본 가이드'}
                </span>
              )}
            </div>
          </div>
          <div className="header-actions">
            {/* 새로고침 버튼 */}
            {onRefresh && guide.packageId && (
              <button
                className="refresh-button"
                onClick={() => {
                  clearGuideCache(guide.packageId);
                  onRefresh(guide.packageId);
                }}
                title="캐시 삭제 후 새로 생성"
              >
                🔄
              </button>
            )}
            <button className="close-button" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className="guide-modal-content">
          {/* Q&A 텍스트 가이드 (동적 생성된 가이드) */}
          {guide.plainText ? (
            <section className="guide-section markdown-section">
              <SimpleMarkdown text={guide.plainText} />

              {guide.source && (
                <div style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  background: guide.source === 'generated' ? '#e7f5ff' : '#fff4e6',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#495057'
                }}>
                  {guide.source === 'generated'
                    ? '🔄 실시간 생성된 가이드 (Gemini AI)'
                    : '✅ 사전 정의된 가이드 (신뢰도 높음)'}
                </div>
              )}
            </section>
          ) : (
            /* 기존 구조화된 가이드 */
            <>
              {/* 핵심 개념 (초심자용) */}
              {guide.coreConcepts && guide.coreConcepts.length > 0 && (
                <section className="guide-section">
                  <h3>💡 핵심 개념 이해하기</h3>
                  <div className="concepts-container">
                    {guide.coreConcepts.map((concept, idx) => (
                      <div key={idx} className="concept-card">
                        <div className="concept-term">{concept.term}</div>
                        <div className="concept-explanation">{concept.explanation}</div>
                        {concept.analogy && (
                          <div className="concept-analogy">
                            <span className="analogy-icon">💭</span>
                            <span>{concept.analogy}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 사전 준비사항 */}
              {guide.prerequisites && guide.prerequisites.length > 0 && (
                <section className="guide-section">
                  <h3>📝 사전 준비사항</h3>
                  <ul className="prerequisites-list">
                    {guide.prerequisites.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}

              {/* 단계별 가이드 */}
              {guide.steps && guide.steps.length > 0 && (
                <section className="guide-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3>📚 단계별 가이드</h3>
                    <button onClick={toggleAll} style={{
                      background: 'none', border: '1px solid #ddd', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px'
                    }}>
                      {expandedSteps.length === guide.steps.length ? '모두 접기' : '모두 펼치기'}
                    </button>
                  </div>

                  <div className="steps-container">
                    {guide.steps.map((step, idx) => (
                      <div key={idx} className="step-item">
                        <div
                          className="step-header"
                          onClick={() => toggleStep(idx)}
                        >
                          <span className="step-number">{step.stepNumber}️⃣</span>
                          <span className="step-title">{step.title}</span>
                          <span className="step-toggle">
                            {expandedSteps.includes(idx) ? '▲' : '▼'}
                          </span>
                        </div>

                        {expandedSteps.includes(idx) && (
                          <div className="step-content">
                            <p className="step-description">{step.description}</p>

                            {/* 이 단계에서 배울 내용 */}
                            {step.whatYouWillLearn && step.whatYouWillLearn.length > 0 && (
                              <div className="learn-box">
                                <div className="learn-header">🎯 이 단계에서 배울 내용</div>
                                <ul className="learn-list">
                                  {step.whatYouWillLearn.map((item, learnIdx) => (
                                    <li key={learnIdx}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Substeps */}
                            {step.substeps && step.substeps.length > 0 && (
                              <ul className="substeps-list">
                                {step.substeps.map((substep, subIdx) => (
                                  <li key={subIdx}>{substep}</li>
                                ))}
                              </ul>
                            )}

                            {/* 코드 블록 */}
                            {step.code && (
                              <div className="code-block">
                                <div className="code-header">
                                  <span className="code-filename">
                                    {step.code.filename || step.code.language}
                                  </span>
                                  <button
                                    className="copy-button"
                                    onClick={() => copyToClipboard(step.code.content, `step-${idx}`)}
                                  >
                                    {copiedCode === `step-${idx}` ? '✓ 복사됨' : '📋 복사'}
                                  </button>
                                </div>
                                <pre>
                                  <code>{step.code.content}</code>
                                </pre>
                              </div>
                            )}

                            {/* 터미널 명령어 */}
                            {step.command && (
                              <div className="command-block">
                                <div className="command-header">
                                  <span>$ {step.command}</span>
                                  <button
                                    className="copy-button"
                                    onClick={() => copyToClipboard(step.command, `cmd-${idx}`)}
                                  >
                                    {copiedCode === `cmd-${idx}` ? '✓ 복사됨' : '📋 복사'}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* 여러 명령어 */}
                            {step.commands && step.commands.length > 0 && (
                              <div className="commands-block">
                                {step.commands.map((cmd, cmdIdx) => (
                                  <div key={cmdIdx} className="command-block">
                                    <div className="command-header">
                                      <span>$ {cmd}</span>
                                      <button
                                        className="copy-button"
                                        onClick={() => copyToClipboard(cmd, `cmds-${idx}-${cmdIdx}`)}
                                      >
                                        {copiedCode === `cmds-${idx}-${cmdIdx}` ? '✓ 복사됨' : '📋 복사'}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* 설명 */}
                            {step.explanation && (
                              <p className="step-note">💡 {step.explanation}</p>
                            )}

                            {/* 노트 */}
                            {step.note && (
                              <p className="step-note">💡 {step.note}</p>
                            )}

                            {/* 초심자 팁 */}
                            {step.beginnerTip && (
                              <div className="beginner-tip-box">
                                <div className="tip-header">🌱 초심자 팁</div>
                                <p>{step.beginnerTip}</p>
                              </div>
                            )}

                            {/* 흔한 실수 */}
                            {step.commonMistake && (
                              <div className="common-mistake-box">
                                <div className="mistake-header">⚠️ 흔한 실수</div>
                                <p>{step.commonMistake}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 흔한 에러 */}
              {guide.commonErrors && guide.commonErrors.length > 0 && (
                <section className="guide-section">
                  <h3>⚠️ 흔한 에러</h3>
                  <div className="errors-container">
                    {guide.commonErrors.map((error, idx) => (
                      <div key={idx} className="error-item">
                        <div className="error-title">{error.error}</div>
                        <div className="error-solution">💡 해결 방법: {error.solution}</div>
                        {error.link && (
                          <a href={error.link} target="_blank" rel="noopener noreferrer" className="error-link">
                            🔗 자세히 보기
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 개발 팁 */}
              {guide.tips && guide.tips.length > 0 && (
                <section className="guide-section">
                  <h3>💡 개발 팁</h3>
                  <ul className="tips-list">
                    {guide.tips.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                </section>
              )}

              {/* 베스트 프랙티스 */}
              {guide.bestPractices && guide.bestPractices.length > 0 && (
                <section className="guide-section">
                  <h3>✨ 베스트 프랙티스</h3>
                  <div className="best-practices-container">
                    {guide.bestPractices.map((practice, idx) => (
                      <div key={idx} className="practice-item">
                        <div className="practice-title">{practice.title}</div>
                        <div className="practice-description">{practice.description}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 다음 단계 */}
              {guide.nextSteps && guide.nextSteps.length > 0 && (
                <section className="guide-section">
                  <h3>🚀 다음 단계</h3>
                  <div className="next-steps-container">
                    {guide.nextSteps.map((step, idx) => (
                      <div key={idx} className="next-step-item">
                        <div className="next-step-title">{step.title}</div>
                        <div className="next-step-description">{step.description}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 참고 자료 */}
              {guide.references && guide.references.length > 0 && (
                <section className="guide-section">
                  <h3>🔗 참고 자료</h3>
                  <ul className="references-list">
                    {guide.references.map((ref, idx) => (
                      <li key={idx}>
                        <a href={ref.url} target="_blank" rel="noopener noreferrer">
                          {ref.title} →
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default GuideModal;
