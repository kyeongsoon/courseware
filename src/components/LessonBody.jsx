import { Fragment } from 'react';

// 본문 글을 그대로 보여 주되, 그 안의 http(s) 주소만 링크로 바꿈.
// HTML 로 해석하지 않으므로 본문에 무엇을 써도 스크립트가 실행되지 않음.
const URL_RE = /(https?:\/\/[^\s<>"')\]]+)/g;

function linkify(text) {
  return text.split(URL_RE).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

export default function LessonBody({ text }) {
  if (!text?.trim()) return null;
  return (
    <div className="lesson-body">
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i}>{linkify(para)}</p>
      ))}
    </div>
  );
}
