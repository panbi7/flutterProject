import { useState } from 'react';
import './GuideModal.css';

function GuideModal({ guide, onClose }) {
  const [expandedSteps, setExpandedSteps] = useState([0]); // 첫 번째 스텝만 펼침
  const [copiedCode, setCopiedCode] = useState(null);

  if (!guide) return null;

  const toggleStep = (stepIndex) => {
    setExpandedSteps(prev =>
      prev.includes(stepIndex)
        ? prev.filter(i => i !== stepIndex)
        : [...prev, stepIndex]
    );
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
            </div>
          </div>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        {/* 콘텐츠 */}
        <div className="guide-modal-content">
          {/* Q&A 텍스트 가이드 (동적 생성된 가이드) */}
          {guide.plainText ? (
            <section className="guide-section">
              <div style={{
                background: '#f8f9fa',
                padding: '20px',
                borderRadius: '8px',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: '14px',
                lineHeight: '1.6',
                maxHeight: '70vh',
                overflow: 'auto'
              }}>
                {guide.plainText}
              </div>
              {guide.source && (
                <div style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  background: guide.source === 'pregenerated' ? '#e7f5ff' : '#fff4e6',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#495057'
                }}>
                  {guide.source === 'pregenerated'
                    ? '✅ 사전 생성된 가이드 (즉시 응답)'
                    : '🔄 실시간 생성된 가이드 (자동 캐싱됨)'}
                </div>
              )}
            </section>
          ) : (
            /* 기존 구조화된 가이드 */
            <>
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
              <h3>📚 단계별 가이드</h3>
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
