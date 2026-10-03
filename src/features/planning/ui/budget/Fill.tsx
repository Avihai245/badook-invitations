import { Fragment, type ReactNode } from 'react';

/** A dictionary line with {placeholders} filled by elements (an amount in <Money />, a name in bold). */
export function Fill({ text, vars }: { text: string; vars: Record<string, ReactNode> }) {
  const parts = text.split(/(\{\w+\})/g);
  return (
    <>
      {parts.map((part, i) => {
        const key = /^\{(\w+)\}$/.exec(part)?.[1];
        return <Fragment key={i}>{key !== undefined && key in vars ? vars[key] : part}</Fragment>;
      })}
    </>
  );
}
