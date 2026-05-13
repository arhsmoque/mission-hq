interface PinyinRubyProps {
  html: string;
}

export default function PinyinRuby({ html }: PinyinRubyProps) {
  return (
    <div
      className="rounded-2xl bg-surface p-5 border border-border text-lg leading-loose"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
