type NotionIframeProps = {
  pageId: string;
  title: string;
  /** default desktop height (px) */
  height?: number;
  /** mobile height (px, for screens < 640px) */
  mobileHeight?: number;
};

export default function NotionIframe({
  pageId,
  title,
  height = 700,
  mobileHeight = 500,
}: NotionIframeProps) {
  // make a safe unique id for scoping the media query
  const elId = `notion-${pageId.slice(0,8)}`;

  return (
    <div
      id={elId}
    >
      {/* Scoped CSS to switch heights by breakpoint */}
      <style>
        {`
          #${elId} iframe { width: 100%; height: ${mobileHeight}px; border: 0; }
          @media (min-width: 640px) {
            #${elId} iframe { height: ${height}px; }
          }
        `}
      </style>

      <iframe
        src={`https://v2-embednotion.com/${pageId}`}
        title={title}
        loading="lazy"
        referrerPolicy="no-referrer"
        allowFullScreen
      />

      <noscript>
        <a href={`https://v2-embednotion.com/${pageId}`} target="_blank" rel="noreferrer">
          Open in Notion
        </a>
      </noscript>
    </div>
  );
}