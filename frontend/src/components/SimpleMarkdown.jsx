import React from 'react';

/**
 * A simple markdown renderer to avoid adding heavy dependencies like react-markdown
 * which caused permission issues.
 * Supports: Headers (#), Bold (**), Code Blocks (```), and Lists (-).
 */
const SimpleMarkdown = ({ text }) => {
    if (!text) return null;

    // Split by code blocks first
    const parts = text.split(/(```[\s\S]*?```)/g);

    return (
        <div className="markdown-body">
            {parts.map((part, index) => {
                if (part.startsWith('```')) {
                    // Render Code Block
                    const content = part.replace(/^```\w*\n?/, '').replace(/```$/, '');
                    return (
                        <div key={index} className="code-block">
                            <pre><code>{content}</code></pre>
                        </div>
                    );
                } else {
                    // Render Regular Text (with headers, lists, etc)
                    return <RegularText key={index} text={part} />;
                }
            })}
        </div>
    );
};

const RegularText = ({ text }) => {
    const lines = text.split('\n');

    return (
        <>
            {lines.map((line, i) => {
                // Headers
                if (line.startsWith('### ')) return <h3 key={i}>{parseInline(line.slice(4))}</h3>;
                if (line.startsWith('## ')) return <h2 key={i}>{parseInline(line.slice(3))}</h2>;
                if (line.startsWith('# ')) return <h1 key={i}>{parseInline(line.slice(2))}</h1>;

                // Lists
                if (line.trim().startsWith('- ')) {
                    return <li key={i}>{parseInline(line.trim().slice(2))}</li>;
                }
                if (line.match(/^\d+\. /)) {
                    return <div key={i} className="list-item-numbered">{parseInline(line)}</div>;
                }

                // Empty lines
                if (!line.trim()) return <br key={i} />;

                // Paragraphs
                return <p key={i}>{parseInline(line)}</p>;
            })}
        </>
    );
};

// Handle **bold** and `code` inline
const parseInline = (text) => {
    // Simple parser: split by ** then by `
    // Note: This is a very basic parser. 

    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={i} className="inline-code">{part.slice(1, -1)}</code>;
        }
        return part;
    });
};

export default SimpleMarkdown;
